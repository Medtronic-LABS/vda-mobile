import type { ChatMessage, LanguageCode } from '../types';
import { getChatMessageSpeechText, getChatMessageText } from '../utils/vdaEngine';

const MAX_TTS_CHARS = 2200;
const AUTO_SUMMARY_CHARS = 650;

// A broad safety signal deliberately favors reading the full answer. A missed
// opportunity to shorten speech is preferable to omitting clinical advice.
const clinicalInstruction = /\b(emergency|urgent|immediately|ambulance|warning|severe|hospital|doctor|medicine|medication|prescription|tablet|dose|mg|do not|stop taking|seek care|call 112)\b|आपात|तुरंत|अस्पताल|डॉक्टर|दवा|खुराक|गोली|चेतावनी|गंभीर|मत लें|அவசர|மருந்து|ತುರ್ತು|ಔಷಧಿ/iu;

export interface SpokenPlan {
  chunks: string[];
  summarized: boolean;
}

/** Speak an explicitly labeled original answer in its script after a language switch. */
export function speechLanguageForText(text: string, selected: LanguageCode): LanguageCode {
  if (/[\u0900-\u097F]/u.test(text)) return 'hi';
  if (/[\u0B80-\u0BFF]/u.test(text)) return 'ta';
  if (/[\u0C80-\u0CFF]/u.test(text)) return 'kn';
  return selected;
}

/** Splits at sentence or word boundaries; no text is discarded. */
export function splitSpokenText(value: string): string[] {
  const text = value.replace(/\s+/gu, ' ').trim();
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_TTS_CHARS) {
    const window = remaining.slice(0, MAX_TTS_CHARS + 1);
    const sentences = [...window.matchAll(/[.!?।॥]\s+/gu)];
    const sentenceEnd = sentences.at(-1)?.index;
    const wordEnd = window.lastIndexOf(' ');
    const boundary = sentenceEnd !== undefined && sentenceEnd > MAX_TTS_CHARS / 2
      ? sentenceEnd + 1 : wordEnd > 0 ? wordEnd : MAX_TTS_CHARS;
    // Preserve even an unusually long unbroken token as a last resort.
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function buildSpokenPlan(message: ChatMessage, lang: LanguageCode, automatic: boolean): SpokenPlan {
  const full = getChatMessageSpeechText(message, lang).trim();
  if (!full) return { chunks: [], summarized: false };
  if (!automatic || full.length <= AUTO_SUMMARY_CHARS) {
    return { chunks: splitSpokenText(full), summarized: false };
  }

  const safetyCritical = message.agent === 'safety_gate'
    || message.agent === 'clinician_escalation'
    || message.isEscalationTrigger
    || message.prescriptionScoped
    || message.provenance === 'PRESCRIPTION'
    || message.provenance === 'PRESCRIPTION_AND_KNOWLEDGE'
    || clinicalInstruction.test(full);
  if (safetyCritical) return { chunks: splitSpokenText(full), summarized: false };

  // Only the backend's short structured scheme summary is suitable for
  // automatic shortening. Other long answers remain visible and can be read
  // completely with the manual control; we cannot infer what may be omitted.
  if (message.agent !== 'scheme' || !message.sections?.length) {
    return { chunks: [], summarized: false };
  }
  const summary = getChatMessageText(message, lang).trim();
  const concise = summary.length <= AUTO_SUMMARY_CHARS ? summary : '';
  if (!concise) return { chunks: [], summarized: false };
  const cue = lang === 'hi' ? 'पूरा जवाब स्क्रीन पर पढ़ें।'
    : lang === 'ta' ? 'முழு பதிலை திரையில் படிக்கவும்.'
      : lang === 'kn' ? 'ಸಂಪೂರ್ಣ ಉತ್ತರವನ್ನು ಪರದೆಯಲ್ಲಿ ಓದಿ.'
        : 'Read the full answer on screen.';
  return { chunks: splitSpokenText(`${concise} ${cue}`), summarized: true };
}
