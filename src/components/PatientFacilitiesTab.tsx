import React, { useState } from 'react';
import {
  Award,
  Building2,
  ExternalLink,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Facility, HealthScheme, LanguageCode } from '../types';
import { playChime } from '../utils/i18n';

interface PatientFacilitiesTabProps {
  facilities: Facility[];
  schemes: HealthScheme[];
  scope: { state: string; district: string } | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  lang: LanguageCode;
  onRetry: () => void;
}

const copy = (lang: LanguageCode) => lang === 'hi' ? {
  title: 'अस्पताल व योजनाएँ', hospitals: 'अस्पताल', schemes: 'सरकारी योजनाएँ',
  search: 'नाम से खोजें', area: 'आपके दर्ज क्षेत्र से मेल खाने वाली सुविधाएँ',
  availability: 'जाने से पहले सेवा और वर्तमान उपलब्धता की पुष्टि सुविधा से करें।',
  areaMatched: 'क्षेत्र के आधार पर मिला', pmjay: 'PM-JAY सूचीबद्ध', call: 'कॉल करें',
  emptyFacilities: 'आपके दर्ज क्षेत्र के लिए अभी कोई स्रोत-समर्थित सुविधा नहीं मिली।',
  emptySchemes: 'आपके राज्य के लिए अभी कोई स्रोत-समर्थित योजना उपलब्ध नहीं है।',
  eligibility: 'पात्रता के लिए आधिकारिक सत्यापन जरूरी है।', documents: 'जरूरी दस्तावेज',
  application: 'आवेदन की जानकारी', official: 'आधिकारिक जानकारी', retry: 'फिर कोशिश करें',
  loading: 'स्रोत-समर्थित जानकारी लोड हो रही है…',
} : {
  title: 'Hospitals & Schemes', hospitals: 'Hospitals', schemes: 'Government schemes',
  search: 'Search by name', area: 'Facilities matched to your registered area',
  availability: 'Confirm the requested service and current availability before travelling.',
  areaMatched: 'Area matched', pmjay: 'PM-JAY listed', call: 'Call facility',
  emptyFacilities: 'No source-backed facility was found for your registered area.',
  emptySchemes: 'No source-backed scheme is currently available for your state.',
  eligibility: 'Eligibility requires official verification.', documents: 'Required documents',
  application: 'How to apply', official: 'Official information', retry: 'Try again',
  loading: 'Loading source-backed information…',
};

export const PatientFacilitiesTab: React.FC<PatientFacilitiesTabProps> = ({
  facilities, schemes, scope, status, error, lang, onRetry,
}) => {
  const [activeTab, setActiveTab] = useState<'facilities' | 'schemes'>('facilities');
  const [searchQuery, setSearchQuery] = useState('');
  const text = copy(lang);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredFacilities = facilities.filter((facility) =>
    !normalizedQuery || [facility.name, facility.facilityType, facility.district, facility.city]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)));
  const filteredSchemes = schemes.filter((scheme) =>
    !normalizedQuery || scheme.name.toLocaleLowerCase().includes(normalizedQuery));

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <h1 className="text-sm font-bold text-white">{text.title}</h1>
        {scope && <p className="text-[11px] text-slate-400">{scope.district}, {scope.state}</p>}
      </header>

      <div className="flex bg-slate-900/80 p-1.5 border-b border-slate-800 gap-1.5">
        <button onClick={() => { playChime('start'); setActiveTab('facilities'); }} className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${activeTab === 'facilities' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 bg-slate-950/40'}`}>
          <Building2 className="w-3.5 h-3.5" /> {text.hospitals}
        </button>
        <button onClick={() => { playChime('start'); setActiveTab('schemes'); }} className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${activeTab === 'schemes' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 bg-slate-950/40'}`}>
          <Award className="w-3.5 h-3.5" /> {text.schemes}
        </button>
      </div>

      <div className="p-3 bg-slate-900/40 border-b border-slate-800/80">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={text.search} className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-8">
        {status === 'loading' && <p className="text-sm text-slate-300">{text.loading}</p>}
        {status === 'error' && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 text-sm text-slate-300">
            <p>{error}</p>
            <button onClick={onRetry} className="mt-3 px-3 py-2 rounded-xl bg-slate-800 text-emerald-300 text-xs font-bold flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />{text.retry}</button>
          </div>
        )}

        {status === 'ready' && activeTab === 'facilities' && (
          <>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
              <p className="font-semibold text-emerald-300">{text.area}</p>
              <p className="mt-1">{text.availability}</p>
            </div>
            {!filteredFacilities.length && <p className="text-sm text-slate-400">{text.emptyFacilities}</p>}
            {filteredFacilities.map((facility) => (
              <article key={facility.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div>
                  <h3 className="text-sm font-bold text-white">{facility.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {facility.facilityType && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">{facility.facilityType}</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">{text.areaMatched}</span>
                    {facility.pmjayListed && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">{text.pmjay}</span>}
                  </div>
                </div>
                <p className="text-xs text-slate-300">{[facility.address, facility.city, facility.district, facility.state].filter(Boolean).join(', ')}</p>
                {facility.contactNumber && <a href={`tel:${facility.contactNumber}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold"><Phone className="w-3.5 h-3.5 text-emerald-400" />{text.call}</a>}
              </article>
            ))}
          </>
        )}

        {status === 'ready' && activeTab === 'schemes' && (
          <>
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-100 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" />{text.eligibility}</div>
            {!filteredSchemes.length && <p className="text-sm text-slate-400">{text.emptySchemes}</p>}
            {filteredSchemes.map((scheme) => (
              <article key={scheme.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-white">{scheme.name}</h3><span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">VERIFY ELIGIBILITY</span></div>
                {scheme.description && <p className="text-xs text-slate-300 leading-relaxed">{scheme.description}</p>}
                {scheme.benefitsDescription && <p className="text-xs text-slate-300">{scheme.benefitsDescription}</p>}
                {scheme.eligibilityCriteria && <p className="text-[11px] text-slate-300"><strong>{text.eligibility}</strong> {scheme.eligibilityCriteria}</p>}
                {!!scheme.requiredDocuments.length && <p className="text-[11px] text-slate-400"><strong>{text.documents}:</strong> {scheme.requiredDocuments.join(', ')}</p>}
                {scheme.applicationProcess && <p className="text-[11px] text-slate-400"><strong>{text.application}:</strong> {scheme.applicationProcess}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {scheme.helpline && <a href={`tel:${scheme.helpline}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-200"><Phone className="w-3.5 h-3.5" />{scheme.helpline}</a>}
                  {scheme.officialUrl && <a href={scheme.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-emerald-300"><ExternalLink className="w-3.5 h-3.5" />{text.official}</a>}
                </div>
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
