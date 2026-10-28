/**
 * VDA Health Assistant - Unified API Client Service
 * 
 * Provides a production-ready communication layer between the mobile UI
 * and any working backend (Node/Express, Python/FastAPI, Spring Boot, etc.).
 * 
 * Features:
 * - Configurable Base URL via `VITE_API_BASE_URL`
 * - Bearer token authentication owned by AuthService
 * - Graceful fallback to local operation when backend is offline or unreachable
 * - Standardized FHIR R4 payload serialization
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  PatientDemographics,
  FhirCondition,
  FhirMedication,
  FhirObservation,
  FhirDocument,
  ConsentArtifact,
  FacilityDirectoryResponse,
  SchemeDirectoryResponse,
  ClinicalReviewState,
  ClinicalReviewFacility,
  FollowUpAttendanceResponse,
  FollowUpListResponse,
  LanguageCode,
  ChatMessage,
  UserProfile
} from '../types';
import type { VdaProcessResult } from '../utils/vdaEngine';
import { voicePerformance } from './voice-performance';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');
const USE_MOCK_FALLBACK = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_FALLBACK === 'true';
const ESANJEEVANI_OFFICIAL_URL = 'https://esanjeevani.mohfw.gov.in/#/patient/signin';
const EsanjeevaniExternalLink = registerPlugin<{ open(): Promise<void> }>('EsanjeevaniLauncher');

export interface SignupDto {
  phone: string;
  pin: string;
  fullName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  state: string;
  district: string;
  language: LanguageCode;
  abhaNumber?: string;
}

export interface LoginDto {
  phone: string;
  pin: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user: UserProfile;
  tokenType?: 'Bearer';
  expiresAt?: string;
  expiresInSeconds?: number;
}

/** Patient-visible extraction only; never an actionable prescription plan. */
export interface PatientPrescriptionLatestSubmission {
  id: string;
  updatedAt?: string;
  extractionStatus: string;
  verificationStatus: string;
  activePlan: boolean;
  patientReviewReason?: string | null;
  extractedDetails?: {
    medications: Array<{ name: string; strength: string | null; frequency: string | null; timing: string | null; uncertain: boolean }>;
    investigations: Array<{ name: string; uncertain: boolean }>;
  };
}

export interface PatientPrescriptionCurrentState {
  activePlan: any | null;
  latestSubmission: PatientPrescriptionLatestSubmission | null;
}

export interface PatientMedicalReport {
  id: string;
  filename: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  extractionStatus: 'EXTRACTED' | 'REVIEW_REQUIRED' | 'UNREADABLE' | 'EXTRACTION_FAILED';
  readingCompleteness?: 'POSSIBLY_PARTIAL' | 'UNCONFIRMED' | 'NOT_VERIFIED';
  explanation: string | null;
  createdAt: string;
  reportType: 'CBC' | 'THYROID' | 'KIDNEY' | 'LIVER' | 'LIPID' | 'URINE'
    | 'BLOOD_GLUCOSE' | 'HBA1C' | 'GLUCOSE_HBA1C' | 'OTHER_LAB' | null;
  category: 'BLOOD_GLUCOSE' | 'HBA1C' | 'GLUCOSE_HBA1C' | null;
  isCurrent: boolean;
  replacementOf: string | null;
  facts: {
    reportName: string | null;
    reportDate: string | null;
    verification?: 'INDEPENDENT_OCR_V1' | 'PDF_TEXT_LAYER_V1';
    tests: Array<{ name: string; value: string; unit: string | null; referenceRange: string | null; flag?: string;
      evidence?: string; source?: { page: number; confidence: number; rotationDegrees?: number;
        bbox: { x0: number; y0: number; x1: number; y1: number } } }>;
  };
}

export class VdaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly patientSafeMessage?: string,
  ) {
    super(message);
    this.name = 'VdaApiError';
  }
}

class ApiService {
  private authToken: string | null = null;
  private accountId: string | null = null;
  private refreshHandler: (() => Promise<boolean>) | null = null;
  private accessExpiresAt: number | null = null;

  public setRefreshHandler(handler: () => Promise<boolean>): void { this.refreshHandler = handler; }
  public setAccessExpiry(value?: string): void {
    const time = value ? Date.parse(value) : NaN;
    this.accessExpiresAt = Number.isFinite(time) ? time : null;
  }

  private timeoutMs(endpoint: string): number {
    if (/\/turns(?:\?|$)/.test(endpoint)) return 120_000;
    if (/\/voice\/tts$/.test(endpoint)) return 150_000;
    if (/\/voice\/stt$/.test(endpoint)) return 45_000;
    if (/\/reports(?:\/|\?|$)/.test(endpoint)) return 150_000;
    if (/\/prescriptions(?:\?|$)/.test(endpoint)) return 90_000;
    return 20_000;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    onTiming?: (phase: 'headers' | 'body', elapsedMs: number) => void,
  ): Promise<Response> {
    const originalHeaders = new Headers(options.headers);
    const authorized = originalHeaders.has('Authorization');
    const authEndpoint = /\/api\/v1\/auth\/(?:signup|login|refresh|logout)(?:\?|$)/.test(url);
    const requestAccountId = this.accountId;
    if (authorized && originalHeaders.get('Authorization') !== `Bearer ${this.authToken}`) {
      throw new VdaApiError('Account changed. Please retry this action.', 0, 'AUTH_OPERATION_SUPERSEDED');
    }
    if (authorized && !authEndpoint && this.refreshHandler && this.accessExpiresAt && Date.now() >= this.accessExpiresAt - 60_000) {
      await this.refreshHandler();
    }
    const headers = new Headers(options.headers);
    if (authorized && requestAccountId && this.accountId !== requestAccountId) {
      throw new VdaApiError('Account changed. Please retry this action.', 0, 'AUTH_OPERATION_SUPERSEDED');
    }
    if (authorized && this.authToken) headers.set('Authorization', `Bearer ${this.authToken}`);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.timeoutMs(url));
    const requestStartedAt = performance.now();
    try {
      const sentAuthorization = headers.get('Authorization');
      let response = await fetch(url, { ...options, headers, signal: controller.signal });
      if (response.status === 401 && authorized && !authEndpoint && this.refreshHandler) {
        const renewed = this.authToken && sentAuthorization !== `Bearer ${this.authToken}`
          ? true : await this.refreshHandler();
        if (requestAccountId && this.accountId !== requestAccountId) {
          throw new VdaApiError('Account changed. Please retry this action.', 0, 'AUTH_OPERATION_SUPERSEDED');
        }
        if (renewed && this.authToken) {
          const method = (options.method || 'GET').toUpperCase();
          const safeRetry = method === 'GET' || method === 'HEAD' || headers.has('Idempotency-Key');
          if (!safeRetry) throw new VdaApiError('Sign-in renewed. Please retry this action.', 0, 'AUTH_RETRY_REQUIRED');
          headers.set('Authorization', `Bearer ${this.authToken}`);
          response = await fetch(url, { ...options, headers, signal: controller.signal });
        }
      }
      onTiming?.('headers', Math.round(performance.now() - requestStartedAt));
      // Keep the deadline active until the response body has arrived as well.
      if (typeof response.arrayBuffer !== 'function') return response;
      const body = await response.arrayBuffer();
      onTiming?.('body', Math.round(performance.now() - requestStartedAt));
      return new Response([204, 205, 304].includes(response.status) ? null : body,
        { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw new VdaApiError('Connection timed out. Please retry.', 0, 'REQUEST_TIMEOUT',
          'The connection timed out. Please retry.');
      }
      if (error instanceof TypeError) {
        throw new VdaApiError('Connection unavailable. Please retry.', 0, 'NETWORK_UNAVAILABLE',
          'The network is unavailable. Please retry when connected.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  public setAuthToken(token: string) {
    this.authToken = token;
  }

  public setAccountId(id: string | null): void { this.accountId = id; }

  public clearAuthToken() {
    this.authToken = null;
    this.accessExpiresAt = null;
    this.accountId = null;
  }

  async refresh(refreshToken: string, nextRefreshToken: string): Promise<AuthResponse> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken, nextRefreshToken }),
    });
    if (!response.ok) throw await this.apiError(response, 'Your session has expired. Please sign in again.');
    return response.json();
  }

  async revokeRefreshSession(refreshToken: string): Promise<void> {
    await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    });
  }

  async registerPushDevice(token: string): Promise<void> {
    await this.request('/api/v1/mobile/push/devices', {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ token }),
    }, { registered: false });
  }

  async unregisterPushDevices(): Promise<void> {
    await this.request('/api/v1/mobile/push/devices', {
      method: 'DELETE', headers: this.getHeaders(),
    }, undefined);
  }

  public isBackendConfigured(): boolean {
    return Boolean(API_BASE_URL);
  }

  async initAuthToken(): Promise<string | null> {
    return this.authToken;
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

  private async apiError(response: Response, fallback: string): Promise<VdaApiError> {
    const payload = await response.json().catch(() => null) as {
      error?: { code?: string; message?: string; patient_safe_message?: string } | string;
      code?: string;
      message?: string;
      patient_safe_message?: string;
    } | null;
    const nested = payload?.error && typeof payload.error === 'object' ? payload.error : undefined;
    const code = nested?.code
      || payload?.code
      || (typeof payload?.error === 'string' ? payload.error : undefined);
    const message = nested?.message || payload?.message || code || fallback;
    return new VdaApiError(
      message,
      response.status,
      code,
      nested?.patient_safe_message || payload?.patient_safe_message,
    );
  }

  /**
   * Generic safe request wrapper with fallback
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, fallbackData: T): Promise<T> {
    if (!API_BASE_URL) {
      if (USE_MOCK_FALLBACK) return fallbackData;
      throw new VdaApiError('VDA service is unavailable.', 0, 'BACKEND_UNAVAILABLE');
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
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
  // AUTHENTICATION & USER PROFILE ENDPOINTS
  // ==========================================

  /**
   * Register a new user: POST /api/v1/auth/signup
   */
  async signup(dto: SignupDto): Promise<AuthResponse> {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL_NOT_CONFIGURED');
    }

    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(dto)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Signup failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * User login: POST /api/v1/auth/login
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL_NOT_CONFIGURED');
    }

    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(dto)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Login failed with status ${response.status}`);
    }

    return response.json();
  }

  async getProfile(): Promise<UserProfile> {
    if (!API_BASE_URL || !this.authToken) throw new Error('AUTHENTICATION_REQUIRED');
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/profile`, { headers: this.getHeaders() });
    if (!response.ok) throw await this.apiError(response, `Profile validation failed with status ${response.status}`);
    return response.json();
  }

  /**
   * Update user basic profile: PUT /api/v1/auth/profile
   */
  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL_NOT_CONFIGURED');
    }

    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(profile)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Update profile failed with status ${response.status}`);
    }

    return response.json();
  }

  // ==========================================
  // SESSION & TURN MANAGEMENT
  // ==========================================

  /**
   * Create VDA Session for the active patient/user
   */
  async createPatientSession(locale = 'hi'): Promise<{ session_id: string; locale?: string } | null> {
    if (!API_BASE_URL) return null;

    try {
      await this.initAuthToken();

      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Idempotency-Key': `mobile-session-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ speaker: 'self', locale_hint: locale, device_class: 'android-pilot' }),
      });

      if (response.ok) return response.json();
      throw await this.apiError(response, `Session creation failed (${response.status})`);
    } catch (err) {
      console.warn('[VDA API] Session creation endpoint error:', err);
      if (err instanceof VdaApiError) throw err;
    }
    return null;
  }

  /** Loads passive, deterministic clinical follow-ups. This endpoint never creates a VDA turn. */
  async getClinicalFollowUps(sessionId: string): Promise<FollowUpListResponse> {
    await this.initAuthToken();
    return this.request<FollowUpListResponse>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/follow-ups`,
      { method: 'GET' },
      { asOfDate: '', timezone: '', followUps: [], progress: { completedFollowUpCount: 0 } },
    );
  }

  /** Records only a checkup-attendance response, never a medication adherence event. */
  async recordClinicalFollowUpAttendance(
    sessionId: string,
    followUpId: string,
    attended: boolean,
  ): Promise<FollowUpAttendanceResponse> {
    await this.initAuthToken();
    const response = await this.fetchWithTimeout(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/follow-ups/${encodeURIComponent(followUpId)}/attendance`,
      { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ attended }) },
    );
    if (!response.ok) throw new Error(`Clinical follow-up attendance API error ${response.status}`);
    const json = await response.json();
    return json.data !== undefined ? json.data as FollowUpAttendanceResponse : json as FollowUpAttendanceResponse;
  }

  /**
   * Send user voice/text query to VDA backend session turns: POST /api/v1/sessions/:session_id/turns
   */
  async processVdaQuery(
    query: string,
    patient: PatientDemographics,
    medications: FhirMedication[],
    observations: FhirObservation[],
    lang: LanguageCode,
    sessionId?: string | null,
    options?: {
      disableLocalFallback?: boolean;
      prescriptionId?: string;
      prescriptionContextRequired?: boolean;
      reportId?: string;
      idempotencyKey?: string;
    },
  ): Promise<VdaProcessResult> {
    if (!API_BASE_URL) throw new Error('VDA_BACKEND_UNAVAILABLE');

    try {
      await this.initAuthToken();

      let activeSession = sessionId;
      if (!activeSession) {
        const sessionRes = await this.createPatientSession(lang);
        activeSession = sessionRes?.session_id || null;
      }

      if (!activeSession) {
        throw new Error('VDA_SESSION_UNAVAILABLE');
      }

      const turnStartedAt = performance.now();
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/sessions/${activeSession}/turns`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Idempotency-Key': options?.idempotencyKey || `turn-${crypto.randomUUID()}`
        },
        body: JSON.stringify({
          input_text: query,
          speaker: 'self',
          language: lang,
          ...(options?.prescriptionId ? { prescription_id: options.prescriptionId } : {}),
          ...(options?.prescriptionContextRequired ? { prescription_context_required: true } : {}),
          ...(options?.reportId ? { report_id: options.reportId } : {}),
        })
      });

      if (!response.ok) {
        throw await this.apiError(response, `Turn API error ${response.status}: ${response.statusText}`);
      }

      const turnResult = await response.json();
      voicePerformance.timing('turn', { requestDurationMs: Math.round(performance.now() - turnStartedAt) });
      const content = turnResult.content || {};
      const sections: ChatMessage['sections'] = Array.isArray(content.sections)
        ? content.sections
            .filter((section: unknown) => section && typeof section === 'object')
            .map((section: Record<string, unknown>) => ({
              ...(typeof section.title === 'string' && section.title.trim()
                ? { title: section.title.trim() }
                : {}),
              ...(typeof section.body === 'string' && section.body.trim()
                ? { body: section.body.trim() }
                : {}),
              ...(Array.isArray(section.bullets)
                ? {
                    bullets: section.bullets
                      .filter((bullet): bullet is string => typeof bullet === 'string' && Boolean(bullet.trim()))
                      .map((bullet) => bullet.trim()),
                  }
                : {}),
            }))
            .filter((section: NonNullable<ChatMessage['sections']>[number]) =>
              Boolean(section.title || section.body || section.bullets?.length))
        : undefined;

      const structuredSummary = typeof content.summary === 'string'
        ? content.summary.trim()
        : '';
      const visualSummary = structuredSummary || content.patient_text || content.reason
        || (typeof content === 'string' ? content : '');
      const englishCandidate = typeof content.en === 'string' ? content.en.trim() : '';
      const hindiCandidate = typeof content.hi === 'string' ? content.hi.trim() : '';
      const localizedSummary = (candidate: string) => sections?.length && structuredSummary
        && candidate.startsWith(structuredSummary) ? structuredSummary : candidate;
      const englishText = localizedSummary(englishCandidate) || visualSummary;
      const textEn = /[\u0900-\u097f]/u.test(englishText)
        ? `English translation unavailable. Original answer:\n${englishText}` : englishText;
      const hindiText = localizedSummary(hindiCandidate) || visualSummary || englishCandidate;
      const textHi = !hindiCandidate && hindiText && !/[\u0900-\u097f]/u.test(hindiText)
        ? `हिंदी अनुवाद उपलब्ध नहीं है। मूल उत्तर:\n${hindiText}` : hindiText;
      const mainText = lang === 'hi' && textHi ? textHi : (textEn || textHi);

      const isEscalated = turnResult.response_type === 'escalation'
        && turnResult.safety_status === 'ESCALATED_BY_RULE'
        && turnResult.intent === 'safety-escalation';

      const nearbyFacilities: ClinicalReviewFacility[] = Array.isArray(content.facility_results)
        ? content.facility_results
            .filter((facility: unknown): facility is Record<string, unknown> =>
              Boolean(facility) && typeof facility === 'object')
            .map((facility: Record<string, unknown>) => ({
              name: typeof facility.name === 'string' ? facility.name : '',
              state: typeof facility.state === 'string' ? facility.state : null,
              district: typeof facility.district === 'string' ? facility.district : null,
              city: typeof facility.city === 'string'
                ? facility.city
                : typeof facility.locality === 'string' ? facility.locality : null,
              address: typeof facility.address === 'string' ? facility.address : null,
              contactNumber: typeof facility.contactNumber === 'string' ? facility.contactNumber : null,
              hospitalType: typeof facility.hospitalType === 'string' ? facility.hospitalType : null,
              schemes: Array.isArray(facility.schemes)
                ? facility.schemes.filter((scheme): scheme is string => typeof scheme === 'string')
                : [],
              emergencyCapabilityVerified:
                facility.emergencyCapabilityVerified === true
                || facility.emergencyAvailable === true
                || facility.emergencyCapability === 'SOURCE_REPORTED_CAPABLE',
              distanceKm: typeof facility.distanceKm === 'number' ? facility.distanceKm : null,
              travelTimeMinutes: typeof facility.travelTimeMinutes === 'number'
                ? facility.travelTimeMinutes
                : null,
            }))
            .filter((facility: ClinicalReviewFacility) => Boolean(facility.name))
        : [];

      const message: ChatMessage = {
        id: `turn-msg-${turnResult.turn_number || Date.now()}`,
        sender: 'vda',
        agent: turnResult.selected_agent || 'router',
        text: textEn || textHi,
        textHi: textHi,
        spokenSummary: typeof content.spoken_summary === 'string' && content.spoken_summary.trim()
          ? content.spoken_summary.trim() : undefined,
        spokenSummaryLang: typeof content.spoken_summary === 'string' && content.spoken_summary.trim()
          ? lang : undefined,
        textTa: mainText,
        textKn: mainText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEscalationTrigger: isEscalated,
        provenance: [
          'FHIR_R4',
          'PRESCRIPTION',
          'REMINDER',
          'KNOWLEDGE',
          'PRESCRIPTION_AND_KNOWLEDGE',
        ].includes(content.provenance) ? content.provenance : undefined,
        sections,
        audioAvailable: true
      };

      return {
        message,
        escalationDetected: isEscalated,
        responseType: turnResult.response_type,
        nearbyFacilities,
      };
    } catch (err) {
      console.warn('[VDA API] Backend turn endpoint error:', err);
      throw err;
    }
  }

  /**
   * Refreshes only the server-side, privacy-minimized prescription context.
   */
  async refreshPrescriptionSessionContext(
    sessionId: string,
    prescriptionRecordId: string,
    planRevision: number,
    reminders: Array<{ medicineName: string; times: string[] }>,
  ): Promise<void> {
    if (!API_BASE_URL) return;
    await this.initAuthToken();
    const response = await this.fetchWithTimeout(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/prescription-context`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          // This is Prescription.id from GET .../prescriptions/current, not
          // the separate public/domain `prescriptionId` field.
          prescription_id: prescriptionRecordId,
          plan_revision: planRevision,
          reminders: reminders.map((reminder) => ({
            medicine_name: reminder.medicineName,
            reminder_times: reminder.times,
          })),
        }),
      },
    );
    if (!response.ok) throw new Error(`Prescription context API error ${response.status}`);
  }

  /** Uploads patient-recorded audio to the authenticated backend STT boundary. */
  async transcribeVoice(
    audio: Blob,
    lang: LanguageCode,
    durationMs?: number,
  ): Promise<{ transcript: string; provider: string; fallbackUsed: boolean; detectedLanguage?: string }> {
    await this.initAuthToken();
    const form = new FormData();
    const mimeType = (audio.type || 'audio/webm').split(';', 1)[0].toLowerCase();
    const extension = mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a'
      ? '.m4a'
      : mimeType === 'audio/mpeg'
        ? '.mp3'
        : mimeType === 'audio/ogg'
          ? '.ogg'
          : mimeType === 'audio/wav' || mimeType === 'audio/x-wav'
            ? '.wav'
            : '.webm';
    form.append('audio', audio, `vda-recording${extension}`);
    form.append('language_code', this.voiceLanguageCode(lang));
    if (durationMs !== undefined) form.append('duration_ms', String(durationMs));
    const headers = this.getHeaders() as Record<string, string>;
    delete headers['Content-Type'];
    const startedAt = performance.now();
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/voice/stt`, {
      method: 'POST',
      headers,
      body: form,
    });
    voicePerformance.timing('stt', {
      status: response.status, requestDurationMs: Math.round(performance.now() - startedAt),
      mimeType, bytes: audio.size, recordingDurationMs: durationMs ?? null,
    });
    if (!response.ok) throw new Error(`Voice STT error ${response.status}`);
    const result = await response.json();
    if (import.meta.env.DEV) console.debug('[VDA STT result]', {
      provider: result.provider, fallbackUsed: result.fallbackUsed,
      emptyTranscript: !String(result.transcript || '').trim(),
    });
    return result;
  }

  /** Requests the configured TTS provider; Sarvam uses these voice settings when selected. */
  async synthesizeVoice(text: string, lang: LanguageCode): Promise<Blob> {
    await this.initAuthToken();
    let headersMs = 0;
    let bodyMs = 0;
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/voice/tts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ text, language_code: this.voiceLanguageCode(lang),
        voice_id: ({ hi: 'priya', en: 'ishita', ta: 'ishita', kn: 'neha' } as const)[lang],
        pace: 0.9 }),
    }, (phase, elapsedMs) => {
      if (phase === 'headers') headersMs = elapsedMs;
      else bodyMs = elapsedMs;
    });
    if (!response.ok) throw new Error(`Voice TTS error ${response.status}`);
    const audio = await response.blob();
    voicePerformance.timing('tts', {
      requestToHeadersMs: headersMs,
      audioDownloadMs: Math.max(0, bodyMs - headersMs),
      totalResponseMs: bodyMs,
      audioBytes: audio.size,
    });
    return audio;
  }

  private voiceLanguageCode(lang: LanguageCode): string {
    const languages: Record<LanguageCode, string> = {
      hi: 'hi-IN',
      en: 'en-IN',
      ta: 'ta-IN',
      kn: 'kn-IN',
    };
    return languages[lang];
  }

  /** Read the persisted, tenant/session-scoped clinician-chat state. */
  async getClinicalReviewState(sessionId: string): Promise<ClinicalReviewState> {
    await this.initAuthToken();
    return this.request<ClinicalReviewState>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/clinical-review`,
      { method: 'GET' },
      {
        reviewRequested: false,
        teleconsultationOffered: false,
        teleconsultationConfigured: false,
        clinicalChatState: 'ENDED',
        clinicianResponseDeadline: null,
        firstClinicianResponseAt: null,
        fallbackShownAt: null,
        nearbyFacilities: [],
        messages: [],
      },
    );
  }

  /** Audits a patient-initiated teleconsultation fallback without transferring health data. */
  async requestClinicalReviewTeleconsultation(sessionId: string): Promise<{ teleconsultationConfigured: boolean }> {
    await this.initAuthToken();
    return this.request<{ teleconsultationConfigured: boolean }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/clinical-review/teleconsultation`,
      { method: 'POST' },
      { teleconsultationConfigured: false },
    );
  }

  /** Opens the official patient sign-in page without transferring VDA data. */
  async openEsanjeevani(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await EsanjeevaniExternalLink.open();
      return;
    }
    window.open(ESANJEEVANI_OFFICIAL_URL, '_blank', 'noopener,noreferrer');
  }

  /**
   * Upload prescription document/image to VDA backend session: POST /api/v1/sessions/:sessionId/prescriptions
   */
  async uploadPrescription(sessionId: string, file: File): Promise<any> {
    if (!API_BASE_URL) return null;

    try {
      await this.initAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/sessions/${sessionId}/prescriptions`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.warn('[VDA API] Prescription upload error:', err);
      throw err;
    }
  }

  /** Report uploads are a separate patient-scoped resource, never a prescription. */
  async uploadMedicalReport(sessionId: string, file: File, language: LanguageCode): Promise<PatientMedicalReport> {
    await this.initAuthToken();
    const form = new FormData();
    form.append('file', file);
    form.append('report_consent', 'true');
    form.append('language', language);
    const headers = new Headers(this.getHeaders());
    headers.delete('Content-Type');
    const response = await this.fetchWithTimeout(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/reports`,
      { method: 'POST', headers, body: form },
    );
    if (!response.ok) throw await this.apiError(response, 'Report upload failed. Please try again.');
    return response.json();
  }

  async listMedicalReports(sessionId: string): Promise<PatientMedicalReport[]> {
    await this.initAuthToken();
    const response = await this.fetchWithTimeout(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/reports`,
      { headers: this.getHeaders() },
    );
    if (!response.ok) throw await this.apiError(response, 'Reports could not be loaded.');
    return response.json();
  }

  async getMedicalReportSource(sessionId: string, reportId: string): Promise<Blob> {
    await this.initAuthToken();
    const response = await this.fetchWithTimeout(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/reports/${encodeURIComponent(reportId)}/source`,
      { headers: this.getHeaders() },
    );
    if (!response.ok) throw await this.apiError(response, 'Report could not be opened.');
    return response.blob();
  }

  async deleteMedicalReport(sessionId: string, reportId: string): Promise<void> {
    await this.initAuthToken();
    const response = await this.fetchWithTimeout(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/reports/${encodeURIComponent(reportId)}`,
      { method: 'DELETE', headers: this.getHeaders() },
    );
    if (!response.ok) throw await this.apiError(response, 'Report could not be deleted.');
  }

  async confirmMedicalReportReplacement(sessionId: string, reportId: string): Promise<PatientMedicalReport> {
    await this.initAuthToken();
    const response = await this.fetchWithTimeout(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/reports/${encodeURIComponent(reportId)}/confirm-replacement`,
      { method: 'POST', headers: this.getHeaders() },
    );
    if (!response.ok) throw await this.apiError(response, 'Report replacement could not be confirmed.');
    return response.json();
  }

  /** Resolve the exact session's active verified plan and latest submission server-side. */
  async getCurrentPrescriptionState(sessionId: string): Promise<PatientPrescriptionCurrentState> {
    await this.initAuthToken();
    return this.request<PatientPrescriptionCurrentState>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/prescriptions/current`,
      { method: 'GET' },
      { activePlan: null, latestSubmission: null },
    );
  }

  /**
   * Record medication taken status (adherence)
   */
  async toggleMedicationAdherence(medicationId: string, taken: boolean): Promise<{ success: boolean; adherenceRate?: number }> {
    return { success: true };
  }

  /**
   * Save a newly recorded vital sign (e.g. self-monitored blood glucose, blood pressure)
   */
  async logObservation(observation: FhirObservation): Promise<FhirObservation> {
    return observation;
  }

  /**
   * Revoke ABDM consent artifact
   */
  async revokeConsent(consentId: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  // ==========================================
  // FACILITIES & HEALTH SCHEMES ENDPOINTS
  // ==========================================

  async getFacilities(): Promise<FacilityDirectoryResponse> {
    await this.initAuthToken();
    if (!this.authToken) throw new Error('AUTHENTICATION_REQUIRED');
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/patient/facilities`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`Facility directory error ${response.status}`);
    const json = await response.json();
    return json.data !== undefined ? json.data : json;
  }

  async getSchemes(): Promise<SchemeDirectoryResponse> {
    await this.initAuthToken();
    if (!this.authToken) throw new Error('AUTHENTICATION_REQUIRED');
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/v1/patient/schemes`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`Scheme directory error ${response.status}`);
    const json = await response.json();
    return json.data !== undefined ? json.data : json;
  }
}

export const apiService = new ApiService();
