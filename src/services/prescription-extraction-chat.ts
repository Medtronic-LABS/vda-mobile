import type { PatientPrescriptionLatestSubmission } from './api';
import type { ChatMessage } from '../types';

/** Formats only the patient-safe API projection. This never starts a VDA turn. */
export const pendingPrescriptionChatContent = (
  submission: PatientPrescriptionLatestSubmission | null,
  hasActivePlan: boolean,
): { text: string; sections: NonNullable<ChatMessage['sections']> } | null => {
  if (!submission?.extractedDetails || !['PENDING_VERIFICATION', 'UNVERIFIED'].includes(submission.verificationStatus)) {
    return null;
  }

  const { medications, investigations } = submission.extractedDetails;
  const sections: NonNullable<ChatMessage['sections']> = [];
  if (submission.extractionStatus === 'REVIEW_REQUIRED') {
    sections.push({ body: 'कुछ लिखावट साफ़ नहीं है। स्वास्थ्यकर्मी नीचे दी गई जानकारी की जाँच करेंगे।' });
  }
  if (medications.length) {
    sections.push({
      title: 'दवाइयाँ',
      bullets: medications.map((medicine) => [
        medicine.name,
        ...[medicine.strength, medicine.frequency, medicine.timing].filter((value): value is string => Boolean(value)),
        ...(medicine.uncertain ? ['लिखावट स्पष्ट नहीं है'] : []),
      ].join(' — ')),
    });
  }
  if (investigations.length) {
    sections.push({
      title: 'जाँच',
      bullets: investigations.map((test) => `${test.name}${test.uncertain ? ' — लिखावट स्पष्ट नहीं है' : ''}`),
    });
  }
  if (!medications.length && !investigations.length) {
    sections.push({ body: 'पर्ची में कोई दवा या जाँच अभी स्पष्ट रूप से नहीं पढ़ी जा सकी।' });
  }
  sections.push({
    title: '⏳ सत्यापन बाकी है',
    body: 'यह जानकारी आपकी पर्ची से AI द्वारा निकाली गई है और अभी स्वास्थ्यकर्मी द्वारा सत्यापित नहीं है। सत्यापन के बाद ही इस पर्ची से दवा रिमाइंडर शुरू किए जा सकते हैं।',
  });
  return {
    text: hasActivePlan ? 'आपकी नई पर्ची से मुझे यह जानकारी मिली है:' : 'आपकी पर्ची से मुझे यह जानकारी मिली है:',
    sections,
  };
};
