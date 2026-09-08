/**
 * VDA Mobile — VDA Engine Unit Tests (P1 Core Navigation)
 *
 * Validates:
 * - Deterministic safety gate bypass
 * - Intent routing to Domain Agents (medication, lab_explainer, facility, scheme, lifestyle_diet, triage)
 * - Multilingual parity across EN, HI, TA, KN
 * - Card and quickAction data structures
 */
import { describe, it, expect } from 'vitest';
import { processVdaQuery, getChatMessageText, getQuickActionLabel, getCardTitle } from '../vdaEngine';
import { SYNTHETIC_PATIENTS } from '../../data/syntheticData';
import { ChatMessage } from '../../types';

describe('VDA Mobile — vdaEngine', () => {
  const patientData = SYNTHETIC_PATIENTS['synth-patient-001'];
  const patient = patientData.demographics;
  const medications = patientData.medications;
  const observations = patientData.observations;

  // ─── Emergency Escalation Bypass ───────────────────────
  describe('Safety Gate Bypass in Engine', () => {
    it('should immediately route emergency symptoms to safety_gate agent with escalation state', () => {
      const result = processVdaQuery('I have severe chest pain', patient, medications, observations, 'en');

      expect(result.message.agent).toBe('safety_gate');
      expect(result.message.isEscalationTrigger).toBe(true);
      expect(result.message.text).toContain('CRITICAL ALERT');
      expect(result.escalationState).toBeDefined();
      expect(result.escalationState?.severity).toBe('CRITICAL');
      expect(result.escalationState?.assignedDoctor.facility).toContain('AIIMS');
    });

    it('should provide multilingual emergency messages for Hindi', () => {
      const result = processVdaQuery('सांस फूल रही है', patient, medications, observations, 'hi');

      expect(result.message.agent).toBe('safety_gate');
      expect(result.message.textHi).toContain('अति महत्वपूर्ण चेतावनी');
      expect(result.escalationState).toBeDefined();
    });
  });

  // ─── Domain Agent Intent Routing ────────────────────────
  describe('Domain Agent Routing', () => {
    it('should route medication queries to "medication" agent', () => {
      const queries = ['when should I take my medicine?', 'दवाई कब लेनी है', 'metformin dose', 'மருந்து'];
      for (const q of queries) {
        const result = processVdaQuery(q, patient, medications, observations, 'en');
        expect(result.message.agent).toBe('medication');
        expect(result.message.cardData?.type).toBe('medication_reminder');
        expect(result.message.quickActions?.length).toBeGreaterThan(0);
      }
    });

    it('should route lab / vital queries to "lab_explainer" agent', () => {
      const queries = ['what is my sugar level?', 'मेरी जांच रिपोर्ट क्या है', 'explain my HbA1c', 'रक्तदबाव'];
      for (const q of queries) {
        const result = processVdaQuery(q, patient, medications, observations, 'en');
        expect(result.message.agent).toBe('lab_explainer');
        expect(result.message.cardData?.type).toBe('lab_highlight');
        expect(result.message.quickActions?.length).toBeGreaterThan(0);
      }
    });

    it('should route hospital queries to "facility" agent', () => {
      const queries = ['where is the nearest hospital?', 'नजदीकी अस्पताल', 'opd timings', 'fast track qr'];
      for (const q of queries) {
        const result = processVdaQuery(q, patient, medications, observations, 'en');
        expect(result.message.agent).toBe('facility');
        expect(result.message.cardData?.type).toBe('facility_qr');
        expect(result.message.text).toContain('District Hospital');
      }
    });

    it('should route PM-JAY queries to "scheme" agent', () => {
      const queries = ['how to claim Ayushman Bharat?', 'आयुष्मान भारत योजना', 'PM-JAY card benefits', '5 lakh insurance'];
      for (const q of queries) {
        const result = processVdaQuery(q, patient, medications, observations, 'en');
        expect(result.message.agent).toBe('scheme');
        expect(result.message.cardData?.type).toBe('scheme_summary');
        expect(result.message.text).toContain('5,00,000');
      }
    });

    it('should route diet queries to "lifestyle_diet" agent', () => {
      const queries = ['what diet should I eat for diabetes?', 'खाने में क्या लें', 'should I eat roti or rice?'];
      for (const q of queries) {
        const result = processVdaQuery(q, patient, medications, observations, 'en');
        expect(result.message.agent).toBe('lifestyle_diet');
        expect(result.message.text).toContain('whole grains');
      }
    });

    it('should route general queries to "triage" navigator', () => {
      const result = processVdaQuery('Hello, help me', patient, medications, observations, 'en');
      expect(result.message.agent).toBe('triage');
      expect(result.message.quickActions?.length).toBe(4);
    });
  });

  // ─── Multilingual Content Parity ────────────────────────
  describe('Multilingual Content Retrieval', () => {
    const dummyMsg: ChatMessage = {
      id: 'test-1',
      sender: 'vda',
      agent: 'medication',
      text: 'Take your medicine',
      textHi: 'अपनी दवा लें',
      textTa: 'உங்கள் மருந்தை உட்கொள்ளவும்',
      textKn: 'ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಿ',
      timestamp: '10:00 AM',
    };

    it('should return correct language text via getChatMessageText', () => {
      expect(getChatMessageText(dummyMsg, 'en')).toBe('Take your medicine');
      expect(getChatMessageText(dummyMsg, 'hi')).toBe('अपनी दवा लें');
      expect(getChatMessageText(dummyMsg, 'ta')).toBe('உங்கள் மருந்தை உட்கொள்ளவும்');
      expect(getChatMessageText(dummyMsg, 'kn')).toBe('ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಿ');
    });

    it('should fall back to English if target language text is missing', () => {
      const partialMsg: ChatMessage = {
        id: 'test-2',
        sender: 'vda',
        agent: 'triage',
        text: 'English only message',
        timestamp: '10:00 AM',
      };
      expect(getChatMessageText(partialMsg, 'hi')).toBe('English only message');
      expect(getChatMessageText(partialMsg, 'ta')).toBe('English only message');
      expect(getChatMessageText(dummyMsg, 'en')).toBe('Take your medicine');
    });

    it('should return translated quick action labels', () => {
      const action = {
        label: 'View Meds',
        labelHi: 'दवाई देखें',
        labelTa: 'மருந்துகள்',
        labelKn: 'ಔಷಧಿಗಳು',
        action: 'test',
      };
      expect(getQuickActionLabel(action, 'en')).toBe('View Meds');
      expect(getQuickActionLabel(action, 'hi')).toBe('दवाई देखें');
      expect(getQuickActionLabel(action, 'ta')).toBe('மருந்துகள்');
      expect(getQuickActionLabel(action, 'kn')).toBe('ಔಷಧಿಗಳು');
    });

    it('should return translated card titles', () => {
      const card = {
        title: 'Medicine Schedule',
        titleHi: 'दवा समय-सारणी',
        titleTa: 'மருந்து அட்டவணை',
        titleKn: 'ಔಷಧಿ ವೇಳಾಪಟ್ಟಿ',
      };
      expect(getCardTitle(card, 'en')).toBe('Medicine Schedule');
      expect(getCardTitle(card, 'hi')).toBe('दवा समय-सारणी');
      expect(getCardTitle(card, 'ta')).toBe('மருந்து அட்டவணை');
      expect(getCardTitle(card, 'kn')).toBe('ಔಷಧಿ ವೇಳಾಪಟ್ಟಿ');
    });
  });
});
