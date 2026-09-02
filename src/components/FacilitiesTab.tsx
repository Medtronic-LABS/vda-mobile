import React, { useState } from 'react';
import { Building2, Award, QrCode, Phone, ShieldCheck, Search, Pill, Droplet, Check, ExternalLink, Volume2, Sparkles } from 'lucide-react';
import { Facility, HealthScheme, LanguageCode, PatientDemographics } from '../types';
import { JAN_AUSHADHI_MEDICINES, BLOOD_BANK_STOCK } from '../data/syntheticData';
import { getTranslation, speakText, getLocalizedField, playChime } from '../utils/i18n';

interface FacilitiesTabProps {
  facilities: Facility[];
  schemes: HealthScheme[];
  patient: PatientDemographics;
  lang: LanguageCode;
}

export const FacilitiesTab: React.FC<FacilitiesTabProps> = ({
  facilities,
  schemes,
  patient,
  lang
}) => {
  const [activeTab, setActiveTab] = useState<'facilities' | 'jan_aushadhi' | 'blood_bank' | 'schemes'>('facilities');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacilityForQr, setSelectedFacilityForQr] = useState<Facility | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [selectedBloodGroupFilter, setSelectedBloodGroupFilter] = useState<string>('ALL');

  const filteredFacilities = facilities.filter(f => {
    const q = searchQuery.toLowerCase();
    const name = (f.name || '').toLowerCase();
    const nameHi = f.nameHi || '';
    const nameTa = f.nameTa || '';
    const nameKn = f.nameKn || '';
    const type = (f.type || '').toLowerCase();
    return name.includes(q) || nameHi.includes(q) || nameTa.includes(q) || nameKn.includes(q) || type.includes(q);
  });

  const filteredJanAushadhi = JAN_AUSHADHI_MEDICINES.filter(ja => {
    const q = searchQuery.toLowerCase();
    const gen = (ja.genericName || '').toLowerCase();
    const genHi = ja.genericNameHi || '';
    const genTa = ja.genericNameTa || '';
    const genKn = ja.genericNameKn || '';
    const brand = (ja.marketBrandName || '').toLowerCase();
    const cat = (ja.category || '').toLowerCase();
    return gen.includes(q) || genHi.includes(q) || genTa.includes(q) || genKn.includes(q) || brand.includes(q) || cat.includes(q);
  });

  const filteredSchemes = schemes.filter(s => {
    const q = searchQuery.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const nameHi = s.nameHi || '';
    const nameTa = s.nameTa || '';
    const nameKn = s.nameKn || '';
    const shortCode = (s.shortCode || '').toLowerCase();
    return name.includes(q) || nameHi.includes(q) || nameTa.includes(q) || nameKn.includes(q) || shortCode.includes(q);
  });

  const filteredBloodStock = BLOOD_BANK_STOCK.filter(b => {
    if (selectedBloodGroupFilter === 'ALL') return true;
    return b.group === selectedBloodGroupFilter;
  });

  const handleGenerateOpdToken = (facility: Facility) => {
    playChime('start');
    setSelectedFacilityForQr(facility);
    const token = `ABDM-OPD-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedToken(token);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>{getTranslation(lang, 'tabFacilities')}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
              ABDM National Registry
            </span>
          </h1>
          <p className="text-[11px] text-slate-400">{getTranslation(lang, 'searchHospital')}</p>
        </div>
      </header>

      {/* Mode Switcher Tabs */}
      <div className="flex bg-slate-900/80 p-1.5 border-b border-slate-800 gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
        <button
          id="tab-btn-hospitals"
          onClick={() => {
            playChime('start');
            setActiveTab('facilities');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'facilities'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{getTranslation(lang, 'tabHospitals')}</span>
        </button>

        <button
          id="tab-btn-janaushadhi"
          onClick={() => {
            playChime('start');
            setActiveTab('jan_aushadhi');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'jan_aushadhi'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Pill className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
          <span>{getTranslation(lang, 'tabJanAushadhi')}</span>
        </button>

        <button
          id="tab-btn-bloodbank"
          onClick={() => {
            playChime('start');
            setActiveTab('blood_bank');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'blood_bank'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Droplet className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
          <span>{getTranslation(lang, 'tabBloodBank')}</span>
        </button>

        <button
          id="tab-btn-schemes"
          onClick={() => {
            playChime('start');
            setActiveTab('schemes');
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'schemes'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
          }`}
        >
          <Award className="w-3.5 h-3.5 flex-shrink-0 text-purple-300" />
          <span>{getTranslation(lang, 'tabSchemes')}</span>
        </button>
      </div>

      {/* Search Bar for Facilities & Jan Aushadhi */}
      {(activeTab === 'facilities' || activeTab === 'jan_aushadhi' || activeTab === 'schemes') && (
        <div className="flex-shrink-0 p-3 bg-slate-900/40 border-b border-slate-800/80">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'jan_aushadhi'
                  ? 'खोजें: मेटफॉर्मिन, टेल्मीसार्टन, ग्लिमेपिराइड...'
                  : activeTab === 'schemes'
                  ? 'खोजें: आयुष्मान, जननी सुरक्षा, पोषण...'
                  : getTranslation(lang, 'searchHospital')
              }
              className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 pb-8 min-h-0">
        {/* 1. FACILITIES LIST */}
        {activeTab === 'facilities' && (
          <div className="space-y-3">
            {filteredFacilities.map((fac) => {
              const facName = getLocalizedField(fac, 'name', lang);
              const facAddress = getLocalizedField(fac, 'address', lang);
              const facType = getLocalizedField(fac, 'type', lang);

              return (
                <div
                  key={fac.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {facName}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {facType}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          📍 {fac.distanceKm} {getTranslation(lang, 'distanceKm')}
                        </span>
                      </div>
                    </div>

                    {fac.hasEmergency24x7 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                        {getTranslation(lang, 'emergency24x7')}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300">
                    {facAddress}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <p>⏰ <strong>{getTranslation(lang, 'opdTimings') || 'OPD'}:</strong> {fac.opdTimings}</p>
                    {fac.availableBeds !== undefined && (
                      <p>🛏️ <strong>{getTranslation(lang, 'bedsAvailable')}:</strong> {fac.availableBeds}</p>
                    )}
                    <p className="text-emerald-400">
                      💳 <strong>{getTranslation(lang, 'coverage')}:</strong> {fac.schemesAccepted.join(', ')}
                    </p>
                  </div>

                  {/* Actions: Fast-Track OPD Check-in & Call */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <a
                      href={`tel:${fac.phone}`}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{getTranslation(lang, 'callHospital')}</span>
                    </a>

                    {fac.hasAbdmQrCheckin && (
                      <button
                        onClick={() => handleGenerateOpdToken(fac)}
                        className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition-all active:scale-95"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{getTranslation(lang, 'generateQrToken')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. JAN AUSHADHI GENERIC SAVINGS COMPARATOR */}
        {activeTab === 'jan_aushadhi' && (
          <div className="space-y-3">
            {/* Promotional Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-950/70 via-slate-900 to-emerald-950/60 border border-amber-500/30 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{getTranslation(lang, 'janAushadhiTitle')}</h3>
                  <p className="text-[11px] text-amber-300 font-medium">{getTranslation(lang, 'janAushadhiSub')}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-amber-500/20">
                📍 {getTranslation(lang, 'district')}: Sitapur / Varanasi Jan Aushadhi Kendra (Kendra Code: JA-7741)
              </p>
            </div>

            {/* Medicines List */}
            {filteredJanAushadhi.map((ja) => {
              const genName = getLocalizedField(ja, 'genericName', lang);
              const spokenInfo = `${genName}. ${getTranslation(lang, 'janAushadhiPriceLabel')} ₹${ja.janAushadhiPrice}. ${getTranslation(lang, 'marketPriceLabel')} ₹${ja.marketPrice}. ${getTranslation(lang, 'youSave')} ${ja.savingsPercentage}%`;

              return (
                <div
                  key={ja.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                        {ja.category}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1">
                        {genName}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Market Alternative: <strong className="text-slate-300">{ja.marketBrandName}</strong> • {ja.dosage}
                      </p>
                    </div>

                    <button
                      onClick={() => speakText(spokenInfo, lang)}
                      className="p-2 rounded-xl bg-slate-800 text-emerald-400 hover:bg-slate-700 transition-colors"
                      title={getTranslation(lang, 'readAloud')}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Price Comparison Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 line-through">{getTranslation(lang, 'marketPriceLabel')}</span>
                      <p className="font-bold text-slate-400 mt-0.5">₹{ja.marketPrice}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40">
                      <span className="text-[10px] text-emerald-300 font-bold">{getTranslation(lang, 'janAushadhiPriceLabel')}</span>
                      <p className="text-base font-extrabold text-emerald-400 mt-0.5">₹{ja.janAushadhiPrice}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/40">
                      <span className="text-[10px] text-amber-300 font-bold">{getTranslation(lang, 'youSave')}</span>
                      <p className="text-base font-black text-amber-400 mt-0.5">{ja.savingsPercentage}%</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> In Stock at Nearby Kendra
                    </span>
                    <a
                      href="tel:18001808080"
                      className="text-slate-300 hover:text-white font-semibold flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3 text-amber-400" /> Helpline
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. e-RaktKosh LIVE BLOOD BANK STOCK */}
        {activeTab === 'blood_bank' && (
          <div className="space-y-3">
            {/* Blood Bank Header */}
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-red-950 via-slate-900 to-slate-900 border border-red-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-black">
                    <Droplet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{getTranslation(lang, 'bloodBankLive')}</h3>
                    <p className="text-[11px] text-red-300">{getTranslation(lang, 'bloodBankSub')}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  LIVE SYNC
                </span>
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-red-500/20">
                🏥 District Hospital Blood Centre, Sitapur • Nodal In-Charge: 24x7 Helpline: 104
              </p>
            </div>

            {/* Blood Group Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {['ALL', 'A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'].map((bg) => (
                <button
                  key={bg}
                  onClick={() => setSelectedBloodGroupFilter(bg)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedBloodGroupFilter === bg
                      ? 'bg-red-500 text-white shadow-md shadow-red-950'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>

            {/* Stock Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {filteredBloodStock.map((b) => {
                const isCritical = b.status === 'CRITICAL';
                const isModerate = b.status === 'MODERATE';

                return (
                  <div
                    key={b.group}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isCritical
                        ? 'bg-red-950/40 border-red-500/40'
                        : isModerate
                        ? 'bg-amber-950/30 border-amber-500/30'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl font-black text-white">{b.group}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          isCritical
                            ? 'bg-red-500/20 text-red-400'
                            : isModerate
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <p className="text-2xl font-black text-white font-mono">
                      {b.unitsAvailable}{' '}
                      <span className="text-xs font-normal text-slate-400 font-sans">{getTranslation(lang, 'unitsAvail')}</span>
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Tested & Screened</span>
                      <a href="tel:104" className="text-red-400 font-bold hover:underline">
                        Request 📞
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. SCHEMES LIST */}
        {activeTab === 'schemes' && (
          <div className="space-y-3">
            {/* PM-JAY Linked Card Status */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> {getTranslation(lang, 'pmjayActiveStatus')}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  VERIFIED
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white">
                {getTranslation(lang, 'pmjayCoverAmount')}
              </h3>
              <p className="text-xs text-slate-300">
                {getTranslation(lang, 'pmjayLinkedDesc')}
              </p>
              <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-slate-300 flex justify-between">
                <span>{getTranslation(lang, 'cardHolder')}: {patient.name}</span>
                <span className="font-mono text-emerald-300">{patient.ayushmanCardNumber}</span>
              </div>
            </div>

            {/* Schemes Cards */}
            {filteredSchemes.map((scheme) => {
              const schemeName = getLocalizedField(scheme, 'name', lang);
              const schemeDesc = getLocalizedField(scheme, 'description', lang);
              const schemeElig = getLocalizedField(scheme, 'eligibility', lang);

              return (
                <div
                  key={scheme.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        {scheme.shortCode}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1">
                        {schemeName}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {schemeDesc}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                    <p className="text-emerald-400 font-semibold">
                      💰 <strong>{getTranslation(lang, 'coverage')}:</strong> {scheme.coverageAmount}
                    </p>
                    <p className="text-slate-300 text-[11px]">
                      👥 <strong>{getTranslation(lang, 'eligibility')}:</strong> {schemeElig}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      📄 <strong>{getTranslation(lang, 'documentsRequired')}:</strong> {scheme.requiredDocuments.join(', ')}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <a
                      href={`tel:${scheme.helpline}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{getTranslation(lang, 'emergencyHelpline')} {scheme.helpline}</span>
                    </a>

                    <button
                      onClick={() => speakText(schemeDesc, lang)}
                      className="text-xs text-emerald-400 font-bold hover:underline"
                    >
                      {getTranslation(lang, 'readAloud')} 🔊
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OPD QR Token Simulation Modal */}
      {selectedFacilityForQr && generatedToken && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-md p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{getTranslation(lang, 'opdTokenModalTitle')}</h3>
              <button
                onClick={() => setSelectedFacilityForQr(null)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                {getTranslation(lang, 'close')}
              </button>
            </div>

            <div className="mt-4 p-5 rounded-3xl bg-slate-900 border border-emerald-500/40 text-center space-y-3">
              <div className="w-40 h-40 mx-auto bg-white rounded-2xl p-2.5 flex items-center justify-center shadow-lg">
                <QrCode className="w-full h-full text-slate-950" />
              </div>

              <div>
                <span className="text-xs text-emerald-400 font-mono font-bold">ABDM Fast-Track Queue Pass</span>
                <h2 className="text-2xl font-black text-white font-mono">{generatedToken}</h2>
                <p className="text-xs text-slate-300 font-semibold">{getLocalizedField(selectedFacilityForQr, 'name', lang)}</p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs text-slate-300 space-y-1">
                <p>👤 <strong>{getTranslation(lang, 'cardHolder')}:</strong> {patient.name} ({patient.age}/{patient.gender})</p>
                <p>🆔 <strong>ABHA:</strong> {patient.abhaNumber}</p>
                <p>🩺 <strong>{getTranslation(lang, 'department')}:</strong> General Medicine & NCD Clinic</p>
                <p>📍 <strong>{getTranslation(lang, 'opdCheckin')}:</strong> {getTranslation(lang, 'expressAbdmDesk')}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedFacilityForQr(null)}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-950 transition-all"
          >
            {getTranslation(lang, 'done')}
          </button>
        </div>
      )}
    </div>
  );
};
