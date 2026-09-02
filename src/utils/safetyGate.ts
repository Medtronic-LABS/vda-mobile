import { AgentDomain, ChatMessage, ClinicalEscalationState, LanguageCode } from '../types';
import { playChime } from './i18n';

export interface SafetyCheckResult {
  isSafe: boolean;
  isEscalated: boolean;
  triggerCategory?: 'CARDIAC' | 'STROKE' | 'RESPIRATORY' | 'SEVERE_HYPOGLYCEMIA' | 'HYPERTENSIVE_CRISIS' | 'ACUTE_INFECTION';
  severity?: 'HIGH' | 'CRITICAL';
  reason?: string;
  recommendedAction?: string;
  matchedKeywords?: string[];
}

// Red flag symptoms that MUST bypass standard conversational LLM responses
const CRITICAL_SYMPTOM_PATTERNS = [
  {
    category: 'CARDIAC' as const,
    regex: /(chest pain|chest tightness|pressure in chest|छाती में दर्द|सीने में दर्द|छाती में जकड़न|மார்பு வலி|எದೆ ನೋವು|heart attack|radiating to left arm|पसीने के साथ दर्द)/i,
    reason: 'Possible Acute Coronary Syndrome (ACS) / Cardiac Emergency',
    reasonHi: 'संभावित हृदय संबंधी आपातकाल (हार्ट अटैक के लक्षण)',
    action: 'Immediate hospital visit + 108 Emergency ambulance dispatch'
  },
  {
    category: 'STROKE' as const,
    regex: /(slurred speech|face drooping|sudden weakness in arm|paralysis|आधा शरीर सुन्न|मुंह टेढ़ा|बोली लड़खड़ाना|பக்கவாதம்|ಲಕ್ವ)/i,
    reason: 'Possible Acute Stroke / Neurological Deficit',
    reasonHi: 'संभावित पक्षाघात / स्ट्रोक के लक्षण',
    action: 'FAST Protocol - Immediate Emergency CT / Stroke Centre'
  },
  {
    category: 'RESPIRATORY' as const,
    regex: /(cannot breathe|severe breathlessness|gasping for air|सांस फूलना|सांस नहीं आ रही|दम घुटना|மூச்சுத்திணறல்|ಉಸಿರಾಟದ ತೊಂದರೆ)/i,
    reason: 'Acute Severe Respiratory Distress',
    reasonHi: 'गंभीर सांस की तकलीफ / श्वसन संकट',
    action: 'Oxygen support needed urgently at nearest PHC/Hospital'
  },
  {
    category: 'SEVERE_HYPOGLYCEMIA' as const,
    regex: /(sugar 40|sugar 45|sugar 50|sugar less than 50|hypo|trembling and sweating|शुगर 50 से कम|चक्कर और बेहोशी|लो शुगर)/i,
    reason: 'Critical Hypoglycemia (< 55 mg/dL)',
    reasonHi: 'गंभीर रूप से कम ब्लड शुगर (हाइपोग्लाइसीमिया)',
    action: 'Take 3-4 spoons glucose/sugar/fruit juice immediately and test again'
  },
  {
    category: 'HYPERTENSIVE_CRISIS' as const,
    regex: /(bp 190|bp 200|bp 210|bp 220|blood pressure 200|बीपी 200|सिर में असहनीय दर्द और बीपी)/i,
    reason: 'Hypertensive Emergency (> 180/120 mmHg)',
    reasonHi: 'अत्यधिक उच्च रक्तचाप संकट',
    action: 'Urgent medical evaluation to prevent organ damage'
  }
];

export function runDeterministicSafetyGate(input: string): SafetyCheckResult {
  const normalized = input.trim();

  for (const pattern of CRITICAL_SYMPTOM_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      return {
        isSafe: false,
        isEscalated: true,
        triggerCategory: pattern.category,
        severity: 'CRITICAL',
        reason: pattern.reason,
        recommendedAction: pattern.action,
        matchedKeywords: [pattern.category]
      };
    }
  }

  return {
    isSafe: true,
    isEscalated: false
  };
}

export function createEscalationPayload(
  triggerText: string,
  safetyResult: SafetyCheckResult,
  patientName: string,
  abhaNumber: string
): ClinicalEscalationState {
  playChime('alert');

  return {
    isActive: true,
    escalationId: `ESC-${Date.now().toString().slice(-6)}`,
    reason: safetyResult.reason || 'Clinical Safety Protocol Triggered',
    severity: safetyResult.severity || 'CRITICAL',
    triggerSymptom: triggerText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    assignedDoctor: {
      name: 'Dr. Ananya Sharma, MD',
      title: 'Senior Clinical Specialist, AIIMS Triage Unit',
      facility: 'AIIMS New Delhi Tele-Emergency Care',
      regNo: 'MCI-88419-UP'
    },
    status: 'connected_to_doctor',
    chatHistory: [
      {
        id: 'sys-esc-01',
        sender: 'system',
        text: `CRITICAL SAFETY PROTOCOL: Patient "${patientName}" (ABHA: ${abhaNumber}) reported: "${triggerText}". Handed over to AIIMS Clinical Tele-Triage Team.`,
        textHi: `आपातकालीन सुरक्षा नियम: मरीज "${patientName}" ने रिपोर्ट किया: "${triggerText}"। एम्स टेली-इमरजेंसी टीम से जोड़ा गया।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      {
        id: 'doc-esc-01',
        sender: 'clinician',
        text: `Namaste ${patientName} ji. I am Dr. Ananya Sharma from AIIMS Tele-Triage. I see your symptom report and your diabetes/BP history. Please sit down calmly, do not exert yourself. Is anyone with you at home right now?`,
        textHi: `नमस्ते ${patientName} जी। मैं एम्स टेली-ट्राइएज से डॉ. अनन्या शर्मा हूँ। आपका लक्षण और बीपी रिकॉर्ड मेरे सामने है। कृपया आराम से बैठ जाएं और घबराएं नहीं। क्या इस समय घर में कोई आपके साथ है?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioAvailable: true
      }
    ]
  };
}
