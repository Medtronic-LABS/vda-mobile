import React, { useState } from 'react';
import { Sparkles, FileText, Building2, User } from 'lucide-react';
import { ChatMessage, ClinicalEscalationState, FhirCondition, FhirDocument, FhirMedication, FhirObservation, LanguageCode, PatientDemographics } from './types';
import { SYNTHETIC_PATIENTS, FACILITIES_LIST, HEALTH_SCHEMES_LIST } from './data/syntheticData';
import { getTranslation, playChime } from './utils/i18n';
import { processVdaQuery } from './utils/vdaEngine';
import { createEscalationPayload } from './utils/safetyGate';
import { apiService } from './services/api';

// Tab & Modal Components
import { OnboardingModal } from './components/OnboardingModal';
import { VdaTab } from './components/VdaTab';
import { RecordsTab } from './components/RecordsTab';
import { FacilitiesTab } from './components/FacilitiesTab';
import { ProfileTab } from './components/ProfileTab';
import { EscalationModal } from './components/EscalationModal';
import { LogVitalModal } from './components/LogVitalModal';

export default function App() {
  // Active Persona & Language
  const [currentPersonaKey, setCurrentPersonaKey] = useState<string>('synth-patient-001');
  const activeProfile = SYNTHETIC_PATIENTS[currentPersonaKey] || SYNTHETIC_PATIENTS['synth-patient-001'];

  const [lang, setLang] = useState<LanguageCode>('hi');
  const [activeTab, setActiveTab] = useState<'vda' | 'records' | 'facilities' | 'profile'>('vda');

  // App Flow Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLogVitalOpen, setIsLogVitalOpen] = useState(false);

  // Dynamic Clinical & Medical State
  const [patient, setPatient] = useState<PatientDemographics>(activeProfile.demographics);
  const [conditions, setConditions] = useState<FhirCondition[]>(activeProfile.conditions);
  const [medications, setMedications] = useState<FhirMedication[]>(activeProfile.medications);
  const [observations, setObservations] = useState<FhirObservation[]>(activeProfile.observations);
  const [documents, setDocuments] = useState<FhirDocument[]>(activeProfile.documents);
  const [consents, setConsents] = useState(activeProfile.consents);

  // Clinical Escalation Takeover State
  const [escalationState, setEscalationState] = useState<ClinicalEscalationState | null>(null);

  // VDA Conversation History
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-01',
      sender: 'vda',
      agent: 'router',
      text: `Namaste ${activeProfile.demographics.name} ji. I am your VDA Health Assistant. I have linked your ABDM records from AIIMS New Delhi. How can I help you today?`,
      textHi: `नमस्ते ${activeProfile.demographics.name} जी। मैं आपका VDA स्वास्थ्य साथी हूँ। आपके एम्स अस्पताल के सभी रिकॉर्ड जुड़ चुके हैं। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
      textTa: `வணக்கம் ${activeProfile.demographics.name} அவர்களே. நான் உங்கள் VDA சுகாதார உதவியாளர். AIIMS புது தில்லி மருத்துவ பதிவுகள் இணைக்கப்பட்டுள்ளன. இன்று உங்களுக்கு எவ்வாறு உதவலாம்?`,
      textKn: `ನಮಸ್ಕಾರ ${activeProfile.demographics.name} ಅವರೇ. ನಾನು ನಿಮ್ಮ VDA ಆರೋಗ್ಯ ಸಹಾಯಕ. AIIMS ನವದೆಹಲಿ ಆಸ್ಪತ್ರೆಯ ದಾಖಲೆಗಳು ಸಂಪರ್ಕಗೊಂಡಿವೆ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true,
      quickActions: [
        { label: 'My Medicines', labelHi: 'मेरी दवाइयां', labelTa: 'எனது மருந்துகள்', labelKn: 'ನನ್ನ ಔಷಧಿಗಳು', action: 'ask_medicines' },
        { label: 'Explain Sugar Lab', labelHi: 'शुगर रिपोर्ट समझाएं', labelTa: 'சர்க்கரை சோதனை விளக்கம்', labelKn: 'ಸಕ್ಕರೆ ವರದಿ ವಿವರಣೆ', action: 'ask_sugar_lab' },
        { label: 'Nearby Hospital', labelHi: 'नजदीकी अस्पताल', labelTa: 'அருகிலுள்ள மருத்துவமனை', labelKn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ', action: 'ask_hospital' },
        { label: 'Ayushman PM-JAY', labelHi: 'आयुष्मान योजना लाभ', labelTa: 'ஆயுஷ்மான் திட்ட பலன்கள்', labelKn: 'ಆಯುಷ್ಮಾನ್ ಯೋಜನೆ', action: 'ask_scheme' }
      ]
    }
  ]);

  // Switch patient profile
  const handleSwitchPersona = (key: string) => {
    setCurrentPersonaKey(key);
    const newProfile = SYNTHETIC_PATIENTS[key] || SYNTHETIC_PATIENTS['synth-patient-001'];
    setPatient(newProfile.demographics);
    setConditions(newProfile.conditions);
    setMedications(newProfile.medications);
    setObservations(newProfile.observations);
    setDocuments(newProfile.documents);
    setConsents(newProfile.consents);
    setEscalationState(null);

    setMessages([
      {
        id: `switch-${Date.now()}`,
        sender: 'vda',
        agent: 'router',
        text: `Switched profile to ${newProfile.demographics.name} (${newProfile.demographics.district}, ${newProfile.demographics.state}). Active ABDM ABHA: ${newProfile.demographics.abhaNumber}. Category: ${newProfile.demographics.goldCategory || 'NCD Profile'}.`,
        textHi: `मरीज प्रोफाइल बदला गया: ${newProfile.demographics.name} (${newProfile.demographics.district}, ${newProfile.demographics.state})। सक्रिय ABHA संख्या: ${newProfile.demographics.abhaNumber}।`,
        textTa: `நோயாளி சுயவிவரம் மாற்றப்பட்டது: ${newProfile.demographics.name}। செயலில் உள்ள ABHA: ${newProfile.demographics.abhaNumber}।`,
        textKn: `ರೋಗಿ ಪ್ರೊಫೈಲ್ ಬದಲಾಯಿಸಲಾಗಿದೆ: ${newProfile.demographics.name}। ಸಕ್ರಿಯ ABHA: ${newProfile.demographics.abhaNumber}।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioAvailable: true
      }
    ]);
  };

  // Toggle medication checklist
  const handleToggleMedication = (medId: string) => {
    playChime('success');
    setMedications((prev) =>
      prev.map((m) => {
        if (m.id === medId) {
          const updatedTaken = !m.takenToday;
          apiService.toggleMedicationAdherence(medId, updatedTaken).catch(console.error);
          return {
            ...m,
            takenToday: updatedTaken,
            adherenceRate: updatedTaken ? Math.min(100, m.adherenceRate + 2) : Math.max(70, m.adherenceRate - 2)
          };
        }
        return m;
      })
    );
  };

  // Process user message
  const handleSendMessage = async (userText: string) => {
    playChime('start');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      textHi: userText,
      textTa: userText,
      textKn: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);

    const result = await apiService.processVdaQuery(userText, patient, medications, observations, lang);
    setMessages((prev) => [...prev, result.message]);

    if (result.escalationState) {
      setEscalationState(result.escalationState);
      apiService.notifyEscalation(result.escalationState).catch(console.error);
    }
  };

  // Trigger manual or test escalation
  const handleTriggerEscalation = (reason: string) => {
    const escPayload = createEscalationPayload(
      reason,
      { isSafe: false, isEscalated: true, severity: 'CRITICAL', reason: 'High Risk Clinical Symptom' },
      patient.name,
      patient.abhaNumber
    );
    setEscalationState(escPayload);
    apiService.notifyEscalation(escPayload).catch(console.error);
  };

  // Doctor tele-consult response
  const handleDoctorChatMessage = (text: string) => {
    if (!escalationState) return;

    const userMsg: ChatMessage = {
      id: `esc-usr-${Date.now()}`,
      sender: 'user',
      text,
      textHi: text,
      textTa: text,
      textKn: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setEscalationState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        chatHistory: [...prev.chatHistory, userMsg]
      };
    });

    // Simulated doctor response
    setTimeout(() => {
      const docReplies = [
        {
          text: `Understood, ${patient.name} ji. An emergency response team has been alerted at District Hospital. Keep breathing slowly and loosen any tight clothing. Do not take any extra painkiller pills.`,
          textHi: `समझ गए, ${patient.name} जी। नजदीकी अस्पताल में इमरजेंसी टीम को सतर्क कर दिया गया है। गहरी सांस लेते रहें और कोई अन्य दर्द निवारक दवा न लें।`,
          textTa: `புரிந்தது, ${patient.name} அவர்களே. மாவட்ட மருத்துவமனையில் அவசர சிகிச்சை குழு எச்சரிக்கப்பட்டுள்ளது. மெதுவாக சுவாசிக்கவும், வேறு வலி மாத்திரைகளை உட்கொள்ள வேண்டாம்.`,
          textKn: `ತಿಳಿಯಿತು, ${patient.name} ಅವರೇ. ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ತುರ್ತು ಚಿಕಿತ್ಸಾ ತಂಡವನ್ನು ಎಚ್ಚರಿಸಲಾಗಿದೆ. ನಿಧಾನವಾಗಿ ಉಸಿರಾಡಿ, ಬೇರೆ ಯಾವುದೇ ನೋವು ನಿವಾರಕ ಮಾತ್ರೆ ತೆಗೆದುಕೊಳ್ಳಬೇಡಿ.`
        },
        {
          text: `I am monitoring your vitals in real time. Please keep the phone near you. Help is on the way.`,
          textHi: `मैं लगातार आपके रिकॉर्ड देख रही हूँ। फोन अपने पास रखें, सहायता पहुँच रही है।`,
          textTa: `நான் உங்கள் பதிவுகளை நேரடியாக கவனித்து வருகிறேன். தொலைபேசியை அருகில் வைத்திருங்கள், உதவி வந்துகொண்டிருக்கிறது.`,
          textKn: `ನಾನು ನಿಮ್ಮ ದಾಖಲೆಗಳನ್ನು ನೈಜ ಸಮಯದಲ್ಲಿ ವೀಕ್ಷಿಸುತ್ತಿದ್ದೇನೆ. ಫೋನ್ ನಿಮ್ಮ ಹತ್ತಿರವೇ ಇರಲಿ, ಸಹಾಯ ಬರುತ್ತಿದೆ.`
        }
      ];
      const reply = docReplies[Math.floor(Math.random() * docReplies.length)];

      const docMsg: ChatMessage = {
        id: `esc-doc-${Date.now()}`,
        sender: 'clinician',
        text: reply.text,
        textHi: reply.textHi,
        textTa: reply.textTa,
        textKn: reply.textKn,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioAvailable: true
      };

      setEscalationState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          chatHistory: [...prev.chatHistory, docMsg]
        };
      });
    }, 1200);
  };

  // Save new observation (e.g. self reported sugar/BP)
  const handleSaveVital = (newObs: FhirObservation) => {
    setObservations((prev) => [newObs, ...prev]);
    apiService.logObservation(newObs).catch(console.error);

    // Send confirmation in VDA chat
    const confirmMsg: ChatMessage = {
      id: `vital-conf-${Date.now()}`,
      sender: 'vda',
      agent: 'lab_explainer',
      text: `Recorded new ${newObs.display} of ${newObs.value} ${newObs.unit}. Added to your ABDM observation log.`,
      textHi: `नया माप दर्ज किया गया: ${newObs.displayHi || newObs.display} (${newObs.value} ${newObs.unit})। आपके स्वास्थ्य रिकॉर्ड में सुरक्षित हो गया।`,
      textTa: `புதிய அளவீடு பதிவு செய்யப்பட்டது: ${newObs.displayTa || newObs.display} (${newObs.value} ${newObs.unit})। உங்கள் சுகாதார பதிவில் சேர்க்கப்பட்டது.`,
      textKn: `ಹೊಸ ರೀಡಿಂಗ್ ದಾಖಲಾಗಿದೆ: ${newObs.displayKn || newObs.display} (${newObs.value} ${newObs.unit})। ನಿಮ್ಮ ಆರೋಗ್ಯ ದಾಖಲೆಯಲ್ಲಿ ಸೇರಿಸಲಾಗಿದೆ.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  // Revoke consent
  const handleRevokeConsent = (consentId: string) => {
    playChime('stop');
    apiService.revokeConsent(consentId).catch(console.error);
    setConsents((prev) =>
      prev.map((c) => (c.id === consentId ? { ...c, status: 'REVOKED' } : c))
    );
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-950 text-slate-100 flex justify-center selection:bg-emerald-500 selection:text-white overflow-hidden">
      {/* Responsive Full-Screen Mobile App Container (Up to max-w-xl on larger screens) */}
      <div className="w-full max-w-xl h-full max-h-full bg-slate-950 flex flex-col relative border-x border-slate-800/80 shadow-2xl overflow-hidden">
        
        {/* Onboarding / Language & ABDM Login Modal */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onComplete={(chosenLang) => {
            setLang(chosenLang);
            setIsOnboardingOpen(false);
          }}
          selectedLang={lang}
          onLangChange={setLang}
        />

        {/* Log Vital Metric Modal */}
        <LogVitalModal
          isOpen={isLogVitalOpen}
          onClose={() => setIsLogVitalOpen(false)}
          onSaveVital={handleSaveVital}
          lang={lang}
        />

        {/* Clinical Escalation Full-Screen Takeover */}
        {escalationState?.isActive && (
          <EscalationModal
            escalation={escalationState}
            patient={patient}
            observations={observations}
            lang={lang}
            onSendMessageToDoctor={handleDoctorChatMessage}
            onResolveEscalation={() => {
              playChime('success');
              setEscalationState(null);
            }}
          />
        )}

        {/* Main Tab Screen Switcher */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'vda' && (
            <VdaTab
              patient={patient}
              medications={medications}
              observations={observations}
              lang={lang}
              messages={messages}
              onSendMessage={handleSendMessage}
              onToggleMedicationTaken={handleToggleMedication}
              onNavigateTab={setActiveTab}
              onTriggerEscalation={handleTriggerEscalation}
              onOpenLogVital={() => setIsLogVitalOpen(true)}
            />
          )}

          {activeTab === 'records' && (
            <RecordsTab
              patient={patient}
              conditions={conditions}
              medications={medications}
              observations={observations}
              documents={documents}
              lang={lang}
              onToggleMedicationTaken={handleToggleMedication}
              onOpenLogVital={() => setIsLogVitalOpen(true)}
            />
          )}

          {activeTab === 'facilities' && (
            <FacilitiesTab
              facilities={FACILITIES_LIST}
              schemes={HEALTH_SCHEMES_LIST}
              patient={patient}
              lang={lang}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab
              patient={patient}
              consents={consents}
              lang={lang}
              onLangChange={setLang}
              onSwitchPersona={handleSwitchPersona}
              onRevokeConsent={handleRevokeConsent}
              onResetSession={() => setIsOnboardingOpen(true)}
            />
          )}
        </main>

        {/* Bottom Primary Mobile Navigation Tab Bar (44px+ touch targets) */}
        <nav aria-label="Main Navigation" className="flex-shrink-0 w-full bg-slate-900/95 border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-30 backdrop-blur-md">
          <button
            id="nav-tab-vda"
            onClick={() => {
              playChime('start');
              setActiveTab('vda');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'vda'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'vda' ? 'bg-emerald-500/20' : ''}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabVda')}</span>
          </button>

          <button
            id="nav-tab-records"
            onClick={() => {
              playChime('start');
              setActiveTab('records');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'records'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'records' ? 'bg-emerald-500/20' : ''}`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabRecords')}</span>
          </button>

          <button
            id="nav-tab-facilities"
            onClick={() => {
              playChime('start');
              setActiveTab('facilities');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'facilities'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'facilities' ? 'bg-emerald-500/20' : ''}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabFacilities')}</span>
          </button>

          <button
            id="nav-tab-profile"
            onClick={() => {
              playChime('start');
              setActiveTab('profile');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-emerald-500/20' : ''}`}>
              <User className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabProfile')}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
