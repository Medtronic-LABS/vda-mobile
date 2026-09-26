import React, { useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Sparkles, Pill, Building2, User } from 'lucide-react';
import { ChatMessage, ClinicalReviewFacility, Facility, FhirCondition, FhirDocument, FhirMedication, FhirObservation, HealthScheme, LanguageCode, PatientDemographics, UserProfile, userProfileToDemographics } from './types';
import { getTranslation, playChime } from './utils/i18n';
import { apiService, VdaApiError, type PatientPrescriptionCurrentState, type PatientPrescriptionLatestSubmission } from './services/api';
import { pendingPrescriptionChatContent } from './services/prescription-extraction-chat';
import { authService } from './services/auth.service';

// Tab & Modal Components
import { VdaTab } from './components/VdaTab';
import { RemindersTab } from './components/RemindersTab';
import { PatientFacilitiesTab } from './components/PatientFacilitiesTab';
import { ProfileTab } from './components/ProfileTab';
import { AuthScreen } from './components/AuthScreen';
import { LogVitalModal } from './components/LogVitalModal';
import { MedicineRemindersModal } from './components/MedicineRemindersModal';
import { MedicineReminderSnapshot, PatientAdherenceAction, PrescriptionReminderDraft, classifyPrescriptionMedicineQuery, isPrescriptionMedicineFollowUp, localPrescriptionToReminderDraft, medicineReminderService, parseReminderTime, prescriptionToReminderDraft } from './services/medicine-reminder.service';

const emptyMedicineReminderSnapshot: MedicineReminderSnapshot = {
  reminders: [],
  progress: { scheduledToday: 0, takenToday: 0, currentStreakDays: 0 },
  notificationPermission: 'unknown',
  todayTakenKeys: [],
  todayOutcomeByKey: {},
  activePrescription: null,
};

type ReminderSetupPhase = 'OFFER' | 'CONFIRM_MEDICINE' | 'ASK_TIME' | 'ASK_PERIOD' | 'CONFIRM_TIME' | 'ACTIVATE';
type ReminderSetup = {
  draft: PrescriptionReminderDraft;
  phase: ReminderSetupPhase;
  medicineIndex: number;
  timeIndex?: number;
  pendingTime?: string;
  pendingHour?: number;
  pendingMinute?: number;
};
type ReminderStepStatus = 'ACTIVE' | 'ANSWERED' | 'EXPIRED';
type ReminderResponseResult = { handled: boolean; answered: boolean };

const isAffirmative = (text: string) => /(?:^|\s)(?:हाँ|हां|ha|haan|yes|y|ठीक है|theek hai|ठीक|laga do|लगा दो|रिमाइंडर लगाएँ|चालू करें|चालू कर दो|activate)(?:$|\s)/i.test(text.trim());
const isNegative = (text: string) => /^(?:नहीं|nahi|nahin|no|अभी नहीं|abhi nahi)$/i.test(text.trim());
const isReminderActivationConfirmation = (text: string) => (
  isAffirmative(text)
  || /^(?:कर दो|कर दीजिए|चालू कर दें|चालू कर दीजिए|रिमाइंडर चालू करें|activate reminders)$/i.test(text.trim())
);
const reminderTimeLabel = (time: string, lang: LanguageCode) => {
  const [hourValue, minute] = time.split(':').map(Number);
  const period = hourValue < 12 ? (lang === 'hi' ? 'सुबह' : 'AM') : (lang === 'hi' ? 'रात' : 'PM');
  const hour = hourValue % 12 || 12;
  return lang === 'hi' ? `${period} ${hour}${minute ? `:${String(minute).padStart(2, '0')}` : ''} बजे` : `${hour}:${String(minute).padStart(2, '0')} ${period}`;
};

const defaultDemographics: PatientDemographics = {
  id: '',
  name: '',
  age: 0,
  gender: 'male',
  abhaNumber: '',
  abhaAddress: '',
  phone: '',
  bloodGroup: 'N/A',
  district: '',
  state: '',
  emergencyContact: { name: '', relation: '', phone: '' },
};

const createWelcomeMessage = (user?: UserProfile | null): ChatMessage => ({
  id: 'welcome-01', sender: 'vda', agent: 'router',
  text: user?.fullName ? `Namaste ${user.fullName} ji. I am your VDA Health Assistant. How can I help you today?` : 'Namaste ji. I am your VDA Health Assistant. How can I help you today?',
  textHi: user?.fullName ? `नमस्ते ${user.fullName} जी। मैं आपका VDA स्वास्थ्य साथी हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?` : 'नमस्ते जी। मैं आपका VDA स्वास्थ्य साथी हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?',
  textTa: user?.fullName ? `வணக்கம் ${user.fullName} அவர்களே. நான் உங்கள் VDA சுகாதார உதவியாளர். இன்று உங்களுக்கு எவ்வாறு உதவலாம்?` : 'வணக்கம். நான் உங்கள் VDA சுகாதார உதவியாளர். இன்று உங்களுக்கு எவ்வாறு உதவலாம்?',
  textKn: user?.fullName ? `ನಮಸ್ಕಾರ ${user.fullName} ಅವರೇ. ನಾನು ನಿಮ್ಮ VDA ಆರೋಗ್ಯ ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?` : 'ನಮಸ್ಕಾರ. ನಾನು ನಿಮ್ಮ VDA ಆರೋಗ್ಯ ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  audioAvailable: true,
  quickActions: [
    { label: 'My Medicines', labelHi: 'मेरी दवाइयां', labelTa: 'எனது மருந்துகள்', labelKn: 'ನನ್ನ ಔಷಧಿಗಳು', action: 'ask_medicines' },
    { label: 'Explain Sugar Lab', labelHi: 'शुगर रिपोर्ट समझाएं', labelTa: 'சர்க்கரை சோதனை விளக்கம்', labelKn: 'ಸಕ್ಕರೆ ವರದಿ ವಿವರಣೆ', action: 'ask_sugar_lab' },
    { label: 'Nearby Hospital', labelHi: 'नजदीकी अस्पताल', labelTa: 'அருகிலுள்ள மருத்துவமனை', labelKn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ', action: 'ask_hospital' },
    { label: 'Ayushman PM-JAY', labelHi: 'आयुष्मान योजना लाभ', labelTa: 'ஆயுஷ்மான் திட்ட பலன்கள்', labelKn: 'ಆಯುಷ್ಮಾನ್ ಯೋಜನೆ', action: 'ask_scheme' },
  ],
});

export default function App() {
  // Authentication & User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [lang, setLang] = useState<LanguageCode>('hi');
  const [activeTab, setActiveTab] = useState<'vda' | 'reminders' | 'facilities' | 'profile'>('vda');

  // Backend VDA Session State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [medicineReminderSnapshot, setMedicineReminderSnapshot] = useState<MedicineReminderSnapshot>(emptyMedicineReminderSnapshot);
  const [prescriptionReminderDraft, setPrescriptionReminderDraft] = useState<PrescriptionReminderDraft | null>(null);
  const [latestPrescriptionSubmission, setLatestPrescriptionSubmission] = useState<PatientPrescriptionLatestSubmission | null>(null);
  const [isMedicineRemindersOpen, setIsMedicineRemindersOpen] = useState(false);
  const [reminderSetup, setReminderSetup] = useState<ReminderSetup | null>(null);
  const [activeReminderStepId, setActiveReminderStepId] = useState<string | null>(null);
  const [reminderStepStates, setReminderStepStates] = useState<Record<string, ReminderStepStatus>>({});
  const activeReminderStepRef = React.useRef<string | null>(null);
  const reminderActionInFlightRef = React.useRef(new Set<string>());
  const localPrescriptionMessageSequenceRef = React.useRef(0);
  const sessionInitRef = React.useRef<{ userId: string; promise: Promise<any> } | null>(null);
  const prescriptionRefreshInFlightRef = React.useRef<{ key: string; promise: Promise<PatientPrescriptionCurrentState | undefined> } | null>(null);
  const resolvedPlanKeyRef = React.useRef<string | null>(null);
  const synchronizedPrescriptionContextKeyRef = React.useRef<string | null>(null);
  const failedPrescriptionContextKeyRef = React.useRef<string | null>(null);
  const initialPrescriptionSyncKeyRef = React.useRef<string | null>(null);
  const activeVerifiedPrescriptionDraftRef = React.useRef<PrescriptionReminderDraft | null>(null);
  const activeUserIdRef = React.useRef<string | null>(null);
  const accountGenerationRef = React.useRef(0);
  const activeSessionIdRef = React.useRef<string | null>(null);
  const sessionRecoveryRef = React.useRef<{ userId: string; failedSessionId: string; promise: Promise<string> } | null>(null);
  const [prescriptionContextSyncError, setPrescriptionContextSyncError] = useState<string | null>(null);
  const [emergencyFallback, setEmergencyFallback] = useState<{ nearbyFacilities: ClinicalReviewFacility[]; messageId: string } | null>(null);

  // App Flow Modals
  const [isLogVitalOpen, setIsLogVitalOpen] = useState(false);

  // Dynamic Clinical & Medical State (Device-Local)
  const [patient, setPatient] = useState<PatientDemographics>(defaultDemographics);
  const [conditions, setConditions] = useState<FhirCondition[]>([]);
  const [medications, setMedications] = useState<FhirMedication[]>([]);
  const [observations, setObservations] = useState<FhirObservation[]>([]);
  const [documents, setDocuments] = useState<FhirDocument[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [schemes, setSchemes] = useState<HealthScheme[]>([]);
  const [directoryScope, setDirectoryScope] = useState<{ state: string; district: string } | null>(null);
  const [directoryStatus, setDirectoryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const directoryLoadKeyRef = React.useRef<string | null>(null);

  // AuthService is the sole persisted-auth owner; this subscription owns the
  // active in-memory account and resets all account-scoped UI state.
  React.useEffect(() => {
    void authService.init().finally(() => setAuthReady(true));
    return authService.subscribe((u) => {
      accountGenerationRef.current += 1;
      activeUserIdRef.current = u?.id || null;
      activeSessionIdRef.current = null;
      sessionInitRef.current = null;
      sessionRecoveryRef.current = null;
      prescriptionRefreshInFlightRef.current = null;
      resolvedPlanKeyRef.current = null;
      synchronizedPrescriptionContextKeyRef.current = null;
      failedPrescriptionContextKeyRef.current = null;
      initialPrescriptionSyncKeyRef.current = null;
      activeVerifiedPrescriptionDraftRef.current = null;
      directoryLoadKeyRef.current = null;
      setActiveSessionId(null);
      setMedicineReminderSnapshot(emptyMedicineReminderSnapshot);
      setPrescriptionReminderDraft(null);
      setLatestPrescriptionSubmission(null);
      setReminderSetup(null);
      activeReminderStepRef.current = null;
      reminderActionInFlightRef.current.clear();
      setActiveReminderStepId(null);
      setReminderStepStates({});
      setIsMedicineRemindersOpen(false);
      setPrescriptionContextSyncError(null);
      setEmergencyFallback(null);
      setFacilities([]);
      setSchemes([]);
      setDirectoryScope(null);
      setDirectoryStatus('idle');
      setDirectoryError(null);
      setCurrentUser(u);
      if (u?.language) setLang(u.language);
    });
  }, []);

  const loadPatientDirectories = React.useCallback(async (force = false) => {
    if (!currentUser) return;
    const userId = currentUser.id;
    const generation = accountGenerationRef.current;
    if (!force && directoryLoadKeyRef.current === currentUser.id) return;
    directoryLoadKeyRef.current = currentUser.id;
    setDirectoryStatus('loading');
    setDirectoryError(null);
    try {
      const [facilityResponse, schemeResponse] = await Promise.all([
        apiService.getFacilities(),
        apiService.getSchemes(),
      ]);
      if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
      setFacilities(facilityResponse.facilities);
      setSchemes(schemeResponse.schemes);
      setDirectoryScope(facilityResponse.scope);
      setDirectoryStatus('ready');
    } catch (error) {
      if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
      console.warn('[VDA] Patient facility/scheme directory unavailable:', error);
      setFacilities([]);
      setSchemes([]);
      setDirectoryScope({ state: currentUser.state, district: currentUser.district });
      setDirectoryStatus('error');
      setDirectoryError(lang === 'hi'
        ? 'अभी अस्पताल और योजना की जानकारी उपलब्ध नहीं है। कृपया बाद में फिर कोशिश करें।'
        : 'Facility and scheme information is currently unavailable. Please try again later.');
    }
  }, [currentUser?.id, currentUser?.state, currentUser?.district, lang]);

  React.useEffect(() => {
    if (activeTab === 'facilities' && currentUser) {
      void loadPatientDirectories();
    }
  }, [activeTab, currentUser?.id, loadPatientDirectories]);

  // Initialize Session when user is authenticated
  const activeUserId = currentUser?.id || '';
  React.useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const userId = currentUser.id;
    const generation = accountGenerationRef.current;
    const demo = userProfileToDemographics(currentUser);
    setPatient(demo);

    const initUserSession = async () => {
      await apiService.initAuthToken();
      const sessionKey = `vda-active-session:${currentUser.id}`;
      const saved = await Preferences.get({ key: sessionKey });
      if (!sessionInitRef.current || sessionInitRef.current.userId !== currentUser.id) {
        sessionInitRef.current = {
          userId: currentUser.id,
          promise: saved.value
            ? Promise.resolve({ session_id: saved.value })
            : apiService.createPatientSession(currentUser.language),
        };
      }
      const sessionRes = await sessionInitRef.current.promise;
      const snapshot = await medicineReminderService.snapshot(currentUser.id);
      if (!active || activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
      if (sessionRes?.session_id) {
        await Preferences.set({ key: sessionKey, value: sessionRes.session_id });
        if (!active || activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
        activeSessionIdRef.current = sessionRes.session_id;
        setActiveSessionId(sessionRes.session_id);
      }
      setMedicineReminderSnapshot(snapshot);
    };
    void initUserSession().catch(async (error) => {
      if (!active || activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
      if (error instanceof VdaApiError && error.status === 401) {
        await authService.invalidateAuthentication();
      }
    });
    return () => { active = false; };
  }, [currentUser?.id]);

  React.useEffect(() => {
    if (!currentUser) return;
    let dispose = () => undefined;
    let active = true;
    void medicineReminderService.initialize((patientId) => {
      if (active && patientId === currentUser.id) {
        void medicineReminderService.snapshot(patientId).then(setMedicineReminderSnapshot);
      }
    }).then((nextDispose) => { dispose = nextDispose; });
    return () => { active = false; dispose(); };
  }, [currentUser?.id]);

  // VDA Conversation History
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-01',
      sender: 'vda',
      agent: 'router',
      text: `Namaste ji. I am your VDA Health Assistant. How can I help you today?`,
      textHi: `नमस्ते जी। मैं आपका VDA स्वास्थ्य साथी हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
      textTa: `வணக்கம். நான் உங்கள் VDA சுகாதார உதவியாளர். இன்று உங்களுக்கு எவ்வாறு உதவலாம்?`,
      textKn: `ನಮಸ್ಕಾರ. ನಾನು ನಿಮ್ಮ VDA ಆರೋಗ್ಯ ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true,
      quickActions: [
        { label: 'My Medicines', labelHi: 'मेरी दवाइयां', labelTa: 'எனது மருந்துகள்', labelKn: 'ನನ್ನ ಔಷಧಿಗಳು', action: 'ask_medicines' },
        { label: 'Explain Sugar Lab', labelHi: 'शुगर रिपोर्ट समझाएं', labelTa: 'சர்க்கரை சோதனை விளக்கம்', labelKn: 'ಸಕ್ಕರೆ ವರದಿ ವಿವರಣೆ', action: 'ask_sugar_lab' },
        { label: 'Nearby Hospital', labelHi: 'नजदीकी अस्पताल', labelTa: 'அருகிலுள்ள மருத்துவமனை', labelKn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ', action: 'ask_hospital' },
        { label: 'Ayushman PM-JAY', labelHi: 'आयुष्मान योजना लाभ', labelTa: 'ஆயுஷ்மான் திட்ட பலன்கள்', labelKn: 'ಆಯುಷ್ಮಾನ್ ಯೋಜನೆ', action: 'ask_scheme' }
      ]
    }
  ]);

  // Update greeting with user name when profile loads
  React.useEffect(() => {
    if (currentUser?.fullName) {
      setMessages((prev) => {
        if (prev.length > 0 && prev[0].id === 'welcome-01') {
          return [
            {
              ...prev[0],
              text: `Namaste ${currentUser.fullName} ji. I am your VDA Health Assistant. How can I help you today?`,
              textHi: `नमस्ते ${currentUser.fullName} जी। मैं आपका VDA स्वास्थ्य साथी हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
              textTa: `வணக்கம் ${currentUser.fullName} அவர்களே. நான் உங்கள் VDA சுகாதார உதவியாளர். இன்று உங்களுக்கு எவ்வாறு உதவலாம்?`,
              textKn: `ನಮಸ್ಕಾರ ${currentUser.fullName} ಅವರೇ. ನಾನು ನಿಮ್ಮ VDA ಆರೋಗ್ಯ ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`,
            },
            ...prev.slice(1)
          ];
        }
        return prev;
      });
    }
  }, [currentUser?.fullName]);

  React.useEffect(() => {
    setMessages([createWelcomeMessage(currentUser)]);
    setIsProcessingMessage(false);
    setPatient(currentUser ? userProfileToDemographics(currentUser) : defaultDemographics);
  }, [currentUser?.id]);

  const activateReminderStep = (stepId: string) => {
    activeReminderStepRef.current = stepId;
    setActiveReminderStepId(stepId);
    setReminderStepStates((previous) => {
      const next = { ...previous };
      Object.entries(next).forEach(([id, status]) => {
        if (status === 'ACTIVE') next[id] = 'EXPIRED';
      });
      next[stepId] = 'ACTIVE';
      return next;
    });
  };

  const markReminderStepAnswered = (stepId: string) => {
    if (activeReminderStepRef.current === stepId) {
      activeReminderStepRef.current = null;
      setActiveReminderStepId(null);
    }
    setReminderStepStates((previous) => ({ ...previous, [stepId]: 'ANSWERED' }));
  };

  const appendConversationMessage = (
    textHi: string,
    quickActions?: ChatMessage['quickActions'],
    options?: { activateReminderStep?: boolean; sections?: ChatMessage['sections']; unverifiedExtraction?: boolean },
  ) => {
    localPrescriptionMessageSequenceRef.current += 1;
    const id = `${options?.unverifiedExtraction ? 'local-unverified-extraction' : 'local-prescription'}-${Date.now()}-${localPrescriptionMessageSequenceRef.current}`;
    const message: ChatMessage = {
      id,
      sender: 'vda',
      agent: 'medication',
      text: textHi,
      textHi,
      textTa: textHi,
      textKn: textHi,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true,
      sections: options?.sections,
      quickActions,
      reminderStepId: options?.activateReminderStep ? id : undefined,
    };
    if (options?.activateReminderStep) activateReminderStep(id);
    setMessages((previous) => [...previous, message]);
    return id;
  };

  const askForReminderTime = (draft: PrescriptionReminderDraft, medicineIndex: number, timeIndex = 0) => {
    const medicine = draft.medicines[medicineIndex];
    if (!medicine) return;
    setReminderSetup({ draft, phase: 'ASK_TIME', medicineIndex, timeIndex });
    const instruction = medicine.timing ? ` पर्ची में “${medicine.timing}” लिखा है, पर यह रिमाइंडर का सही घड़ी समय नहीं बताता।` : '';
    const occurrence = medicine.times.length > 1 ? ` (दिन में ${timeIndex + 1}वीं बार)` : '';
    appendConversationMessage(`${medicine.medicineName}${medicine.frequency ? ` ${medicine.frequency}` : ''}${occurrence} लिखी है।${instruction} आपको इसकी याद किस समय दिलाऊँ?`);
  };

  const askForNextReminderTime = (draft: PrescriptionReminderDraft, startIndex: number) => {
    const medicineIndex = draft.medicines.findIndex((medicine, index) => index >= startIndex && medicine.enabled);
    if (medicineIndex < 0) {
      const scheduled = draft.medicines.filter((medicine) => medicine.enabled)
        .map((medicine) => `✓ ${medicine.medicineName} — ${medicine.times.map((time) => reminderTimeLabel(time, lang)).join(', ')}`)
        .join('\n');
      setReminderSetup({ draft, phase: 'ACTIVATE', medicineIndex: draft.medicines.length });
      appendConversationMessage(
        `मैंने आपके दवा रिमाइंडर तैयार कर दिए हैं:\n${scheduled}\n\nक्या मैं इन्हें चालू कर दूँ?`,
        [
          { label: 'हाँ, चालू करें', labelHi: 'हाँ, चालू करें', action: 'confirm_medicine_reminders' },
          { label: 'समय बदलें', labelHi: 'समय बदलें', action: 'change_medicine_reminder_time' },
        ],
        { activateReminderStep: true },
      );
      return;
    }
    const medicine = draft.medicines[medicineIndex];
    if (medicine.requiresConfirmation && !medicine.confirmed) {
      setReminderSetup({ draft, phase: 'CONFIRM_MEDICINE', medicineIndex });
      appendConversationMessage(
        `${medicine.medicineName} की जानकारी पर्ची में पूरी तरह साफ़ नहीं है। कृपया नाम और खुराक देखकर पुष्टि करें: ${medicine.dosageText}। क्या यह सही है?`,
        [
          { label: 'हाँ', labelHi: 'हाँ', action: 'confirm_medicine_reminders' },
          { label: 'नहीं', labelHi: 'नहीं', action: 'skip_medicine_reminders' },
        ],
        { activateReminderStep: true },
      );
      return;
    }
    askForReminderTime(draft, medicineIndex);
  };

  const reminderActivationMessage = (draft: PrescriptionReminderDraft, notificationPermission: MedicineReminderSnapshot['notificationPermission']) => {
    const schedule = draft.medicines
      .filter((medicine) => medicine.enabled && medicine.confirmed)
      .map((medicine) => `✓ ${medicine.medicineName} — ${medicine.times.map((time) => reminderTimeLabel(time, lang)).join(', ')}`)
      .join('\n');
    if (notificationPermission === 'granted') {
      return `ठीक है। आपके दवा रिमाइंडर चालू कर दिए गए हैं।\n\n${schedule}`;
    }
    if (notificationPermission === 'unavailable') {
      return `आपके रिमाइंडर इस ब्राउज़र में सेव कर दिए गए हैं। फोन ऐप में नोटिफिकेशन चालू होने पर आपको समय पर याद दिलाया जाएगा।\n\n${schedule}`;
    }
    return `आपके रिमाइंडर इस फोन में सेव कर दिए गए हैं। समय पर सूचना पाने के लिए नोटिफिकेशन की अनुमति दें।\n\n${schedule}`;
  };

  /** Sends only confirmed reminder names/times; server resolves prescription facts itself. */
  const syncPrescriptionSessionContext = React.useCallback(async (
    sessionId: string,
    snapshot: MedicineReminderSnapshot,
    ownerUserId = activeUserIdRef.current,
    ownerGeneration = accountGenerationRef.current,
  ) => {
    const prescription = snapshot.activePrescription;
    if (!prescription?.id || prescription.verificationStatus !== 'VERIFIED') return;
    const reminders = snapshot.reminders
      .filter((reminder) => (
        reminder.active
        && reminder.confirmed
        && reminder.prescriptionId === prescription.id
        && reminder.times.length > 0
        && reminder.times.every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
      ))
      .map((reminder) => ({ medicineName: reminder.medicineName, times: reminder.times }));
    const synchronizationKey = JSON.stringify({
      sessionId,
      prescriptionId: prescription.id,
      planRevision: prescription.planRevision,
      reminders,
    });
    if (
      synchronizedPrescriptionContextKeyRef.current === synchronizationKey
      || failedPrescriptionContextKeyRef.current === synchronizationKey
    ) return;
    try {
      await apiService.refreshPrescriptionSessionContext(
        sessionId,
        prescription.id,
        prescription.planRevision,
        reminders,
      );
      if (activeUserIdRef.current !== ownerUserId || accountGenerationRef.current !== ownerGeneration) return;
      synchronizedPrescriptionContextKeyRef.current = synchronizationKey;
      failedPrescriptionContextKeyRef.current = null;
      setPrescriptionContextSyncError(null);
    } catch {
      if (activeUserIdRef.current !== ownerUserId || accountGenerationRef.current !== ownerGeneration) return;
      // Device-local reminder preferences remain valid. A deterministic
      // failure is surfaced once and is not retried until this key changes.
      failedPrescriptionContextKeyRef.current = synchronizationKey;
      setPrescriptionContextSyncError('दवा रिमाइंडर इस फोन में सेव हैं, लेकिन VDA चैट से अभी सिंक नहीं हो पाए।');
    }
  }, []);

  const refreshVerifiedPrescription = React.useCallback(async (
    openReview = false,
    sessionIdOverride?: string,
  ) => {
    const userId = currentUser?.id;
    const targetSessionId = sessionIdOverride || activeSessionId;
    const generation = accountGenerationRef.current;
    if (!targetSessionId || !userId) return;
    const requestKey = `${userId}:${targetSessionId}`;
    if (!prescriptionRefreshInFlightRef.current || prescriptionRefreshInFlightRef.current.key !== requestKey) {
      const promise = (async () => {
        const state = await apiService.getCurrentPrescriptionState(targetSessionId);
        if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
        setLatestPrescriptionSubmission(state.latestSubmission);
        const activeVerified = state.activePlan;
        if (activeVerified) {
          activeVerifiedPrescriptionDraftRef.current = prescriptionToReminderDraft(userId, activeVerified);
          const planKey = `${activeVerified.id}:${activeVerified.planRevision}:${activeVerified.updatedAt || ''}`;
          let snapshot: MedicineReminderSnapshot;
          if (resolvedPlanKeyRef.current !== planKey) {
            snapshot = await medicineReminderService.saveExtractedPrescription(
              activeVerifiedPrescriptionDraftRef.current,
            );
            resolvedPlanKeyRef.current = planKey;
          } else {
            snapshot = await medicineReminderService.snapshot(userId);
          }
          if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
          setMedicineReminderSnapshot(snapshot);
          await syncPrescriptionSessionContext(targetSessionId, snapshot, userId, generation);
        } else {
          activeVerifiedPrescriptionDraftRef.current = null;
        }
        const displayPrescription = state.latestSubmission?.id === activeVerified?.id
          ? activeVerified
          : state.latestSubmission || activeVerified;
        if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
        setPrescriptionReminderDraft(displayPrescription
          ? prescriptionToReminderDraft(userId, displayPrescription)
          : null);
        return state;
      })();
      prescriptionRefreshInFlightRef.current = { key: requestKey, promise };
      const clearInFlight = () => {
        if (prescriptionRefreshInFlightRef.current?.promise === promise) {
          prescriptionRefreshInFlightRef.current = null;
        }
      };
      void promise.then(clearInFlight, clearInFlight);
    }
    const refreshedState = await prescriptionRefreshInFlightRef.current.promise;
    if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) return;
    if (openReview) {
      if (activeVerifiedPrescriptionDraftRef.current) {
        setPrescriptionReminderDraft(activeVerifiedPrescriptionDraftRef.current);
      }
      setIsMedicineRemindersOpen(true);
    }
    return refreshedState;
  }, [activeSessionId, currentUser?.id, syncPrescriptionSessionContext]);

  const recoverConversationSession = React.useCallback(async (failedSessionId: string): Promise<string> => {
    const user = authService.getUser();
    if (!user || activeUserIdRef.current !== user.id) throw new Error('AUTHENTICATION_REQUIRED');
    if (
      sessionRecoveryRef.current
      && sessionRecoveryRef.current.userId === user.id
      && sessionRecoveryRef.current.failedSessionId === failedSessionId
    ) {
      return sessionRecoveryRef.current.promise;
    }

    const userId = user.id;
    const generation = accountGenerationRef.current;
    const promise = (async () => {
      const sessionKey = `vda-active-session:${userId}`;
      const stored = await Preferences.get({ key: sessionKey });
      if (stored.value && stored.value !== failedSessionId) {
        activeSessionIdRef.current = stored.value;
        setActiveSessionId(stored.value);
        return stored.value;
      }
      await Preferences.remove({ key: sessionKey });
      if (activeSessionIdRef.current === failedSessionId) {
        activeSessionIdRef.current = null;
        setActiveSessionId(null);
      }
      synchronizedPrescriptionContextKeyRef.current = null;
      failedPrescriptionContextKeyRef.current = null;
      initialPrescriptionSyncKeyRef.current = null;
      prescriptionRefreshInFlightRef.current = null;

      const replacement = await apiService.createPatientSession(user.language);
      if (!replacement?.session_id) throw new Error('VDA_SESSION_UNAVAILABLE');
      if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) {
        throw new Error('AUTH_OPERATION_SUPERSEDED');
      }
      await Preferences.set({ key: sessionKey, value: replacement.session_id });
      if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) {
        throw new Error('AUTH_OPERATION_SUPERSEDED');
      }
      activeSessionIdRef.current = replacement.session_id;
      setActiveSessionId(replacement.session_id);
      sessionInitRef.current = {
        userId,
        promise: Promise.resolve(replacement),
      };
      await refreshVerifiedPrescription(false, replacement.session_id);
      return replacement.session_id;
    })();

    sessionRecoveryRef.current = { userId, failedSessionId, promise };
    try {
      return await promise;
    } finally {
      if (sessionRecoveryRef.current?.promise === promise) sessionRecoveryRef.current = null;
    }
  }, [refreshVerifiedPrescription]);

  /**
   * One-shot recovery boundary for a plain text turn only. Uploads and all
   * other mutating operations never call this function and are never retried.
   */
  const processSafeTextTurn = React.useCallback(async (
    text: string,
    sessionId: string,
    options: { prescriptionContextRequired?: boolean; disableLocalFallback?: boolean; idempotencyKey: string },
    userId: string,
    generation: number,
  ) => {
    try {
      return await apiService.processVdaQuery(
        text, patient, medications, observations, lang, sessionId, options,
      );
    } catch (error) {
      if (error instanceof VdaApiError && error.status === 401) {
        await authService.invalidateAuthentication();
        throw error;
      }
      const recoverable = error instanceof VdaApiError
        && ['SESSION_EXPIRED', 'SESSION_CLOSED', 'SESSION_NOT_FOUND'].includes(error.code || '');
      if (!recoverable) throw error;
      const replacementSessionId = await recoverConversationSession(sessionId);
      if (activeUserIdRef.current !== userId || accountGenerationRef.current !== generation) {
        throw new Error('AUTH_OPERATION_SUPERSEDED');
      }
      // Exactly one retry, with the original key. Backend failures are not
      // cached by the idempotency interceptor.
      return apiService.processVdaQuery(
        text, patient, medications, observations, lang, replacementSessionId, options,
      );
    }
  }, [lang, medications, observations, patient, recoverConversationSession]);

  React.useEffect(() => {
    if (!activeSessionId || !currentUser) return;
    const synchronizationKey = `${currentUser.id}:${activeSessionId}`;
    if (initialPrescriptionSyncKeyRef.current !== synchronizationKey) {
      initialPrescriptionSyncKeyRef.current = synchronizationKey;
      void refreshVerifiedPrescription(false);
    }
    let wasHidden = document.visibilityState === 'hidden';
    const onVisible = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        return;
      }
      if (wasHidden) {
        wasHidden = false;
        void refreshVerifiedPrescription(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeSessionId, currentUser?.id, refreshVerifiedPrescription]);

  const openMedicineReminderConfiguration = React.useCallback(() => {
    const activePrescription = medicineReminderSnapshot.activePrescription;
    if (
      activePrescription?.verificationStatus === 'VERIFIED'
      && activePrescription.activePlan
      && currentUser?.id
    ) {
      const hasConfiguredPlanReminders = medicineReminderSnapshot.reminders.some((reminder) => (
        reminder.prescriptionId === activePrescription.id
        && reminder.planRevision === activePrescription.planRevision
      ));
      setPrescriptionReminderDraft(hasConfiguredPlanReminders
        ? null
        : localPrescriptionToReminderDraft(currentUser.id, activePrescription));
      setIsMedicineRemindersOpen(true);
      return;
    }
    if (prescriptionReminderDraft) {
      setIsMedicineRemindersOpen(true);
      return;
    }
    // No synchronized local state exists yet; this is the only modal-open path
    // that needs to refresh the current session prescription from the backend.
    void refreshVerifiedPrescription(true);
  }, [currentUser?.id, medicineReminderSnapshot, prescriptionReminderDraft, refreshVerifiedPrescription]);

  const handleReminderSetupResponse = async (text: string): Promise<ReminderResponseResult> => {
    if (!reminderSetup) return { handled: false, answered: false };
    const answer = text.trim();
    const currentMedicine = reminderSetup.draft.medicines[reminderSetup.medicineIndex];

    if (reminderSetup.phase === 'OFFER') {
      if (isAffirmative(answer)) {
        askForNextReminderTime(reminderSetup.draft, 0);
      } else if (isNegative(answer)) {
        setReminderSetup(null);
        setPrescriptionReminderDraft(null);
        appendConversationMessage('ठीक है। आपकी पर्ची इस फोन में सुरक्षित है। जब चाहें, दवा रिमाइंडर चालू कर सकते हैं।');
      } else {
        appendConversationMessage('क्या मैं आपको इन दवाइयों को समय पर लेने के लिए याद दिलाऊँ? कृपया हाँ या नहीं कहें।');
      }
      return { handled: true, answered: isAffirmative(answer) || isNegative(answer) };
    }

    if (reminderSetup.phase === 'ACTIVATE') {
      const activationConfirmed = isReminderActivationConfirmation(answer);
      if (activationConfirmed) {
        const scheduledMedicines = reminderSetup.draft.medicines.filter((medicine) => (
          medicine.enabled
          && medicine.confirmed
          && medicine.times.length > 0
          && medicine.times.every(Boolean)
        ));
        if (!scheduledMedicines.length) {
          appendConversationMessage('रिमाइंडर चालू करने से पहले कम से कम एक दवा का समय चुनें।');
          askForNextReminderTime(reminderSetup.draft, 0);
          return { handled: true, answered: false };
        }
        const snapshot = await medicineReminderService.confirmDraft(reminderSetup.draft);
        setMedicineReminderSnapshot(snapshot);
        if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
        setPrescriptionReminderDraft(null);
        setReminderSetup(null);
        appendConversationMessage(reminderActivationMessage(reminderSetup.draft, snapshot.notificationPermission));
      } else if (isNegative(answer) || /बदल|change/i.test(answer)) {
        askForNextReminderTime(reminderSetup.draft, 0);
      } else {
        appendConversationMessage('क्या मैं रिमाइंडर चालू कर दूँ? कृपया हाँ या समय बदलें कहें।');
      }
      return { handled: true, answered: activationConfirmed || isNegative(answer) || /बदल|change/i.test(answer) };
    }

    if (!currentMedicine) return { handled: false, answered: false };
    if (reminderSetup.phase === 'CONFIRM_MEDICINE') {
      const medicines = reminderSetup.draft.medicines.map((medicine, index) => index === reminderSetup.medicineIndex
        ? { ...medicine, confirmed: isAffirmative(answer), enabled: isAffirmative(answer) }
        : medicine);
      const draft = { ...reminderSetup.draft, medicines };
      if (isAffirmative(answer)) askForNextReminderTime(draft, reminderSetup.medicineIndex);
      else if (isNegative(answer)) askForNextReminderTime(draft, reminderSetup.medicineIndex + 1);
      else appendConversationMessage('कृपया हाँ या नहीं कहकर पुष्टि करें।');
      return { handled: true, answered: isAffirmative(answer) || isNegative(answer) };
    }

    if (reminderSetup.phase === 'ASK_TIME') {
      const parsed = parseReminderTime(answer);
      if (parsed.value) {
        setReminderSetup({ ...reminderSetup, phase: 'CONFIRM_TIME', pendingTime: parsed.value });
        appendConversationMessage(`${currentMedicine.medicineName} के लिए रोज़ ${reminderTimeLabel(parsed.value, lang)} रिमाइंडर लगा दूँ?`, [
          { label: 'हाँ', labelHi: 'हाँ', action: 'confirm_medicine_reminders' },
          { label: 'समय बदलें', labelHi: 'समय बदलें', action: 'change_medicine_reminder_time' },
        ], { activateReminderStep: true });
      } else if (parsed.ambiguous) {
        setReminderSetup({ ...reminderSetup, phase: 'ASK_PERIOD', pendingHour: parsed.hour, pendingMinute: parsed.minute });
        appendConversationMessage('यह समय सुबह है या शाम?');
      } else {
        appendConversationMessage('मुझे सही समय समझ नहीं आया। जैसे “सुबह 8 बजे”, “शाम 6 बजे” या “8 AM” कहें।');
      }
      return { handled: true, answered: false };
    }

    if (reminderSetup.phase === 'ASK_PERIOD') {
      const period = /सुबह|morning|am/i.test(answer) ? 'AM' : /शाम|रात|evening|night|pm/i.test(answer) ? 'PM' : null;
      if (!period || !reminderSetup.pendingHour) {
        appendConversationMessage('कृपया सुबह या शाम कहें।');
        return { handled: true, answered: false };
      }
      const hour24 = period === 'PM' && reminderSetup.pendingHour < 12 ? reminderSetup.pendingHour + 12 : period === 'AM' && reminderSetup.pendingHour === 12 ? 0 : reminderSetup.pendingHour;
      const pendingTime = `${String(hour24).padStart(2, '0')}:${String(reminderSetup.pendingMinute || 0).padStart(2, '0')}`;
      setReminderSetup({ ...reminderSetup, phase: 'CONFIRM_TIME', pendingTime });
      appendConversationMessage(`${currentMedicine.medicineName} के लिए रोज़ ${reminderTimeLabel(pendingTime, lang)} रिमाइंडर लगा दूँ?`, [
        { label: 'हाँ', labelHi: 'हाँ', action: 'confirm_medicine_reminders' },
        { label: 'समय बदलें', labelHi: 'समय बदलें', action: 'change_medicine_reminder_time' },
      ], { activateReminderStep: true });
      return { handled: true, answered: true };
    }

    if (reminderSetup.phase === 'CONFIRM_TIME') {
      if (isAffirmative(answer) && reminderSetup.pendingTime) {
        const timeIndex = reminderSetup.timeIndex || 0;
        const medicines = reminderSetup.draft.medicines.map((medicine, index) => {
          if (index !== reminderSetup.medicineIndex) return medicine;
          const times = medicine.times.length ? [...medicine.times] : [''];
          times[timeIndex] = reminderSetup.pendingTime!;
          return { ...medicine, times, confirmed: true };
        });
        const draft = { ...reminderSetup.draft, medicines };
        const updatedMedicine = medicines[reminderSetup.medicineIndex];
        if (timeIndex + 1 < updatedMedicine.times.length) {
          askForReminderTime(draft, reminderSetup.medicineIndex, timeIndex + 1);
        } else {
          askForNextReminderTime(draft, reminderSetup.medicineIndex + 1);
        }
      } else if (isNegative(answer) || /बदल|change/i.test(answer)) {
        askForReminderTime(reminderSetup.draft, reminderSetup.medicineIndex, reminderSetup.timeIndex || 0);
      } else {
        appendConversationMessage('कृपया हाँ कहकर समय की पुष्टि करें, या समय बदलें कहें।');
      }
      return { handled: true, answered: Boolean(
        (isAffirmative(answer) && reminderSetup.pendingTime)
        || isNegative(answer)
        || /बदल|change/i.test(answer),
      ) };
    }

    return { handled: false, answered: false };
  };

  // Process user message with optional prescription document attachment
  const handleSendMessage = async (userText: string, attachmentFile?: File, submittedReminderStepId?: string) => {
    if (isProcessingMessage) return;
    const submissionUserId = activeUserIdRef.current;
    const submissionGeneration = accountGenerationRef.current;
    if (!submissionUserId) return;
    playChime('start');
    setIsProcessingMessage(true);
    // Emergency presentation is strictly per turn. A new message always starts
    // with normal routing and cannot inherit an earlier emergency card or poll.
    setEmergencyFallback(null);

    let attachmentInfo = undefined;
    if (attachmentFile) {
      const isImage = attachmentFile.type.startsWith('image/');
      attachmentInfo = {
        name: attachmentFile.name,
        type: attachmentFile.type.split('/')[1]?.toUpperCase() || 'DOCUMENT',
        url: isImage ? URL.createObjectURL(attachmentFile) : undefined,
        isImage
      };
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      textHi: userText,
      textTa: userText,
      textKn: userText,
      attachment: attachmentInfo,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);

    // Voice and typed replies use the same patient-led reminder conversation.
    const reminderStepIdAtSubmission = submittedReminderStepId || activeReminderStepRef.current;
    const hasLocalReminderWorkflow = Boolean(reminderSetup || reminderStepIdAtSubmission);
    const reminderResponse = !attachmentFile
      ? await handleReminderSetupResponse(userText)
      : { handled: false, answered: false };
    if (reminderResponse.handled) {
      if (reminderResponse.answered && reminderStepIdAtSubmission) {
        markReminderStepAnswered(reminderStepIdAtSubmission);
      }
      setIsProcessingMessage(false);
      return;
    }
    if (!attachmentFile && hasLocalReminderWorkflow) {
      // An active device-local workflow is never allowed to fall through into a
      // normal VDA turn, even if its persisted UI state was interrupted.
      appendConversationMessage('रिमाइंडर की जानकारी अभी पूरी नहीं हुई है। कृपया दिए गए समय या विकल्प के अनुसार जवाब दें।');
      setIsProcessingMessage(false);
      return;
    }

    // Ensure session exists and upload prescription attachment if attached
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      try {
        if (!sessionInitRef.current || sessionInitRef.current.userId !== submissionUserId) {
          sessionInitRef.current = {
            userId: submissionUserId,
            promise: apiService.createPatientSession(lang),
          };
        }
        const sessionRes = await sessionInitRef.current.promise;
        if (sessionRes?.session_id) {
          if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
          currentSessionId = sessionRes.session_id;
          await Preferences.set({ key: `vda-active-session:${submissionUserId}`, value: currentSessionId });
          activeSessionIdRef.current = currentSessionId;
          setActiveSessionId(currentSessionId);
        }
      } catch (error) {
        if (error instanceof VdaApiError && error.status === 401) await authService.invalidateAuthentication();
        setIsProcessingMessage(false);
        return;
      }
    }

    let extractedDraft: PrescriptionReminderDraft | null = null;
    let uploadCurrentState: PatientPrescriptionCurrentState | undefined;
    if (attachmentFile && currentSessionId) {
      try {
        await medicineReminderService.beginPrescriptionProcessing(submissionUserId);
        const processingSnapshot = await medicineReminderService.snapshot(submissionUserId);
        if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
        setMedicineReminderSnapshot(processingSnapshot);
        appendConversationMessage('मैं आपकी पर्ची देख रहा हूँ…');
        const prescription = await apiService.uploadPrescription(currentSessionId, attachmentFile);
        if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
        const draft = prescriptionToReminderDraft(submissionUserId, prescription);
        extractedDraft = draft;
        setPrescriptionReminderDraft(draft);
        // Fetch the patient-only, read-only extraction projection once after
        // upload. It never enters the reminder draft or local reminder store.
        try {
          uploadCurrentState = await refreshVerifiedPrescription(false, currentSessionId);
        } catch {
          // The existing upload status remains visible if this read fails.
        }
        if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
      } catch (err: any) {
        await medicineReminderService.markPrescriptionExtractionFailed(submissionUserId);
        const failedSnapshot = await medicineReminderService.snapshot(submissionUserId);
        if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
        setMedicineReminderSnapshot(failedSnapshot);
        console.warn('[VDA App] Prescription upload failed:', err);
        const errMsg: ChatMessage = {
          id: `upload-err-${Date.now()}`,
          sender: 'vda',
          agent: 'router',
          text: `Prescription upload notice: ${err.message || 'Unable to upload file to backend.'}`,
          textHi: `पर्ची अपलोड सूचना: ${err.message || 'फाइल सर्वर तक नहीं पहुँच पाई।'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsProcessingMessage(false);
        return;
      }
    }

    if (attachmentFile) {
      if (!extractedDraft) {
        appendConversationMessage('पर्ची से दवा की जानकारी की पुष्टि नहीं हो सकी। कृपया साफ़ फोटो या PDF फिर से अपलोड करें।');
      } else {
        try {
          const snapshot = await medicineReminderService.saveExtractedPrescription(extractedDraft);
          if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
          setMedicineReminderSnapshot(snapshot);
          setPrescriptionReminderDraft(extractedDraft);
          const medicineLines = extractedDraft.medicines.map((medicine) =>
            `• ${medicine.medicineName}${medicine.dosageText ? ` — ${medicine.dosageText}` : ''}${medicine.frequency ? ` • ${medicine.frequency}` : ''}`,
          );
          const verificationMessage = extractedDraft.verificationStatus === 'VERIFIED'
            ? 'दवा की जानकारी सत्यापित हो गई है।'
            : 'पर्ची की जानकारी की जाँच बाकी है। स्वास्थ्यकर्मी द्वारा सत्यापन होने तक रिमाइंडर चालू नहीं किए जा सकते।';
          const latestUpload = uploadCurrentState?.latestSubmission?.id === extractedDraft.prescriptionId
            ? uploadCurrentState.latestSubmission : null;
          const pendingContent = pendingPrescriptionChatContent(
            latestUpload,
            Boolean(uploadCurrentState?.activePlan && uploadCurrentState.activePlan.id !== extractedDraft.prescriptionId),
          );
          if (extractedDraft.verificationStatus === 'VERIFIED') {
            appendConversationMessage(`पर्ची में सत्यापित दवा की जानकारी:\n${medicineLines.join('\n')}\n\n${verificationMessage}`);
          } else if (pendingContent) {
            appendConversationMessage(pendingContent.text, undefined, { sections: pendingContent.sections, unverifiedExtraction: true });
          } else if (latestUpload?.verificationStatus === 'REJECTED' || latestUpload?.verificationStatus === 'NEEDS_RESUBMISSION') {
            appendConversationMessage(latestUpload.patientReviewReason || (latestUpload.verificationStatus === 'NEEDS_RESUBMISSION'
              ? 'पर्ची की साफ़ फोटो या PDF दोबारा अपलोड करें।'
              : 'यह पर्ची सत्यापित नहीं हो सकी। कृपया स्वास्थ्यकर्मी से संपर्क करें।'));
          } else {
            appendConversationMessage(verificationMessage);
          }
          if (extractedDraft.verificationStatus === 'VERIFIED') {
            if (currentSessionId) await syncPrescriptionSessionContext(currentSessionId, snapshot);
            setReminderSetup({ draft: extractedDraft, phase: 'OFFER', medicineIndex: 0 });
            appendConversationMessage(
              'दवा की जानकारी सत्यापित हो गई है। अब आप अपनी सुविधा के अनुसार रिमाइंडर का समय चुन सकते हैं।',
              [
                { label: 'रिमाइंडर समय चुनें', labelHi: 'रिमाइंडर समय चुनें', action: 'setup_medicine_reminders' },
                { label: 'अभी नहीं', labelHi: 'अभी नहीं', action: 'skip_medicine_reminders' },
              ],
              { activateReminderStep: true },
            );
          }
        } catch {
          appendConversationMessage('पर्ची की जानकारी अभी समझाई नहीं जा सकी। कृपया थोड़ी देर बाद फिर प्रयास करें।');
        }
      }
      setIsProcessingMessage(false);
      return;
    }

    // Hard boundary: only attachment-free text can enter session recovery.
    // Uploads have already completed above and can never be retried here.
    if (attachmentFile) {
      setIsProcessingMessage(false);
      return;
    }

    try {
      const latestAssistantMessage = [...messages].reverse().find((message) => message.sender === 'vda');
      const followsLocalPrescriptionAnswer = Boolean(
        (latestAssistantMessage?.id.startsWith('local-prescription-') || latestAssistantMessage?.prescriptionScoped)
        && isPrescriptionMedicineFollowUp(userText),
      );
      const localSnapshot = await medicineReminderService.snapshot(submissionUserId);
      if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
      setMedicineReminderSnapshot(localSnapshot);
      const medicineRoute = classifyPrescriptionMedicineQuery(userText, localSnapshot);
      const isPrescriptionContextQuestion = !attachmentFile && (
        medicineRoute.route !== 'NONE' || followsLocalPrescriptionAnswer
      );
      // The backend owns all prescription-context reasoning. The device only
      // refreshes its confirmed reminder times and blocks any FHIR/mock fallback.
      // SafetyGate remains the backend's first decision for unsafe questions.
      if (!currentSessionId) throw new Error('VDA_SESSION_UNAVAILABLE');
      const idempotencyKey = `turn-${crypto.randomUUID()}`;
      const result = await processSafeTextTurn(
        userText,
        currentSessionId,
        isPrescriptionContextQuestion
          ? { disableLocalFallback: true, prescriptionContextRequired: true, idempotencyKey }
          : { idempotencyKey },
        submissionUserId,
        submissionGeneration,
      );
      if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
      if (result.responseType !== 'clinical-review') setMessages((prev) => [...prev, result.message]);
      if (result.escalationDetected) {
        setEmergencyFallback({
          messageId: userMsg.id,
          nearbyFacilities: result.nearbyFacilities || [],
        });
      }
    } catch (error) {
      if (activeUserIdRef.current !== submissionUserId || accountGenerationRef.current !== submissionGeneration) return;
      if (error instanceof VdaApiError && error.status === 401) {
        await authService.invalidateAuthentication();
        return;
      }
      setMessages((prev) => [...prev, {
        id: `backend-unavailable-${Date.now()}`,
        sender: 'vda',
        agent: 'router',
        text: 'VDA service is unavailable. Please try again.',
        textHi: 'VDA सेवा अभी उपलब्ध नहीं है। कृपया फिर प्रयास करें।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      if (activeUserIdRef.current === submissionUserId && accountGenerationRef.current === submissionGeneration) {
        setIsProcessingMessage(false);
      }
    }
  };

  // Trigger manual or test escalation
  // The test control now sends the same input through the backend SafetyGate.
  const handleTriggerEscalation = (reason: string) => { void handleSendMessage(reason); };

  const handleReminderQuickAction = async (stepId: string, action: string) => {
    if (activeReminderStepRef.current !== stepId || reminderStepStates[stepId] !== 'ACTIVE') return;
    if (reminderActionInFlightRef.current.has(stepId)) return;
    const textByAction: Record<string, string> = {
      setup_medicine_reminders: 'हाँ, रिमाइंडर लगाएँ',
      confirm_medicine_reminders: 'हाँ',
      skip_medicine_reminders: 'अभी नहीं',
      change_medicine_reminder_time: 'समय बदलें',
    };
    const response = textByAction[action];
    if (!response) return;
    reminderActionInFlightRef.current.add(stepId);
    try {
      // Do not clear the active step before the local state machine sees the
      // answer; it needs the current phase to process the final confirmation.
      await handleSendMessage(response, undefined, stepId);
    } finally {
      reminderActionInFlightRef.current.delete(stepId);
    }
  };

  const openEmergencyEsanjeevani = async () => {
    await apiService.openEsanjeevani();
  };

  const dismissEmergencyFallback = () => {
    setEmergencyFallback(null);
  };

  const refreshMedicineReminders = async () => {
    const snapshot = await medicineReminderService.snapshot(activeUserId);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
  };

  const confirmPrescriptionReminders = async (draft: PrescriptionReminderDraft) => {
    const snapshot = await medicineReminderService.confirmDraft(draft);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
    setPrescriptionReminderDraft(null);
  };

  const updateMedicineReminder = async (id: string, patch: { times: string[]; active: boolean }) => {
    const snapshot = await medicineReminderService.updateReminder(activeUserId, id, patch);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
  };

  const deleteMedicineReminder = async (id: string) => {
    const snapshot = await medicineReminderService.deleteReminder(activeUserId, id);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
  };

  const enableMedicineNotifications = async () => {
    setMedicineReminderSnapshot(await medicineReminderService.enableNotifications(activeUserId));
  };

  const disableAllMedicineReminders = async () => {
    for (const reminder of medicineReminderSnapshot.reminders) {
      await medicineReminderService.updateReminder(activeUserId, reminder.id, { times: reminder.times, active: false });
    }
    await refreshMedicineReminders();
  };

  const recordMedicineAdherence = async (reminderId: string, time: string, action: PatientAdherenceAction) => {
    setMedicineReminderSnapshot(await medicineReminderService.recordAdherenceFromApp(activeUserId, reminderId, time, action));
  };

  const snoozeMedicineReminder = async (reminderId: string, time: string) => {
    setMedicineReminderSnapshot(await medicineReminderService.snoozeFromApp(activeUserId, reminderId, time));
  };

  // Save new observation (e.g. self reported sugar/BP)
  const handleSaveVital = (newObs: FhirObservation) => {
    setObservations((prev) => [newObs, ...prev]);
    apiService.logObservation(newObs).catch(console.error);

    // Send confirmation in VDA chat
    const confirmMsg: ChatMessage = {
      id: `vital-conf-${Date.now()}`,
      sender: 'vda',
      agent: 'lab_explainer',
      text: `Recorded new ${newObs.display} of ${newObs.value} ${newObs.unit} in this pilot app.`,
      textHi: `नया माप दर्ज किया गया: ${newObs.displayHi || newObs.display} (${newObs.value} ${newObs.unit})। आपके स्वास्थ्य रिकॉर्ड में सुरक्षित हो गया।`,
      textTa: `புதிய அளவீடு பதிவு செய்யப்பட்டது: ${newObs.displayTa || newObs.display} (${newObs.value} ${newObs.unit})। உங்கள் சுகாதார பதிவில் சேர்க்கப்பட்டது.`,
      textKn: `ಹೊಸ ರೀಡಿಂಗ್ ದಾಖಲಾಗಿದೆ: ${newObs.displayKn || newObs.display} (${newObs.value} ${newObs.unit})। ನಿಮ್ಮ ಆರೋಗ್ಯ ದಾಖಲೆಯಲ್ಲಿ ಸೇರಿಸಲಾಗಿದೆ.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  // Revoke consent
  const handleRevokeConsent = (consentId: string) => {
    playChime('stop');
    apiService.revokeConsent(consentId).catch(console.error);
    setConsents((prev) =>
      prev.map((c) => (c.id === consentId ? { ...c, status: 'REVOKED' } : c))
    );
  };

  if (!authReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-emerald-400">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="w-8 h-8 animate-pulse text-emerald-400" />
          <span className="text-xs font-bold font-mono tracking-wider">VDA HEALTH NAVIGATOR</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        currentLang={lang}
        onLangChange={setLang}
        onAuthenticated={(u) => {
          setCurrentUser(u);
          if (u.language) setLang(u.language);
        }}
      />
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-950 text-slate-100 flex justify-center selection:bg-emerald-500 selection:text-white overflow-hidden">
      {/* Responsive Full-Screen Mobile App Container (Up to max-w-xl on larger screens) */}
      <div className="w-full max-w-xl h-full max-h-full bg-slate-950 flex flex-col relative border-x border-slate-800/80 shadow-2xl overflow-hidden">
        
        {/* Log Vital Metric Modal */}
        <LogVitalModal
          isOpen={isLogVitalOpen}
          onClose={() => setIsLogVitalOpen(false)}
          onSaveVital={handleSaveVital}
          lang={lang}
        />

        {isMedicineRemindersOpen && (
          <MedicineRemindersModal
            lang={lang}
            draft={prescriptionReminderDraft}
            snapshot={medicineReminderSnapshot}
            contextSyncError={prescriptionContextSyncError}
            onClose={() => setIsMedicineRemindersOpen(false)}
            onConfirmDraft={confirmPrescriptionReminders}
            onUpdateReminder={updateMedicineReminder}
            onDeleteReminder={deleteMedicineReminder}
            onEnableNotifications={enableMedicineNotifications}
            onDisableAll={disableAllMedicineReminders}
          />
        )}

        {/* Main Tab Screen Switcher */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'vda' && (
            <VdaTab
              patient={patient}
              lang={lang}
              messages={messages}
              medicineReminderSnapshot={medicineReminderSnapshot}
              emergencyFallback={emergencyFallback}
              isProcessing={isProcessingMessage}
              onSendMessage={handleSendMessage}
              activeReminderStepId={activeReminderStepId}
              reminderStepStates={reminderStepStates}
              onReminderQuickAction={handleReminderQuickAction}
              onNavigateTab={setActiveTab}
              onTriggerEscalation={handleTriggerEscalation}
              onOpenLogVital={() => setIsLogVitalOpen(true)}
              onOpenMedicineReminders={openMedicineReminderConfiguration}
              onRecordMedicineAdherence={recordMedicineAdherence}
              onSnoozeMedicineReminder={snoozeMedicineReminder}
              onOpenEmergencyTeleconsultation={openEmergencyEsanjeevani}
              onDismissEmergency={dismissEmergencyFallback}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersTab
              lang={lang}
              snapshot={medicineReminderSnapshot}
              prescriptionState={prescriptionReminderDraft}
              latestSubmission={latestPrescriptionSubmission}
              contextSyncError={prescriptionContextSyncError}
              onRecordAdherence={recordMedicineAdherence}
              onSnooze={snoozeMedicineReminder}
              onDeleteReminder={deleteMedicineReminder}
              onEnableNotifications={enableMedicineNotifications}
              onOpenUploadPrescription={openMedicineReminderConfiguration}
              onResubmitPrescription={() => {
                setIsMedicineRemindersOpen(false);
                setActiveTab('vda');
              }}
              onClearAllReminders={disableAllMedicineReminders}
            />
          )}

          {activeTab === 'facilities' && (
            <PatientFacilitiesTab
              facilities={facilities}
              schemes={schemes}
              scope={directoryScope}
              status={directoryStatus}
              error={directoryError}
              lang={lang}
              onRetry={() => {
                directoryLoadKeyRef.current = null;
                void loadPatientDirectories(true);
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab
              user={currentUser}
              lang={lang}
              onLangChange={setLang}
              onProfileUpdated={(updated) => setCurrentUser(updated)}
              onLogout={() => {
                setCurrentUser(null);
                setActiveSessionId(null);
              }}
              onClearLocalData={async () => {
                await disableAllMedicineReminders();
              }}
            />
          )}
        </main>

        {/* Bottom Primary Mobile Navigation Tab Bar (44px+ touch targets) */}
        <nav aria-label="Main Navigation" className="flex-shrink-0 w-full bg-slate-900/95 border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-30 backdrop-blur-md">
          <button
            id="nav-tab-vda"
            onClick={() => {
              playChime('start');
              setActiveTab('vda');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'vda'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'vda' ? 'bg-emerald-500/20' : ''}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabVda')}</span>
          </button>

          <button
            id="nav-tab-reminders"
            onClick={() => {
              playChime('start');
              setActiveTab('reminders');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'reminders'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'reminders' ? 'bg-emerald-500/20' : ''}`}>
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">
              {lang === 'hi' ? 'दवाइयां' : lang === 'ta' ? 'மருந்துகள்' : lang === 'kn' ? 'ಔಷಧಿಗಳು' : 'Medicines'}
            </span>
          </button>

          <button
            id="nav-tab-facilities"
            onClick={() => {
              playChime('start');
              setActiveTab('facilities');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'facilities'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'facilities' ? 'bg-emerald-500/20' : ''}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabFacilities')}</span>
          </button>

          <button
            id="nav-tab-profile"
            onClick={() => {
              playChime('start');
              setActiveTab('profile');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-emerald-500/20' : ''}`}>
              <User className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabProfile')}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
