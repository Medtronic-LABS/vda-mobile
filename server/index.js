/**
 * VDA Health Assistant - Reference Backend Server
 * 
 * Implements ABDM FHIR R4 standard endpoints backed by the VDA Gold Synthetic
 * Patient Dataset (200 Patient Records, 9 LOINC lab markers, non-issuable ABHA 98-XXXX-XXXX-XXXX).
 * 
 * Run locally with:
 *   npm run server
 *   OR node server/index.js
 */

import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Load Gold Dataset (200 Patients Summary)
let GOLD_PATIENTS_DB = [];
const localSummaryPath = path.resolve('src/data/patients_200_summary.json');
const externalSummaryPath = 'c:/Users/devil/Desktop/VDA/data/patients_200_summary.json';

if (fs.existsSync(localSummaryPath)) {
  GOLD_PATIENTS_DB = JSON.parse(fs.readFileSync(localSummaryPath, 'utf8'));
} else if (fs.existsSync(externalSummaryPath)) {
  GOLD_PATIENTS_DB = JSON.parse(fs.readFileSync(externalSummaryPath, 'utf8'));
}

console.log(`[VDA Backend] Loaded ${GOLD_PATIENTS_DB.length} Gold Dataset patient records.`);

// Canonical LOINC mapping conforming to VDA Engineering Spec §05
const LOINC_MAP = {
  'Fasting Glucose': { code: '1558-6', refRange: '70 - 100 mg/dL', category: 'laboratory' },
  'Post-Prandial Glucose': { code: '1521-4', refRange: '< 140 mg/dL', category: 'laboratory' },
  'HbA1c': { code: '4548-4', refRange: '4.0 - 5.6 % (Target < 7.0%)', category: 'laboratory' },
  'Systolic BP': { code: '8480-6', refRange: '90 - 120 mmHg', category: 'vital-signs' },
  'Diastolic BP': { code: '8462-4', refRange: '60 - 80 mmHg', category: 'vital-signs' },
  'LDL Cholesterol': { code: '2089-1', refRange: '< 100 mg/dL', category: 'laboratory' },
  'eGFR': { code: '62238-1', refRange: '> 60 mL/min/1.73m2', category: 'laboratory' },
  'Urine Microalbumin': { code: '14959-1', refRange: '< 30 mg/g', category: 'laboratory' },
  'BMI': { code: '39156-5', refRange: '18.5 - 24.9 kg/m2', category: 'vital-signs' }
};

function findPatient(key) {
  if (!key) return GOLD_PATIENTS_DB[0] || null;
  if (key === 'ramesh-kumar') return GOLD_PATIENTS_DB[0] || null;
  if (key === 'sunita-devi') return GOLD_PATIENTS_DB[40] || null;
  if (key === 'emergency-case') return GOLD_PATIENTS_DB.find(p => p.id === 'synth-patient-101') || null;
  return GOLD_PATIENTS_DB.find(p => p.id === key || p.abhaNumber === key) || GOLD_PATIENTS_DB[0] || null;
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'VDA Health API Gateway (Gold Dataset Edition)',
    totalPatients: GOLD_PATIENTS_DB.length
  });
});

// List All Gold Patients with optional filtering
app.get('/api/patients', (req, res) => {
  const { category, state, search } = req.query;
  let results = GOLD_PATIENTS_DB;

  if (category) {
    results = results.filter(p => p.categoryCode === category || p.goldCategory.toLowerCase().includes(category.toLowerCase()));
  }
  if (state) {
    results = results.filter(p => p.state.toLowerCase() === state.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(q) || p.abhaNumber.includes(q) || p.district.toLowerCase().includes(q));
  }

  res.json({
    success: true,
    count: results.length,
    data: results.map(p => ({
      id: p.id,
      name: p.name,
      abhaNumber: p.abhaNumber,
      age: p.age,
      gender: p.gender,
      state: p.state,
      district: p.district,
      goldCategory: p.goldCategory,
      categoryCode: p.categoryCode,
      escalationTriggered: p.escalationTriggered,
      pmjayEligible: p.pmjayEligible
    }))
  });
});

// Patient Demographics
app.get('/api/patient/profile', (req, res) => {
  const key = req.query.id || req.query.persona || 'synth-patient-001';
  const p = findPatient(key);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  res.json({
    success: true,
    data: {
      id: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      abhaNumber: p.abhaNumber,
      abhaAddress: `${p.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@abdm`,
      phone: `+91 98${p.id.slice(-6).padStart(8, '0')}`,
      bloodGroup: 'B+',
      district: p.district,
      state: p.state,
      goldCategory: p.goldCategory,
      categoryCode: p.categoryCode,
      pmjayEligible: p.pmjayEligible,
      escalationTriggered: p.escalationTriggered,
      ayushmanCardNumber: p.pmjayEligible ? `PMJAY-${p.state.slice(0, 2).toUpperCase()}-${p.abhaNumber.slice(-9)}` : undefined,
      emergencyContact: {
        name: `Sri ${p.name.split(' ')[1] || 'Relative'}`,
        relation: 'Family Relative',
        phone: '+91 98123 45678'
      }
    }
  });
});

// FHIR R4 DocumentBundle fetcher
app.get('/api/records/bundle/:id', (req, res) => {
  const { id } = req.params;
  const bundleFile = path.resolve(`c:/Users/devil/Desktop/VDA/data/bundles/${id}.json`);
  if (fs.existsSync(bundleFile)) {
    const raw = fs.readFileSync(bundleFile, 'utf8');
    return res.header('Content-Type', 'application/json').send(raw);
  }
  res.status(404).json({ error: 'FHIR DocumentBundle not found' });
});

// FHIR R4 Conditions
app.get('/api/records/conditions', (req, res) => {
  const key = req.query.id || req.query.persona || 'synth-patient-001';
  const p = findPatient(key);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  const conditions = p.conditions.map((cond, idx) => ({
    id: `cond-${p.id}-${idx + 1}`,
    code: cond.includes('diabetes') ? 'ICD-10: E11.9' : cond.includes('hypertension') ? 'ICD-10: I10' : `SNOMED: ${cond}`,
    display: cond,
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: p.escalationTriggered ? 'severe' : 'moderate',
    onsetDateTime: '2023-01-10',
    recordedDate: '2026-08-15',
    sourceFacility: `${p.district} Civil Hospital (${p.state})`
  }));

  res.json({ success: true, data: conditions });
});

// FHIR R4 Medications
app.get('/api/records/medications', (req, res) => {
  const key = req.query.id || req.query.persona || 'synth-patient-001';
  const p = findPatient(key);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  const medications = p.medications.map((m, idx) => ({
    id: `med-${p.id}-${idx + 1}`,
    name: m.name,
    code: `RxNorm: ${860970 + idx}`,
    dosage: m.dosage,
    frequency: m.dosage.includes('twice') ? 'Twice daily' : 'Once daily',
    timing: m.dosage.includes('before') ? 'before_meal' : 'after_meal',
    prescribedDate: '2026-08-01',
    duration: '90 days',
    refillCount: 1,
    totalDays: 90,
    daysRemaining: 28,
    sourceFacility: `${p.district} Civil Hospital (${p.state})`,
    takenToday: true,
    timeOfDay: m.dosage.includes('twice') ? ['08:00 AM', '08:00 PM'] : ['08:00 AM'],
    adherenceRate: p.escalationTriggered ? 76 : 94
  }));

  res.json({ success: true, data: medications });
});

// FHIR R4 Observations (9 Canonical LOINC Markers)
app.get('/api/records/observations', (req, res) => {
  const key = req.query.id || req.query.persona || 'synth-patient-001';
  const p = findPatient(key);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  const observations = p.labs.map((lab, idx) => {
    const meta = LOINC_MAP[lab.name] || { code: '85354-9', refRange: 'Standard', category: 'laboratory' };
    const val = parseFloat(lab.value) || 0;
    return {
      id: `obs-${p.id}-${meta.code}`,
      code: `LOINC: ${meta.code} (${lab.name})`,
      display: lab.name,
      category: meta.category,
      value: val,
      unit: lab.unit,
      interpretation: p.escalationTriggered && (lab.name.includes('Glucose') || lab.name.includes('BP')) ? 'critical-high' : 'normal',
      referenceRange: meta.refRange,
      effectiveDateTime: '2026-08-28T08:30:00+05:30',
      sourceFacility: `${p.district} Civil Hospital Central Lab (${p.state})`
    };
  });

  res.json({ success: true, data: observations });
});

// Conversational AI Assistant
app.post('/api/vda/chat', async (req, res) => {
  const { query, lang = 'hi', patientContext } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Deterministic Clinical Safety Gate
  const criticalPatterns = /(chest pain|heart attack|छाती में दर्द|सीने में दर्द|slurred speech|stroke|cannot breathe|दम घुटना|sugar 40|bp 200)/i;
  if (criticalPatterns.test(query)) {
    return res.json({
      success: true,
      data: {
        message: {
          id: `msg-${Date.now()}`,
          sender: 'vda',
          agent: 'safety_gate',
          text: `CRITICAL ALERT: Your reported symptom "${query}" requires urgent clinician review. Clinical Emergency Triage has been connected.`,
          textHi: `अति महत्वपूर्ण चेतावनी: आपके लक्षण "${query}" के लिए तुरंत डॉक्टर की सलाह आवश्यक है। मैंने आपको आपातकालीन टीम से जोड़ दिया है।`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEscalationTrigger: true,
          audioAvailable: true
        },
        escalationState: {
          isActive: true,
          escalationId: `ESC-${Date.now().toString().slice(-6)}`,
          reason: 'Acute Clinical Red Flag Triggered',
          severity: 'CRITICAL',
          triggerSymptom: query,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          assignedDoctor: {
            name: 'Dr. Ananya Sharma, MD',
            title: 'Senior Clinical Specialist, Tele-Triage Unit',
            facility: 'Tele-Emergency Care Unit',
            regNo: 'MCI-88419-UP'
          },
          status: 'connected_to_doctor',
          chatHistory: []
        }
      }
    });
  }

  const patientName = patientContext?.name || 'Patient';
  res.json({
    success: true,
    data: {
      message: {
        id: `msg-${Date.now()}`,
        sender: 'vda',
        agent: 'router',
        text: `Namaste ${patientName} ji. Your health records across ${patientContext?.state || 'India'} under ABHA ID ${patientContext?.abhaNumber || ''} are up to date. How can I help you today?`,
        textHi: `नमस्ते ${patientName} जी। आपके स्वास्थ्य रिकॉर्ड और जांच रिपोर्ट सुरक्षित हैं। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioAvailable: true
      }
    }
  });
});

// Emergency Escalation Webhook
app.post('/api/escalation/trigger', (req, res) => {
  const payload = req.body;
  console.log(`[ALERT] Clinical emergency triggered for ABHA: ${payload.abhaNumber} - Symptom: ${payload.triggerSymptom}`);
  res.json({
    success: true,
    dispatchId: `DISPATCH-${Date.now().toString().slice(-6)}`,
    status: 'ambulance_alerted'
  });
});

app.listen(PORT, () => {
  console.log(`[VDA Health Assistant Backend] Running on http://localhost:${PORT} (Gold Dataset 200 Patients Ready)`);
});
