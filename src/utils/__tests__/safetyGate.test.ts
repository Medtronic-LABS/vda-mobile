/**
 * VDA Mobile — Deterministic Safety Gate Unit Tests (P0 Safety-Critical)
 *
 * Validates that red-flag symptoms in English, Hindi, Tamil, and Kannada
 * trigger immediate escalation and bypass standard LLM responses.
 */
import { describe, it, expect } from 'vitest';
import { runDeterministicSafetyGate, createEscalationPayload } from '../safetyGate';

describe('VDA Mobile — Deterministic Safety Gate', () => {
  // ─── CARDIAC Emergency Detection ────────────────────────
  describe('Cardiac Emergency Patterns', () => {
    const cardiacCases = [
      { text: 'I am experiencing chest pain', lang: 'EN' },
      { text: 'Severe chest tightness since morning', lang: 'EN' },
      { text: 'Heavy pressure in chest', lang: 'EN' },
      { text: 'Pain radiating to left arm', lang: 'EN' },
      { text: 'Suspected heart attack', lang: 'EN' },
      { text: 'सीने में दर्द हो रहा है', lang: 'HI' },
      { text: 'छाती में दर्द और बेचैनी', lang: 'HI' },
      { text: 'छाती में जकड़न महसूस हो रही है', lang: 'HI' },
      { text: 'पसीने के साथ दर्द है', lang: 'HI' },
      { text: 'மார்பு வலி அதிகமாக உள்ளது', lang: 'TA' },
      { text: 'ಎದೆ ನೋವು ಕಾಣಿಸಿಕೊಂಡಿದೆ', lang: 'KN' },
    ];

    it.each(cardiacCases)('should flag CARDIAC emergency for "$text" ($lang)', ({ text }) => {
      const result = runDeterministicSafetyGate(text);
      expect(result.isSafe).toBe(false);
      expect(result.isEscalated).toBe(true);
      expect(result.triggerCategory).toBe('CARDIAC');
      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toContain('Cardiac');
      expect(result.recommendedAction).toContain('108');
    });
  });

  // ─── STROKE Emergency Detection ─────────────────────────
  describe('Stroke Emergency Patterns (FAST Protocol)', () => {
    const strokeCases = [
      { text: 'Patient has slurred speech', lang: 'EN' },
      { text: 'Sudden face drooping noticed', lang: 'EN' },
      { text: 'Sudden weakness in arm', lang: 'EN' },
      { text: 'Sudden paralysis on right side', lang: 'EN' },
      { text: 'आधा शरीर सुन्न पड़ गया है', lang: 'HI' },
      { text: 'मुंह टेढ़ा हो गया है', lang: 'HI' },
      { text: 'बोली लड़खड़ाना शुरू हो गई', lang: 'HI' },
      { text: 'பக்கவாதம் அறிகுறி தெரிகிறது', lang: 'TA' },
      { text: 'ಲಕ್ವ ಹೊಡೆದಿದೆ', lang: 'KN' },
    ];

    it.each(strokeCases)('should flag STROKE emergency for "$text" ($lang)', ({ text }) => {
      const result = runDeterministicSafetyGate(text);
      expect(result.isSafe).toBe(false);
      expect(result.isEscalated).toBe(true);
      expect(result.triggerCategory).toBe('STROKE');
      expect(result.severity).toBe('CRITICAL');
      expect(result.recommendedAction).toContain('FAST Protocol');
    });
  });

  // ─── RESPIRATORY Distress Detection ─────────────────────
  describe('Respiratory Distress Patterns', () => {
    const respiratoryCases = [
      { text: 'I cannot breathe properly', lang: 'EN' },
      { text: 'Severe breathlessness after walking', lang: 'EN' },
      { text: 'Gasping for air suddenly', lang: 'EN' },
      { text: 'बहुत तेज़ सांस फूलना', lang: 'HI' },
      { text: 'सांस नहीं आ रही है', lang: 'HI' },
      { text: 'दम घुटना शुरू हो गया', lang: 'HI' },
      { text: 'மூச்சுத்திணறல் அதிகமாக உள்ளது', lang: 'TA' },
      { text: 'ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆ', lang: 'KN' },
    ];

    it.each(respiratoryCases)('should flag RESPIRATORY emergency for "$text" ($lang)', ({ text }) => {
      const result = runDeterministicSafetyGate(text);
      expect(result.isSafe).toBe(false);
      expect(result.isEscalated).toBe(true);
      expect(result.triggerCategory).toBe('RESPIRATORY');
      expect(result.severity).toBe('CRITICAL');
      expect(result.recommendedAction).toContain('Oxygen');
    });
  });

  // ─── SEVERE HYPOGLYCEMIA Detection ──────────────────────
  describe('Severe Hypoglycemia Patterns (< 55 mg/dL)', () => {
    const hypoCases = [
      { text: 'My glucometer shows sugar 40', lang: 'EN' },
      { text: 'Fasting sugar 45 this morning', lang: 'EN' },
      { text: 'Sugar 50 and feeling faint', lang: 'EN' },
      { text: 'Sugar less than 50 mg/dl', lang: 'EN' },
      { text: 'Trembling and sweating cold', lang: 'EN' },
      { text: 'Feeling severe hypo right now', lang: 'EN' },
      { text: 'शुगर 50 से कम हो गया है', lang: 'HI' },
      { text: 'चक्कर और बेहोशी महसूस हो रही है', lang: 'HI' },
      { text: 'बहुत लो शुगर हो गई है', lang: 'HI' },
    ];

    it.each(hypoCases)('should flag SEVERE_HYPOGLYCEMIA for "$text" ($lang)', ({ text }) => {
      const result = runDeterministicSafetyGate(text);
      expect(result.isSafe).toBe(false);
      expect(result.isEscalated).toBe(true);
      expect(result.triggerCategory).toBe('SEVERE_HYPOGLYCEMIA');
      expect(result.severity).toBe('CRITICAL');
      expect(result.recommendedAction).toContain('glucose');
    });
  });

  // ─── HYPERTENSIVE CRISIS Detection ──────────────────────
  describe('Hypertensive Crisis Patterns (> 180/120 mmHg)', () => {
    const htnCases = [
      { text: 'BP 190 over 110 today', lang: 'EN' },
      { text: 'Blood pressure 200 measured', lang: 'EN' },
      { text: 'BP 210 with headache', lang: 'EN' },
      { text: 'BP 220 acute', lang: 'EN' },
      { text: 'बीपी 200 पहुंच गया है', lang: 'HI' },
      { text: 'सिर में असहनीय दर्द और बीपी बहुत ज्यादा', lang: 'HI' },
    ];

    it.each(htnCases)('should flag HYPERTENSIVE_CRISIS for "$text" ($lang)', ({ text }) => {
      const result = runDeterministicSafetyGate(text);
      expect(result.isSafe).toBe(false);
      expect(result.isEscalated).toBe(true);
      expect(result.triggerCategory).toBe('HYPERTENSIVE_CRISIS');
      expect(result.severity).toBe('CRITICAL');
    });
  });

  // ─── Safe Queries (Should NOT Escalate) ─────────────────
  describe('Non-Emergency Safe Queries', () => {
    const safeCases = [
      'Hello, what medicines should I take today?',
      'Can you explain my HbA1c test result of 7.2%?',
      'Where is the nearest primary health centre?',
      'How to register for Ayushman Bharat PM-JAY?',
      'What are the symptoms of Type 2 Diabetes?',
      'मेरा शुगर लेवल 140 है, क्या यह सामान्य है?',
      'दवाई लेने का सही समय क्या है?',
      'नजदीकी अस्पताल का पता बताएं',
    ];

    it.each(safeCases)('should allow safe query through: "%s"', (text) => {
      const result = runDeterministicSafetyGate(text);
      expect(result.isSafe).toBe(true);
      expect(result.isEscalated).toBe(false);
      expect(result.triggerCategory).toBeUndefined();
    });
  });

  // ─── Escalation Payload Creation ────────────────────────
  describe('createEscalationPayload', () => {
    it('should build a structured ClinicalEscalationState', () => {
      const safetyResult = runDeterministicSafetyGate('I have severe chest pain');
      const payload = createEscalationPayload(
        'I have severe chest pain',
        safetyResult,
        'Ramesh Kumar',
        '91-1234-5678-9012'
      );

      expect(payload.isActive).toBe(true);
      expect(payload.escalationId).toMatch(/^ESC-\d+$/);
      expect(payload.severity).toBe('CRITICAL');
      expect(payload.triggerSymptom).toBe('I have severe chest pain');
      expect(payload.assignedDoctor.name).toContain('Dr. Ananya Sharma');
      expect(payload.assignedDoctor.facility).toContain('AIIMS');
      expect(payload.status).toBe('connected_to_doctor');
      expect(payload.chatHistory.length).toBe(2);
      expect(payload.chatHistory[0].text).toContain('Ramesh Kumar');
      expect(payload.chatHistory[0].text).toContain('91-1234-5678-9012');
    });
  });
});
