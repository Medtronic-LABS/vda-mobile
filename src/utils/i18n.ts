import { LanguageCode } from '../types';

export type UiLanguage = 'hi' | 'en';

export const TRANSLATIONS: Record<UiLanguage, Record<string, string>> = {
  hi: {
    appTitle: 'सेहत साथी',
    tabVda: 'सेहत साथी',
    tabRecords: 'रिकॉर्ड्स',
    tabFacilities: 'अस्पताल व योजनाएं',
    tabProfile: 'प्रोफाइल',
    tapToSpeak: 'बोलने के लिए दबाएं',
    listening: 'सुन रहे हैं... कृपया बोलिए',
    processing: 'समझ रहे हैं...',
    stopListening: 'रोकें',
    safetyWarning: 'आपातकालीन चेतावनी',
    escalatedToDoctor: 'एम्स डॉक्टर से तुरंत जोड़ा गया',
    readAloud: 'सुनें (बोलकर पढ़ें)',
    stopReading: 'आवाज रोकें',
    activePrescriptions: 'चल रही दवाइयां',
    takenToday: 'आज ली गई',
    pendingToday: 'आज बची हुई',
    markTaken: 'दवा ली',
    undoTaken: 'हटाएं',
    adherenceRate: 'दवा अनुशासन दर',
    adherenceAdvice: 'समय पर दवा लेने से रोग नियंत्रण में रहता है',
    recentLab: 'हालिया खून/शुगर जांच',
    allRecords: 'सभी स्वास्थ्य रिकॉर्ड',
    searchHospital: 'अस्पताल या योजना खोजें',
    abhaCard: 'आयुष्मान भारत स्वास्थ्य खाता (ABHA)',
    abhaCardTitle: 'आयुष्मान भारत स्वास्थ्य खाता',
    abhaNumber: 'ABHA संख्या',
    abhaAddress: 'ABHA पता',
    viewQr: 'QR कोड देखें',
    downloadCard: 'कार्ड डाउनलोड करें',
    consentManagement: 'डेटा सहमति (Consent)',
    activeConsents: 'सक्रिय अनुमतियां',
    switchPatient: 'रोगी प्रोफाइल बदलें (डेमो)',
    emergencyHelpline: 'आपातकालीन 108',
    opdCheckin: 'फास्ट-ट्रैक OPD चेक-इन',
    generateQrToken: 'OPD टोकन प्राप्त करें',
    distanceKm: 'किमी दूर',
    emergency24x7: '24 घंटे आपातकालीन सेवा उपलब्ध',
    provenanceSource: 'दर्ज किया गया',
    normalRange: 'सामान्य सीमा',
    targetRange: 'लक्ष्य सीमा',
    doctorEscalationNotice: 'सुरक्षा नियम के तहत आपको तुरंत वरिष्ठ चिकित्सक से जोड़ा जा रहा है।',
    callAmbulance: 'एम्बुलेंस 108 पर कॉल करें',
    ambulanceEnRoute: '108 एम्बुलेंस आ रही है',
    joinLiveConsult: 'लाइव डॉक्टर परामर्श जारी रखें',
    typeMessagePlaceholder: 'संदेश लिखें या माइक दबाकर बोलें...',
    quickQuestions: 'त्वरित सवाल',
    myMedicinesChip: 'मेरी दवाइयों का समय',
    sugarLabChip: 'मेरी शुगर रिपोर्ट समझाएं',
    nearbyHospitalChip: 'नजदीकी सरकारी अस्पताल',
    pmjayBenefitsChip: 'आयुष्मान भारत योजना लाभ',
    chestPainTestChip: 'छाती में दर्द [सुरक्षा जांच]',
    onboardingTitle: 'नमस्ते! सेहत साथी में आपका स्वागत है',
    onboardingSubtitle: 'आपकी आवाज में आपका व्यक्तिगत स्वास्थ्य मार्गदर्शक',
    selectLanguage: 'अपनी भाषा चुनें',
    selectLanguageHint: 'अपनी पसंदीदा भाषा चुनें (आवाज में सुनने के लिए किसी भी विकल्प को दबाएं)',
    verifyAbhaAadhaar: 'ABHA डिजिटल पहचान',
    verifyAbhaSubtitle: 'Aadhaar Face-Auth / OTP द्वारा सुरक्षित सत्यापन (सिम्युलेटेड डेमो)',
    consentTitle: 'डेटा सहमति (ABDM Consent)',
    consentSubtitle: 'आपकी अनुमति के बिना कोई भी डेटा साझा नहीं किया जाएगा। आप कभी भी अनुमति रद्द कर सकते हैं।',
    agreeAndStart: 'सहमत हैं व शुरू करें',
    selfReportVital: 'नया माप दर्ज करें',
    logBloodSugar: 'ब्लड शुगर दर्ज करें',
    logBloodPressure: 'ब्लड प्रेशर दर्ज करें',
    readingSaved: 'सफलतापूर्वक सहेजा गया',
    close: 'बंद करें',
    back: 'पीछे',
    continue: 'आगे बढ़ें',
    authenticate: 'प्रमाणित करें',
    authenticating: 'सत्यापन हो रहा है...',
    faceAuth: 'Face Auth',
    aadhaarOtp: 'Aadhaar OTP',
    uidaiVerifying: 'प्रोफ़ाइल की जाँच हो रही है...',
    teleconsultConsent: 'टेली-परामर्श व एम्स ट्राइएज साझाकरण',
    teleconsultConsentDesc: 'आपातकालीन स्थिति में तुरंत डॉक्टर को जांच रिकॉर्ड भेजना।',
    recordsConsent: 'स्वास्थ्य रिकॉर्ड व जांच रिपोर्ट विश्लेषण',
    recordsConsentDesc: 'दवाइयों के समय और शुगर/बीपी रिपोर्ट को आसान भाषा में समझाने हेतु।',
    digilockerConsent: 'डिजिलॉकर (DigiLocker) बैकअप',
    digilockerConsentDesc: 'पर्चे व डिस्चार्ज सारांश को सरकारी वॉल्ट में सुरक्षित रखना।',
    filterAll: 'सभी',
    filterMeds: 'दवाइयां',
    filterLabs: 'जांच व बीपी',
    filterConditions: 'बीमारियां',
    filterDocs: 'पर्चे व रिपोर्ट',
    filterHospitals: 'सरकारी अस्पताल',
    filterJanAushadhi: 'जन औषधि केंद्र',
    filterBloodBank: 'ब्लड बैंक',
    filterSchemes: 'सरकारी योजनाएं',
    coverage: 'कवरेज लाभ',
    eligibility: 'पात्रता',
    documentsRequired: 'आवश्यक दस्तावेज',
    callHelpline: 'हेल्पलाइन पर कॉल करें',
    viewDetails: 'विवरण देखें',
    hideDetails: 'विवरण छुपाएं',
    ageGender: 'आयु / लिंग',
    bloodGroup: 'रक्त समूह',
    district: 'जिला',
    downloadSuccess: 'ABHA कार्ड सफलतापूर्वक डाउनलोड हुआ (PDF)',
    revokeConsent: 'अनुमति रद्द करें',
    revoked: 'रद्द',
    active: 'सक्रिय',
    expires: 'समाप्ति तिथि',
    scope: 'दायरा',
    resetSession: 'सत्र रीसेट करें',
    doctorVoiceListen: 'डॉक्टर की आवाज सुनें',
    doctorLiveTriage: 'सुरक्षा द्वार ट्राइएज / CLINICAL ESCALATION',
    doctorResolved: 'समाप्त (Resolve)',
    fastingSugar: 'खाली पेट (Fasting)',
    afterFoodSugar: 'खाने के बाद (After Food)',
    sugarReading: 'शुगर रीडिंग',
    upperBp: 'ऊपरी बीपी (Systolic)',
    lowerBp: 'निचला बीपी (Diastolic)',
    voiceActive: 'आवाज सक्रिय',
    tapMicToStart: 'माइक दबाकर बोलें या सवाल चुनें',
    opdTokenGenerated: 'ABDM OPD टोकन जनरेट हुआ',
    scanAtCounter: 'अस्पताल के फास्ट-ट्रैक काउंटर पर दिखाएं',
    tokenNumber: 'टोकन संख्या',
    department: 'विभाग',
    bedsAvailable: 'उपलब्ध बेड',
    safetyGateBadge: 'सुरक्षा ट्रिगर',
    safetyGateAgent: 'सुरक्षा द्वार',
    medicationAgent: 'दवाई साथी',
    labAgent: 'जांच विशेषज्ञ',
    hospitalAgent: 'अस्पताल मार्गदर्शक',
    schemeAgent: 'आयुष्मान योजना',
    multiAgentVda: 'सेहत साथी',
    welcomeIntroTitle: 'नमस्ते! मैं आपकी सेहत साथी हूँ',
    welcomeIntroDesc: 'दवाइयों का समय, जांच रिपोर्ट, नजदीकी अस्पताल या सरकारी योजनाओं के बारे में अपनी आवाज में पूछें।',
    tabRecordsMeds: 'दवाइयां',
    tabRecordsLabs: 'जांच व बीपी',
    tabRecordsConditions: 'बीमारियां',
    tabRecordsDocs: 'पर्चे व रिपोर्ट',
    tabHospitals: 'अस्पताल व केंद्र',
    tabSchemes: 'सरकारी योजनाएं',
    daysRemaining: 'बची हुई खुराक',
    refillsLeft: 'रिफिल शेष',
    trendHistory: 'पिछली जांचों का रुझान',
    explanation: 'सरल भाषा में अर्थ',
    doctorAdvice: 'डॉक्टर की सलाह',
    verifiedVault: 'स्वास्थ्य जानकारी',
    viewDetailsOrBack: 'वापस जाएं',
    pmjayActiveStatus: 'आयुष्मान भारत सक्रिय स्थिति',
    pmjayCoverAmount: '₹5,00,000 वार्षिक निःशुल्क इलाज',
    pmjayLinkedDesc: 'आपका ABHA खाता संख्या सीधे आयुष्मान भारत योजना से लिंक है।',
    cardHolder: 'कार्ड धारक',
    opdTokenModalTitle: 'फास्ट-ट्रैक OPD चेक-इन टोकन',
    expressAbdmDesk: 'OPD गेट 2 - एक्सप्रेस ABDM स्कैन डेस्क',
    done: 'संपन्न',
    abhaCardSub: 'डिजिटल स्वास्थ्य पहचान व सेटिंग्स',
    preferredLangTitle: 'भाषा / Preferred Language',
    readyLangsSub: 'भारतीय भाषाएं उपलब्ध',
    callHospital: 'कॉल करें',
    normalStatus: 'सामान्य (Normal)',
    elevatedStatus: 'नियंत्रित सुधार (Elevated)',
    logVital: 'नया माप जोड़ें',
    aarogyaStatusSafe: 'आप सुरक्षित हैं',
    aarogyaStatusDetail: 'उपलब्ध जानकारी VDA सेवा से जुड़ी है',
    abhaVerifiedBadge: 'प्रोफ़ाइल सक्रिय',
    bloodBankLive: 'e-RaktKosh लाइव ब्लड बैंक',
    bloodBankSub: 'जिला अस्पताल व रेड क्रॉस रक्त उपलब्धता',
    janAushadhiTitle: 'प्रधानमंत्री जन औषधि केंद्र (PMBJP)',
    janAushadhiSub: 'ब्रांडेड दवाओं पर 85% से 90% तक बचत करें',
    vaccineCertTitle: 'टीकाकरण पास (CoWIN / U-WIN)',
    vaccineCertSub: 'डिजिटल सत्यापित प्रमाण पत्र व आगामी टीके',
    symptomGridTitle: 'सचित्र लक्षण साथी (आवाज में पूछें)',
    symptomGridSub: 'किसी भी लक्षण पर दबाकर सीधे डॉक्टर AI से बात करें',
    visualPillBoxTitle: 'रंगीन गोली बक्सा (दवाई समय)',
    visualPillBoxSub: 'निरक्षर व ग्रामीण सुलभ दवाई मार्गदर्शक',
    morningSlot: 'सुबह नाश्ता',
    afternoonSlot: 'दोपहर भोजन',
    nightSlot: 'रात का खाना',
    emergencyDialTitle: 'आपातकालीन त्वरित डायल (24x7)',
    ambulance108: '108 एम्बुलेंस',
    healthHelpline104: '104 स्वास्थ्य सलाह',
    emergency112: '112 राष्ट्रीय आपातकाल',
    ayushman14555: '14555 आयुष्मान',
    marketPriceLabel: 'बाजार मूल्य',
    janAushadhiPriceLabel: 'जन औषधि मूल्य',
    youSave: 'बचत',
    unitsAvail: 'यूनिट उपलब्ध',
    beneficiaryLabel: 'लाभार्थी संदर्भ',
    doseCompleted: 'टीका पूर्ण',
    doseDue: 'टीका बाकी (Due)',
    downloadVaccineCert: 'टीका प्रमाण पत्र',
    askAboutSymptom: 'लक्षण के बारे में पूछें',
    headacheSymptom: 'सिरदर्द व चक्कर',
    chestPainSymptom: 'छाती में दर्द व भारीपन',
    stomachPainSymptom: 'पेट दर्द व गैस',
    feverSymptom: 'तेज बुखार व बदन दर्द',
    sugarThirstSymptom: 'ज्यादा प्यास व बार-बार पेशाब',
    footPainSymptom: 'पैरों में झनझनाहट व सुन्नता',
    pregnancySymptom: 'गर्भावस्था व पोषण',
    woundSymptom: 'चोट व घाव की देखभाल',
    takePillNow: 'यह गोली लें',
    pillTakenDone: 'दवा ले ली गई',
    pillAudioGuide: 'दवा निर्देश सुनें',
    selectPersonaNotice: 'रोगी प्रोफाइल बदली गई',
    syncingAbdm: 'जानकारी अपडेट हो रही है...',
    abdmSynced: 'जानकारी अपडेट हो गई',
    tabVaccines: 'टीकाकरण',
    tabJanAushadhi: 'सस्ती दवाएं',
    tabBloodBank: 'ब्लड बैंक'
  },
  en: {
    appTitle: 'Sehat Saathi',
    tabVda: 'Sehat Saathi',
    tabRecords: 'My Records',
    tabFacilities: 'Facilities & Schemes',
    tabProfile: 'ABHA Profile',
    tapToSpeak: 'Tap to Speak',
    listening: 'Listening... Please speak',
    processing: 'Understanding...',
    stopListening: 'Stop',
    safetyWarning: 'Emergency Clinical Alert',
    escalatedToDoctor: 'Handed over to AIIMS Clinical Triage',
    readAloud: 'Read Aloud',
    stopReading: 'Stop Reading',
    activePrescriptions: 'Active Medications',
    takenToday: 'Taken Today',
    pendingToday: 'Pending Today',
    markTaken: 'Mark as Taken',
    undoTaken: 'Undo',
    adherenceRate: 'Medication Adherence Rate',
    adherenceAdvice: 'Taking medicines on schedule prevents health complications',
    recentLab: 'Recent Observations & Labs',
    allRecords: 'Complete ABDM Health Records',
    searchHospital: 'Search Hospitals or Schemes',
    abhaCard: 'Ayushman Bharat Health Account (ABHA)',
    abhaCardTitle: 'Ayushman Bharat Health Account',
    abhaNumber: 'ABHA Number',
    abhaAddress: 'ABHA Address',
    viewQr: 'View QR Code',
    downloadCard: 'Download Card',
    consentManagement: 'Data Consent Management',
    activeConsents: 'Active Permissions',
    switchPatient: 'Switch Patient Persona (Demo)',
    emergencyHelpline: 'Emergency 108',
    opdCheckin: 'Fast-Track OPD Check-in',
    generateQrToken: 'Generate OPD Token',
    distanceKm: 'km away',
    emergency24x7: '24x7 Emergency Services Available',
    provenanceSource: 'Recorded at',
    normalRange: 'Reference Range',
    targetRange: 'Target Range',
    doctorEscalationNotice: 'Deterministic safety rules triggered immediate clinical triage handover.',
    callAmbulance: 'Call 108 Emergency Ambulance',
    ambulanceEnRoute: '108 Ambulance is en route',
    joinLiveConsult: 'Join Live Clinical Tele-Consult',
    typeMessagePlaceholder: 'Type a query or tap microphone...',
    quickQuestions: 'Quick Inquiries',
    myMedicinesChip: 'My medication schedule',
    sugarLabChip: 'Explain my latest HbA1c lab',
    nearbyHospitalChip: 'Nearby ABDM hospital',
    pmjayBenefitsChip: 'Ayushman PM-JAY coverage',
    chestPainTestChip: 'Severe chest pain [Safety Trigger]',
    onboardingTitle: 'Welcome to Sehat Saathi',
    onboardingSubtitle: 'Voice-first AI Health Assistant backed by ABDM standards',
    selectLanguage: 'Select Your Preferred Language',
    selectLanguageHint: 'Choose your language (tap any button to hear audio intro)',
    verifyAbhaAadhaar: 'ABHA Digital Identity',
    verifyAbhaSubtitle: 'Secure Aadhaar Face-Auth / OTP Verification (Simulated)',
    consentTitle: 'ABDM Privacy & Consent Artifacts',
    consentSubtitle: 'Your records are encrypted and shared strictly for your medical care.',
    agreeAndStart: 'Agree & Enter Health App',
    selfReportVital: 'Log New Reading',
    logBloodSugar: 'Log Blood Glucose',
    logBloodPressure: 'Log Blood Pressure',
    readingSaved: 'Measurement Recorded',
    close: 'Close',
    back: 'Back',
    continue: 'Continue',
    authenticate: 'Authenticate',
    authenticating: 'Authenticating...',
    faceAuth: 'Face Auth',
    aadhaarOtp: 'Aadhaar OTP',
    uidaiVerifying: 'Checking profile...',
    teleconsultConsent: 'Tele-Consultation & AIIMS Triage Access',
    teleconsultConsentDesc: 'Allows immediate handover of clinical vitals during emergency triage.',
    recordsConsent: 'Health Record & Lab Observation AI Explainer',
    recordsConsentDesc: 'Translates complex medical labs and medication timings into simple language.',
    digilockerConsent: 'DigiLocker Personal Health Vault Backup',
    digilockerConsentDesc: 'Stores verified prescriptions and summaries in government locker.',
    filterAll: 'All',
    filterMeds: 'Medications',
    filterLabs: 'Labs & Vitals',
    filterConditions: 'Conditions',
    filterDocs: 'Documents',
    filterHospitals: 'Government Hospitals',
    filterJanAushadhi: 'Jan Aushadhi Stores',
    filterBloodBank: 'Blood Banks',
    filterSchemes: 'Government Schemes',
    coverage: 'Coverage Benefits',
    eligibility: 'Eligibility',
    documentsRequired: 'Required Documents',
    callHelpline: 'Call Helpline',
    viewDetails: 'View Details',
    hideDetails: 'Hide Details',
    ageGender: 'Age / Gender',
    bloodGroup: 'Blood Group',
    district: 'District',
    downloadSuccess: 'ABHA Card Downloaded (PDF)',
    revokeConsent: 'Revoke Permission',
    revoked: 'REVOKED',
    active: 'ACTIVE',
    expires: 'Expires',
    scope: 'Scope',
    resetSession: 'Reset Onboarding Demo',
    doctorVoiceListen: 'Listen to Doctor Voice',
    doctorLiveTriage: 'CLINICAL ESCALATION / TRIAGE',
    doctorResolved: 'Resolve Case',
    fastingSugar: 'Fasting Glucose',
    afterFoodSugar: 'Post Meal Glucose',
    sugarReading: 'Sugar Reading',
    upperBp: 'Systolic BP (Upper)',
    lowerBp: 'Diastolic BP (Lower)',
    voiceActive: 'Voice Channel Active',
    tapMicToStart: 'Tap microphone or select a prompt',
    opdTokenGenerated: 'ABDM OPD Token Generated',
    scanAtCounter: 'Scan at hospital fast-track registration counter',
    tokenNumber: 'Token Number',
    department: 'Department',
    bedsAvailable: 'Beds Available',
    safetyGateBadge: 'Safety Trigger',
    safetyGateAgent: 'Safety Gate',
    medicationAgent: 'Pharmacy Agent',
    labAgent: 'Lab Agent',
    hospitalAgent: 'Hospital Agent',
    schemeAgent: 'PM-JAY Scheme',
    multiAgentVda: 'Sehat Saathi',
    welcomeIntroTitle: 'Namaste! I am Sehat Saathi, your health companion',
    welcomeIntroDesc: 'Ask in your voice about your medicines, lab observations, nearby ABDM hospitals, or PM-JAY scheme.',
    tabRecordsMeds: 'Medications',
    tabRecordsLabs: 'Labs & Vitals',
    tabRecordsConditions: 'Conditions',
    tabRecordsDocs: 'Documents',
    tabHospitals: 'Hospitals & Centers',
    tabSchemes: 'Govt Schemes',
    daysRemaining: 'Stock remaining',
    refillsLeft: 'Refills left',
    trendHistory: 'Trend History',
    explanation: 'Explanation',
    doctorAdvice: 'Doctor Advice',
    verifiedVault: 'Health information',
    viewDetailsOrBack: 'Back to Records',
    pmjayActiveStatus: 'Ayushman Bharat Active Status',
    pmjayCoverAmount: '₹5,00,000 Annual Cashless Treatment',
    pmjayLinkedDesc: 'Your ABHA ID is directly linked to Ayushman Bharat PM-JAY scheme.',
    cardHolder: 'Card Holder',
    opdTokenModalTitle: 'Fast-Track OPD Check-in Token',
    expressAbdmDesk: 'OPD Gate 2 - Express ABDM Scan Desk',
    done: 'Done',
    abhaCardSub: 'Digital Health Identity & Settings',
    preferredLangTitle: 'Preferred Language',
    readyLangsSub: 'Indian Languages Supported',
    callHospital: 'Call Facility',
    normalStatus: 'Normal',
    elevatedStatus: 'Elevated (Follow up)',
    logVital: 'Log New Vital',
    aarogyaStatusSafe: 'You Are Safe & Monitored',
    aarogyaStatusDetail: 'Available information is connected to the VDA service',
    abhaVerifiedBadge: 'Profile active',
    bloodBankLive: 'e-RaktKosh Live Blood Stock',
    bloodBankSub: 'District Hospital & Red Cross live availability',
    janAushadhiTitle: 'PM Jan Aushadhi Generic Savings',
    janAushadhiSub: 'Save 85% to 90% compared to branded market drugs',
    vaccineCertTitle: 'Universal Vaccine Passport (CoWIN / U-WIN)',
    vaccineCertSub: 'Digitally verifiable certificates & booster schedules',
    symptomGridTitle: 'Pictorial Body & Symptom Assistant',
    symptomGridSub: 'Tap any illustrated symptom to start voice triage',
    visualPillBoxTitle: 'Visual Pill Box (Dosage & Timing)',
    visualPillBoxSub: 'Accessible visual guide for low-literacy users',
    morningSlot: 'Morning (Breakfast)',
    afternoonSlot: 'Afternoon (Lunch)',
    nightSlot: 'Night (Dinner)',
    emergencyDialTitle: 'Emergency Quick Dial (24x7)',
    ambulance108: '108 Ambulance',
    healthHelpline104: '104 Health Advice',
    emergency112: '112 National SOS',
    ayushman14555: '14555 Ayushman',
    marketPriceLabel: 'Market Brand Price',
    janAushadhiPriceLabel: 'Jan Aushadhi Price',
    youSave: 'You Save',
    unitsAvail: 'Units in Stock',
    beneficiaryLabel: 'Beneficiary Ref',
    doseCompleted: 'Completed',
    doseDue: 'Due for Dose',
    downloadVaccineCert: 'Vaccine Certificate',
    askAboutSymptom: 'Inquire about symptom',
    headacheSymptom: 'Headache & Dizziness',
    chestPainSymptom: 'Chest Pain & Tightness',
    stomachPainSymptom: 'Stomach Ache & Acidity',
    feverSymptom: 'High Fever & Bodyache',
    sugarThirstSymptom: 'Excess Thirst & Frequent Urination',
    footPainSymptom: 'Foot Tingling / Neuropathy',
    pregnancySymptom: 'Maternal Care & IFA',
    woundSymptom: 'Wound & Cut First Aid',
    takePillNow: 'Take Medicine Now',
    pillTakenDone: 'Marked as Taken',
    pillAudioGuide: 'Audio Dosage Guide',
    selectPersonaNotice: 'Patient profile switched',
    syncingAbdm: 'Updating information...',
    abdmSynced: 'Information updated',
    tabVaccines: 'Vaccines',
    tabJanAushadhi: 'Jan Aushadhi',
    tabBloodBank: 'Blood Bank'
  }
};

// The UI and backend speak only Hindi and English; a stored 'ta'/'kn' falls back to Hindi.
export const toUiLang = (lang?: string | null): UiLanguage => (lang === 'en' ? 'en' : 'hi');

export function getTranslation(lang: LanguageCode, key: string): string {
  return TRANSLATIONS[toUiLang(lang)][key] || TRANSLATIONS.en[key] || key;
}

// Localized helper functions for FHIR data
export function getLocalizedField<T extends Record<string, any>>(
  obj: T | undefined | null,
  baseKey: string,
  lang: LanguageCode
): string {
  if (!obj) return '';
  if (lang === 'hi') {
    const hiKey = `${baseKey}Hi`;
    if (obj[hiKey]) return obj[hiKey];
  } else if (lang === 'ta') {
    const taKey = `${baseKey}Ta`;
    if (obj[taKey]) return obj[taKey];
  } else if (lang === 'kn') {
    const knKey = `${baseKey}Kn`;
    if (obj[knKey]) return obj[knKey];
  }
  return obj[baseKey] || '';
}

// Audio Cue Helper
export function playChime(type: 'start' | 'stop' | 'success' | 'alert') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'start') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'stop') {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(600, now + 0.1);
      osc.frequency.setValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // ignore audio context restrictions
  }
}

// Text-to-Speech engine
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function configureSpeechUtterance(utterance: SpeechSynthesisUtterance, lang: LanguageCode) {
  const locale: Record<LanguageCode, string> = { hi: 'hi-IN', en: 'en-IN', ta: 'ta-IN', kn: 'kn-IN' };
  utterance.lang = locale[lang];
  utterance.rate = lang === 'hi' ? 0.88 : 0.9;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const matching = voices.filter((voice) => voice.lang.toLowerCase() === utterance.lang.toLowerCase());
  const preferred = matching.find((voice) => /\b(?:female|woman|priya|suhani|ishita|neha|ritu|pooja|lekha|vani)\b/i.test(voice.name));
  utterance.voice = preferred || matching[0]
    || voices.find((voice) => voice.lang.toLowerCase().startsWith(lang)) || null;
}

export function speakText(text: string, lang: LanguageCode = 'hi', onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  configureSpeechUtterance(utterance, lang);

  utterance.onend = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}
