import React, { useState, useMemo } from 'react';
import { QrCode, Globe, ShieldCheck, RefreshCw, LogOut, Check, Download, Search, AlertTriangle, Award, Building, User } from 'lucide-react';
import { ConsentArtifact, LanguageCode, PatientDemographics, GoldPatientSummary } from '../types';
import { getTranslation, playChime, getLocalizedField } from '../utils/i18n';
import { GOLD_PATIENTS_LIST } from '../data/syntheticData';

interface ProfileTabProps {
  patient: PatientDemographics;
  consents: ConsentArtifact[];
  lang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
  onSwitchPersona: (personaKey: string) => void;
  onRevokeConsent: (consentId: string) => void;
  onResetSession: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  patient,
  consents,
  lang,
  onLangChange,
  onSwitchPersona,
  onRevokeConsent,
  onResetSession
}) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDownloadedToast, setShowDownloadedToast] = useState(false);
  const [showAllPatientsModal, setShowAllPatientsModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const handleDownloadCard = () => {
    playChime('success');
    setShowDownloadedToast(true);
    setTimeout(() => setShowDownloadedToast(false), 2500);
  };

  const patientDistrict = getLocalizedField(patient, 'district', lang);

  // 7 Primary Pilot Cases representing Gold Dataset categories
  const PILOT_CASES = [
    { id: 'synth-patient-001', name: 'Vijay Chauhan', meta: '61/M • NCD Glucose/BP • Solan, HP', category: 'NCD Glucose / BP' },
    { id: 'synth-patient-041', name: 'Kanta Devi', meta: '58/F • Prescription • Gurugram, HR', category: 'Prescription' },
    { id: 'synth-patient-071', name: 'Meena Kumari', meta: '52/F • Lab Explanation • Karnal, HR', category: 'Lab Explainer' },
    { id: 'synth-patient-101', name: 'Pradeep Saini', meta: '66/M • 🚨 Emergency Escalation • Una, HP', category: 'Escalation Alert', isEmergency: true },
    { id: 'synth-patient-126', name: 'Deepak Verma', meta: '49/M • PM-JAY Benefits • Shimla, HP', category: 'Scheme Entitled' },
    { id: 'synth-patient-146', name: 'Suman Devi', meta: '45/F • Facility Search • Faridabad, HR', category: 'Facility Search' },
    { id: 'synth-patient-161', name: 'Jaswinder Singh', meta: '63/M • Multilingual • Ambala, HR', category: 'Multilingual' }
  ];

  // Filtered 200 Gold Patients List
  const filteredPatients = useMemo(() => {
    return GOLD_PATIENTS_LIST.filter(p => {
      const q = patientSearch.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || p.abhaNumber.includes(q) || p.district.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      const matchCat = selectedCategoryFilter === 'ALL' || p.categoryCode === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [patientSearch, selectedCategoryFilter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>{getTranslation(lang, 'tabProfile')}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
              ABDM Verified
            </span>
          </h1>
          <p className="text-[11px] text-slate-400">{getTranslation(lang, 'abhaCardSub')}</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-4 pb-8 min-h-0">
        {/* OFFICIAL ABHA CARD METAPHOR */}
        <div className="p-5 rounded-3xl bg-gradient-to-tr from-slate-900 via-emerald-950/80 to-teal-900 border-2 border-emerald-500/50 shadow-xl shadow-emerald-950/40 relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">
                National Health Authority • ABDM
              </p>
              <h2 className="text-base font-extrabold text-white">{getTranslation(lang, 'abhaCardTitle')}</h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <QrCode className="w-6 h-6" />
            </div>
          </div>

          {/* Badges: Category, State & Entitlements */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {patient.goldCategory && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                ⭐ {patient.goldCategory}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
              📍 {patient.district}, {patient.state}
            </span>
            {patient.pmjayEligible && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40">
                🏆 PM-JAY ₹5L Cashless
              </span>
            )}
            {patient.escalationTriggered && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 font-semibold border border-red-500/40 animate-pulse">
                🚨 Emergency Active
              </span>
            )}
          </div>

          {/* Patient Details */}
          <div className="space-y-1.5 mb-4">
            <h3 className="text-lg font-black text-white">{patient.name}</h3>
            <p className="text-xs font-mono font-bold text-emerald-300">
              {getTranslation(lang, 'abhaNumber')}: {patient.abhaNumber}
            </p>
            <p className="text-xs font-mono text-slate-300">
              {getTranslation(lang, 'abhaAddress')}: {patient.abhaAddress}
            </p>
          </div>

          <div className="pt-3 border-t border-emerald-500/30 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-1.5 rounded-lg bg-black/30">
              <span className="text-[10px] text-slate-400">{getTranslation(lang, 'ageGender')}</span>
              <p className="font-bold text-white">{patient.age} / {patient.gender === 'male' ? 'M' : 'F'}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-black/30">
              <span className="text-[10px] text-slate-400">{getTranslation(lang, 'bloodGroup')}</span>
              <p className="font-bold text-emerald-300">{patient.bloodGroup}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-black/30">
              <span className="text-[10px] text-slate-400">{getTranslation(lang, 'district')}</span>
              <p className="font-bold text-white">{patientDistrict}</p>
            </div>
          </div>

          {/* Action Row on Card */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex-1 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-white/20 transition-all"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{getTranslation(lang, 'viewQr')}</span>
            </button>
            <button
              onClick={handleDownloadCard}
              className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{getTranslation(lang, 'downloadCard')}</span>
            </button>
          </div>
        </div>

        {/* Download Success Toast */}
        {showDownloadedToast && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4" />
            <span>{getTranslation(lang, 'downloadSuccess')}</span>
          </div>
        )}

        {/* GOLD SYNTHETIC PATIENT SELECTOR (200 RECORDS) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>Gold Synthetic Patient Cases (200 Records)</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Himachal Pradesh & Haryana ABDM Cohort</p>
            </div>
            <button
              onClick={() => setShowAllPatientsModal(true)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/30 transition-all"
            >
              Browse All 200 ➔
            </button>
          </div>

          {/* Quick Pilot Selector Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PILOT_CASES.map((item) => {
              const isSelected = patient.id === item.id || (item.id === 'synth-patient-001' && patient.name.includes('Vijay'));
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    playChime('start');
                    onSwitchPersona(item.id);
                  }}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                      : item.isEmergency
                      ? 'bg-red-950/20 border-red-800/60 text-slate-300 hover:border-red-500'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white text-xs">{item.name}</p>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${item.isEmergency ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-slate-300'}`}>
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{item.meta}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* LANGUAGE SELECTOR */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>{getTranslation(lang, 'preferredLangTitle')}</span>
            </h3>
            <span className="text-[10px] text-slate-400">{getTranslation(lang, 'readyLangsSub')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { code: 'hi' as LanguageCode, label: 'हिन्दी (Hindi)' },
              { code: 'en' as LanguageCode, label: 'English' },
              { code: 'ta' as LanguageCode, label: 'தமிழ் (Tamil)' },
              { code: 'kn' as LanguageCode, label: 'ಕನ್ನಡ (Kannada)' }
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  onLangChange(l.code);
                  playChime('start');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${
                  lang === l.code
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <span>{l.label}</span>
                {lang === l.code && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* CONSENT ARTIFACTS MANAGEMENT */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{getTranslation(lang, 'consentManagement')}</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold">{consents.filter(c => c.status === 'ACTIVE').length} {getTranslation(lang, 'active')}</span>
          </div>

          <div className="space-y-2">
            {consents.map((consent) => {
              const consentPurpose = getLocalizedField(consent, 'purpose', lang);
              const consentScope = getLocalizedField(consent, 'scope', lang);

              return (
                <div
                  key={consent.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {consentPurpose}
                      </h4>
                      <p className="text-[10px] text-slate-400">{consent.grantedTo}</p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        consent.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {consent.status === 'ACTIVE' ? getTranslation(lang, 'active') : getTranslation(lang, 'revoked')}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    <strong>{getTranslation(lang, 'scope')}:</strong> {consentScope}
                  </p>

                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{getTranslation(lang, 'expires')}: {consent.expiryDate}</span>
                    {consent.status === 'ACTIVE' && (
                      <button
                        onClick={() => onRevokeConsent(consent.id)}
                        className="text-red-400 hover:text-red-300 font-semibold"
                      >
                        {getTranslation(lang, 'revokeConsent')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RESET / LOGOUT */}
        <button
          onClick={onResetSession}
          className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>{getTranslation(lang, 'resetSession')}</span>
        </button>
      </div>

      {/* FULL BROWSER MODAL FOR ALL 200 PATIENTS */}
      {showAllPatientsModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">VDA Gold Dataset (200 Patients)</h3>
              <p className="text-[11px] text-slate-400">Select any patient profile from Himachal Pradesh & Haryana</p>
            </div>
            <button
              onClick={() => setShowAllPatientsModal(false)}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
            >
              {getTranslation(lang, 'close')}
            </button>
          </div>

          {/* Search Bar & Category Filter */}
          <div className="py-3 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by name, ABHA (98-XXXX), district..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
              {[
                { code: 'ALL', label: 'All (200)' },
                { code: 'NCD_GLUCOSE_BP', label: 'NCD Glucose/BP (40)' },
                { code: 'EMERGENCY_ESCALATION', label: '🚨 Emergency (25)' },
                { code: 'PRESCRIPTION_INTERPRETATION', label: 'Prescription (30)' },
                { code: 'LAB_EXPLANATION', label: 'Lab Report (30)' },
                { code: 'SCHEME_BENEFITS', label: 'PM-JAY Schemes (20)' },
                { code: 'FACILITY_SEARCH', label: 'Facilities (15)' },
                { code: 'MULTILINGUAL_PARITY', label: 'Multilingual (40)' }
              ].map((c) => (
                <button
                  key={c.code}
                  onClick={() => setSelectedCategoryFilter(c.code)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategoryFilter === c.code
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patients List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredPatients.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  playChime('start');
                  onSwitchPersona(p.id);
                  setShowAllPatientsModal(false);
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  patient.id === p.id
                    ? 'bg-emerald-500/20 border-emerald-500'
                    : p.escalationTriggered
                    ? 'bg-slate-900 border-red-900/60 hover:border-red-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{p.name}</span>
                    <span className="text-[10px] text-slate-400">({p.age}/{p.gender === 'male' ? 'M' : 'F'})</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-semibold ${
                    p.escalationTriggered ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {p.goldCategory}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span className="font-mono text-emerald-400 font-semibold">{p.abhaNumber}</span>
                  <span>📍 {p.district}, {p.state}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  <strong>Conditions:</strong> {p.conditions.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Full Modal */}
      {showQrModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-between items-center text-center">
          <div className="w-full">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowQrModal(false)}
                className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300"
              >
                {getTranslation(lang, 'close')}
              </button>
            </div>

            <div className="w-64 h-64 mx-auto bg-white rounded-3xl p-4 flex items-center justify-center shadow-2xl mb-4">
              <QrCode className="w-full h-full text-slate-950" />
            </div>

            <h3 className="text-base font-bold text-white">{patient.name}</h3>
            <p className="text-sm font-mono text-emerald-400 font-bold">{patient.abhaNumber}</p>
            <p className="text-xs text-slate-400 mt-1">{patient.abhaAddress}</p>
          </div>

          <button
            onClick={() => setShowQrModal(false)}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-sm"
          >
            {getTranslation(lang, 'viewDetailsOrBack')}
          </button>
        </div>
      )}
    </div>
  );
};
