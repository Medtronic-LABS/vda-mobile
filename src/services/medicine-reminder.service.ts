import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import type { LanguageCode } from '../types';

const STORAGE_GROUP = 'VDA_Medicine_Reminders';
const STORAGE_KEY = 'medicine-reminder-store-v1';
const ACTION_TYPE_ID = 'VDA_MEDICINE_REMINDER_ACTIONS';
const ACTION_TAKEN = 'TAKEN';
const ACTION_SNOOZE = 'SNOOZE';
const SNOOZE_MINUTES = 15;
const MAX_SNOOZES_PER_SLOT = 1;

export type PrescriptionMedicine = {
  medicationName?: string | null;
  normalizedName?: string | null;
  strength?: string | null;
  dosage?: string | null;
  dosageForm?: string | null;
  frequency?: string | null;
  timing?: string | null;
  duration?: string | null;
  instructions?: string | null;
  confidence?: string | null;
};

export type PrescriptionUpload = {
  id: string;
  prescriptionId?: string;
  extractionStatus?: string;
  verificationStatus?: PrescriptionVerificationStatus;
  activePlan?: boolean;
  planRevision?: number;
  medications?: PrescriptionMedicine[];
  patientReviewReason?: string | null;
  createdAt?: string;
};

export type PrescriptionVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'NEEDS_RESUBMISSION'
  | 'SUPERSEDED';

export type PatientAdherenceAction = 'TAKEN' | 'SKIPPED' | 'NOT_TAKEN';
export type ReminderAcknowledgementStatus = PatientAdherenceAction | 'SNOOZED' | 'NOT_CONFIRMED';

export type DraftMedicineReminder = {
  id: string;
  medicineIndex: number;
  medicineName: string;
  dosageText: string;
  frequency: string | null;
  timing: string | null;
  duration: string | null;
  times: string[];
  enabled: boolean;
  requiresConfirmation: boolean;
  confirmed: boolean;
  uncertaintyReason?: string;
};

export type PrescriptionReminderDraft = {
  id: string;
  patientId: string;
  prescriptionId: string;
  createdAt: string;
  extractionStatus: 'EXTRACTED' | 'APPROVED' | 'REVIEW_REQUIRED' | 'EXTRACTION_FAILED';
  verificationStatus: PrescriptionVerificationStatus;
  activePlan: boolean;
  planRevision: number;
  patientReviewReason: string | null;
  medicines: DraftMedicineReminder[];
};

export type LocalMedicineReminder = {
  id: string;
  prescriptionId: string;
  planRevision: number;
  medicineId: string;
  medicineIndex: number;
  medicineName: string;
  dosageText: string;
  frequency: string | null;
  times: string[];
  startDate: string;
  endDate?: string;
  active: boolean;
  /** Patient explicitly confirmed this extracted medicine in the local review UI. */
  confirmed: boolean;
  uncertaintyReason?: string;
  notificationIds: number[];
  createdAt: string;
};

export type LocalPrescriptionMedicine = {
  id: string;
  medicineIndex: number;
  medicineName: string;
  dosageText: string;
  frequency: string | null;
  administrationInstruction: string | null;
  extractedTimingText: string | null;
  confirmed: boolean;
  requiresConfirmation: boolean;
  uncertaintyReason?: string;
};

export type LocalPrescription = {
  id: string;
  processedAt: string;
  status: 'PROCESSING' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REVIEW_REQUIRED' | 'EXTRACTION_FAILED';
  verificationStatus: PrescriptionVerificationStatus;
  activePlan: boolean;
  planRevision: number;
  medicines: LocalPrescriptionMedicine[];
};

export type LocalReminderEvent = {
  id: string;
  occurrenceId?: string;
  reminderId: string;
  medicineId: string;
  prescriptionId?: string;
  planRevision?: number;
  medicineIndex?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledAt: string;
  acknowledgedAt: string;
  status: ReminderAcknowledgementStatus;
};

export type MedicineReminderProgress = {
  scheduledToday: number;
  takenToday: number;
  currentStreakDays: number;
};

export type MedicineReminderSnapshot = {
  reminders: LocalMedicineReminder[];
  progress: MedicineReminderProgress;
  notificationPermission: 'granted' | 'denied' | 'unavailable' | 'unknown';
  todayTakenKeys: string[];
  todayOutcomeByKey: Record<string, PatientAdherenceAction>;
  /** Local confirmed source used only to refresh the server-held safe session context. */
  activePrescription: LocalPrescription | null;
};

type PatientReminderStore = {
  prescriptions: LocalPrescription[];
  activePrescriptionId?: string | null;
  reminders: LocalMedicineReminder[];
  events: LocalReminderEvent[];
  notificationPermission: MedicineReminderSnapshot['notificationPermission'];
};

type ReminderStore = { patients: Record<string, PatientReminderStore> };

const defaultPatientStore = (): PatientReminderStore => ({
  prescriptions: [], activePrescriptionId: null, reminders: [], events: [], notificationPermission: 'unknown',
});

const localDateKey = (date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return formatter.format(date);
};

// Calendar arithmetic must use the same India day as reminders, even when the
// browser or phone is running in another time zone.
const previousLocalDateKey = (day: string, days = 1): string => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date - days)).toISOString().slice(0, 10);
};

const safeId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const occurrenceIdentity = (
  patientId: string,
  reminder: Pick<LocalMedicineReminder, 'prescriptionId' | 'planRevision' | 'medicineId'>,
  scheduledDate: string,
  scheduledTime: string,
) => [patientId, reminder.prescriptionId, reminder.planRevision, reminder.medicineId, scheduledDate, scheduledTime].join('|');

const notificationId = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2_000_000_000 || 1;
};

const frequencyCount = (frequency?: string | null): number | null => {
  const value = (frequency || '').toLowerCase();
  if (/\b(three times|tds|tid|3 times)\b/.test(value)) return 3;
  if (/\b(twice|bd|bid|2 times)\b/.test(value)) return 2;
  if (/\b(once|od|daily|1 time)\b/.test(value)) return 1;
  return null;
};

type ParsedReminderTime = { value?: string; ambiguous: boolean; hour?: number; minute?: number };

const hindiNumberWords: Record<string, string> = {
  'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5', 'छह': '6',
  'सात': '7', 'आठ': '8', 'नौ': '9', 'दस': '10', 'ग्यारह': '11', 'बारह': '12',
};

const normalizeTimeWords = (value: string) => Object.entries(hindiNumberWords)
  .reduce((result, [word, number]) => result.replace(new RegExp(word, 'g'), number), value.toLowerCase());

/** Parses a patient-provided clock time without assigning an AM/PM value that was not stated. */
export const parseReminderTime = (input: string): ParsedReminderTime => {
  const normalized = normalizeTimeWords(input);
  const match = normalized.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(?:बजे|baje|o'?clock|am|a\.m\.|pm|p\.m\.)?/i);
  if (!match) return { ambiguous: false };
  const hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59 || hour > 23 || hour === 0) return { ambiguous: false };
  const prefix = normalized.slice(Math.max(0, match.index! - 16), match.index! + match[0].length + 12);
  const isAm = /\b(?:am|a\.m\.)\b|सुबह|morning/.test(prefix);
  const isPm = /\b(?:pm|p\.m\.)\b|दोपहर|शाम|रात|afternoon|evening|night/.test(prefix);
  if (isAm && isPm) return { ambiguous: false };
  // A leading zero (08:00) and 13:00-23:59 are explicit 24-hour values. A plain
  // “7 बजे” is deliberately not scheduled until the patient says morning/evening.
  const isExplicit24Hour = hour > 12 || (match[1].length === 2 && match[1].startsWith('0'));
  if (!isAm && !isPm && !isExplicit24Hour && hour <= 12) return { ambiguous: true, hour, minute };
  const hour24 = isPm && hour < 12 ? hour + 12 : isAm && hour === 12 ? 0 : hour;
  return { value: `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, ambiguous: false };
};

/** Only explicit, unambiguous clock values can become a notification time. */
const mappedTimes = (medicine: PrescriptionMedicine): string[] => {
  const source = `${medicine.frequency || ''} ${medicine.timing || ''} ${medicine.instructions || ''}`;
  const parsed = parseReminderTime(source);
  const count = frequencyCount(medicine.frequency);
  const explicit = parsed.value ? [parsed.value] : [];
  const required = count || explicit.length || 1;
  return explicit.concat(Array.from({ length: Math.max(0, required - explicit.length) }, () => ''));
};

const dosageText = (medicine: PrescriptionMedicine) =>
  [medicine.strength, medicine.dosage].filter(Boolean).join(' • ') || 'खुराक की पुष्टि करें';

const medicineQuestionPattern = /(?:\b(?:medicine|medicines|medication|dose|dosage|tablet|tablets|pill|pills|reminder|reminders|prescription|dawai|dava)\b|दवाई|दवाइ|दवा|मेडिसिन|औषधि|गोली|गोलियां|खुराक|पर्ची|टैबलेट|रिमाइंडर|(?:कब|समय|कितनी बार)\s*(?:लेना|लूं|लूँ|लें|खाना|दवा|गोली|टैबलेट|रिमाइंडर)|(?:सुबह|शाम|रात)\s*(?:की|को)?\s*(?:दवा|गोली|टैबलेट|रिमाइंडर))/i;
const unsafeMedicineActionPattern = /(?:\b(?:increase|decrease|stop|start|change|adjust|double)\b.{0,32}\b(?:dose|dosage|medicine|medication|pill)\b|\b(?:taking double|double the dose|stop taking)\b|दवा\s*(?:बढ़ाना|घटाना|बंद|बदलना|शुरू)|(?:डबल|दोगुनी)\s*(?:खुराक|dose)|(?:दो|2)\s*(?:गोली|tablet|tablets|pills?)|(?:dose|dawa|medicine|dosage|medication)\s+(?:increase|decrease|stop|start|change|adjust|double|kam|zyada|badhana|ghatana|band))/i;

export type PrescriptionMedicineQueryRoute =
  | 'PRESCRIPTION_FACT'
  | 'MEDICINE_EDUCATION'
  | 'MEDICATION_SAFETY'
  | 'REMINDER_QUERY'
  | 'NONE';

const medicineEducationPattern = /(?:किस\s*(?:लिए|काम)|kis\s*(?:liye|liye)|क्या\s*(?:करती|करता|है)|kya\s*(?:karti|karta)|क्या\s*काम|what\s*(?:does|is)|why\s*(?:is|was)|use\s*(?:करते|करती|hoti|hota|hai)|क्यों\s*(?:दी|दिया|लिखी)|kyon\s*(?:di|likhi)|काम\s*(?:की|का|है))/i;
// Only explicit reminder questions enter the device reminder path. Medicine
// timing, education, and safety questions continue through VDA agents.
const reminderQueryPattern = /(?:reminder|रिमाइंडर)/i;
const namedMedicineTimingPattern = /\b(?:kab\s+(?:leni|lena|loon|lu)\s+hai|when\s+(?:should\s+i\s+)?take)\b|कब\s*(?:लेनी|लेना|लूं|लूँ|लें)\s*है/i;
const hasNamedPrescriptionMedicine = (query: string, prescription: LocalPrescription): boolean => {
  const normalized = query.toLowerCase();
  return prescription.medicines.some((medicine) => (
    medicine.confirmed && normalized.includes(medicine.medicineName.toLowerCase())
  ));
};

/** Classifies prescription-only medicine questions without using patient clinical data. */
export const classifyPrescriptionMedicineQuery = (
  query: string,
  snapshot: MedicineReminderSnapshot,
): { route: PrescriptionMedicineQueryRoute } => {
  const prescription = snapshot.activePrescription;
  const normalized = query.toLowerCase();
  const hasNamedMedicine = prescription ? hasNamedPrescriptionMedicine(query, prescription) : false;

  if (isUnsafeMedicineAction(query)) return { route: 'MEDICATION_SAFETY' };
  if (reminderQueryPattern.test(normalized)) return { route: 'REMINDER_QUERY' };
  if (medicineEducationPattern.test(normalized)) return { route: 'MEDICINE_EDUCATION' };
  if (medicineQuestionPattern.test(query) || hasNamedMedicine || namedMedicineTimingPattern.test(query)) return { route: 'PRESCRIPTION_FACT' };
  return { route: 'NONE' };
};

/** Marks a short prescription follow-up for server-side sanitized-context resolution. */
export const isPrescriptionMedicineFollowUp = (query: string): boolean => /(?:\b(?:ye|this|it|these|them)\b|इसे|इसको|इन्हें|इनको|कब|समय|timing|time|सुबह|शाम)/i.test(query.trim());

/** A routing guard only; the backend SafetyGate remains the authority for WITHHOLD decisions. */
export const isUnsafeMedicineAction = (query: string): boolean => unsafeMedicineActionPattern.test(query);

export const classifyAdherenceQuestion = (query: string): 'PENDING' | 'MISSED' | 'STREAK' | 'CORRECTION' | null => {
  // Status is device-local, but a combined status + dosing decision must use
  // the backend clinical safety route rather than this local answer.
  if (isUnsafeMedicineAction(query)
    || /(?:\b(?:should i|can i|what should i|kya main|abhi|now)\b.{0,40}\b(?:take|skip|double|le\s*lu|loon|lena)\b|(?:क्या\s*मैं|अभी|अब).{0,40}(?:ले\s*लूं|ले\s*लूँ|छोड़\s*दूं|दोगुनी))/i.test(query)) return null;
  if (/\b(?:galti|galat|accidental(?:ly)?|mistake|wrong)\b.{0,45}\b(?:taken|mark|le\s*li|liya)\b|गलती.{0,45}(?:ले ली|मार्क|दर्ज)/i.test(query)) return 'CORRECTION';
  if (/\b(?:streak|lagatar|continuous)\b|लगातार.{0,25}(?:दिन|दवा)|स्ट्रीक/i.test(query)) return 'STREAK';
  const medicine = medicineQuestionPattern.test(query);
  if (medicine && /\b(?:pending|remaining|left to take|baaki|baki)\b|बाकी|लंबित/i.test(query)) return 'PENDING';
  if (medicine && /\b(?:missed|skip(?:ped)?|bhool|chhoot)\b|छूट|भूल/i.test(query)
    && /\b(?:show|list|dikhao|kal|yesterday|which|kaunsi|konsi)\b|दिखाओ|कौनसी|कौन\s*सी|कल/i.test(query)) return 'MISSED';
  return null;
};

export const prescriptionToReminderDraft = (patientId: string, prescription: PrescriptionUpload): PrescriptionReminderDraft => {
  const rawExtractionStatus = (prescription.extractionStatus || ((prescription.medications || []).length ? 'EXTRACTED' : 'REVIEW_REQUIRED')).toUpperCase();
  const extractionStatus: PrescriptionReminderDraft['extractionStatus'] = rawExtractionStatus === 'APPROVED'
    ? 'APPROVED'
    : rawExtractionStatus === 'EXTRACTED'
      ? 'EXTRACTED'
      : rawExtractionStatus === 'EXTRACTION_FAILED' || rawExtractionStatus === 'FAILED'
        ? 'EXTRACTION_FAILED'
        : 'REVIEW_REQUIRED';
  const verificationStatus = prescription.verificationStatus || 'UNVERIFIED';
  // Only a backend worker-verified plan may become device medication truth.
  const trustedExtraction = verificationStatus === 'VERIFIED';
  return {
    id: safeId(),
    patientId,
    // The context endpoint requires the database record `id`; the separate
    // public/domain `prescriptionId` is deliberately not interchangeable.
    prescriptionId: prescription.id,
    createdAt: new Date().toISOString(),
    extractionStatus: trustedExtraction
      ? extractionStatus
      : extractionStatus === 'EXTRACTION_FAILED'
        ? 'EXTRACTION_FAILED'
        : 'REVIEW_REQUIRED',
    verificationStatus,
    activePlan: Boolean(prescription.activePlan),
    planRevision: prescription.planRevision || 1,
    patientReviewReason: prescription.patientReviewReason?.trim() || null,
    medicines: trustedExtraction ? (prescription.medications || []).flatMap((medicine, index) => {
    const medicineName = (medicine.normalizedName || medicine.medicationName || '').trim();
    if (!medicineName) return [];
    const lowConfidence = (medicine.confidence || 'LOW').toUpperCase() === 'LOW';
    const times = mappedTimes(medicine);
    const requiresTimeConfirmation = times.some((time) => !time);
    return [{
      id: `${prescription.id}-${index}`,
      medicineIndex: index,
      medicineName,
      dosageText: dosageText(medicine),
      frequency: medicine.frequency || null,
      timing: medicine.timing || null,
      duration: medicine.duration || null,
      times,
      enabled: verificationStatus === 'VERIFIED',
      requiresConfirmation: lowConfidence || requiresTimeConfirmation,
      confirmed: !lowConfidence,
      uncertaintyReason: lowConfidence
        ? 'OCR में इस दवा की जानकारी साफ़ नहीं है। नाम और समय देखकर पुष्टि करें।'
        : requiresTimeConfirmation
          ? 'समय पर्ची में साफ़ नहीं है। अपनी सुविधा का समय चुनें।'
          : undefined,
    }];
    }) : [],
  };
};

/** Builds a reminder-preference draft from the already synchronized verified plan. */
export const localPrescriptionToReminderDraft = (
  patientId: string,
  prescription: LocalPrescription,
): PrescriptionReminderDraft => ({
  id: `local-reminder-draft:${prescription.id}:${prescription.planRevision}`,
  patientId,
  prescriptionId: prescription.id,
  createdAt: prescription.processedAt,
  extractionStatus: 'APPROVED',
  verificationStatus: prescription.verificationStatus,
  activePlan: prescription.activePlan,
  planRevision: prescription.planRevision,
  patientReviewReason: null,
  medicines: prescription.medicines.map((medicine) => ({
    id: medicine.id,
    medicineIndex: medicine.medicineIndex,
    medicineName: medicine.medicineName,
    dosageText: medicine.dosageText,
    frequency: medicine.frequency,
    timing: medicine.extractedTimingText,
    duration: null,
    times: Array.from({ length: frequencyCount(medicine.frequency) || 1 }, () => ''),
    // The patient must explicitly choose whether to enable each reminder.
    enabled: false,
    requiresConfirmation: medicine.requiresConfirmation,
    confirmed: medicine.confirmed,
    uncertaintyReason: medicine.uncertaintyReason,
  })),
});

export class MedicineReminderService {
  private initialized = false;

  private async configure() {
    await Preferences.configure({ group: STORAGE_GROUP });
  }

  private async readStore(): Promise<ReminderStore> {
    await this.configure();
    const stored = await Preferences.get({ key: STORAGE_KEY });
    if (!stored.value) return { patients: {} };
    try {
      const parsed = JSON.parse(stored.value) as ReminderStore;
      if (!parsed?.patients) return { patients: {} };
      let storeChanged = false;
      const revokedNotificationIds: number[] = [];
      // Migrate only prior device-local reminder records. No backend/FHIR data is read.
      for (const [patientId, patient] of Object.entries(parsed.patients)) {
        if (!Array.isArray(patient.prescriptions)) patient.prescriptions = [];
        if (!Array.isArray(patient.reminders)) patient.reminders = [];
        if (!Array.isArray(patient.events)) { patient.events = []; storeChanged = true; }
        for (const prescription of patient.prescriptions) {
          // Pre-Phase-1 local data had no worker-verification proof. It must
          // never be promoted to an active clinical plan during migration.
          if (!prescription.verificationStatus) {
            prescription.verificationStatus = 'UNVERIFIED';
            storeChanged = true;
          }
          if (typeof prescription.activePlan !== 'boolean') { prescription.activePlan = false; storeChanged = true; }
          if (!Number.isInteger(prescription.planRevision) || prescription.planRevision < 1) { prescription.planRevision = 1; storeChanged = true; }
          prescription.medicines = (prescription.medicines || []).map((medicine, index) => {
            if (Number.isInteger(medicine.medicineIndex) && medicine.medicineIndex >= 0) return medicine;
            storeChanged = true;
            return { ...medicine, medicineIndex: index };
          });
          if (prescription.verificationStatus !== 'VERIFIED') {
            const safeStatus = prescription.status === 'PROCESSING'
              ? 'PROCESSING'
              : prescription.status === 'REVIEW_REQUIRED' || prescription.status === 'EXTRACTION_FAILED'
                ? prescription.status
                : 'PENDING_VERIFICATION';
            if (prescription.status !== safeStatus) {
              prescription.status = safeStatus;
              storeChanged = true;
            }
          }
        }
        const hasStructuredPrescription = patient.prescriptions.some((prescription) => Array.isArray(prescription?.medicines));
        if (!hasStructuredPrescription && patient.reminders.length) {
          patient.prescriptions.unshift({
            id: `local-migrated-${safeId()}`,
            processedAt: new Date().toISOString(),
            status: 'PENDING_VERIFICATION',
            verificationStatus: 'UNVERIFIED',
            activePlan: false,
            planRevision: 1,
            medicines: patient.reminders.map((reminder, index) => ({
              id: reminder.id,
              medicineIndex: index,
              medicineName: reminder.medicineName,
              dosageText: reminder.dosageText,
              frequency: reminder.frequency,
              administrationInstruction: null,
              extractedTimingText: null,
              confirmed: reminder.confirmed === true,
              requiresConfirmation: reminder.confirmed !== true,
              uncertaintyReason: reminder.uncertaintyReason,
            })),
          });
          storeChanged = true;
        }
        const activePrescription = patient.prescriptions.find((prescription) =>
          prescription.id === patient.activePrescriptionId &&
          prescription.verificationStatus === 'VERIFIED',
        );
        const nextActivePrescriptionId = activePrescription?.id || null;
        if (patient.activePrescriptionId !== nextActivePrescriptionId) {
          patient.activePrescriptionId = nextActivePrescriptionId;
          storeChanged = true;
        }
        patient.reminders = patient.reminders.map((reminder) => {
          const sourcePrescription = patient.prescriptions.find((prescription) => prescription.id === reminder.prescriptionId);
          const sourceMedicine = sourcePrescription?.medicines.find((medicine) => (
            medicine.id === reminder.medicineId || medicine.medicineName === reminder.medicineName
          ));
          const normalizedReminder = {
            ...reminder,
            medicineId: reminder.medicineId || sourceMedicine?.id || reminder.id,
            medicineIndex: Number.isInteger(reminder.medicineIndex)
              ? reminder.medicineIndex
              : sourceMedicine?.medicineIndex ?? 0,
            planRevision: reminder.planRevision || sourcePrescription?.planRevision || 1,
          };
          if (normalizedReminder.medicineId !== reminder.medicineId || normalizedReminder.medicineIndex !== reminder.medicineIndex || normalizedReminder.planRevision !== reminder.planRevision) {
            storeChanged = true;
          }
          return {
            ...normalizedReminder,
            active: (() => {
              const safeActive = normalizedReminder.active && patient.prescriptions.some((prescription) =>
                prescription.id === normalizedReminder.prescriptionId &&
                prescription.planRevision === normalizedReminder.planRevision &&
                prescription.verificationStatus === 'VERIFIED' &&
                prescription.activePlan,
              );
              if (normalizedReminder.active && !safeActive) {
                revokedNotificationIds.push(...(normalizedReminder.notificationIds || []));
                storeChanged = true;
              }
              return safeActive;
            })(),
          };
        });
        patient.events = patient.events.map((event) => {
          if (event.status === 'SNOOZED' || event.occurrenceId) return event;
          const reminder = patient.reminders.find((item) => item.id === event.reminderId);
          if (!reminder) return event;
          const scheduledDate = event.scheduledDate || localDateKey(new Date(event.scheduledAt));
          const scheduledTime = event.scheduledTime || event.scheduledAt.slice(11, 16);
          storeChanged = true;
          return {
            ...event,
            occurrenceId: occurrenceIdentity(patientId, reminder, scheduledDate, scheduledTime),
            prescriptionId: reminder.prescriptionId,
            planRevision: reminder.planRevision,
            medicineIndex: reminder.medicineIndex,
            medicineId: reminder.medicineId,
            scheduledDate,
            scheduledTime,
          };
        });
      }
      if (Capacitor.isNativePlatform() && revokedNotificationIds.length) {
        await LocalNotifications.cancel({
          notifications: [...new Set(revokedNotificationIds)].map((id) => ({ id })),
        });
      }
      if (storeChanged) {
        await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(parsed) });
      }
      return parsed;
    } catch {
      return { patients: {} };
    }
  }

  private async writeStore(store: ReminderStore) {
    await this.configure();
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(store) });
  }

  private async patientStore(patientId: string): Promise<[ReminderStore, PatientReminderStore]> {
    const store = await this.readStore();
    const patient = store.patients[patientId] || defaultPatientStore();
    store.patients[patientId] = patient;
    return [store, patient];
  }

  async beginPrescriptionProcessing(patientId: string): Promise<void> {
    const [store, patient] = await this.patientStore(patientId);
    patient.prescriptions = [{
      id: safeId(), processedAt: new Date().toISOString(), status: 'PROCESSING', verificationStatus: 'UNVERIFIED', activePlan: false, planRevision: 1, medicines: [],
    }, ...patient.prescriptions];
    await this.writeStore(store);
  }

  async saveExtractedPrescription(draft: PrescriptionReminderDraft): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(draft.patientId);
    const previousActiveId = patient.activePrescriptionId;
    const prescription: LocalPrescription = {
      id: draft.prescriptionId,
      processedAt: new Date().toISOString(),
      status: draft.extractionStatus === 'REVIEW_REQUIRED'
        ? 'REVIEW_REQUIRED'
        : draft.extractionStatus === 'EXTRACTION_FAILED' || !draft.medicines.length
          ? 'EXTRACTION_FAILED'
          : draft.verificationStatus === 'VERIFIED'
            ? 'VERIFIED'
            : 'PENDING_VERIFICATION',
      verificationStatus: draft.verificationStatus,
      activePlan: draft.activePlan,
      planRevision: draft.planRevision,
      medicines: draft.medicines.map((medicine) => ({
        id: medicine.id,
        medicineIndex: medicine.medicineIndex,
        medicineName: medicine.medicineName,
        dosageText: medicine.dosageText,
        frequency: medicine.frequency,
        administrationInstruction: medicine.timing || medicine.duration || null,
        extractedTimingText: medicine.timing,
        confirmed: medicine.confirmed,
        requiresConfirmation: medicine.requiresConfirmation,
        uncertaintyReason: medicine.uncertaintyReason,
      })),
    };
    patient.prescriptions = [prescription, ...patient.prescriptions.filter((item) => item.id !== prescription.id && item.status !== 'PROCESSING')];
    if (
      prescription.verificationStatus === 'VERIFIED'
      && prescription.medicines.length > 0
      && prescription.medicines.every((medicine) => medicine.confirmed)
    ) {
      // A newer trusted, confirmed prescription replaces—not merges with—the
      // prior device-local medicine source.
      if (previousActiveId && previousActiveId !== prescription.id) {
        const obsolete = patient.reminders.filter((reminder) => reminder.prescriptionId === previousActiveId && reminder.active);
        const ids = obsolete.flatMap((reminder) => reminder.notificationIds).map((id) => ({ id }));
        if (Capacitor.isNativePlatform() && ids.length) await LocalNotifications.cancel({ notifications: ids });
        patient.reminders = patient.reminders.map((reminder) => reminder.prescriptionId === previousActiveId
          ? { ...reminder, active: false, notificationIds: [] }
          : reminder);
      }
      patient.activePrescriptionId = prescription.id;
    }
    await this.writeStore(store);
    return this.snapshot(draft.patientId);
  }

  async markPrescriptionExtractionFailed(patientId: string): Promise<void> {
    const [store, patient] = await this.patientStore(patientId);
    const latest = patient.prescriptions[0];
    if (latest?.status === 'PROCESSING') latest.status = 'EXTRACTION_FAILED';
    await this.writeStore(store);
  }

  private progress(patient: PatientReminderStore): MedicineReminderProgress {
    const today = localDateKey();
    const active = patient.reminders.filter((reminder) => reminder.active);
    const activeReminderIds = new Set(active.map((reminder) => reminder.id));
    const eligibleForDay = (day: string) => active.filter((reminder) =>
      reminder.startDate <= day && (!reminder.endDate || reminder.endDate >= day));
    const outcomesForDay = (day: string) => patient.events.reduce<Record<string, PatientAdherenceAction>>((outcomes, event) => {
      if ((event.status === 'TAKEN' || event.status === 'SKIPPED' || event.status === 'NOT_TAKEN')
        && activeReminderIds.has(event.reminderId)
        && (event.scheduledDate || localDateKey(new Date(event.scheduledAt))) === day) {
        outcomes[`${event.reminderId}:${event.scheduledTime || event.scheduledAt.slice(11, 16)}`] = event.status;
      }
      return outcomes;
    }, {});
    const todayReminders = eligibleForDay(today);
    const scheduledToday = todayReminders.reduce((count, reminder) => count + reminder.times.length, 0);
    const todayOutcomes = outcomesForDay(today);
    const takenToday = todayReminders.reduce((count, reminder) => count + reminder.times.filter((time) =>
      todayOutcomes[`${reminder.id}:${time}`] === 'TAKEN').length, 0);
    let currentStreakDays = 0;
    // An unfinished day does not erase a completed streak through yesterday.
    // An explicit skipped/not-taken outcome does end today's streak.
    const explicitlyNotTakenToday = todayReminders.some((reminder) => reminder.times.some((time) =>
      todayOutcomes[`${reminder.id}:${time}`] === 'SKIPPED'
      || todayOutcomes[`${reminder.id}:${time}`] === 'NOT_TAKEN'));
    if (explicitlyNotTakenToday) return { scheduledToday, takenToday, currentStreakDays };
    const firstOffset = scheduledToday > 0 && takenToday === scheduledToday ? 0 : 1;
    for (let offset = firstOffset; offset < 365; offset += 1) {
      const dayKey = previousLocalDateKey(today, offset);
      const eligible = eligibleForDay(dayKey);
      if (!eligible.length) break;
      const total = eligible.reduce((count, reminder) => count + reminder.times.length, 0);
      const outcomes = offset === 0 ? todayOutcomes : outcomesForDay(dayKey);
      const completed = eligible.reduce((count, reminder) => count + reminder.times.filter((time) =>
        outcomes[`${reminder.id}:${time}`] === 'TAKEN').length, 0);
      if (completed < total) break;
      currentStreakDays += 1;
    }
    return { scheduledToday, takenToday, currentStreakDays };
  }

  async snapshot(patientId: string): Promise<MedicineReminderSnapshot> {
    const [, patient] = await this.patientStore(patientId);
    const activePrescription = patient.prescriptions.find((prescription) => prescription.id === patient.activePrescriptionId) || null;
    const activePlanReminders = activePrescription
      ? patient.reminders.filter((reminder) => (
          reminder.prescriptionId === activePrescription.id
          && reminder.planRevision === activePrescription.planRevision
        ))
      : [];
    const today = localDateKey();
    const activeReminderIds = new Set(activePlanReminders.map((reminder) => reminder.id));
    const todayOutcomeByKey = patient.events.reduce<Record<string, PatientAdherenceAction>>((outcomes, event) => {
      if (
        (event.status === 'TAKEN' || event.status === 'SKIPPED' || event.status === 'NOT_TAKEN')
        && activeReminderIds.has(event.reminderId)
        && (event.scheduledDate || localDateKey(new Date(event.scheduledAt))) === today
      ) {
        outcomes[`${event.reminderId}:${event.scheduledTime || event.scheduledAt.slice(11, 16)}`] = event.status;
      }
      return outcomes;
    }, {});
    const todayTakenKeys = Object.entries(todayOutcomeByKey)
      .filter(([, status]) => status === 'TAKEN')
      .map(([key]) => key);
    return {
      reminders: activePlanReminders,
      progress: this.progress(patient),
      notificationPermission: patient.notificationPermission,
      todayTakenKeys,
      todayOutcomeByKey,
      activePrescription,
    };
  }

  async answerAdherenceQuestion(patientId: string, query: string, language: LanguageCode): Promise<string | null> {
    const kind = classifyAdherenceQuestion(query);
    if (!kind) return null;
    const [, patient] = await this.patientStore(patientId);
    const snapshot = await this.snapshot(patientId);
    const hindi = language === 'hi' || /[\u0900-\u097f]|\b(?:meri|mera|maine|mujhe|kaunsi|dikhao|galti|kal)\b/i.test(query);
    if (kind === 'CORRECTION') {
      if (/\b(?:yesterday|kal)\b|कल/i.test(query)) return hindi
        ? 'कल का रिकॉर्ड दवाइयाँ टैब से अभी नहीं बदल सकता। मैंने रिकॉर्ड नहीं बदला है।'
        : 'The Medicines tab cannot correct yesterday’s record yet. I have not changed it.';
      return hindi
        ? 'आज की उसी दवा और समय के लिए दवाइयाँ टैब में “नहीं ली” चुनें। मैंने अभी रिकॉर्ड नहीं बदला है।'
        : 'For today’s dose, select “Not taken” in Medicines for the same medicine and time. I have not changed the record.';
    }
    if (kind === 'STREAK') {
      if (!snapshot.reminders.some((reminder) => reminder.active && reminder.confirmed)) return hindi
        ? 'अभी कोई पुष्ट दवा रिमाइंडर नहीं है, इसलिए लेने की लगातार अवधि उपलब्ध नहीं है।'
        : 'No confirmed medicine reminders are active, so an adherence streak is unavailable.';
      return hindi
        ? `आपकी दर्ज दवा लेने की लगातार अवधि ${snapshot.progress.currentStreakDays} दिन है।`
        : `Your recorded medicine adherence streak is ${snapshot.progress.currentStreakDays} days.`;
    }
    const today = localDateKey();
    const day = kind === 'MISSED' ? previousLocalDateKey(today) : today;
    const active = snapshot.reminders.filter((reminder) => reminder.active && reminder.confirmed
      && reminder.startDate <= day && (!reminder.endDate || reminder.endDate >= day));
    const slots = active.flatMap((reminder) => reminder.times.map((time) => ({ reminder, time })));
    if (!slots.length) return hindi
      ? 'उस दिन के लिए कोई पुष्ट दवा रिमाइंडर दर्ज नहीं है।'
      : 'No confirmed medicine reminders are recorded for that day.';
    const outcomes = patient.events.reduce<Record<string, PatientAdherenceAction>>((found, event) => {
      if ((event.status === 'TAKEN' || event.status === 'SKIPPED' || event.status === 'NOT_TAKEN')
        && (event.scheduledDate || localDateKey(new Date(event.scheduledAt))) === day) {
        found[`${event.reminderId}:${event.scheduledTime || event.scheduledAt.slice(11, 16)}`] = event.status;
      }
      return found;
    }, {});
    const groups: Record<'scheduled' | 'unrecorded' | 'notTaken' | 'skipped', string[]> = {
      scheduled: [], unrecorded: [], notTaken: [], skipped: [],
    };
    const now = Date.now();
    for (const { reminder, time } of slots) {
      const status = outcomes[`${reminder.id}:${time}`];
      if (status === 'TAKEN') continue;
      const label = `${reminder.medicineName} — ${time}`;
      if (status === 'SKIPPED') groups.skipped.push(label);
      else if (status === 'NOT_TAKEN') groups.notTaken.push(label);
      else if (kind === 'PENDING' && new Date(`${day}T${time}:00+05:30`).getTime() > now) groups.scheduled.push(label);
      else groups.unrecorded.push(label);
    }
    if (Object.values(groups).every((items) => items.length === 0)) return hindi
      ? 'उस दिन के सभी पुष्ट रिमाइंडर “ले ली” दर्ज हैं।'
      : 'All confirmed reminders for that day are recorded as taken.';
    const parts = hindi
      ? [groups.scheduled.length && `आगे के रिमाइंडर: ${groups.scheduled.join(', ')}`,
        groups.unrecorded.length && `समय बीत गया, लेने का रिकॉर्ड नहीं: ${groups.unrecorded.join(', ')}`,
        groups.notTaken.length && `“नहीं ली” दर्ज: ${groups.notTaken.join(', ')}`,
        groups.skipped.length && `“छोड़ दी” दर्ज: ${groups.skipped.join(', ')}`]
      : [groups.scheduled.length && `Upcoming reminders: ${groups.scheduled.join(', ')}`,
        groups.unrecorded.length && `Time passed, no taken record: ${groups.unrecorded.join(', ')}`,
        groups.notTaken.length && `Marked not taken: ${groups.notTaken.join(', ')}`,
        groups.skipped.length && `Marked skipped: ${groups.skipped.join(', ')}`];
    return `${hindi ? (kind === 'MISSED' ? 'कल का रिकॉर्ड: ' : 'आज का रिकॉर्ड: ')
      : (kind === 'MISSED' ? 'Yesterday’s record: ' : 'Today’s record: ')}${parts.filter(Boolean).join(hindi ? '। ' : '. ')}${hindi
      ? '। रिकॉर्ड न होना पक्की छूटी खुराक नहीं है; दवाइयाँ टैब में जाँचें।'
      : '. No record alone does not confirm a missed dose; check Medicines.'}`;
  }

  async initialize(onAction: (patientId: string) => void): Promise<() => void> {
    if (!Capacitor.isNativePlatform()) return () => undefined;
    if (!this.initialized) {
      await LocalNotifications.createChannel({ id: 'vda-medicine-reminders', name: 'Medicine reminders', description: 'VDA medicine reminder notifications', importance: 4, visibility: 1, sound: 'default', vibration: true });
      await LocalNotifications.registerActionTypes({
        types: [{ id: ACTION_TYPE_ID, actions: [
          { id: ACTION_TAKEN, title: 'ले ली' },
          { id: ACTION_SNOOZE, title: 'बाद में याद दिलाएँ' },
        ] }],
      });
      this.initialized = true;
    }
    const listener = await LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      const patientId = String(action.notification.extra?.patientId || '');
      const reminderId = String(action.notification.extra?.reminderId || '');
      const scheduledTime = String(action.notification.extra?.scheduledTime || '');
      if (!patientId || !reminderId || !scheduledTime) return;
      if (action.actionId === ACTION_TAKEN) {
        try { await this.recordOutcome(patientId, reminderId, scheduledTime, 'TAKEN'); }
        catch { return; }
      }
      if (action.actionId === ACTION_SNOOZE) await this.snooze(patientId, reminderId, scheduledTime);
      onAction(patientId);
    });
    return () => { void listener.remove(); };
  }

  private async permission(patient: PatientReminderStore): Promise<'granted' | 'denied' | 'unavailable'> {
    if (!Capacitor.isNativePlatform()) {
      patient.notificationPermission = 'unavailable';
      return 'unavailable';
    }
    const current = await LocalNotifications.checkPermissions();
    const result = current.display === 'granted' ? current : await LocalNotifications.requestPermissions();
    patient.notificationPermission = result.display === 'granted' ? 'granted' : 'denied';
    return patient.notificationPermission;
  }

  private async syncNotifications(patientId: string, patient: PatientReminderStore) {
    if (!Capacitor.isNativePlatform() || patient.notificationPermission !== 'granted') return;
    const ids = patient.reminders.flatMap((reminder) => reminder.notificationIds);
    if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    for (const reminder of patient.reminders) {
      reminder.notificationIds = reminder.times.map((time) => notificationId(`${patientId}:${reminder.id}:${time}`));
    }
    const notifications = patient.reminders
      .filter((reminder) => reminder.active && reminder.confirmed && patient.prescriptions.some((prescription) =>
        prescription.id === reminder.prescriptionId &&
        prescription.verificationStatus === 'VERIFIED' &&
        prescription.activePlan &&
        prescription.planRevision === reminder.planRevision,
      ))
      .flatMap((reminder) => reminder.times.map((time, index) => {
        const [hour, minute] = time.split(':').map(Number);
        return {
          id: reminder.notificationIds[index],
          title: 'दवा लेने का समय',
          body: `${reminder.medicineName} लेने का समय हो गया है।`,
          channelId: 'vda-medicine-reminders',
          actionTypeId: ACTION_TYPE_ID,
          extra: { patientId, reminderId: reminder.id, scheduledTime: time },
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
          isExactNotification: false,
        };
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  }

  /** Keep another patient's scheduled reminders off a shared device after logout. */
  async suspendNotifications(patientId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const pending = await LocalNotifications.getPending();
    const notifications = pending.notifications
      .filter((item) => item.extra?.patientId === patientId)
      .map((item) => ({ id: item.id }));
    if (notifications.length) await LocalNotifications.cancel({ notifications });
  }

  /** Restore any missing alarms after login, reboot, or a device settings change. */
  async reconcileNotifications(patientId: string): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(patientId);
    if (!Capacitor.isNativePlatform()) return this.snapshot(patientId);
    const permission = await LocalNotifications.checkPermissions();
    patient.notificationPermission = permission.display === 'granted' ? 'granted' : 'denied';
    if (patient.notificationPermission === 'granted') {
      const pending = await LocalNotifications.getPending();
      const pendingIds = new Set(pending.notifications.map((item) => item.id));
      const expectedIds = patient.reminders
        .filter((reminder) => reminder.active && reminder.confirmed && patient.prescriptions.some((prescription) =>
          prescription.id === reminder.prescriptionId && prescription.verificationStatus === 'VERIFIED' &&
          prescription.activePlan && prescription.planRevision === reminder.planRevision,
        ))
        .flatMap((reminder) => reminder.times.map((time) => notificationId(`${patientId}:${reminder.id}:${time}`)));
      if (expectedIds.some((id) => !pendingIds.has(id))) await this.syncNotifications(patientId, patient);
    }
    await this.writeStore(store);
    return this.snapshot(patientId);
  }

  async confirmDraft(draft: PrescriptionReminderDraft): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(draft.patientId);
    const verifiedPrescription = patient.prescriptions.find((prescription) =>
      prescription.id === draft.prescriptionId &&
      prescription.verificationStatus === 'VERIFIED' &&
      prescription.activePlan &&
      prescription.planRevision === draft.planRevision,
    );
    if (draft.verificationStatus !== 'VERIFIED' || !verifiedPrescription) {
      throw new Error('VERIFIED_PRESCRIPTION_REQUIRED');
    }
    const reminders = draft.medicines.map((medicine) => ({
      id: `${draft.prescriptionId}:${draft.planRevision}:${medicine.id}`,
      prescriptionId: draft.prescriptionId,
      planRevision: draft.planRevision,
      medicineId: medicine.id,
      medicineIndex: medicine.medicineIndex,
      medicineName: medicine.medicineName,
      dosageText: medicine.dosageText, frequency: medicine.frequency,
      times: medicine.times.filter(Boolean), startDate: localDateKey(),
      active: medicine.enabled && medicine.confirmed && medicine.times.every(Boolean),
      confirmed: medicine.confirmed,
      uncertaintyReason: medicine.uncertaintyReason,
      notificationIds: [], createdAt: new Date().toISOString(),
    }));
    patient.prescriptions = patient.prescriptions.map((prescription) => prescription.id === draft.prescriptionId
      ? {
          ...prescription,
          status: 'VERIFIED',
          medicines: prescription.medicines.map((medicine) => {
            const draftMedicine = draft.medicines.find((item) => item.id === medicine.id);
            return draftMedicine
              ? { ...medicine, confirmed: draftMedicine.confirmed, requiresConfirmation: draftMedicine.requiresConfirmation, uncertaintyReason: draftMedicine.uncertaintyReason }
              : medicine;
          }),
        }
      : prescription);
    const activePrescription = patient.prescriptions.find((prescription) => prescription.id === draft.prescriptionId);
    if (activePrescription?.verificationStatus === 'VERIFIED' && activePrescription.medicines.length && activePrescription.medicines.every((medicine) => medicine.confirmed)) {
      patient.activePrescriptionId = activePrescription.id;
    }
    const obsoleteForPlan = patient.reminders.filter((reminder) => (
      reminder.prescriptionId === draft.prescriptionId
      && reminder.planRevision === draft.planRevision
    ));
    if (Capacitor.isNativePlatform()) {
      const obsoleteNotificationIds = obsoleteForPlan.flatMap((reminder) => reminder.notificationIds || []);
      if (obsoleteNotificationIds.length) {
        await LocalNotifications.cancel({ notifications: obsoleteNotificationIds.map((id) => ({ id })) });
      }
    }
    patient.reminders = [
      ...patient.reminders.filter((reminder) => !(
        reminder.prescriptionId === draft.prescriptionId
        && reminder.planRevision === draft.planRevision
      )),
      ...reminders,
    ];
    await this.writeStore(store);
    const permission = await this.permission(patient);
    if (permission === 'granted') await this.syncNotifications(draft.patientId, patient);
    await this.writeStore(store);
    return this.snapshot(draft.patientId);
  }

  async enableNotifications(patientId: string): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(patientId);
    const permission = await this.permission(patient);
    if (permission === 'granted') await this.syncNotifications(patientId, patient);
    await this.writeStore(store);
    return this.snapshot(patientId);
  }

  async updateReminder(patientId: string, reminderId: string, patch: Pick<LocalMedicineReminder, 'times' | 'active'>): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(patientId);
    const target = patient.reminders.find((reminder) => reminder.id === reminderId);
    const verified = target && patient.prescriptions.some((prescription) =>
      prescription.id === target.prescriptionId && prescription.verificationStatus === 'VERIFIED',
    );
    if (patch.active && !verified) throw new Error('VERIFIED_PRESCRIPTION_REQUIRED');
    patient.reminders = patient.reminders.map((reminder) => reminder.id === reminderId
      ? { ...reminder, ...patch, times: patch.times.filter(Boolean) }
      : reminder);
    await this.syncNotifications(patientId, patient);
    await this.writeStore(store);
    return this.snapshot(patientId);
  }

  async deleteReminder(patientId: string, reminderId: string): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(patientId);
    const deleted = patient.reminders.find((reminder) => reminder.id === reminderId);
    if (Capacitor.isNativePlatform() && deleted?.notificationIds.length) {
      await LocalNotifications.cancel({ notifications: deleted.notificationIds.map((id) => ({ id })) });
    }
    patient.reminders = patient.reminders.filter((reminder) => reminder.id !== reminderId);
    await this.writeStore(store);
    return this.snapshot(patientId);
  }

  private async recordOutcome(patientId: string, reminderId: string, time: string, status: PatientAdherenceAction) {
    const [store, patient] = await this.patientStore(patientId);
    const reminder = patient.reminders.find((item) => item.id === reminderId);
    const activePrescription = patient.prescriptions.find((item) => item.id === patient.activePrescriptionId);
    if (
      !reminder
      || !reminder.active
      || !activePrescription
      || activePrescription.verificationStatus !== 'VERIFIED'
      || !activePrescription.activePlan
      || reminder.prescriptionId !== activePrescription.id
      || reminder.planRevision !== activePrescription.planRevision
      || !reminder.times.includes(time)
    ) throw new Error('ACTIVE_VERIFIED_REMINDER_REQUIRED');
    const scheduledDate = localDateKey();
    const scheduledAt = `${scheduledDate}T${time}:00+05:30`;
    const occurrenceId = occurrenceIdentity(patientId, reminder, scheduledDate, time);
    const existingIndex = patient.events.findIndex((event) => (
      event.status !== 'SNOOZED'
      && (event.occurrenceId === occurrenceId || (event.reminderId === reminderId && event.scheduledAt === scheduledAt))
    ));
    if (existingIndex >= 0 && patient.events[existingIndex].status === status) return;
    const nextEvent: LocalReminderEvent = {
      id: existingIndex >= 0 ? patient.events[existingIndex].id : safeId(),
      occurrenceId,
      reminderId,
      medicineId: reminder.medicineId,
      prescriptionId: reminder.prescriptionId,
      planRevision: reminder.planRevision,
      medicineIndex: reminder.medicineIndex,
      scheduledDate,
      scheduledTime: time,
      scheduledAt,
      acknowledgedAt: new Date().toISOString(),
      status,
    };
    if (existingIndex >= 0) patient.events[existingIndex] = nextEvent;
    else patient.events.push(nextEvent);
    await this.writeStore(store);
  }

  async recordAdherenceFromApp(patientId: string, reminderId: string, time: string, status: PatientAdherenceAction): Promise<MedicineReminderSnapshot> {
    await this.recordOutcome(patientId, reminderId, time, status);
    return this.snapshot(patientId);
  }

  private async snooze(patientId: string, reminderId: string, time: string) {
    const [store, patient] = await this.patientStore(patientId);
    const scheduledAt = `${localDateKey()}T${time}:00+05:30`;
    const priorSnoozes = patient.events.filter((event) => event.status === 'SNOOZED' && event.reminderId === reminderId && localDateKey(new Date(event.scheduledAt)) === localDateKey()).length;
    if (priorSnoozes >= MAX_SNOOZES_PER_SLOT) return;
    patient.events.push({ id: safeId(), reminderId, medicineId: reminderId, scheduledAt, acknowledgedAt: new Date().toISOString(), status: 'SNOOZED' });
    const reminder = patient.reminders.find((item) => item.id === reminderId);
    if (Capacitor.isNativePlatform() && patient.notificationPermission === 'granted' && reminder) {
      const at = new Date(Date.now() + SNOOZE_MINUTES * 60_000);
      await LocalNotifications.schedule({ notifications: [{
        id: notificationId(`${patientId}:${reminderId}:${localDateKey()}:snooze:${priorSnoozes}`),
        title: 'दवा लेने का समय', body: `${reminder.medicineName} लेने की याद दिला रहे हैं।`,
        channelId: 'vda-medicine-reminders', actionTypeId: ACTION_TYPE_ID,
        extra: { patientId, reminderId, scheduledTime: time },
        schedule: { at }, isExactNotification: false,
      }] });
    }
    await this.writeStore(store);
  }

  async snoozeFromApp(patientId: string, reminderId: string, time: string): Promise<MedicineReminderSnapshot> {
    await this.snooze(patientId, reminderId, time);
    return this.snapshot(patientId);
  }
}

export const medicineReminderService = new MedicineReminderService();
