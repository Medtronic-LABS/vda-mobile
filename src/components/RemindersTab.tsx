import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  Pill, 
  Plus, 
  Trash2, 
  Upload, 
  AlertCircle, 
  ShieldCheck, 
  Calendar, 
  Flame,
  Check
} from 'lucide-react';
import { LanguageCode } from '../types';
import { 
  LocalMedicineReminder, 
  MedicineReminderSnapshot,
  PatientAdherenceAction,
  PrescriptionReminderDraft,
} from '../services/medicine-reminder.service';
import { playChime } from '../utils/i18n';
import type { PatientPrescriptionLatestSubmission } from '../services/api';

interface RemindersTabProps {
  lang: LanguageCode;
  snapshot: MedicineReminderSnapshot;
  prescriptionState: PrescriptionReminderDraft | null;
  latestSubmission?: PatientPrescriptionLatestSubmission | null;
  contextSyncError: string | null;
  onRecordAdherence: (reminderId: string, time: string, action: PatientAdherenceAction) => Promise<void>;
  onSnooze: (reminderId: string, time: string) => Promise<void>;
  onDeleteReminder: (reminderId: string) => Promise<void>;
  onEnableNotifications: () => Promise<void>;
  onOpenUploadPrescription: () => void;
  onResubmitPrescription: () => void;
  onClearAllReminders: () => Promise<void>;
}

export const RemindersTab: React.FC<RemindersTabProps> = ({
  lang,
  snapshot,
  prescriptionState,
  latestSubmission,
  contextSyncError,
  onRecordAdherence,
  onSnooze,
  onDeleteReminder,
  onEnableNotifications,
  onOpenUploadPrescription,
  onResubmitPrescription,
  onClearAllReminders
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const t = {
    hi: {
      title: 'मेरी दवाइयां व रिमाइंडर',
      subtitle: 'रिमाइंडर समय इस फ़ोन में सेव रहते हैं',
      uploadRx: 'पर्ची अपलोड करें',
      configureReminders: 'रिमाइंडर समय चुनें',
      verifiedPrescription: 'स्वास्थ्यकर्मी द्वारा सत्यापित दवाइयाँ',
      verifiedNoReminders: 'इन दवाइयों के लिए रिमाइंडर समय अभी नहीं चुना गया है।',
      pendingVerification: 'आपकी पर्ची स्वास्थ्यकर्मी की जाँच में है। सत्यापन के बाद दवाइयाँ और रिमाइंडर विकल्प यहाँ दिखेंगे।',
      verificationPending: 'जाँच जारी है',
      rejectedPrescription: 'पर्ची सत्यापित नहीं हो सकी। कृपया सही पर्ची अपलोड करें।',
      resubmitPrescription: 'पर्ची साफ़ नहीं है। कृपया साफ़ फोटो या PDF दोबारा अपलोड करें।',
      rejectedTitle: 'पर्ची स्वीकार नहीं हुई',
      resubmitTitle: 'पर्ची की साफ़ फोटो चाहिए',
      rejectedFallback: 'स्वास्थ्यकर्मी इस पर्ची को सत्यापित नहीं कर पाए।',
      resubmitFallback: 'स्वास्थ्यकर्मी को पर्ची की साफ़ फोटो या PDF चाहिए।',
      rejectedGuidance: 'कारण समझने के लिए स्वास्थ्यकर्मी से संपर्क करें। सही या नई पर्ची हो तो उसे दोबारा अपलोड कर सकते हैं।',
      resubmitGuidance: 'पर्ची को अच्छी रोशनी में पूरा और साफ़ दिखाते हुए नई फोटो या PDF अपलोड करें।',
      submitAgain: 'दूसरी पर्ची अपलोड करें',
      todayProgress: 'आज की दवा प्रगति',
      remindersCompleted: 'दवाएँ लेने की पुष्टि',
      streakDays: 'दिन का अटूट नियम',
      notificationsOff: 'नोटिफिकेशन बंद हैं। समय पर अलर्ट पाने के लिए अनुमति दें।',
      notificationsUnavailable: 'इस ब्राउज़र में डिवाइस नोटिफिकेशन शेड्यूल नहीं किए जा सकते। समय पर फोन अलर्ट के लिए Android ऐप का उपयोग करें।',
      enableNotifications: 'नोटिफिकेशन चालू करें',
      scheduleMorning: 'सुबह की खुराक',
      scheduleAfternoon: 'दोपहर की खुराक',
      scheduleEvening: 'शाम / रात की खुराक',
      markTaken: 'ले ली',
      taken: 'पूर्ण',
      noReminders: 'अभी कोई दवा रिमाइंडर नहीं है।',
      noRemindersSub: 'डॉक्टर का पर्चा अपलोड करें या अपनी दवाइयां जोड़ें।',
      privacyNotice: '🔒 पर्ची VDA सेवा द्वारा प्रोसेस और सेव की जा सकती है। आपके चुने रिमाइंडर समय इस फ़ोन में रहते हैं।',
      clearAll: 'सभी रिमाइंडर हटाएं',
      confirmClear: 'क्या आप वाकई सभी रिमाइंडर हटाना चाहते हैं?'
    },
    en: {
      title: 'My Medicines & Reminders',
      subtitle: 'Reminder times are stored on this phone',
      uploadRx: 'Upload Prescription',
      configureReminders: 'Choose reminder times',
      verifiedPrescription: 'Medicines verified by a health worker',
      verifiedNoReminders: 'Reminder times have not been selected for these medicines yet.',
      pendingVerification: 'Your prescription is awaiting health-worker verification. Medicines and reminder options will appear here after verification.',
      verificationPending: 'Verification pending',
      rejectedPrescription: 'The prescription could not be verified. Please upload the correct prescription.',
      resubmitPrescription: 'The prescription is unclear. Please upload a clearer photo or PDF.',
      rejectedTitle: 'Prescription not accepted',
      resubmitTitle: 'A clearer prescription is needed',
      rejectedFallback: 'The health worker could not verify this prescription.',
      resubmitFallback: 'The health worker needs a clearer photo or PDF of the prescription.',
      rejectedGuidance: 'Contact the health worker if you need help understanding the decision. You may upload a correct or new prescription.',
      resubmitGuidance: 'Upload a new photo or PDF showing the complete prescription clearly in good light.',
      submitAgain: 'Upload another prescription',
      todayProgress: "Today's Medicine Adherence",
      remindersCompleted: 'doses marked taken',
      streakDays: 'day adherence streak',
      notificationsOff: 'Notifications are off. Enable them for timely reminders.',
      notificationsUnavailable: 'This browser cannot schedule device notifications. Use the Android app for timed phone alerts.',
      enableNotifications: 'Enable Notifications',
      scheduleMorning: 'Morning Dose',
      scheduleAfternoon: 'Afternoon Dose',
      scheduleEvening: 'Evening / Night Dose',
      markTaken: 'Mark Taken',
      taken: 'Taken',
      noReminders: 'No active medicine reminders.',
      noRemindersSub: 'Upload a prescription or add your medications to begin.',
      privacyNotice: '🔒 Prescriptions may be processed and stored by the VDA service. Your chosen reminder times stay on this phone.',
      clearAll: 'Clear All Reminders',
      confirmClear: 'Are you sure you want to delete all local reminders?'
    },
    ta: {
      title: 'எனது மருந்துகள் & நினைவூட்டல்',
      subtitle: 'நினைவூட்டல் நேரங்கள் இந்த தொலைபேசியில் இருக்கும்',
      uploadRx: 'மருந்துச் சீட்டைப் பதிவேற்றவும்',
      configureReminders: 'நினைவூட்டல் நேரத்தைத் தேர்வு செய்க',
      verifiedPrescription: 'சுகாதாரப் பணியாளர் சரிபார்த்த மருந்துகள்',
      verifiedNoReminders: 'இந்த மருந்துகளுக்கு நினைவூட்டல் நேரம் இன்னும் தேர்வு செய்யப்படவில்லை.',
      pendingVerification: 'உங்கள் மருந்துச் சீட்டு சுகாதாரப் பணியாளர் சரிபார்ப்பில் உள்ளது.',
      verificationPending: 'சரிபார்ப்பு நடைபெறுகிறது',
      rejectedPrescription: 'மருந்துச் சீட்டை சரிபார்க்க முடியவில்லை. சரியான சீட்டை பதிவேற்றவும்.',
      resubmitPrescription: 'மருந்துச் சீட்டு தெளிவாக இல்லை. தெளிவான படம் அல்லது PDF ஐ மீண்டும் பதிவேற்றவும்.',
      rejectedTitle: 'மருந்துச் சீட்டு ஏற்கப்படவில்லை',
      resubmitTitle: 'தெளிவான மருந்துச் சீட்டு தேவை',
      rejectedFallback: 'சுகாதாரப் பணியாளர் இந்த மருந்துச் சீட்டைச் சரிபார்க்க முடியவில்லை.',
      resubmitFallback: 'சுகாதாரப் பணியாளருக்கு தெளிவான படம் அல்லது PDF தேவை.',
      rejectedGuidance: 'மேலும் விளக்கத்திற்கு சுகாதாரப் பணியாளரை தொடர்பு கொள்ளுங்கள். சரியான அல்லது புதிய சீட்டை மீண்டும் பதிவேற்றலாம்.',
      resubmitGuidance: 'முழு மருந்துச் சீட்டும் தெளிவாகத் தெரியும்படி புதிய படம் அல்லது PDF ஐ பதிவேற்றவும்.',
      submitAgain: 'மற்றொரு சீட்டை பதிவேற்றவும்',
      todayProgress: 'இன்றைய மருந்துகள்',
      remindersCompleted: 'மருந்துகள் எடுத்ததாக பதிவு',
      streakDays: 'நாட்கள் தொடர்ச்சி',
      notificationsOff: 'அறிவிப்புகள் முடக்கப்பட்டுள்ளன.',
      notificationsUnavailable: 'இந்த உலாவியில் சாதன அறிவிப்புகளை திட்டமிட முடியாது. நேர அலர்ட்களுக்கு Android பயன்பாட்டைப் பயன்படுத்தவும்.',
      enableNotifications: 'அறிவிப்புகளை இயக்கு',
      scheduleMorning: 'காலை அளவு',
      scheduleAfternoon: 'மதிய அளவு',
      scheduleEvening: 'இரவு அளவு',
      markTaken: 'எடுத்துக்கொண்டேன்',
      taken: 'முடிந்தது',
      noReminders: 'நினைவூட்டல்கள் எதுவும் இல்லை.',
      noRemindersSub: 'தொடங்க மருந்துச் சீட்டைப் பதிவேற்றவும்.',
      privacyNotice: '🔒 மருந்துச் சீட்டு VDA சேவையால் செயலாக்கப்பட்டு சேமிக்கப்படலாம். நினைவூட்டல் நேரங்கள் இந்த தொலைபேசியில் இருக்கும்.',
      clearAll: 'அனைத்தையும் நீக்கு',
      confirmClear: 'நிச்சயமாக நீக்க விரும்புகிறீர்களா?'
    },
    kn: {
      title: 'ನನ್ನ ಔಷಧಿಗಳು & ಜ್ಞಾಪನೆ',
      subtitle: 'ರಿಮೈಂಡರ್ ಸಮಯಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಇರುತ್ತವೆ',
      uploadRx: 'ಚೀಟಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
      configureReminders: 'ಜ್ಞಾಪನೆ ಸಮಯ ಆಯ್ಕೆಮಾಡಿ',
      verifiedPrescription: 'ಆರೋಗ್ಯ ಕಾರ್ಯಕರ್ತರು ಪರಿಶೀಲಿಸಿದ ಔಷಧಿಗಳು',
      verifiedNoReminders: 'ಈ ಔಷಧಿಗಳಿಗೆ ಜ್ಞಾಪನೆ ಸಮಯವನ್ನು ಇನ್ನೂ ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ.',
      pendingVerification: 'ನಿಮ್ಮ ಚೀಟಿ ಆರೋಗ್ಯ ಕಾರ್ಯಕರ್ತರ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.',
      verificationPending: 'ಪರಿಶೀಲನೆ ನಡೆಯುತ್ತಿದೆ',
      rejectedPrescription: 'ಚೀಟಿಯನ್ನು ಪರಿಶೀಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಸರಿಯಾದ ಚೀಟಿಯನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
      resubmitPrescription: 'ಚೀಟಿ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಸ್ಪಷ್ಟವಾದ ಚಿತ್ರ ಅಥವಾ PDF ಅನ್ನು ಮತ್ತೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
      rejectedTitle: 'ಚೀಟಿಯನ್ನು ಸ್ವೀಕರಿಸಲಾಗಿಲ್ಲ',
      resubmitTitle: 'ಸ್ಪಷ್ಟವಾದ ಚೀಟಿ ಅಗತ್ಯವಿದೆ',
      rejectedFallback: 'ಆರೋಗ್ಯ ಕಾರ್ಯಕರ್ತರು ಈ ಚೀಟಿಯನ್ನು ಪರಿಶೀಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.',
      resubmitFallback: 'ಆರೋಗ್ಯ ಕಾರ್ಯಕರ್ತರಿಗೆ ಸ್ಪಷ್ಟವಾದ ಚಿತ್ರ ಅಥವಾ PDF ಅಗತ್ಯವಿದೆ.',
      rejectedGuidance: 'ಕಾರಣ ತಿಳಿಯಲು ಆರೋಗ್ಯ ಕಾರ್ಯಕರ್ತರನ್ನು ಸಂಪರ್ಕಿಸಿ. ಸರಿಯಾದ ಅಥವಾ ಹೊಸ ಚೀಟಿಯನ್ನು ಮತ್ತೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಬಹುದು.',
      resubmitGuidance: 'ಪೂರ್ಣ ಚೀಟಿ ಸ್ಪಷ್ಟವಾಗಿ ಕಾಣುವಂತೆ ಹೊಸ ಚಿತ್ರ ಅಥವಾ PDF ಅನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
      submitAgain: 'ಮತ್ತೊಂದು ಚೀಟಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
      todayProgress: 'ಇಂದಿನ ಔಷಧಿ ಪ್ರಗತಿ',
      remindersCompleted: 'ತೆಗೆದುಕೊಂಡ ಔಷಧಿಗಳು',
      streakDays: 'ದಿನಗಳ ಸತತ ಬಳಕೆ',
      notificationsOff: 'ಅಧಿಸೂಚನೆಗಳು ಆಫ್ ಆಗಿವೆ.',
      notificationsUnavailable: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಸಾಧನ ಅಧಿಸೂಚನೆಗಳನ್ನು ನಿಗದಿಪಡಿಸಲಾಗುವುದಿಲ್ಲ. ಸಮಯದ ಫೋನ್ ಎಚ್ಚರಿಕೆಗಳಿಗೆ Android ಅಪ್ಲಿಕೇಶನ್ ಬಳಸಿ.',
      enableNotifications: 'ಅಧಿಸೂಚನೆಗಳನ್ನು ಆನ್ ಮಾಡಿ',
      scheduleMorning: 'ಬೆಳಗಿನ ಡೋಸ್',
      scheduleAfternoon: 'ಮಧ್ಯಾಹ್ನದ ಡೋಸ್',
      scheduleEvening: 'ರಾತ್ರಿಯ ಡೋಸ್',
      markTaken: 'ತೆಗೆದುಕೊಂಡಿದ್ದೇನೆ',
      taken: 'ತೆಗೆದುಕೊಂಡಾಗಿದೆ',
      noReminders: 'ಯಾವುದೇ ಜ್ಞಾಪನೆಗಳಿಲ್ಲ.',
      noRemindersSub: 'ಪ್ರಾರಂಭಿಸಲು ವೈದ್ಯರ ಚೀಟಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
      privacyNotice: '🔒 ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಅನ್ನು VDA ಸೇವೆ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಿ ಸಂಗ್ರಹಿಸಬಹುದು. ರಿಮೈಂಡರ್ ಸಮಯಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಇರುತ್ತವೆ.',
      clearAll: 'ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ',
      confirmClear: 'ಖಚಿತವಾಗಿ ಅಳಿಸಲು ಬಯಸುವಿರಾ?'
    }
  }[lang];

  const verifiedPrescription = snapshot.activePrescription?.verificationStatus === 'VERIFIED'
    && snapshot.activePrescription.activePlan
    ? snapshot.activePrescription
    : null;
  const pendingSubmission = latestSubmission
    && latestSubmission.id !== verifiedPrescription?.id
    && latestSubmission.extractedDetails
    && (latestSubmission.verificationStatus === 'PENDING_VERIFICATION' || latestSubmission.verificationStatus === 'UNVERIFIED')
    ? latestSubmission : null;
  const verificationStatus = prescriptionState?.verificationStatus;
  const isPendingVerification = Boolean(pendingSubmission) || verificationStatus === 'PENDING_VERIFICATION' || verificationStatus === 'UNVERIFIED';
  const hasDecisionGuidance = verificationStatus === 'REJECTED' || verificationStatus === 'NEEDS_RESUBMISSION';
  const hasConfiguredReminders = snapshot.reminders.length > 0;

  const adherenceText: Record<LanguageCode, Record<PatientAdherenceAction | 'SNOOZED', string>> = {
    hi: { TAKEN: 'ले ली', SKIPPED: 'छोड़ दी', NOT_TAKEN: 'नहीं ली', SNOOZED: 'बाद में' },
    en: { TAKEN: 'Taken', SKIPPED: 'Skip', NOT_TAKEN: 'Not taken', SNOOZED: 'Later' },
    ta: { TAKEN: 'எடுத்தேன்', SKIPPED: 'தவிர்த்தேன்', NOT_TAKEN: 'எடுக்கவில்லை', SNOOZED: 'பிறகு' },
    kn: { TAKEN: 'ತೆಗೆದುಕೊಂಡೆ', SKIPPED: 'ಬಿಟ್ಟೆ', NOT_TAKEN: 'ತೆಗೆದುಕೊಳ್ಳಲಿಲ್ಲ', SNOOZED: 'ನಂತರ' },
  };

  const handleRecordAdherence = async (reminder: LocalMedicineReminder, time: string, action: PatientAdherenceAction) => {
    const key = `${reminder.id}:${time}`;
    if (snapshot.todayOutcomeByKey[key] === action) return;

    setBusyAction(key);
    playChime('success');
    try {
      await onRecordAdherence(reminder.id, time, action);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSnooze = async (reminder: LocalMedicineReminder, time: string) => {
    const key = `${reminder.id}:${time}`;
    setBusyAction(key);
    try { await onSnooze(reminder.id, time); }
    finally { setBusyAction(null); }
  };

  const handleDelete = async (reminderId: string) => {
    setBusyAction(reminderId);
    playChime('start');
    try {
      await onDeleteReminder(reminderId);
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm(t.confirmClear)) {
      await onClearAllReminders();
      playChime('start');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <Pill className="w-4 h-4 text-emerald-400" />
            <span>{t.title}</span>
          </h1>
          <p className="text-[10px] text-emerald-400 font-medium">{t.subtitle}</p>
        </div>

        {/* A verified plan configures reminders; only an absent/unusable plan asks for upload. */}
        {isPendingVerification && !verifiedPrescription ? (
          <span className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-[11px] font-bold text-amber-200">
            {t.verificationPending}
          </span>
        ) : (
          <button
            type="button"
            onClick={hasDecisionGuidance && !verifiedPrescription ? onResubmitPrescription : onOpenUploadPrescription}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all"
          >
            {verifiedPrescription ? <Bell className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{verifiedPrescription ? t.configureReminders : t.uploadRx}</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-12">
        {contextSyncError && (
          <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-950/25 p-3 text-xs text-amber-100">
            {contextSyncError}
          </p>
        )}
        {hasDecisionGuidance && prescriptionState && (
          <section className="rounded-2xl border border-red-500/35 bg-red-950/25 p-4 space-y-3" role="status">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
              <div>
                <h3 className="text-sm font-bold text-red-100">
                  {verificationStatus === 'NEEDS_RESUBMISSION' ? t.resubmitTitle : t.rejectedTitle}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-100">
                  {prescriptionState.patientReviewReason || (verificationStatus === 'NEEDS_RESUBMISSION' ? t.resubmitFallback : t.rejectedFallback)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {verificationStatus === 'NEEDS_RESUBMISSION' ? t.resubmitGuidance : t.rejectedGuidance}
                </p>
              </div>
            </div>
            <button type="button" onClick={onResubmitPrescription} className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950">
              {t.submitAgain}
            </button>
          </section>
        )}
        {pendingSubmission && (
          <section className="rounded-2xl border border-amber-400/35 bg-amber-950/20 p-4 space-y-3" role="status" aria-label="Pending prescription extraction">
            <div className="flex items-center gap-2 text-amber-200">
              <Clock className="h-4 w-4" />
              <h3 className="text-sm font-bold">{lang === 'hi' ? 'आपकी नई पर्ची से मिली जानकारी' : 'Information found in your new prescription'}</h3>
            </div>
            <p className="text-xs font-semibold text-amber-100">{lang === 'hi' ? '⏳ सत्यापन बाकी है' : '⏳ Verification pending'}</p>
            {pendingSubmission.extractionStatus === 'REVIEW_REQUIRED' && (
              <p className="text-xs text-amber-100">{lang === 'hi' ? 'कुछ लिखावट साफ़ नहीं है। नीचे दी गई जानकारी की स्वास्थ्यकर्मी जाँच करेंगे।' : 'Some extracted information is unclear and needs health-worker review.'}</p>
            )}
            {!!pendingSubmission.extractedDetails?.medications.length && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-200">{lang === 'hi' ? 'दवाइयाँ' : 'Medicines'}</p>
                <ul className="space-y-1.5">
                  {pendingSubmission.extractedDetails.medications.map((medicine, index) => (
                    <li key={`${medicine.name}-${index}`} className="rounded-xl border border-amber-500/15 bg-slate-950/40 px-3 py-2 text-sm text-slate-100">
                      <span className="font-semibold">{medicine.name}</span>
                      {[medicine.strength, medicine.frequency, medicine.timing].filter(Boolean).map((detail, detailIndex) => <span key={detailIndex} className="block text-xs text-slate-300">{detail}</span>)}
                      {medicine.uncertain && <span className="text-xs text-amber-200">{lang === 'hi' ? 'यह जानकारी स्पष्ट नहीं है' : 'This detail is unclear'}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!pendingSubmission.extractedDetails?.investigations.length && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-200">{lang === 'hi' ? 'जाँच' : 'Tests'}</p>
                <ul className="space-y-1 text-sm text-slate-100">
                  {pendingSubmission.extractedDetails.investigations.map((test, index) => (
                    <li key={`${test.name}-${index}`}>• {test.name}{test.uncertain ? (lang === 'hi' ? ' — स्पष्ट नहीं' : ' — unclear') : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            {!pendingSubmission.extractedDetails?.medications.length && !pendingSubmission.extractedDetails?.investigations.length && (
              <p className="text-xs text-slate-300">{lang === 'hi' ? 'अभी कोई दवा या जाँच स्पष्ट रूप से नहीं पढ़ी जा सकी।' : 'No medicine or test could be read clearly yet.'}</p>
            )}
            <p className="text-xs leading-relaxed text-slate-300">{lang === 'hi'
              ? 'यह जानकारी AI ने आपकी अपलोड की हुई पर्ची से निकाली है। यह अभी स्वास्थ्यकर्मी द्वारा सत्यापित नहीं है। सत्यापन के बाद ही इस पर्ची से दवा रिमाइंडर शुरू किए जा सकते हैं।'
              : 'AI extracted this from your upload. A health worker has not verified it. Reminders for this prescription can start only after verification.'}</p>
          </section>
        )}
        {/* Adherence Progress Banner */}
        <div className="p-4 rounded-3xl bg-gradient-to-tr from-slate-900 via-emerald-950/60 to-slate-900 border border-emerald-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                {t.todayProgress}
              </p>
              <h2 className="text-xl font-black text-white mt-0.5">
                {snapshot.progress.takenToday} / {snapshot.progress.scheduledToday} {t.remindersCompleted}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mt-3">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
              style={{
                width: `${snapshot.progress.scheduledToday > 0 ? (snapshot.progress.takenToday / snapshot.progress.scheduledToday) * 100 : 0}%`
              }}
            />
          </div>

          {/* Streak Indicator */}
          {snapshot.progress.currentStreakDays > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-300 font-bold">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>{snapshot.progress.currentStreakDays} {t.streakDays}</span>
            </div>
          )}
        </div>

        {/* Notification Permission Callout */}
        {snapshot.notificationPermission !== 'granted' && (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-[11px] leading-snug">{snapshot.notificationPermission === 'unavailable' ? t.notificationsUnavailable : t.notificationsOff}</p>
            </div>
            {snapshot.notificationPermission !== 'unavailable' && <button
              type="button"
              onClick={onEnableNotifications}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold whitespace-nowrap"
            >
              {t.enableNotifications}
            </button>}
          </div>
        )}

        {/* Medicines List */}
        {!hasConfiguredReminders && verifiedPrescription ? (
          <div className="rounded-3xl bg-slate-900/60 border border-emerald-500/30 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-100">{t.verifiedPrescription}</h3>
                <p className="text-xs text-slate-400 mt-1">{t.verifiedNoReminders}</p>
              </div>
            </div>
            <div className="space-y-2">
              {verifiedPrescription.medicines.map((medicine) => (
                <div key={medicine.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <p className="text-sm font-bold text-white">{medicine.medicineName}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {medicine.dosageText}{medicine.frequency ? ` • ${medicine.frequency}` : ''}
                  </p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenUploadPrescription}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4" />
              <span>{t.configureReminders}</span>
            </button>
          </div>
        ) : !hasConfiguredReminders && isPendingVerification && pendingSubmission ? null : !hasConfiguredReminders && isPendingVerification ? (
          <div className="rounded-3xl bg-slate-900/50 border border-amber-500/30 p-5 text-center">
            <Clock className="w-7 h-7 text-amber-400 mx-auto" />
            <p className="mt-3 text-sm text-amber-100">{t.pendingVerification}</p>
          </div>
        ) : hasDecisionGuidance ? null : !hasConfiguredReminders ? (
          <div className="text-center py-10 px-4 rounded-3xl bg-slate-900/50 border border-slate-800/80 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t.noReminders}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                {t.noRemindersSub}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenUploadPrescription}
              className="mt-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-emerald-950/50 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>{t.uploadRx}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshot.reminders.map((reminder) => (
              <div 
                key={reminder.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 mt-0.5">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{reminder.medicineName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {reminder.dosageText || 'As prescribed'}
                        {reminder.frequency ? ` • ${reminder.frequency}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(reminder.id)}
                    disabled={busyAction === reminder.id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all"
                    title="Delete reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Dose Times & Actions */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  {reminder.times.map((time, idx) => {
                    const doseKey = `${reminder.id}:${time}`;
                    const outcome = snapshot.todayOutcomeByKey[doseKey];
                    const isBusy = busyAction === doseKey;

                    return (
                      <div 
                        key={`${reminder.id}-${time}-${idx}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-bold text-white">{time}</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {(['TAKEN', 'SKIPPED', 'NOT_TAKEN'] as PatientAdherenceAction[]).map((action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => void handleRecordAdherence(reminder, time, action)}
                              disabled={outcome === action || isBusy}
                              className={`px-2 py-1 rounded-lg font-bold text-[10px] transition-all ${outcome === action
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'border border-slate-600 text-slate-200 hover:border-emerald-500/50'}`}
                            >
                              {outcome === action && action === 'TAKEN' && <Check className="mr-1 inline h-3 w-3" />}
                              {adherenceText[lang][action]}
                            </button>
                          ))}
                          <button type="button" onClick={() => void handleSnooze(reminder, time)} disabled={isBusy} className="px-2 py-1 rounded-lg border border-slate-700 text-[10px] font-semibold text-slate-400">
                            {adherenceText[lang].SNOOZED}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Clear All Button */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-slate-500 hover:text-red-400 font-medium transition-all"
              >
                {t.clearAll}
              </button>
            </div>
          </div>
        )}

        {/* Privacy Assurance Card */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-2.5 text-slate-400 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            {t.privacyNotice}
          </p>
        </div>
      </div>
    </div>
  );
};
