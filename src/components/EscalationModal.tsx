import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Phone, Send, Volume2, VolumeX, Activity } from 'lucide-react';
import { ChatMessage, ClinicalEscalationState, FhirObservation, LanguageCode, PatientDemographics } from '../types';
import { speakText, stopSpeaking, playChime, getTranslation } from '../utils/i18n';
import { getChatMessageText } from '../utils/vdaEngine';

interface EscalationModalProps {
  escalation: ClinicalEscalationState;
  patient: PatientDemographics;
  observations: FhirObservation[];
  lang: LanguageCode;
  onSendMessageToDoctor: (text: string) => void;
  onResolveEscalation: () => void;
}

export const EscalationModal: React.FC<EscalationModalProps> = ({
  escalation,
  lang,
  onSendMessageToDoctor,
  onResolveEscalation
}) => {
  const [replyText, setReplyText] = useState('');
  const [isAmbulanceDispatched, setIsAmbulanceDispatched] = useState(false);
  const [etaMinutes] = useState(12);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [escalation.chatHistory]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onSendMessageToDoctor(replyText.trim());
    setReplyText('');
  };

  const handleDispatchAmbulance = () => {
    playChime('alert');
    setIsAmbulanceDispatched(true);
  };

  const handleSpeak = (msg: ChatMessage) => {
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      setSpeakingMsgId(msg.id);
      const textToSpeak = getChatMessageText(msg, lang);
      speakText(textToSpeak, lang, () => {
        setSpeakingMsgId(null);
      });
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Clinical Red Alert Banner */}
      <div className="p-3.5 bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-b-2 border-red-500 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white shadow-md animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-black tracking-wider uppercase text-red-200">
                {getTranslation(lang, 'doctorLiveTriage')}
              </h2>
              <p className="text-sm font-bold text-white leading-tight">
                {escalation.assignedDoctor.name} ({escalation.assignedDoctor.facility})
              </p>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-800 text-red-100 font-bold border border-red-400/40">
            {escalation.escalationId}
          </span>
        </div>

        {/* Doctor Credential Bar */}
        <div className="mt-2 pt-1.5 border-t border-red-400/30 flex items-center justify-between text-[11px] text-red-100">
          <span>🩺 Reg No: {escalation.assignedDoctor.regNo}</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Live Priority Channel Active
          </span>
        </div>
      </div>

      {/* Ambulance Dispatch & Vitals Snapshot Deck */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            id="call-108-ambulance-btn"
            onClick={handleDispatchAmbulance}
            className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
              isAmbulanceDispatched
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950 animate-bounce'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>{isAmbulanceDispatched ? `${getTranslation(lang, 'ambulanceEnRoute')} (ETA: ${etaMinutes}m)` : getTranslation(lang, 'callAmbulance')}</span>
          </button>

          <button
            onClick={onResolveEscalation}
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            title="Mark patient stabilized"
          >
            {getTranslation(lang, 'doctorResolved')}
          </button>
        </div>

        {/* Auto-transferred FHIR Vitals Summary Pill */}
        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-red-400" />
            <span><strong>Vitals Handover:</strong> BP 132/84 • HbA1c 7.8% • Metformin 500mg</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">Synced</span>
        </div>
      </div>

      {/* Main Escalation Chat Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 pb-24">
        {escalation.chatHistory.map((msg) => {
          const isUser = msg.sender === 'user';
          const isSystem = msg.sender === 'system';
          const isSpeaking = speakingMsgId === msg.id;
          const displayMsg = getChatMessageText(msg, lang);

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-center text-xs text-red-200"
              >
                <p className="font-semibold">{displayMsg}</p>
                <span className="text-[10px] text-red-400 font-mono mt-0.5 block">{msg.timestamp}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              {!isUser && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">
                    👨‍⚕️
                  </div>
                  <span className="text-xs font-bold text-rose-300">{escalation.assignedDoctor.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                    : 'bg-rose-950/80 border border-rose-500/40 text-rose-100 rounded-bl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-line font-medium">
                  {displayMsg}
                </p>

                {!isUser && (
                  <div className="mt-2 pt-1.5 border-t border-rose-500/20 flex items-center justify-between">
                    <button
                      onClick={() => handleSpeak(msg)}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg transition-all ${
                        isSpeaking
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-rose-900/60 text-rose-200 hover:bg-rose-900'
                      }`}
                    >
                      {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-rose-300" />}
                      <span>{isSpeaking ? getTranslation(lang, 'stopReading') : getTranslation(lang, 'doctorVoiceListen')}</span>
                    </button>
                    <span className="text-[10px] text-rose-400">AIIMS Tele-Triage</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Doctor Input Row */}
      <div className="absolute bottom-0 inset-x-0 bg-slate-950/95 border-t border-slate-800 p-3 flex items-center gap-2">
        <form onSubmit={handleSend} className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 focus-within:border-rose-500">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={getTranslation(lang, 'typeMessagePlaceholder')}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!replyText.trim()}
            className="p-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
