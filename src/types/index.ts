// Types conforming to ABDM & VDA standard structures

export type LanguageCode = 'hi' | 'en' | 'ta' | 'kn';

export interface UserProfile {
  id: string;
  phone: string;
  fullName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  state: string;
  district: string;
  language: LanguageCode;
  abhaNumber?: string;
  createdAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
}

export function userProfileToDemographics(profile: UserProfile): PatientDemographics {
  return {
    id: profile.id,
    name: profile.fullName,
    age: profile.age,
    gender: profile.gender,
    abhaNumber: profile.abhaNumber || '',
    abhaAddress: '',
    phone: profile.phone,
    bloodGroup: 'N/A',
    district: profile.district,
    state: profile.state,
    emergencyContact: { name: '', relation: '', phone: '' },
  };
}

export interface PatientDemographics {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  nameKn?: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  abhaNumber: string;
  abhaAddress: string;
  phone: string;
  bloodGroup: string;
  district: string;
  districtHi?: string;
  districtTa?: string;
  districtKn?: string;
  state: string;
  goldCategory?: string;
  pmjayEligible?: boolean;
  escalationTriggered?: boolean;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  ayushmanCardNumber?: string;
  photoUrl?: string;
}

export interface FhirCondition {
  id: string;
  code: string;
  display: string;
  displayHi?: string;
  displayTa?: string;
  displayKn?: string;
  clinicalStatus: 'active' | 'recurrence' | 'relapse' | 'remission' | 'resolved';
  verificationStatus: 'confirmed' | 'provisional';
  severity: 'mild' | 'moderate' | 'severe';
  onsetDateTime: string;
  recordedDate: string;
  sourceFacility: string;
  doctorName?: string;
  notes?: string;
  notesHi?: string;
  notesTa?: string;
  notesKn?: string;
}

export interface FhirMedication {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  nameKn?: string;
  code: string;
  dosage: string;
  dosageHi?: string;
  dosageTa?: string;
  dosageKn?: string;
  frequency: string;
  frequencyHi?: string;
  frequencyTa?: string;
  frequencyKn?: string;
  timing: 'before_meal' | 'after_meal' | 'with_meal' | 'anytime';
  timingHi?: string;
  timingTa?: string;
  timingKn?: string;
  prescribedDate: string;
  duration: string;
  refillCount: number;
  totalDays: number;
  daysRemaining: number;
  sourceFacility: string;
  takenToday: boolean;
  timeOfDay: string[];
  adherenceRate: number;
}

export interface FhirObservation {
  id: string;
  code: string;
  display: string;
  displayHi?: string;
  displayTa?: string;
  displayKn?: string;
  category: 'vital-signs' | 'laboratory';
  value: number;
  unit: string;
  interpretation: 'normal' | 'high' | 'critical-high' | 'low' | 'critical-low';
  referenceRange: string;
  effectiveDateTime: string;
  sourceFacility: string;
  history?: { date: string; value: number }[];
  clinicalMeaning?: string;
  clinicalMeaningHi?: string;
  clinicalMeaningTa?: string;
  clinicalMeaningKn?: string;
}

export interface FhirDocument {
  id: string;
  title: string;
  titleHi?: string;
  titleTa?: string;
  titleKn?: string;
  type: 'Prescription' | 'Lab Report' | 'Discharge Summary' | 'OPD Slip';
  date: string;
  facility: string;
  doctor: string;
  size: string;
  tags: string[];
  summary: string;
  summaryHi?: string;
  summaryTa?: string;
  summaryKn?: string;
  thumbnailUrl?: string;
}

export interface ConsentArtifact {
  id: string;
  purpose: string;
  purposeHi?: string;
  purposeTa?: string;
  purposeKn?: string;
  scope: string;
  scopeHi?: string;
  scopeTa?: string;
  scopeKn?: string;
  grantedTo: string;
  grantedDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export interface Facility {
  id: string;
  name: string;
  facilityType: string | null;
  ownership: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  contactNumber: string | null;
  schemes: string[];
  pmjayListed: boolean;
  iphsLevel: string;
  emergencyCapability: 'SOURCE_REPORTED_CAPABLE' | 'SOURCE_REPORTED_NOT_CAPABLE' | 'UNKNOWN';
  distanceKm: number | null;
  travelTimeMinutes: number | null;
  sourceKind: 'STRUCTURED_FACILITY_DATABASE' | 'NHA_FACILITY_DIRECTORY';
  sourceVersion: string | null;
}

export interface HealthScheme {
  id: string;
  name: string;
  description: string | null;
  geographyScope: 'NATIONAL' | 'STATE';
  state: string | null;
  eligibilityCriteria: string | null;
  benefitsDescription: string | null;
  coverageInformation: string | null;
  requiredDocuments: string[];
  applicationProcess: string | null;
  officialUrl: string | null;
  helpline: string | null;
  sourceVersion: string | null;
  eligibilityStatus: 'ELIGIBILITY_CHECK_REQUIRED';
}

export interface FacilityDirectoryResponse {
  scope: { state: string; district: string; matchType: 'AREA' };
  facilities: Facility[];
  notice: string;
}

export interface SchemeDirectoryResponse {
  state: string;
  eligibilityStatus: 'ELIGIBILITY_CHECK_REQUIRED';
  schemes: HealthScheme[];
  notice: string;
}

export type AgentDomain = 
  | 'router'
  | 'triage'
  | 'medication'
  | 'lab_explainer'
  | 'facility'
  | 'scheme'
  | 'lifestyle_diet'
  | 'maternal_rch'
  | 'safety_gate'
  | 'clinician_escalation';

export interface ChatMessage {
  id: string;
  /** Local provenance used to remove report questions and answers after deletion. */
  reportId?: string;
  sender: 'user' | 'vda' | 'clinician' | 'system';
  agent?: AgentDomain;
  text: string;
  textHi?: string;
  textTa?: string;
  textKn?: string;
  timestamp: string;
  isEscalationTrigger?: boolean;
  /** Device-local prescription reminder workflow step; never sent to the backend. */
  reminderStepId?: string;
  /** Backend explanation restricted to the exact uploaded prescription, not FHIR data. */
  prescriptionScoped?: boolean;
  /** Safe source category only; contains no document or patient metadata. */
  provenance?: 'FHIR_R4' | 'PRESCRIPTION' | 'REMINDER' | 'KNOWLEDGE' | 'PRESCRIPTION_AND_KNOWLEDGE';
  /** Structured patient-facing sections returned by the backend response contract. */
  sections?: Array<{
    title?: string;
    body?: string;
    bullets?: string[];
  }>;
  quickActions?: { label: string; labelHi?: string; labelTa?: string; labelKn?: string; action: string; icon?: string }[];
  cardData?: {
    type: 'medication_reminder' | 'lab_highlight' | 'facility_qr' | 'scheme_summary' | 'vitals_logged';
    title: string;
    titleHi?: string;
    titleTa?: string;
    titleKn?: string;
    details: Record<string, any>;
  };
  attachment?: {
    name: string;
    type: string;
    url?: string;
    isImage: boolean;
  };
  audioAvailable?: boolean;
}

export type ClinicalChatState = 'WAITING_FOR_CLINICIAN' | 'CLINICIAN_CONNECTED' | 'ENDED';

/** Deterministic clinical follow-up reminder. It is intentionally separate from medication adherence. */
export interface ClinicalFollowUp {
  id: string;
  type: 'CLINICAL_REVIEW' | 'MEDICATION_REVIEW' | 'LAB_REVIEW' | 'CHECKUP';
  title: string;
  dueDate: string;
  daysUntil: number;
  status: 'DUE_TODAY' | 'DUE_TOMORROW' | 'UPCOMING' | 'ATTENDANCE_CHECK';
  dateSource: 'EXPLICIT' | 'DERIVED_30_DAY';
  attendanceStatus: 'PENDING' | 'COMPLETED' | 'MISSED';
  requiresAttendanceCheck: boolean;
  condition?: string;
  guidance?: string;
}

export interface FollowUpListResponse {
  asOfDate: string;
  timezone: string;
  followUps: ClinicalFollowUp[];
  progress: FollowUpProgress;
}

/** Patient-scoped checkup completion progress; intentionally separate from medication adherence. */
export interface FollowUpProgress {
  completedFollowUpCount: number;
}

export interface FollowUpAttendanceResponse {
  followUpId: string;
  attendanceStatus: 'COMPLETED' | 'MISSED';
  message: string;
}

/** Server-authoritative patient view of a persisted clinical escalation. */
export interface ClinicalReviewFacility {
  name: string;
  state: string | null;
  district: string | null;
  city: string | null;
  address: string | null;
  contactNumber: string | null;
  hospitalType: string | null;
  schemes: string[];
  emergencyCapabilityVerified: boolean;
  distanceKm: number | null;
  travelTimeMinutes: number | null;
}

export interface ClinicalEscalationState {
  isActive: boolean;
  escalationId: string;
  reason: string;
  severity: string;
  triggerSymptom: string;
  timestamp: string;
  assignedDoctor: {
    name: string;
    title: string;
    facility: string;
    regNo: string;
  };
  status: string;
  chatHistory: Array<{
    id: string;
    sender: "system" | "clinician";
    text: string;
    textHi?: string;
    timestamp: string;
    audioAvailable?: boolean;
  }>;
}

export interface ClinicalReviewState {
  reviewRequested: boolean;
  teleconsultationOffered: boolean;
  teleconsultationConfigured: boolean;
  clinicalChatState: ClinicalChatState;
  clinicianResponseDeadline: string | Date | null;
  firstClinicianResponseAt: string | Date | null;
  fallbackShownAt: string | Date | null;
  nearbyFacilities: ClinicalReviewFacility[];
  messages: Array<{ speaker: 'PATIENT' | 'CLINICIAN'; text: string; createdAt: string | Date }>;
}

export interface VaccineRecord {
  id: string;
  vaccineName: string;
  vaccineNameHi?: string;
  vaccineNameTa?: string;
  vaccineNameKn?: string;
  doseNumber: string;
  doseNumberHi?: string;
  doseNumberTa?: string;
  doseNumberKn?: string;
  dateAdministered: string;
  facility: string;
  facilityHi?: string;
  facilityTa?: string;
  facilityKn?: string;
  beneficiaryRef: string;
  certificateQr: string;
  status: 'COMPLETED' | 'DUE' | 'UPCOMING';
  dueDate?: string;
}

export interface JanAushadhiItem {
  id: string;
  genericName: string;
  genericNameHi?: string;
  genericNameTa?: string;
  genericNameKn?: string;
  marketBrandName: string;
  dosage: string;
  marketPrice: number;
  janAushadhiPrice: number;
  savingsPercentage: number;
  category: string;
  availableAtKendra: boolean;
}

export interface BloodStockItem {
  group: string;
  unitsAvailable: number;
  status: 'SUFFICIENT' | 'CRITICAL' | 'MODERATE';
}
