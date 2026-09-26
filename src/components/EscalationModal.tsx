import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Hospital, Phone, Send, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import { ClinicalReviewState, LanguageCode } from '../types';
import { speakText, stopSpeaking } from '../utils/i18n';

interface EscalationModalProps {
  review: ClinicalReviewState;
  lang: LanguageCode;
  onSendMessageToClinician: (text: string) => Promise<void>;
  onOpenTeleconsultation: () => Promise<void>;
}

const label = (lang: LanguageCode, hi: string, en: string) => lang === 'hi' ? hi : en;

/** Server-backed clinician chat. Emergency cards follow the initial patient message. */
export const EscalationModal: React.FC<EscalationModalProps> = ({ review, lang, onSendMessageToClinician, onOpenTeleconsultation }) => {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [speakingMessage, setSpeakingMessage] = useState<number | null>(null);
  const [speakingGuidance, setSpeakingGuidance] = useState(false);
  const [showAllFacilities, setShowAllFacilities] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const facilitiesRef = useRef<HTMLElement>(null);
  const connected = review.clinicalChatState === 'CLINICIAN_CONNECTED';
  const fallbackVisible = review.teleconsultationOffered && !connected;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: fallbackVisible ? 0 : scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [review.messages, fallbackVisible]);
  useEffect(() => () => stopSpeaking(), []);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = replyText.trim();
    if (!message || sending) return;
    setSending(true); setActionError('');
    try { await onSendMessageToClinician(message); setReplyText(''); }
    catch { setActionError(label(lang, 'संदेश अभी नहीं भेजा जा सका। कृपया फिर प्रयास करें।', 'Your message could not be sent. Please try again.')); }
    finally { setSending(false); }
  };
  const openTeleconsultation = async () => {
    setActionError('');
    try { await onOpenTeleconsultation(); }
    catch { setActionError(label(lang, 'eSanjeevani खोलने में समस्या हुई।', 'Unable to open eSanjeevani.')); }
  };
  const speak = (text: string, index: number) => {
    if (speakingMessage === index) { stopSpeaking(); setSpeakingMessage(null); setSpeakingGuidance(false); return; }
    setSpeakingGuidance(false); setSpeakingMessage(index); speakText(text, lang, () => setSpeakingMessage(null));
  };
  const guidanceText = label(
    lang,
    'अगर आपकी हालत गंभीर है या तकलीफ बढ़ रही है, तो इंतजार न करें। तुरंत नजदीकी बड़े अस्पताल जाएं या एम्बुलेंस बुलाएं।',
    'If your condition is serious or getting worse, do not wait. Go to a nearby large hospital or call an ambulance now.',
  );
  const speakGuidance = () => {
    if (speakingGuidance) { stopSpeaking(); setSpeakingGuidance(false); return; }
    setSpeakingMessage(null); setSpeakingGuidance(true);
    speakText(guidanceText, lang, () => setSpeakingGuidance(false));
  };
  const visibleFacilities = showAllFacilities
    ? review.nearbyFacilities
    : review.nearbyFacilities.slice(0, 3);

  const emergencyGuidance = <section className="rounded-xl border border-red-400/35 bg-red-950/40 px-3 py-2.5 text-red-50">
    <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" /><div><b className="block text-xs">{label(lang, 'जरूरी सूचना', 'Important information')}</b><p className="mt-0.5 text-xs leading-relaxed">{guidanceText}</p><button type="button" onClick={speakGuidance} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-100 underline underline-offset-2">{speakingGuidance ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}{speakingGuidance ? label(lang, 'रोकें', 'Stop') : label(lang, 'सुनें', 'Listen')}</button></div></div>
  </section>;
  const fallbackCard = fallbackVisible ? <section className="rounded-xl border border-amber-300/30 bg-slate-900 p-3 space-y-3">
    <div><b className="text-sm text-amber-100">{label(lang, 'क्लिनिकल टीम अभी नहीं जुड़ पाई है।', 'The clinical team has not joined yet.')}</b><p className="mt-1 text-xs leading-relaxed text-slate-300">{label(lang, 'गंभीर तकलीफ में मदद लेने में देरी न करें। eSanjeevani आपात मदद की जगह नहीं है।', 'Do not delay getting help for serious symptoms. eSanjeevani does not replace emergency care.')}</p></div>
    <div className="grid grid-cols-3 gap-2"><a href="tel:108" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-red-400/45 bg-red-950/45 px-2 text-center text-xs font-bold text-red-50"><Phone className="h-4 w-4 shrink-0" />{label(lang, 'एम्बुलेंस बुलाएं', 'Call ambulance')}</a><button type="button" onClick={() => facilitiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-600 bg-slate-800 px-2 text-center text-xs font-semibold text-white"><Hospital className="h-4 w-4 shrink-0 text-emerald-300" />{label(lang, 'नजदीकी अस्पताल', 'Nearby hospitals')}</button><button type="button" onClick={() => void openTeleconsultation()} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-white px-2 text-center text-xs font-bold text-slate-900"><ExternalLink className="h-4 w-4 shrink-0" />{label(lang, 'eSanjeevani से बात करें', 'Talk to eSanjeevani')}</button></div>
    <section ref={facilitiesRef} className="grid gap-2 border-t border-slate-700 pt-3"><b className="text-xs text-slate-200">{label(lang, 'नजदीकी अस्पताल', 'Nearby hospitals')}</b>{review.nearbyFacilities.length === 0 && <p className="text-xs text-slate-400">{label(lang, 'इस जगह के लिए कोई उपयुक्त अस्पताल नहीं मिला। 108 पर कॉल करें या नजदीकी बड़े अस्पताल जाएं।', 'No suitable hospital was found for this area. Call 108 or go to a nearby large hospital.')}</p>}{visibleFacilities.map((facility, index) => <article key={`${facility.name}-${index}`} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs"><b className="block text-sm text-white">{facility.name}</b><p className="mt-0.5 text-slate-300">{[facility.district, facility.city, facility.state].filter(Boolean).join(', ')}</p>{(facility.hospitalType || facility.schemes.length > 0) && <p className="mt-1 text-slate-400">{[facility.hospitalType, facility.schemes.includes('AYUSHMAN_BHARAT') || facility.schemes.includes('PMJAY') ? 'PM-JAY listed' : ''].filter(Boolean).join(' • ')}</p>}<small className="mt-1 block text-amber-100">{facility.emergencyCapabilityVerified ? label(lang, 'आपात सुविधा की जानकारी स्रोत में दर्ज है। जाने से पहले पुष्टि कर लें।', 'The source lists emergency capability; please confirm before visiting.') : label(lang, 'जाने से पहले सुविधा की उपलब्धता की पुष्टि कर लें।', 'Please confirm availability with the facility before visiting.')}</small></article>)}{review.nearbyFacilities.length > 3 && <button type="button" onClick={() => setShowAllFacilities((value) => !value)} className="justify-self-start text-xs font-semibold text-emerald-300 underline underline-offset-2">{showAllFacilities ? label(lang, 'कम अस्पताल देखें', 'Show fewer hospitals') : label(lang, 'और अस्पताल देखें', 'See more hospitals')}</button>}</section>
  </section> : null;

  return <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
    <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-3 shadow-sm"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-300"><ShieldAlert className="h-5 w-5" /></span><div><h2 className="text-sm font-bold">{label(lang, '🚨 क्लिनिकल सहायता', '🚨 Clinical assistance')}</h2><p className={`text-xs ${connected ? 'text-emerald-300' : 'text-slate-400'}`}>{connected ? label(lang, '● क्लिनिकल टीम जुड़ गई है', '● Clinical team connected') : label(lang, '● क्लिनिकल टीम से कनेक्ट किया जा रहा है...', '● Connecting to the clinical team...')}</p></div></div></header>
    <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-950 px-4 py-3 pb-24 space-y-3">
      {!connected && !fallbackVisible && <section className="mx-auto max-w-sm rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-xs text-slate-300"><b className="text-slate-100">{label(lang, 'Clinician से कनेक्ट किया जा रहा है...', 'Connecting to a clinician...')}</b><p className="mt-1">{label(lang, 'आमतौर पर कुछ ही समय लगता है। गंभीर स्थिति में emergency care लेने में देरी न करें।', 'This usually takes only a short time. Do not delay emergency care if symptoms are severe.')}</p></section>}
      {review.messages.length === 0 && <><p className="mx-auto max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-3 text-center text-xs text-slate-300">{label(lang, 'आपका संदेश clinician को भेजा जा रहा है।', 'Your message is being sent to the clinician.')}</p>{emergencyGuidance}{fallbackCard}</>}
      {review.messages.map((message, index) => {
        const clinician = message.speaker === 'CLINICIAN'; const isSpeaking = speakingMessage === index;
        return <React.Fragment key={`${message.createdAt}-${index}`}><article className={`flex flex-col gap-1 ${clinician ? 'items-start' : 'items-end'}`}><b className={`text-[11px] ${clinician ? 'text-sky-300' : 'text-emerald-300'}`}>{clinician ? label(lang, 'क्लिनिकल टीम', 'Clinical team') : label(lang, 'आप', 'You')}</b><div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${clinician ? 'rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-100' : 'rounded-br-sm bg-emerald-600 text-white'}`}><p className="whitespace-pre-line">{message.text}</p><div className="mt-2 flex items-center justify-between gap-3 text-[10px] opacity-80"><span>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>{clinician && <button type="button" onClick={() => speak(message.text, index)} className="inline-flex items-center gap-1">{isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}{isSpeaking ? label(lang, 'रोकें', 'Stop') : label(lang, 'सुनें', 'Listen')}</button>}</div></div></article>{index === 0 && <>{emergencyGuidance}{fallbackCard}</>}</React.Fragment>;
      })}
    </main>
    <form onSubmit={send} className="absolute inset-x-0 bottom-0 flex shrink-0 gap-2 border-t border-slate-800 bg-slate-900/95 p-3 backdrop-blur"><input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder={label(lang, 'क्लिनिकल टीम को संदेश लिखें', 'Write a message to the clinical team')} className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none" /><button type="submit" disabled={sending || !replyText.trim()} className="rounded-xl bg-emerald-600 px-3 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>{actionError && <p role="alert" className="absolute bottom-[68px] left-3 right-3 rounded-lg border border-red-500/40 bg-red-950 p-2 text-xs text-red-100">{actionError}</p>}</form>
  </div>;
};
