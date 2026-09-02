import React, { useState } from 'react';
import { Pill, Activity, FileText, Stethoscope, Volume2, VolumeX, Plus, CheckCircle2, ChevronRight, ShieldCheck, Download, Sun, Moon, Sunrise, QrCode, Check } from 'lucide-react';
import { FhirCondition, FhirDocument, FhirMedication, FhirObservation, LanguageCode, PatientDemographics, VaccineRecord } from '../types';
import { VACCINES_DATA } from '../data/syntheticData';
import { speakText, stopSpeaking, getTranslation, getLocalizedField, playChime } from '../utils/i18n';

interface RecordsTabProps {
  patient: PatientDemographics;
  conditions: FhirCondition[];
  medications: FhirMedication[];
  observations: FhirObservation[];
  documents: FhirDocument[];
  lang: LanguageCode;
  onToggleMedicationTaken: (medId: string) => void;
  onOpenLogVital: () => void;
}

export const RecordsTab: React.FC<RecordsTabProps> = ({
  patient,
  conditions,
  medications,
  observations,
  documents,
  lang,
  onToggleMedicationTaken,
  onOpenLogVital
}) => {
  const [activeSection, setActiveSection] = useState<'medications' | 'pillbox' | 'vaccines' | 'observations' | 'conditions' | 'documents'>('medications');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<FhirDocument | null>(null);
  const [selectedVaccineCert, setSelectedVaccineCert] = useState<VaccineRecord | null>(null);
  const [showCertToast, setShowCertToast] = useState(false);

  // Vaccines for active patient
  const patientVaccines: VaccineRecord[] = VACCINES_DATA[patient.id] || VACCINES_DATA['patient-001'] || [];

  const handleSpeak = (id: string, text: string) => {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      setSpeakingId(id);
      speakText(text, lang, () => {
        setSpeakingId(null);
      });
    }
  };

  const calculateOverallAdherence = () => {
    if (medications.length === 0) return 100;
    const sum = medications.reduce((acc, m) => acc + (m.adherenceRate || 90), 0);
    return Math.round(sum / medications.length);
  };

  const handleDownloadCert = (vac: VaccineRecord) => {
    playChime('success');
    setShowCertToast(true);
    setTimeout(() => setShowCertToast(false), 2500);
  };

  // Visual Pill Box styling helper
  const getPillVisual = (medName: string, index: number) => {
    const lower = medName.toLowerCase();
    if (lower.includes('metformin')) {
      return { shape: 'rounded-full w-9 h-9 bg-white text-slate-900 border-2 border-slate-300 font-bold', label: '500' };
    }
    if (lower.includes('telmisartan')) {
      return { shape: 'rounded-full w-9 h-9 bg-amber-400 text-slate-950 border-2 border-amber-500 font-bold', label: '40' };
    }
    if (lower.includes('glimepiride')) {
      return { shape: 'rounded-full w-8 h-8 bg-sky-300 text-slate-950 border-2 border-sky-400 font-bold', label: '1' };
    }
    if (lower.includes('methylcobalamin') || lower.includes('vitamin')) {
      return { shape: 'rounded-2xl w-10 h-6 bg-gradient-to-r from-red-500 to-amber-400 text-white font-bold', label: 'CAP' };
    }
    if (lower.includes('thyroxine')) {
      return { shape: 'rounded-full w-7 h-7 bg-purple-300 text-slate-950 border-2 border-purple-400 font-bold', label: '50' };
    }
    return { shape: 'rounded-full w-8 h-8 bg-emerald-400 text-slate-950 font-bold', label: 'TAB' };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>{getTranslation(lang, 'tabRecords')}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
              FHIR R4 / ABDM
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">{patient.abhaAddress}</p>
        </div>

        <button
          id="log-vital-top-btn"
          onClick={onOpenLogVital}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-950 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{getTranslation(lang, 'selfReportVital')}</span>
        </button>
      </header>

      {/* Sub-Section Navigation Tabs */}
      <div className="flex bg-slate-900/80 p-1.5 border-b border-slate-800 gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
        <button
          id="rec-tab-meds"
          onClick={() => {
            playChime('start');
            setActiveSection('medications');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSection === 'medications'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>{getTranslation(lang, 'tabRecordsMeds')}</span>
        </button>

        <button
          id="rec-tab-pillbox"
          onClick={() => {
            playChime('start');
            setActiveSection('pillbox');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSection === 'pillbox'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="w-2 h-2 rounded-full bg-sky-400" />
          </div>
          <span>{getTranslation(lang, 'visualPillBoxTitle')}</span>
        </button>

        <button
          id="rec-tab-vaccines"
          onClick={() => {
            playChime('start');
            setActiveSection('vaccines');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSection === 'vaccines'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{getTranslation(lang, 'tabVaccines')}</span>
        </button>

        <button
          id="rec-tab-obs"
          onClick={() => {
            playChime('start');
            setActiveSection('observations');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSection === 'observations'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{getTranslation(lang, 'tabRecordsLabs')}</span>
        </button>

        <button
          id="rec-tab-cond"
          onClick={() => {
            playChime('start');
            setActiveSection('conditions');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSection === 'conditions'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>{getTranslation(lang, 'tabRecordsConditions')}</span>
        </button>

        <button
          id="rec-tab-docs"
          onClick={() => {
            playChime('start');
            setActiveSection('documents');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSection === 'documents'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{getTranslation(lang, 'tabRecordsDocs')}</span>
        </button>
      </div>

      {/* Main Section Content Area */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 pb-8 min-h-0">
        {/* 1. MEDICATIONS SECTION */}
        {activeSection === 'medications' && (
          <div className="space-y-3">
            {/* Adherence Overview Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/70 to-slate-900 border border-blue-500/30 flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-300 font-medium">{getTranslation(lang, 'adherenceRate')}</p>
                <h3 className="text-xl font-bold text-white">{calculateOverallAdherence()}%</h3>
                <p className="text-[10px] text-slate-400">{getTranslation(lang, 'adherenceAdvice')}</p>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-blue-400 border-t-emerald-400 flex items-center justify-center font-bold text-xs text-white">
                {calculateOverallAdherence()}%
              </div>
            </div>

            {/* Medication Card List */}
            {medications.map((med) => {
              const isSpeaking = speakingId === med.id;
              const medName = getLocalizedField(med, 'name', lang);
              const medDosage = getLocalizedField(med, 'dosage', lang);
              const medTiming = getLocalizedField(med, 'timing', lang);
              const spokenText = `${medName}. ${medDosage}. ${medTiming}.`;

              return (
                <div
                  key={med.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white">
                          {medName}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {med.code}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                        {medDosage}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSpeak(med.id, spokenText)}
                      className={`p-2 rounded-xl border transition-all ${
                        isSpeaking
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title={getTranslation(lang, 'readAloud')}
                    >
                      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>

                  {/* Frequency & Timing Badge */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-300">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                      ⏰ {med.timeOfDay.join(' • ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                      🍽️ {medTiming}
                    </span>
                  </div>

                  {/* Refill & Days Remaining Meter */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>{getTranslation(lang, 'daysRemaining')}: <strong className="text-white">{med.daysRemaining}</strong></span>
                      <span>{med.refillCount} {getTranslation(lang, 'refillsLeft')}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          med.daysRemaining < 10 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, (med.daysRemaining / med.totalDays) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Provenance & Interactive Checkbox */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400">
                      {med.prescribedDate} · {med.sourceFacility}
                    </p>
                    <button
                      onClick={() => onToggleMedicationTaken(med.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        med.takenToday
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{med.takenToday ? getTranslation(lang, 'takenToday') : getTranslation(lang, 'markTaken')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. AAROGYA SETU 2.0 VISUAL PILL BOX (RURAL / ILLITERATE ACCESSIBLE) */}
        {activeSection === 'pillbox' && (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-950 via-slate-900 to-blue-950 border border-emerald-500/40 space-y-1">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{getTranslation(lang, 'visualPillBoxTitle')}</span>
              </h3>
              <p className="text-[11px] text-slate-300">{getTranslation(lang, 'visualPillBoxSub')}</p>
            </div>

            {/* Time Slot Groups */}
            {[
              { slot: 'morning', title: getTranslation(lang, 'morningSlot'), icon: Sunrise, color: 'text-amber-400', time: '08:00 AM' },
              { slot: 'afternoon', title: getTranslation(lang, 'afternoonSlot'), icon: Sun, color: 'text-yellow-300', time: '01:30 PM' },
              { slot: 'night', title: getTranslation(lang, 'nightSlot'), icon: Moon, color: 'text-sky-300', time: '09:30 PM' }
            ].map((slotInfo) => {
              const SlotIcon = slotInfo.icon;
              return (
                <div key={slotInfo.slot} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-800">
                        <SlotIcon className={`w-4 h-4 ${slotInfo.color}`} />
                      </div>
                      <span className="text-xs font-bold text-white">{slotInfo.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{slotInfo.time}</span>
                  </div>

                  {/* Pills inside slot */}
                  <div className="space-y-2">
                    {medications.map((med, idx) => {
                      const visual = getPillVisual(med.name, idx);
                      const medName = getLocalizedField(med, 'name', lang);
                      const medTiming = getLocalizedField(med, 'timing', lang);
                      const isSpeaking = speakingId === `pill-${med.id}`;

                      return (
                        <div
                          key={med.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 gap-3"
                        >
                          {/* Visual Pill Metaphor */}
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`flex items-center justify-center text-[10px] shadow-md flex-shrink-0 ${visual.shape}`}>
                              {visual.label}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{medName}</h4>
                              <p className="text-[10px] text-slate-400">{getLocalizedField(med, 'dosage', lang)} • {medTiming}</p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSpeak(`pill-${med.id}`, `${medName}. ${getLocalizedField(med, 'dosage', lang)}. ${medTiming}`)}
                              className="p-2 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700 transition-colors"
                              title={getTranslation(lang, 'pillAudioGuide')}
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onToggleMedicationTaken(med.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                                med.takenToday
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-950 active:scale-95'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{med.takenToday ? getTranslation(lang, 'pillTakenDone') : getTranslation(lang, 'takePillNow')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. UNIVERSAL VACCINE PASSPORT (CoWIN / U-WIN) */}
        {activeSection === 'vaccines' && (
          <div className="space-y-3">
            {/* Vaccine Pass Header */}
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{getTranslation(lang, 'vaccineCertTitle')}</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {getTranslation(lang, 'abhaVerifiedBadge')}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">{getTranslation(lang, 'vaccineCertSub')}</p>
            </div>

            {/* Vaccine Cards */}
            {patientVaccines.map((vac) => {
              const vacName = getLocalizedField(vac, 'vaccineName', lang);
              const vacDose = getLocalizedField(vac, 'doseNumber', lang);
              const vacFacility = getLocalizedField(vac, 'facility', lang);
              const isCompleted = vac.status === 'COMPLETED';

              return (
                <div
                  key={vac.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 shadow-sm ${
                    isCompleted
                      ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      : 'bg-amber-950/30 border-amber-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white">{vacName}</h4>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-300 animate-pulse'
                          }`}
                        >
                          {isCompleted ? `✓ ${getTranslation(lang, 'doseCompleted')}` : `⏰ ${getTranslation(lang, 'doseDue')}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{vacDose}</p>
                    </div>

                    <button
                      onClick={() => speakText(`${vacName}. ${vacDose}. ${vacFacility}`, lang)}
                      className="p-2 rounded-xl bg-slate-800 text-emerald-400 hover:bg-slate-700"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <p>📍 <strong>{getTranslation(lang, 'district')}:</strong> {vacFacility}</p>
                    <p>📅 <strong>Date:</strong> {isCompleted ? vac.dateAdministered : `Due by ${vac.dueDate}`}</p>
                    <p className="text-[10px] font-mono text-emerald-400">
                      🔖 {getTranslation(lang, 'beneficiaryLabel')}: {vac.beneficiaryRef}
                    </p>
                  </div>

                  {isCompleted && (
                    <div className="pt-2 border-t border-slate-800 flex gap-2">
                      <button
                        onClick={() => setSelectedVaccineCert(vac)}
                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{getTranslation(lang, 'viewQr')}</span>
                      </button>
                      <button
                        onClick={() => handleDownloadCert(vac)}
                        className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{getTranslation(lang, 'downloadVaccineCert')}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 4. OBSERVATIONS & LABS SECTION */}
        {activeSection === 'observations' && (
          <div className="space-y-3">
            {observations.map((obs) => {
              const isSpeaking = speakingId === obs.id;
              const obsDisplay = getLocalizedField(obs, 'display', lang);
              const obsMeaning = getLocalizedField(obs, 'clinicalMeaning', lang);
              const spokenText = `${obsDisplay}: ${obs.value} ${obs.unit}. ${obsMeaning}`;

              return (
                <div
                  key={obs.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white">
                          {obsDisplay}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400">
                          {obs.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {getTranslation(lang, 'normalRange')}: {obs.referenceRange}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSpeak(obs.id, spokenText)}
                      className={`p-2 rounded-xl border transition-all ${
                        isSpeaking
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title={getTranslation(lang, 'readAloud')}
                    >
                      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>

                  {/* Primary Metric Display */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400">({obs.effectiveDateTime})</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-white">{obs.value}</span>
                        <span className="text-xs text-slate-400">{obs.unit}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        obs.interpretation === 'normal'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {obs.interpretation === 'normal' ? `✓ ${getTranslation(lang, 'normalStatus')}` : `▲ ${getTranslation(lang, 'elevatedStatus')}`}
                    </span>
                  </div>

                  {/* History sparkline bar visualizer */}
                  {obs.history && obs.history.length > 1 && (
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">{getTranslation(lang, 'trendHistory')}:</p>
                      <div className="flex items-end gap-2 h-10 p-2 rounded-lg bg-slate-950/50 border border-slate-800/60">
                        {obs.history.map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-slate-400 font-mono">{h.value}</span>
                            <div
                              className="w-full bg-emerald-500/80 rounded-t"
                              style={{
                                height: `${Math.max(20, Math.min(100, (h.value / (obs.value * 1.3)) * 100))}%`
                              }}
                            />
                            <span className="text-[8px] text-slate-500">{h.date.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plain Language Interpretation for Low Literacy */}
                  {obsMeaning && (
                    <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300 leading-relaxed">
                      💡 <strong>{getTranslation(lang, 'explanation')}:</strong> {obsMeaning}
                    </div>
                  )}

                  {/* Provenance */}
                  <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{getTranslation(lang, 'provenanceSource')}: {obs.sourceFacility}</span>
                    <span className="text-emerald-400 font-mono">Verified</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. CONDITIONS SECTION */}
        {activeSection === 'conditions' && (
          <div className="space-y-3">
            {conditions.map((cond) => {
              const isSpeaking = speakingId === cond.id;
              const condDisplay = getLocalizedField(cond, 'display', lang);
              const condNotes = getLocalizedField(cond, 'notes', lang);
              const spokenText = `${condDisplay}. ${condNotes}`;

              return (
                <div
                  key={cond.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white">
                          {condDisplay}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-blue-400">
                          {cond.code}
                        </span>
                      </div>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        {cond.clinicalStatus.toUpperCase()} • {cond.verificationStatus}
                      </span>
                    </div>

                    <button
                      onClick={() => handleSpeak(cond.id, spokenText)}
                      className={`p-2 rounded-xl border transition-all ${
                        isSpeaking
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title={getTranslation(lang, 'readAloud')}
                    >
                      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>

                  {condNotes && (
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
                      🩺 <strong>{getTranslation(lang, 'doctorAdvice')}:</strong> {condNotes}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{cond.recordedDate} · {cond.sourceFacility}</span>
                    <span className="text-slate-300">{cond.doctorName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 6. DOCUMENTS SECTION */}
        {activeSection === 'documents' && (
          <div className="space-y-3">
            {documents.map((doc) => {
              const docTitle = getLocalizedField(doc, 'title', lang);
              const docSummary = getLocalizedField(doc, 'summary', lang);

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                          {docTitle}
                        </h4>
                        <p className="text-[11px] text-slate-400">{doc.facility} • {doc.date}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors mt-2" />
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2">
                    {docSummary}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <div className="flex gap-1">
                      {doc.tags.map((t, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          #{t}
                        </span>
                      ))}
                    </div>
                    <span className="font-mono">{doc.size}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {showCertToast && (
        <div className="fixed bottom-20 inset-x-6 z-50 p-3 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-2xl animate-bounce">
          <Check className="w-4 h-4" />
          <span>Vaccine Certificate Downloaded to ABDM DigiLocker</span>
        </div>
      )}

      {/* Vaccine QR Modal */}
      {selectedVaccineCert && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-between items-center text-center">
          <div className="w-full">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setSelectedVaccineCert(null)}
                className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300"
              >
                {getTranslation(lang, 'close')}
              </button>
            </div>

            <div className="w-56 h-56 mx-auto bg-white rounded-3xl p-4 flex items-center justify-center shadow-2xl mb-4">
              <QrCode className="w-full h-full text-slate-950" />
            </div>

            <h3 className="text-base font-bold text-white">{getLocalizedField(selectedVaccineCert, 'vaccineName', lang)}</h3>
            <p className="text-sm font-mono text-emerald-400 font-bold">{selectedVaccineCert.beneficiaryRef}</p>
            <p className="text-xs text-slate-400 mt-1">{selectedVaccineCert.certificateQr}</p>
          </div>

          <button
            onClick={() => setSelectedVaccineCert(null)}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-sm"
          >
            {getTranslation(lang, 'viewDetailsOrBack')}
          </button>
        </div>
      )}

      {/* Document Detail Preview Modal */}
      {selectedDoc && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-md p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{getTranslation(lang, 'tabRecordsDocs')}</h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                {getTranslation(lang, 'close')}
              </button>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h2 className="text-base font-bold text-white">
                {getLocalizedField(selectedDoc, 'title', lang)}
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Type</span>
                  <p className="text-slate-200 font-semibold">{selectedDoc.type}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Date</span>
                  <p className="text-slate-200 font-semibold">{selectedDoc.date}</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                {getLocalizedField(selectedDoc, 'summary', lang)}
              </p>
              <div className="text-[11px] text-slate-400 space-y-1">
                <p>📍 <strong>Facility:</strong> {selectedDoc.facility}</p>
                <p>👨‍⚕️ <strong>Doctor:</strong> {selectedDoc.doctor}</p>
                <p>🔒 <strong>ABDM DigiLocker:</strong> {getTranslation(lang, 'verifiedVault')}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedDoc(null)}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-950 transition-all"
          >
            {getTranslation(lang, 'viewDetailsOrBack')}
          </button>
        </div>
      )}
    </div>
  );
};
