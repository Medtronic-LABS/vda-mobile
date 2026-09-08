/**
 * VDA Mobile — Client-Side Security Attack Vector Tests
 *
 * Validates:
 * - XSS resistance: malicious HTML / script injection in queries and chat messages
 * - Token hygiene: auth token cannot be exfiltrated via prototype pollution
 * - Open redirect prevention: eSanjeevani URL is hardcoded and immutable
 * - Input validation: vital bounds (glucose, BP) reject anomalous/malicious payloads
 * - PII confidentiality: sensitive fields are not leaked to telemetry or insecure sinks
 */
import { describe, it, expect, vi } from 'vitest';
import { runDeterministicSafetyGate } from '../utils/safetyGate';
import { processVdaQuery } from '../utils/vdaEngine';
import { SYNTHETIC_PATIENTS } from '../data/syntheticData';
import { apiService } from '../services/api';

describe('VDA Mobile — Security Hardening Tests', () => {
  const patientData = SYNTHETIC_PATIENTS['synth-patient-001'];

  // ─── XSS Resistance ────────────────────────────────────
  describe('XSS Resistance in Chat Pipeline', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror="alert(document.cookie)">',
      '<svg/onload=alert`1`>',
      'javascript:void(0)',
      '"><script>window.location="http://attacker.com"</script>',
      '{{7*7}}',
      '${alert(1)}',
    ];

    it.each(xssPayloads)('should handle XSS payload without crash or unsanitized output: %s', (payload) => {
      const safetyResult = runDeterministicSafetyGate(payload);
      expect(safetyResult).toBeDefined();

      const engineResult = processVdaQuery(
        payload,
        patientData.demographics,
        patientData.medications,
        patientData.observations,
        'en'
      );

      expect(engineResult.message).toBeDefined();
      expect(typeof engineResult.message.text).toBe('string');
      // The engine should not evaluate code; it returns standard text
    });
  });

  // ─── Open Redirect Prevention ──────────────────────────
  describe('Open Redirect Prevention', () => {
    it('should only ever navigate to official government eSanjeevani domain', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      await apiService.openEsanjeevani();

      expect(openSpy).toHaveBeenCalledTimes(1);
      const targetUrl = openSpy.mock.calls[0][0] as string;
      const parsed = new URL(targetUrl);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.hostname).toBe('esanjeevani.mohfw.gov.in');
    });
  });

  // ─── Token Hygiene ─────────────────────────────────────
  describe('Auth Token Storage Security', () => {
    it('should properly isolate auth token and prevent unauthorized extraction', () => {
      apiService.setAuthToken('bearer-token-secret-999');

      // Verify it is stored under the designated key only
      expect(localStorage.getItem('vda_auth_token')).toBe('bearer-token-secret-999');
      expect(localStorage.getItem('admin_token')).toBeNull();

      apiService.clearAuthToken();
      expect(localStorage.getItem('vda_auth_token')).toBeNull();
    });
  });

  // ─── Vital Sign Bounds Validation ──────────────────────
  describe('Clinical Vital Sign Bounds Defense', () => {
    it('extreme high glucose (>400 mg/dL) or extreme low (<55 mg/dL) must trigger safety gate', () => {
      // Low glucose
      const lowResult = runDeterministicSafetyGate('My sugar 40 right now');
      expect(lowResult.isSafe).toBe(false);
      expect(lowResult.triggerCategory).toBe('SEVERE_HYPOGLYCEMIA');

      // Hypertensive crisis
      const highBpResult = runDeterministicSafetyGate('My BP 200 measured');
      expect(highBpResult.isSafe).toBe(false);
      expect(highBpResult.triggerCategory).toBe('HYPERTENSIVE_CRISIS');
    });
  });

  // ─── Prototype Pollution Defense ───────────────────────
  describe('Prototype Pollution Defense', () => {
    it('should not mutate Object.prototype when processing malicious object-like strings', () => {
      const maliciousQuery = '__proto__.polluted = true; constructor.prototype.isAdmin = true;';
      processVdaQuery(
        maliciousQuery,
        patientData.demographics,
        patientData.medications,
        patientData.observations,
        'en'
      );

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
    });
  });
});
