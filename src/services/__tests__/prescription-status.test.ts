import { describe, expect, it } from 'vitest';
import { prescriptionToReminderDraft } from '../medicine-reminder.service';

describe('patient prescription decision state', () => {
  it.each(['REJECTED', 'NEEDS_RESUBMISSION'] as const)(
    'preserves the patient-facing reason but creates no actionable medicines for %s',
    (verificationStatus) => {
      const draft = prescriptionToReminderDraft('patient-a', {
        id: 'replacement-b',
        verificationStatus,
        activePlan: false,
        patientReviewReason: 'Please upload the complete prescription.',
        medications: [{ medicationName: 'Unverified medicine', strength: '40 mg' }],
      });

      expect(draft.patientReviewReason).toBe('Please upload the complete prescription.');
      expect(draft.medicines).toEqual([]);
      expect(draft.activePlan).toBe(false);
    },
  );
});
