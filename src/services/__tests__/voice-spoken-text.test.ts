import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types';
import { buildSpokenPlan, speechLanguageForText, splitSpokenText } from '../voice-spoken-text';

const message = (text: string, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'voice-test', sender: 'vda', text, timestamp: '12:00', ...overrides,
});

describe('spoken answer safety', () => {
  it('uses the original answer language for speech after a language switch', () => {
    expect(speechLanguageForText('English translation unavailable. Original answer: बीपी जाँच कराएँ।', 'en')).toBe('hi');
    expect(speechLanguageForText('Check your blood pressure.', 'en')).toBe('en');
  });
  it('uses the dedicated speech text without visual section titles or repeated bullets', () => {
    const reply = message('आयुष्मान भारत योजना पात्र लोगों की मदद करती है।', {
      textHi: 'आयुष्मान भारत योजना पात्र लोगों की मदद करती है।',
      spokenSummary: 'आयुष्मान भारत योजना की पात्रता पहले जाँच लें।', spokenSummaryLang: 'hi',
      sections: [{ title: 'पात्रता', bullets: ['आयुष्मान भारत योजना पात्र लोगों की मदद करती है।'] }],
    });
    expect(buildSpokenPlan(reply, 'hi', false).chunks).toEqual(['आयुष्मान भारत योजना की पात्रता पहले जाँच लें।']);
    expect(buildSpokenPlan(reply, 'en', false).chunks.join(' ')).not.toContain('पात्रता पहले जाँच लें');
  });

  it('keeps older section details while skipping duplicate visual headings', () => {
    const reply = message('Check your eligibility.', {
      sections: [{ title: 'Eligibility', body: 'Check your eligibility.', bullets: ['Ask at the help desk.'] }],
    });
    expect(buildSpokenPlan(reply, 'en', false).chunks.join(' ')).toBe('Check your eligibility. Ask at the help desk.');
  });
  it('uses a concise automatic summary for a long non-clinical structured answer', () => {
    const reply = message('Here is a short overview.', {
      agent: 'scheme',
      sections: [{ body: 'Background information. '.repeat(90) }],
    });
    const plan = buildSpokenPlan(reply, 'en', true);
    expect(plan.summarized).toBe(true);
    expect(plan.chunks.join(' ')).toContain('Here is a short overview.');
    expect(plan.chunks.join(' ')).toContain('Read the full answer on screen.');
    expect(plan.chunks.join(' ')).not.toContain('Background information.');
  });

  it('reads all urgent English and Hindi advice without a character cut', () => {
    const english = message(`Seek urgent care immediately. ${'Call 112 if breathing worsens. '.repeat(100)}`);
    const hindi = message('अभी अस्पताल जाएँ।', { textHi: `तुरंत अस्पताल जाएँ। ${'सांस लेने में तकलीफ हो तो तुरंत मदद लें। '.repeat(80)}` });
    for (const [reply, lang] of [[english, 'en'], [hindi, 'hi']] as const) {
      const plan = buildSpokenPlan(reply, lang, true);
      expect(plan.summarized).toBe(false);
      expect(plan.chunks.length).toBeGreaterThan(1);
      expect(plan.chunks.every((chunk) => chunk.length <= 2200)).toBe(true);
      expect(plan.chunks.join(' ').replace(/\s+/g, ' ')).toBe(
        (lang === 'hi' ? reply.textHi : reply.text)!.trim().replace(/\s+/g, ' '),
      );
    }
  });

  it('keeps the complete manual Read Aloud text and skips unsafe automatic cuts', () => {
    const longUnpunctuated = 'information '.repeat(240);
    const reply = message(longUnpunctuated);
    expect(buildSpokenPlan(reply, 'en', true).chunks).toEqual([]);
    expect(buildSpokenPlan(reply, 'en', false).chunks.join(' ')).toBe(longUnpunctuated.trim());
    expect(splitSpokenText('unbroken'.repeat(400)).join('')).toBe('unbroken'.repeat(400));
  });

  it('keeps prescription instructions and Hindi summary cues in their intended mode', () => {
    const clinical = message('Summary.', {
      prescriptionScoped: true,
      sections: [{ body: 'Take the medicine after food. '.repeat(40) }],
    });
    expect(buildSpokenPlan(clinical, 'en', true).summarized).toBe(false);
    const hindi = message('Overview.', {
      agent: 'scheme',
      textHi: 'यह संक्षिप्त जानकारी है।',
      sections: [{ body: 'सामान्य जानकारी। '.repeat(90) }],
    });
    expect(buildSpokenPlan(hindi, 'hi', true).chunks.join(' ')).toContain('पूरा जवाब स्क्रीन पर पढ़ें।');
  });

  it('does not shorten a long clinical answer without explicit safety metadata', () => {
    const reply = message('General guidance. '.repeat(70), { agent: 'triage' });
    expect(buildSpokenPlan(reply, 'en', true).chunks).toEqual([]);
    expect(buildSpokenPlan(reply, 'en', false).chunks.join(' ')).toBe(reply.text.trim());
  });
});
