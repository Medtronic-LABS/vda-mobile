import { 
  PatientDemographics, 
  FhirCondition, 
  FhirMedication, 
  FhirObservation, 
  FhirDocument, 
  ConsentArtifact, 
  Facility, 
  HealthScheme, 
  VaccineRecord, 
  JanAushadhiItem, 
  BloodStockItem,
  GoldPatientSummary
} from '../types';
import rawGoldPatients from './patients_200_summary.json';

export interface SyntheticPatientProfile {
  demographics: PatientDemographics;
  conditions: FhirCondition[];
  medications: FhirMedication[];
  observations: FhirObservation[];
  documents: FhirDocument[];
  consents: ConsentArtifact[];
}

export const GOLD_PATIENTS_LIST: GoldPatientSummary[] = rawGoldPatients as unknown as GoldPatientSummary[];

// Canonical LOINC mapping conforming to VDA Engineering Spec §05
const LOINC_METADATA: Record<string, { code: string; refRange: string; category: 'laboratory' | 'vital-signs'; meaning: string }> = {
  'Fasting Glucose': {
    code: '1558-6',
    refRange: '70 - 100 mg/dL (Target < 126 mg/dL)',
    category: 'laboratory',
    meaning: 'Fasting plasma glucose measuring baseline glycemic control after 8h fast.'
  },
  'Post-Prandial Glucose': {
    code: '1521-4',
    refRange: '< 140 mg/dL (Target < 180 mg/dL)',
    category: 'laboratory',
    meaning: 'Post-prandial glucose measuring blood sugar spike 2 hours after food.'
  },
  'HbA1c': {
    code: '4548-4',
    refRange: '4.0 - 5.6 % (Target < 7.0%)',
    category: 'laboratory',
    meaning: 'Glycated hemoglobin representing 3-month average plasma glucose.'
  },
  'Systolic BP': {
    code: '8480-6',
    refRange: '90 - 120 mmHg (Target < 130 mmHg)',
    category: 'vital-signs',
    meaning: 'Systolic blood pressure during ventricular contraction.'
  },
  'Diastolic BP': {
    code: '8462-4',
    refRange: '60 - 80 mmHg (Target < 80 mmHg)',
    category: 'vital-signs',
    meaning: 'Diastolic blood pressure during ventricular relaxation.'
  },
  'LDL Cholesterol': {
    code: '2089-1',
    refRange: '< 100 mg/dL',
    category: 'laboratory',
    meaning: 'Low-density lipoprotein cholesterol (bad cholesterol).'
  },
  'eGFR': {
    code: '62238-1',
    refRange: '> 60 mL/min/1.73m2',
    category: 'laboratory',
    meaning: 'Estimated Glomerular Filtration Rate assessing kidney renal function.'
  },
  'Urine Microalbumin': {
    code: '14959-1',
    refRange: '< 30 mg/g',
    category: 'laboratory',
    meaning: 'Urine albumin-to-creatinine ratio screening early diabetic nephropathy.'
  },
  'BMI': {
    code: '39156-5',
    refRange: '18.5 - 24.9 kg/m2',
    category: 'vital-signs',
    meaning: 'Body Mass Index assessing nutritional and metabolic status.'
  }
};

function getInterpretation(labName: string, val: number): 'normal' | 'high' | 'critical-high' | 'low' | 'critical-low' {
  switch (labName) {
    case 'Fasting Glucose':
      if (val > 250) return 'critical-high';
      if (val > 125) return 'high';
      if (val < 50) return 'critical-low';
      if (val < 70) return 'low';
      return 'normal';
    case 'Post-Prandial Glucose':
      if (val > 300) return 'critical-high';
      if (val > 180) return 'high';
      return 'normal';
    case 'HbA1c':
      if (val > 10.0) return 'critical-high';
      if (val > 7.0) return 'high';
      return 'normal';
    case 'Systolic BP':
      if (val > 180) return 'critical-high';
      if (val > 130) return 'high';
      if (val < 90) return 'low';
      return 'normal';
    case 'Diastolic BP':
      if (val > 110) return 'critical-high';
      if (val > 85) return 'high';
      if (val < 60) return 'low';
      return 'normal';
    case 'LDL Cholesterol':
      if (val > 160) return 'critical-high';
      if (val > 100) return 'high';
      return 'normal';
    case 'eGFR':
      if (val < 30) return 'critical-low';
      if (val < 60) return 'low';
      return 'normal';
    case 'Urine Microalbumin':
      if (val > 100) return 'critical-high';
      if (val > 30) return 'high';
      return 'normal';
    case 'BMI':
      if (val > 30) return 'critical-high';
      if (val > 25) return 'high';
      if (val < 18.5) return 'low';
      return 'normal';
    default:
      return 'normal';
  }
}

function buildPatientProfile(p: GoldPatientSummary): SyntheticPatientProfile {
  const isEscalated = p.escalationTriggered;
  const facility = `${p.district} Civil Hospital (${p.state})`;

  const demographics: PatientDemographics = {
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    abhaNumber: p.abhaNumber,
    abhaAddress: `${p.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@abdm`,
    phone: `+91 98${Math.abs(p.id.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7)) % 100000000}`.padEnd(14, '0'),
    bloodGroup: (['B+', 'O+', 'A+', 'AB+'])[Math.abs(p.name.length) % 4],
    district: p.district,
    state: p.state,
    goldCategory: p.goldCategory,
    categoryCode: p.categoryCode,
    pmjayEligible: p.pmjayEligible,
    escalationTriggered: isEscalated,
    ayushmanCardNumber: p.pmjayEligible ? `PMJAY-${p.state === 'Haryana' ? 'HR' : 'HP'}-${p.abhaNumber.slice(-9).replace('-', '')}` : undefined,
    emergencyContact: {
      name: `Smt. / Sri ${p.name.split(' ')[1] || 'Family'}`,
      relation: 'Family Relative',
      phone: '+91 98123 45678'
    }
  };

  const conditions: FhirCondition[] = p.conditions.map((condName, idx) => ({
    id: `cond-${p.id}-${idx + 1}`,
    code: condName.toLowerCase().includes('diabetes')
      ? 'ICD-10: E11.9 (Type 2 Diabetes Mellitus)'
      : condName.toLowerCase().includes('hypertension')
      ? 'ICD-10: I10 (Essential Primary Hypertension)'
      : condName.toLowerCase().includes('renal')
      ? 'ICD-10: E11.2 (Diabetes with Renal Complication)'
      : `SNOMED: ${condName}`,
    display: condName,
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: isEscalated ? 'severe' : 'moderate',
    onsetDateTime: '2022-05-10',
    recordedDate: '2026-08-15',
    sourceFacility: facility,
    doctorName: p.state === 'Haryana' ? 'Dr. Verma (Civil Hospital)' : 'Dr. Sharma (IGMC / Civil Hospital)'
  }));

  const medications: FhirMedication[] = p.medications.map((m, idx) => {
    const isTwice = m.dosage.toLowerCase().includes('twice');
    const isMorning = m.dosage.toLowerCase().includes('morning') || m.dosage.toLowerCase().includes('breakfast');
    const isBefore = m.dosage.toLowerCase().includes('before');
    return {
      id: `med-${p.id}-${idx + 1}`,
      name: m.name,
      code: `RxNorm: ${860970 + idx}`,
      dosage: m.dosage,
      frequency: isTwice ? 'Twice daily' : 'Once daily',
      timing: isBefore ? 'before_meal' : 'after_meal',
      prescribedDate: '2026-08-01',
      duration: '90 days',
      refillCount: 1,
      totalDays: 90,
      daysRemaining: 28,
      sourceFacility: facility,
      takenToday: true,
      timeOfDay: isTwice ? ['08:00 AM', '08:00 PM'] : isMorning ? ['08:00 AM'] : ['01:30 PM'],
      adherenceRate: isEscalated ? 76 : 94
    };
  });

  const observations: FhirObservation[] = p.labs.map((lab, idx) => {
    const meta = LOINC_METADATA[lab.name] || {
      code: '85354-9',
      refRange: 'Standard clinical reference range',
      category: 'laboratory' as const,
      meaning: 'Diagnostic clinical observation.'
    };
    const val = parseFloat(lab.value) || 0;
    const interp = getInterpretation(lab.name, val);

    return {
      id: `obs-${p.id}-${idx + 1}`,
      code: `LOINC: ${meta.code} (${lab.name})`,
      display: lab.name,
      category: meta.category,
      value: val,
      unit: lab.unit,
      interpretation: interp,
      referenceRange: meta.refRange,
      effectiveDateTime: '2026-08-28T08:30:00+05:30',
      sourceFacility: `${p.district} Civil Hospital Central Lab`,
      clinicalMeaning: meta.meaning,
      history: [
        { date: '2026-04-10', value: Math.round((val * 1.08) * 10) / 10 },
        { date: '2026-06-20', value: Math.round((val * 1.03) * 10) / 10 },
        { date: '2026-08-28', value: val }
      ]
    };
  });

  const documents: FhirDocument[] = [
    {
      id: `doc-${p.id}-rx`,
      title: `${p.district} Civil Hospital - OPD Prescription Slip`,
      type: 'Prescription',
      date: '2026-08-15',
      facility: facility,
      doctor: 'Civil Hospital NCD Clinic',
      size: '1.2 MB',
      tags: ['Prescription', 'NCD', 'ABDM Fast-Track'],
      summary: `Active prescription for ${p.conditions.join(', ')}. Regimen: ${p.medications.map(m => m.name).join(', ')}.`
    },
    {
      id: `doc-${p.id}-lab`,
      title: 'Comprehensive NCD Diagnostic Panel (9 LOINC Markers)',
      type: 'Lab Report',
      date: '2026-08-28',
      facility: `${p.district} District Diagnostic Laboratory`,
      doctor: 'Pathology Division',
      size: '2.4 MB',
      tags: ['Biochemistry', 'LOINC', 'FHIR R4'],
      summary: `Automated 9-marker profile covering Fasting Glucose, HbA1c, BP, Lipid, Renal eGFR, and Microalbumin.`
    }
  ];

  const consents: ConsentArtifact[] = [
    {
      id: `consent-${p.id}-01`,
      purpose: 'ABDM Unified Health Record Exchange & Tele-Triage',
      purposeHi: 'एबीडीएम स्वास्थ्य रिकॉर्ड साझाकरण व टेली-परामर्श',
      scope: 'Diagnostic Labs, Medication Statements & Conditions',
      grantedTo: `${p.state} State Health Agency (SHA)`,
      grantedDate: '2026-01-01',
      expiryDate: '2027-01-01',
      status: 'ACTIVE'
    }
  ];

  return {
    demographics,
    conditions,
    medications,
    observations,
    documents,
    consents
  };
}

// Build all 200 patient profiles indexed by id (e.g. synth-patient-001)
const patientsMap: Record<string, SyntheticPatientProfile> = {};
GOLD_PATIENTS_LIST.forEach(p => {
  patientsMap[p.id] = buildPatientProfile(p);
});

// Backward-compatibility aliases for existing UI selectors
if (patientsMap['synth-patient-001']) {
  patientsMap['ramesh-kumar'] = patientsMap['synth-patient-001'];
}
if (patientsMap['synth-patient-041']) {
  patientsMap['sunita-devi'] = patientsMap['synth-patient-041'];
}
if (patientsMap['synth-patient-101']) {
  patientsMap['emergency-case'] = patientsMap['synth-patient-101'];
}

export const SYNTHETIC_PATIENTS: Record<string, SyntheticPatientProfile> = patientsMap;

export const FACILITIES_LIST: Facility[] = [
  {
    id: 'fac-hp-01',
    name: 'District Hospital Solan',
    nameHi: 'जिला अस्पताल सोलन (हिमाचल प्रदेश)',
    nameTa: 'மாவட்ட மருத்துவமனை சோலன்',
    nameKn: 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಸೋಲನ್',
    type: 'District Hospital',
    distanceKm: 2.4,
    address: 'Mall Road, Solan, Himachal Pradesh 173212',
    addressHi: 'माल रोड, सोलन, हिमाचल प्रदेश',
    phone: '+91 1792 223638',
    opdTimings: '09:00 AM - 03:00 PM (Mon-Sat)',
    hasAbdmQrCheckin: true,
    hasEmergency24x7: true,
    availableBeds: 45,
    schemesAccepted: ['Ayushman Bharat PM-JAY', 'HIMCARE Himachal Scheme', 'Free Essential Drugs']
  },
  {
    id: 'fac-hp-02',
    name: 'Indira Gandhi Medical College & Hospital (IGMC Shimla)',
    nameHi: 'आईजीएमसी शिमला (शीर्ष चिकित्सा महाविद्यालय व अस्पताल)',
    nameTa: 'இந்திரா காந்தி மருத்துவக் கல்லூரி சிம்லா',
    nameKn: 'ಇಂದಿರಾ ಗಾಂಧಿ ವೈದ್ಯಕೀಯ ಕಾಲೇಜು ಶಿಮ್ಲಾ',
    type: 'Tertiary AIIMS',
    distanceKm: 46,
    address: 'Ridge Road, Snowdown, Shimla, Himachal Pradesh 171001',
    addressHi: 'स्नोडाउन, शिमला, हिमाचल प्रदेश',
    phone: '+91 177 2804251',
    opdTimings: '08:30 AM - 04:00 PM',
    hasAbdmQrCheckin: true,
    hasEmergency24x7: true,
    availableBeds: 180,
    schemesAccepted: ['Ayushman Bharat PM-JAY', 'HIMCARE', 'CGHS', 'Emergency Trauma Care']
  },
  {
    id: 'fac-hr-01',
    name: 'Civil Hospital Gurugram (Sector 10)',
    nameHi: 'नागरिक अस्पताल गुरुग्राम (सेक्टर 10, हरियाणा)',
    nameTa: 'குருகிராம் சிவில் மருத்துவமனை',
    nameKn: 'ಗುರುಗ್ರಾಮ ಸಿವಿಲ್ ಆಸ್ಪತ್ರೆ',
    type: 'District Hospital',
    distanceKm: 3.8,
    address: 'Sector 10A, Near Hero Honda Chowk, Gurugram, Haryana 122001',
    addressHi: 'सेक्टर 10A, गुरुग्राम, हरियाणा',
    phone: '+91 124 2322412',
    opdTimings: '08:00 AM - 02:00 PM (Mon-Sat)',
    hasAbdmQrCheckin: true,
    hasEmergency24x7: true,
    availableBeds: 72,
    schemesAccepted: ['Ayushman Bharat PM-JAY', 'Chirayu Haryana Scheme', 'Nirogi Haryana']
  },
  {
    id: 'fac-hr-02',
    name: 'B.K. Civil Hospital Faridabad',
    nameHi: 'बी.के. नागरिक अस्पताल फरीदाबाद',
    nameTa: 'பரிதாபாத் பி.கே. சிவில் மருத்துவமனை',
    nameKn: 'ಫರಿದಾಬಾದ್ ಸಿವಿಲ್ ಆಸ್ಪತ್ರೆ',
    type: 'District Hospital',
    distanceKm: 5.2,
    address: 'NIT 1, Near Neelam Flyover, Faridabad, Haryana 121001',
    addressHi: 'एनआईटी 1, फरीदाबाद, हरियाणा',
    phone: '+91 129 2415664',
    opdTimings: '08:00 AM - 03:00 PM',
    hasAbdmQrCheckin: true,
    hasEmergency24x7: true,
    availableBeds: 60,
    schemesAccepted: ['Ayushman Bharat PM-JAY', 'Chirayu Haryana', 'PM National Dialysis']
  },
  {
    id: 'fac-01',
    name: 'AIIMS New Delhi (Apex Care & Tele-Triage)',
    nameHi: 'एम्स नई दिल्ली (शीर्ष अस्पताल व टेली-परामर्श)',
    nameTa: 'எய்ம்ஸ் புது தில்லி (முதன்மை மருத்துவமனை & டெலி-ட்ரையേജ്)',
    nameKn: 'ಏಮ್ಸ್ ನವದೆಹಲಿ (ಪ್ರಮುಖ ಆಸ್ಪತ್ರೆ ಮತ್ತು ಟೆಲಿ-ಸಮಾಲೋಚನೆ)',
    type: 'Tertiary AIIMS',
    distanceKm: 120,
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029',
    addressHi: 'श्री अरबिंदो मार्ग, अंसारी नगर, नई दिल्ली',
    phone: '+91 11 26588500',
    opdTimings: '08:00 AM - 04:00 PM',
    hasAbdmQrCheckin: true,
    hasEmergency24x7: true,
    availableBeds: 110,
    schemesAccepted: ['Ayushman Bharat PM-JAY', 'CGHS', 'ECHS', 'AIIMS Poor Patient Fund']
  },
  {
    id: 'fac-04',
    name: 'Pradhan Mantri Jan Aushadhi Kendra #5512',
    nameHi: 'प्रधानमंत्री जन औषधि केंद्र #5512 (सस्ती दवाएं)',
    nameTa: 'பிரதான் மந்திரி மக்கள் மருந்தகம் #5512',
    nameKn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಔಷಧಿ ಕೇಂದ್ರ #5512',
    type: 'Diagnostic Lab',
    distanceKm: 1.2,
    address: 'Near Civil Hospital Complex, Main Market',
    addressHi: 'सिविल अस्पताल परिसर के पास, मुख्य बाजार',
    phone: '+91 98160 44321',
    opdTimings: '08:00 AM - 09:00 PM (All Days)',
    hasAbdmQrCheckin: true,
    hasEmergency24x7: false,
    schemesAccepted: ['Generic Medicines up to 90% discount', 'Digital Prescription Dispense']
  },
  {
    id: 'fac-05',
    name: 'Red Cross Regional Blood Centre & Bank',
    nameHi: 'रेड क्रॉस क्षेत्रीय ब्लड बैंक',
    nameTa: 'ரெட் கிராஸ் இரத்த வங்கி',
    nameKn: 'ರೆಡ್ ಕ್ರಾಸ್ ರಕ್ತ ನಿಧಿ',
    type: 'Blood Bank',
    distanceKm: 2.1,
    address: 'Civil Hospital Campus',
    addressHi: 'अस्पताल परिसर',
    phone: '+91 1792 224190',
    opdTimings: '24 Hours Emergency Service',
    hasAbdmQrCheckin: true,
    hasEmergency24x7: true,
    schemesAccepted: ['ABDM e-RaktKosh Live Inventory', 'Voluntary Blood Donation']
  }
];

export const HEALTH_SCHEMES_LIST: HealthScheme[] = [
  {
    id: 'scheme-01',
    name: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY)',
    nameHi: 'आयुष्मान भारत प्रधानमंत्री जन आरोग्य योजना (PM-JAY)',
    nameTa: 'ஆயுஷ்மான் பாரத் பிரதம மந்திரி மக்கள் ஆரோக்கிய திட்டம் (PM-JAY)',
    nameKn: 'ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಆರೋಗ್ಯ ಯೋಜನೆ (PM-JAY)',
    shortCode: 'PM-JAY',
    category: 'Universal Health Insurance',
    description: 'Provides cashless annual coverage of ₹5,00,000 per family for secondary and tertiary care hospitalization across all empaneled public and private hospitals across India.',
    descriptionHi: 'प्रत्येक पात्र परिवार को प्रति वर्ष ₹5,00,000 तक का मुफ्त व कैशलेस अस्पताल इलाज पूरे भारत में मिलता है।',
    coverageAmount: '₹5,00,000 / year / family',
    eligibility: 'SECC 2011 identified rural/urban poor families + all senior citizens aged 70+ irrespective of income.',
    eligibilityHi: 'SECC सूची में दर्ज परिवार एवं 70 वर्ष से अधिक उम्र के सभी वरिष्ठ नागरिक।',
    requiredDocuments: ['Aadhaar Card', 'Ration Card', 'ABHA Number'],
    helpline: '14555'
  },
  {
    id: 'scheme-hp-01',
    name: 'Mukhya Mantri Himachal Health Care Scheme (HIMCARE)',
    nameHi: 'मुख्यमंत्री हिमाचल हेल्थ केयर योजना (HIMCARE)',
    nameTa: 'ஹிம்கேர் திட்டம் (இமாச்சல பிரதேசம்)',
    nameKn: 'ಹಿಮ್‌ಕೇರ್ ಯೋಜನೆ (ಹಿಮಾಚಲ ಪ್ರದೇಶ)',
    shortCode: 'HIMCARE',
    category: 'State Cashless Hospitalization',
    description: 'Covers families in Himachal Pradesh not eligible under PM-JAY for up to ₹5,00,000 cashless hospitalization treatment per family per year.',
    descriptionHi: 'हिमाचल प्रदेश के उन सभी परिवारों को ₹5,00,000 तक का मुफ्त इलाज जो आयुष्मान भारत में शामिल नहीं हैं।',
    coverageAmount: '₹5,00,000 / year / family',
    eligibility: 'Residents of Himachal Pradesh with valid ration card not covered under Ayushman Bharat or government employee schemes.',
    eligibilityHi: 'हिमाचल प्रदेश के निवासी जिनके पास राशन कार्ड है।',
    requiredDocuments: ['Himachal Ration Card', 'Aadhaar Card', 'ABHA ID'],
    helpline: '104'
  },
  {
    id: 'scheme-hr-01',
    name: 'Ayushman Bharat - Chirayu Haryana Scheme',
    nameHi: 'चिरायु हरियाणा योजना (₹5 लाख मुफ्त इलाज)',
    nameTa: 'சிராயு ஹரியானா திட்டம்',
    nameKn: 'ಚಿರಾಯು ಹರಿಯಾಣ ಯೋಜನೆ',
    shortCode: 'CHIRAYU',
    category: 'State Cashless Hospitalization',
    description: 'Expanded coverage for Haryana families with annual verified income up to ₹3,00,000 under Parivar Pehchan Patra (PPP) for ₹5 lakh cashless medical care.',
    descriptionHi: 'हरियाणा के परिवारों (वार्षिक आय ₹3 लाख तक) को परिवार पहचान पत्र के तहत ₹5 लाख तक का कैशलेस इलाज।',
    coverageAmount: '₹5,00,000 / year / family',
    eligibility: 'Haryana residents with Parivar Pehchan Patra (PPP) family income up to ₹3.00 Lakh.',
    eligibilityHi: 'हरियाणा परिवार पहचान पत्र (PPP) धारक परिवार।',
    requiredDocuments: ['Parivar Pehchan Patra (PPP ID)', 'Aadhaar Card', 'ABHA Card'],
    helpline: '104 / 14555'
  },
  {
    id: 'scheme-02',
    name: 'Pradhan Mantri National Dialysis Programme (PMNDP)',
    nameHi: 'प्रधानमंत्री राष्ट्रीय डायलिसिस कार्यक्रम',
    shortCode: 'PMNDP',
    category: 'Chronic Kidney Disease',
    description: 'Free Hemodialysis and Peritoneal Dialysis services for BPL/PM-JAY patients at all District Hospitals across India.',
    descriptionHi: 'गरीबी रेखा व आयुष्मान लाभार्थियों को जिला अस्पतालों में बिल्कुल मुफ्त डायलिसिस की सुविधा।',
    coverageAmount: '100% Free at District Hospitals',
    eligibility: 'Patients diagnosed with End-Stage Renal Disease (ESRD) with BPL/PM-JAY card.',
    eligibilityHi: 'गुर्दे की गंभीर बीमारी से पीड़ित मरीज।',
    requiredDocuments: ['Nephrologist Prescription', 'ABHA ID', 'Aadhaar'],
    helpline: '1800-180-1104'
  },
  {
    id: 'scheme-03',
    name: 'Pradhan Mantri Bharatiya Janaushadhi Pariyojana (PMBJP)',
    nameHi: 'प्रधानमंत्री भारतीय जन औषधि परियोजना',
    shortCode: 'PMBJP',
    category: 'Affordable Medicines',
    description: 'Provides high quality WHO-GMP certified generic medicines at 50% to 90% cheaper prices compared to branded medicines.',
    descriptionHi: 'ब्रांडेड दवाओं की तुलना में 50% से 90% तक कम कीमत में उच्च गुणवत्ता वाली जेनेरिक दवाइयां।',
    coverageAmount: 'Up to 90% savings on 2,000+ medicines',
    eligibility: 'Open to all citizens with a valid doctor prescription.',
    eligibilityHi: 'मान्य डॉक्टर के पर्चे वाले सभी नागरिकों के लिए खुली है।',
    requiredDocuments: ['Doctor Prescription', 'ABHA ID'],
    helpline: '1800-180-8080'
  }
];

export const VACCINES_DATA: Record<string, VaccineRecord[]> = {
  'synth-patient-001': [
    {
      id: 'vac-01',
      vaccineName: 'COVID-19 Covishield (ChAdOx1-S)',
      doseNumber: 'Dose 1 / 2',
      dateAdministered: '18 Mar 2021',
      facility: 'Civil Hospital Solan CVC',
      beneficiaryRef: 'COWIN-98282414-HP',
      certificateQr: 'COWIN-VERIFIED-CERT-D1-99824',
      status: 'COMPLETED'
    },
    {
      id: 'vac-02',
      vaccineName: 'COVID-19 Covishield (ChAdOx1-S)',
      doseNumber: 'Dose 2 / 2 (Final)',
      dateAdministered: '14 Jun 2021',
      facility: 'Civil Hospital Solan CVC',
      beneficiaryRef: 'COWIN-98282414-HP',
      certificateQr: 'COWIN-VERIFIED-CERT-D2-44102',
      status: 'COMPLETED'
    }
  ]
};

export const JAN_AUSHADHI_MEDICINES: JanAushadhiItem[] = [
  {
    id: 'ja-01',
    genericName: 'Metformin Hydrochloride 500mg SR',
    genericNameHi: 'मेटफॉर्मिन 500 मि.ग्रा.',
    marketBrandName: 'Glycomet 500 / Glucophage',
    dosage: '10 tablets strip',
    marketPrice: 42,
    janAushadhiPrice: 6.8,
    savingsPercentage: 84,
    category: 'Diabetes Care',
    availableAtKendra: true
  },
  {
    id: 'ja-02',
    genericName: 'Telmisartan 40mg Tablet',
    genericNameHi: 'टेल्मीसार्टन 40 मि.ग्रा.',
    marketBrandName: 'Telma 40 / Micardis',
    dosage: '10 tablets strip',
    marketPrice: 96,
    janAushadhiPrice: 14.2,
    savingsPercentage: 85,
    category: 'Cardiovascular / Blood Pressure',
    availableAtKendra: true
  },
  {
    id: 'ja-03',
    genericName: 'Glimepiride 1mg Tablet',
    genericNameHi: 'ग्लिमेपिराइड 1 मि.ग्रा.',
    marketBrandName: 'Amaryl 1mg / Glimy',
    dosage: '10 tablets strip',
    marketPrice: 68,
    janAushadhiPrice: 9.5,
    savingsPercentage: 86,
    category: 'Diabetes Care',
    availableAtKendra: true
  },
  {
    id: 'ja-04',
    genericName: 'Atorvastatin 10mg Tablet',
    genericNameHi: 'एटोरवास्टेटिन 10 मि.ग्रा. (कोलेस्ट्रॉल)',
    marketBrandName: 'Atorva 10 / Lipitor',
    dosage: '10 tablets strip',
    marketPrice: 85,
    janAushadhiPrice: 12.0,
    savingsPercentage: 86,
    category: 'Lipid / Cholesterol',
    availableAtKendra: true
  }
];

export const BLOOD_BANK_STOCK: BloodStockItem[] = [
  { group: 'A+', unitsAvailable: 14, status: 'SUFFICIENT' },
  { group: 'B+', unitsAvailable: 28, status: 'SUFFICIENT' },
  { group: 'O+', unitsAvailable: 32, status: 'SUFFICIENT' },
  { group: 'AB+', unitsAvailable: 8, status: 'MODERATE' },
  { group: 'A-', unitsAvailable: 3, status: 'CRITICAL' },
  { group: 'B-', unitsAvailable: 4, status: 'CRITICAL' },
  { group: 'O-', unitsAvailable: 2, status: 'CRITICAL' },
  { group: 'AB-', unitsAvailable: 1, status: 'CRITICAL' }
];
