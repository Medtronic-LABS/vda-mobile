/**
 * VDA Health Assistant - Unified API Client Service
 * 
 * Provides a production-ready communication layer between the mobile UI
 * and any working backend (Node/Express, Python/FastAPI, Spring Boot, etc.).
 * 
 * Features:
 * - Configurable Base URL via `VITE_API_BASE_URL`
 * - Automatic bearer token authentication via `localStorage` or environment
 * - Graceful fallback to local synthetic data when backend is offline or unreachable
 * - Standardized FHIR R4 payload serialization
 */

import {
  PatientDemographics,
  FhirCondition,
  FhirMedication,
  FhirObservation,
  FhirDocument,
  ConsentArtifact,
  Facility,
  HealthScheme,
  ClinicalEscalationState,
  LanguageCode
} from '../types';
import {
  SYNTHETIC_PATIENTS,
  FACILITIES_LIST,
  HEALTH_SCHEMES_LIST
} from '../data/syntheticData';
import { processVdaQuery, VdaProcessResult } from '../utils/vdaEngine';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const USE_MOCK_FALLBACK = import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== 'false';

class ApiService {
  private authToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('vda_auth_token');
    }
  }

  public setAuthToken(token: string) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vda_auth_token', token);
    }
  }

  public clearAuthToken() {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vda_auth_token');
    }
  }

  public isBackendConfigured(): boolean {
    return Boolean(API_BASE_URL);
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * Generic safe request wrapper with fallback
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, fallbackData: T): Promise<T> {
    if (!API_BASE_URL) {
      return fallbackData;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      console.warn(`[VDA API] Error contacting ${endpoint}. Falling back to local data:`, error);
      if (USE_MOCK_FALLBACK) {
        return fallbackData;
      }
      throw error;
    }
  }

  // ==========================================
  // PATIENT & FHIR R4 RECORDS ENDPOINTS
  // ==========================================

  /**
   * Fetch list of all Gold Synthetic Patients with optional category/search filters
   */
  async getPatients(category?: string, search?: string): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (category) queryParams.set('category', category);
    if (search) queryParams.set('search', search);
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<any[]>(`/api/patients${qs}`, {}, Object.values(SYNTHETIC_PATIENTS).map(p => p.demographics));
  }

  /**
   * Fetch patient profile by ID or persona key
   */
  async getPatientProfile(patientKey: string = 'synth-patient-001'): Promise<PatientDemographics> {
    const profile = SYNTHETIC_PATIENTS[patientKey] || SYNTHETIC_PATIENTS['synth-patient-001'];
    const fallback = profile ? profile.demographics : SYNTHETIC_PATIENTS['synth-patient-001'].demographics;
    return this.request<PatientDemographics>(`/api/patient/profile?id=${patientKey}`, {}, fallback);
  }

  /**
   * Fetch active clinical conditions
   */
  async getConditions(patientKey: string = 'synth-patient-001'): Promise<FhirCondition[]> {
    const profile = SYNTHETIC_PATIENTS[patientKey] || SYNTHETIC_PATIENTS['synth-patient-001'];
    const fallback = profile ? profile.conditions : [];
    return this.request<FhirCondition[]>(`/api/records/conditions?patientId=${patientKey}`, {}, fallback);
  }

  /**
   * Fetch prescribed medications
   */
  async getMedications(patientKey: string = 'synth-patient-001'): Promise<FhirMedication[]> {
    const profile = SYNTHETIC_PATIENTS[patientKey] || SYNTHETIC_PATIENTS['synth-patient-001'];
    const fallback = profile ? profile.medications : [];
    return this.request<FhirMedication[]>(`/api/records/medications?patientId=${patientKey}`, {}, fallback);
  }

  /**
   * Record medication taken status (adherence)
   */
  async toggleMedicationAdherence(medicationId: string, taken: boolean): Promise<{ success: boolean; adherenceRate?: number }> {
    return this.request<{ success: boolean; adherenceRate?: number }>(
      `/api/records/medications/${medicationId}/adherence`,
      {
        method: 'POST',
        body: JSON.stringify({ taken, timestamp: new Date().toISOString() })
      },
      { success: true }
    );
  }

  /**
   * Fetch observations and lab records
   */
  async getObservations(patientKey: string = 'synth-patient-001'): Promise<FhirObservation[]> {
    const profile = SYNTHETIC_PATIENTS[patientKey] || SYNTHETIC_PATIENTS['synth-patient-001'];
    const fallback = profile ? profile.observations : [];
    return this.request<FhirObservation[]>(`/api/records/observations?patientId=${patientKey}`, {}, fallback);
  }

  /**
   * Save a newly recorded vital sign (e.g. self-monitored blood glucose, blood pressure)
   */
  async logObservation(observation: FhirObservation): Promise<FhirObservation> {
    return this.request<FhirObservation>(
      `/api/records/observations`,
      {
        method: 'POST',
        body: JSON.stringify(observation)
      },
      observation
    );
  }

  /**
   * Fetch health records documents (prescriptions, discharge summaries)
   */
  async getDocuments(patientKey: string = 'synth-patient-001'): Promise<FhirDocument[]> {
    const profile = SYNTHETIC_PATIENTS[patientKey] || SYNTHETIC_PATIENTS['synth-patient-001'];
    const fallback = profile ? profile.documents : [];
    return this.request<FhirDocument[]>(`/api/records/documents?patientId=${patientKey}`, {}, fallback);
  }

  /**
   * Fetch active ABDM consent artifacts
   */
  async getConsents(patientKey: string = 'synth-patient-001'): Promise<ConsentArtifact[]> {
    const profile = SYNTHETIC_PATIENTS[patientKey] || SYNTHETIC_PATIENTS['synth-patient-001'];
    const fallback = profile ? profile.consents : [];
    return this.request<ConsentArtifact[]>(`/api/consents?patientId=${patientKey}`, {}, fallback);
  }

  /**
   * Fetch raw ABDM FHIR DocumentBundle
   */
  async getBundle(patientId: string): Promise<any> {
    return this.request<any>(`/api/records/bundle/${patientId}`, {}, null);
  }

  /**
   * Revoke ABDM consent artifact
   */
  async revokeConsent(consentId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/api/consents/${consentId}/revoke`,
      {
        method: 'POST',
        body: JSON.stringify({ revokedAt: new Date().toISOString() })
      },
      { success: true }
    );
  }

  // ==========================================
  // CONVERSATIONAL AI & VDA ENGINE ENDPOINTS
  // ==========================================

  /**
   * Send user voice/text query to the backend VDA engine (powered by Gemini or domain agents)
   */
  async processVdaQuery(
    query: string,
    patient: PatientDemographics,
    medications: FhirMedication[],
    observations: FhirObservation[],
    lang: LanguageCode
  ): Promise<VdaProcessResult> {
    const fallback = processVdaQuery(query, patient, medications, observations, lang);

    if (!API_BASE_URL) {
      return fallback;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/vda/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query,
          lang,
          patientContext: {
            id: patient.id,
            name: patient.name,
            abhaNumber: patient.abhaNumber,
            age: patient.age,
            gender: patient.gender,
            bloodGroup: patient.bloodGroup
          },
          activeMedications: medications.map(m => ({ name: m.name, dosage: m.dosage, takenToday: m.takenToday })),
          latestObservations: observations.map(o => ({ code: o.code, display: o.display, value: o.value, unit: o.unit }))
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      console.warn('[VDA API] Backend chat endpoint unavailable, utilizing local AI engine:', err);
      return fallback;
    }
  }

  /**
   * Dispatch emergency clinical escalation to hospital triage desk
   */
  async notifyEscalation(payload: ClinicalEscalationState): Promise<{ success: boolean; dispatchId?: string }> {
    return this.request<{ success: boolean; dispatchId?: string }>(
      `/api/escalation/trigger`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      { success: true, dispatchId: `DISPATCH-${Date.now().toString().slice(-4)}` }
    );
  }

  // ==========================================
  // FACILITIES & HEALTH SCHEMES ENDPOINTS
  // ==========================================

  async getFacilities(): Promise<Facility[]> {
    return this.request<Facility[]>(`/api/facilities`, {}, FACILITIES_LIST);
  }

  async getSchemes(): Promise<HealthScheme[]> {
    return this.request<HealthScheme[]>(`/api/schemes`, {}, HEALTH_SCHEMES_LIST);
  }
}

export const apiService = new ApiService();
