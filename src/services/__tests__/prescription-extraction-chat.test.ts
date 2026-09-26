import { describe, expect, it } from 'vitest';
import { pendingPrescriptionChatContent } from '../prescription-extraction-chat';
import type { PatientPrescriptionLatestSubmission } from '../api';

const submission = (overrides: Partial<PatientPrescriptionLatestSubmission> = {}): PatientPrescriptionLatestSubmission => ({
  id: 'pending-b', extractionStatus: 'EXTRACTED', verificationStatus: 'PENDING_VERIFICATION', activePlan: false,
  extractedDetails: { medications: [], investigations: [] },
  ...overrides,
});

describe('read-only prescription upload chat content', () => {
  it('shows only extracted medicine fields and investigations from the patient-safe response', () => {
    const result = pendingPrescriptionChatContent(submission({
      extractedDetails: {
        medications: [{ name: 'Telma 40', strength: '40 mg', frequency: 'once daily', timing: null, uncertain: false }],
        investigations: [{ name: 'HbA1c', uncertain: true }],
      },
    }), false);
    expect(result?.text).toContain('आपकी पर्ची');
    expect(result?.sections?.[0]).toMatchObject({ title: 'दवाइयाँ', bullets: ['Telma 40 — 40 mg — once daily'] });
    expect(result?.sections?.[1]).toMatchObject({ title: 'जाँच', bullets: ['HbA1c — लिखावट स्पष्ट नहीं है'] });
    expect(result?.sections?.[2].title).toContain('सत्यापन बाकी है');
    expect(JSON.stringify(result)).not.toMatch(/quickActions|reminderStepId|TAKEN|SKIPPED|NOT_TAKEN/);
  });

  it('does not invent absent strength, frequency, or timing', () => {
    const result = pendingPrescriptionChatContent(submission({
      extractedDetails: { medications: [{ name: 'Amlo', strength: null, frequency: null, timing: null, uncertain: true }], investigations: [] },
    }), false);
    expect(result?.sections?.[0].bullets).toEqual(['Amlo — लिखावट स्पष्ट नहीं है']);
  });

  it('labels a pending replacement as new without changing any active-plan data', () => {
    const current = submission({
      extractedDetails: { medications: [{ name: 'Extracted B', strength: null, frequency: null, timing: null, uncertain: false }], investigations: [] },
    });
    const result = pendingPrescriptionChatContent(current, true);
    expect(result?.text).toContain('नई पर्ची');
    expect(JSON.stringify(result)).toContain('Extracted B');
    expect(JSON.stringify(result)).not.toContain('Verified A');
    expect(current.activePlan).toBe(false);
  });

  it.each(['REJECTED', 'NEEDS_RESUBMISSION', 'VERIFIED', 'SUPERSEDED'])(
    'never presents %s extraction as pending/current', (verificationStatus) => {
      expect(pendingPrescriptionChatContent(submission({ verificationStatus }), false)).toBeNull();
    },
  );

  it('does not display extraction when the patient-safe API withheld it', () => {
    expect(pendingPrescriptionChatContent(submission({ extractedDetails: undefined }), false)).toBeNull();
  });
});
