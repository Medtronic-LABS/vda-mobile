/**
 * VDA Mobile — API Service Unit Tests (P0 Integration & Resilience)
 *
 * Validates:
 * - Auth token storage and lifecycle
 * - Local fallback when backend is unreachable
 * - Real user signup & login endpoints
 * - eSanjeevani deep-link launcher behavior
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiService, VdaApiError } from '../api';
import { PatientDemographics } from '../../types';

describe('VDA Mobile — ApiService', () => {
  const mockDemographics: PatientDemographics = {
    name: 'Suman Devi',
    age: 42,
    gender: 'female',
    state: 'Uttar Pradesh',
    district: 'Sitapur',
  };

  beforeEach(() => {
    localStorage.clear();
    apiService.clearAuthToken();
    vi.restoreAllMocks();
  });

  // ─── Token Management ──────────────────────────────────
  describe('Authentication Token Lifecycle', () => {
    it('keeps the bearer token in memory instead of creating a competing browser store', () => {
      apiService.setAuthToken('test-jwt-token-123');
      expect(localStorage.getItem('vda_auth_token')).toBeNull();
    });

    it('should clear auth token from memory and localStorage', () => {
      apiService.setAuthToken('temp-token');
      apiService.clearAuthToken();
      expect(localStorage.getItem('vda_auth_token')).toBeNull();
    });

    it('should report backend is configured when base URL exists', () => {
      expect(apiService.isBackendConfigured()).toBe(true);
    });
  });

  // ─── Fallback Handling when Backend Offline ────────────
  describe('Resilience & Fallbacks', () => {
    it('should fall back to local vdaEngine when backend turn endpoint fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Backend offline'));

      const result = await apiService.processVdaQuery(
        'What is my blood sugar?',
        mockDemographics,
        [],
        [],
        'en'
      );

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.message.sender).toBe('vda');
      expect(result.message.text).toBeTruthy();
    });

    it('should return source-backed patient facilities without synthetic availability', async () => {
      apiService.setAuthToken('patient-token');
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          scope: { state: 'HARYANA', district: 'FARIDABAD', matchType: 'AREA' },
          notice: 'Confirm availability.',
          facilities: [{
            id: 'source-facility-1', name: 'Source Facility', facilityType: 'CHC',
            ownership: 'GOVERNMENT', address: null, city: null, district: 'FARIDABAD',
            state: 'HARYANA', contactNumber: null, schemes: ['PMJAY'], pmjayListed: true,
            iphsLevel: 'CHC', emergencyCapability: 'UNKNOWN', distanceKm: null,
            travelTimeMinutes: null, sourceKind: 'NHA_FACILITY_DIRECTORY', sourceVersion: '1',
          }],
        }),
      } as Response);
      const result = await apiService.getFacilities();
      expect(result.facilities).toHaveLength(1);
      expect(result.facilities[0].distanceKm).toBeNull();
      expect(result.scope.matchType).toBe('AREA');
    });

    it('should return governed schemes requiring official eligibility verification', async () => {
      apiService.setAuthToken('patient-token');
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          state: 'HARYANA', eligibilityStatus: 'ELIGIBILITY_CHECK_REQUIRED',
          notice: 'Eligibility requires official verification.',
          schemes: [{ id: 'pmjay', name: 'PM-JAY', eligibilityStatus: 'ELIGIBILITY_CHECK_REQUIRED' }],
        }),
      } as Response);
      const result = await apiService.getSchemes();
      expect(result.schemes).toHaveLength(1);
      expect(result.eligibilityStatus).toBe('ELIGIBILITY_CHECK_REQUIRED');
    });

    it('should successfully acknowledge adherence toggle', async () => {
      const res = await apiService.toggleMedicationAdherence('med-001', true);
      expect(res.success).toBe(true);
    });

    it('should successfully acknowledge consent revocation', async () => {
      const res = await apiService.revokeConsent('consent-001');
      expect(res.success).toBe(true);
    });
  });

  // ─── Authentication Endpoints ─────────────────────────
  describe('Authentication & User Registration', () => {
    it('should handle signup request with basic demographics only', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          token: 'token-abc',
          user: {
            id: 'usr-1',
            fullName: 'Rahul Sharma',
            phone: '9876543210',
            age: 35,
            gender: 'male',
            state: 'Madhya Pradesh',
            district: 'Bhopal',
            language: 'hi',
          },
        }),
      } as any);

      const res = await apiService.signup({
        fullName: 'Rahul Sharma',
        phone: '9876543210',
        pin: '1234',
        age: 35,
        gender: 'male',
        state: 'Madhya Pradesh',
        district: 'Bhopal',
        language: 'hi',
      });

      expect(res.user.id).toBe('usr-1');
      expect(res.token).toBe('token-abc');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle login request', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          token: 'token-xyz',
          user: {
            id: 'usr-1',
            fullName: 'Rahul Sharma',
            phone: '9876543210',
            age: 35,
            gender: 'MALE',
            state: 'Madhya Pradesh',
            district: 'Bhopal',
            language: 'hi',
          },
        }),
      } as any);

      const res = await apiService.login({
        phone: '9876543210',
        pin: '1234',
      });

      expect(res.user.id).toBe('usr-1');
      expect(res.token).toBe('token-xyz');
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Conversation session error contract', () => {
    it('preserves SESSION_EXPIRED and the caller idempotency key for recovery', async () => {
      apiService.setAuthToken('patient-token');
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 410,
        statusText: 'Gone',
        json: async () => ({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Your active session has expired.',
            patient_safe_message: 'Please start a new session.',
          },
        }),
      } as Response);

      await expect(apiService.processVdaQuery(
        'hello', mockDemographics, [], [], 'en', 'expired-session',
        { idempotencyKey: 'turn-recovery-test' },
      )).rejects.toMatchObject<VdaApiError>({ status: 410, code: 'SESSION_EXPIRED' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/expired-session/turns'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': 'turn-recovery-test' }),
        }),
      );
    });
  });

  // ─── Teleconsultation & eSanjeevani ─────────────────────
  describe('eSanjeevani Teleconsultation Launch', () => {
    it('should launch browser fallback when Capacitor native platform is unavailable', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      await apiService.openEsanjeevani();

      expect(openSpy).toHaveBeenCalledWith(
        'https://esanjeevani.mohfw.gov.in/#/patient/signin',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});
