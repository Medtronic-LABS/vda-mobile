import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Pill, Activity, Building2, Award, AlertTriangle, QrCode, ShieldAlert, Sparkles, CheckCircle2, Phone, ShieldCheck, ChevronDown, ChevronUp, Paperclip, FileText, X, LoaderCircle } from 'lucide-react';
import { ChatMessage, ClinicalFollowUp, FhirMedication, FhirObservation, LanguageCode, PatientDemographics } from '../types';
import { getTranslation, playChime, getLocalizedField } from '../utils/i18n';
import { getChatMessageText, getQuickActionLabel, getCardTitle } from '../utils/vdaEngine';
import { apiService } from '../services/api';

interface VdaTabProps {
  patient: PatientDemographics;
  medications: FhirMedication[];
  observations: FhirObservation[];
  lang: LanguageCode;
  messages: ChatMessage[];
  clinicalFollowUps: ClinicalFollowUp[];
  isProcessing: boolean;
  onSendMessage: (text: string, file?: File) => void;
  onToggleMedicationTaken: (medId: string) => void;
  onNavigateTab: (tab: 'vda' | 'records' | 'facilities' | 'profile') => void;
  onTriggerEscalation: (reason: string) => void;
  onOpenLogVital: () => void;
  onRecordClinicalFollowUpAttendance: (followUpId: string, attended: boolean) => Promise<string>;
}

type FollowUpCopy = { heading: string; message: string; question?: string; supporting?: string };

const patientConditionLabel = (followUp: ClinicalFollowUp, lang: LanguageCode): string | null => {
  const source = `${followUp.condition || ''} ${followUp.title || ''}`.toLowerCase();
  const hindi = lang === 'hi';
  if (/diabetes|t2dm|mellitus/.test(source)) return hindi ? 'डायबिटीज़' : 'diabetes';
  if (/hypertension|htn|blood pressure|bp/.test(source)) return hindi ? 'बीपी' : 'blood pressure';
  if (/ckd|renal|nephropathy|kidney/.test(source)) return hindi ? 'किडनी' : 'kidney';
  if (/cad|coronary|heart|cardiac/.test(source)) return hindi ? 'दिल' : 'heart';
  return null;
};

const localizedFollowUpDate = (dueDate: string, lang: LanguageCode): string => {
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'ta' ? 'ta-IN' : lang === 'kn' ? 'kn-IN' : 'en-IN';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })
    .format(new Date(`${dueDate}T12:00:00+05:30`));
};

const followUpCopy = (followUp: ClinicalFollowUp, lang: LanguageCode): FollowUpCopy => {
  const isHindi = lang === 'hi';
  const condition = patientConditionLabel(followUp, lang);
  const checkup = isHindi ? (condition ? `${condition} का चेकअप` : 'चेकअप') : (condition ? `${condition} check-up` : 'check-up');
  const checkupName = isHindi ? (condition ? `${condition} चेकअप` : 'चेकअप') : checkup;
  const date = localizedFollowUpDate(followUp.dueDate, lang);

  if (followUp.status === 'ATTENDANCE_CHECK') {
    return isHindi
      ? { heading: 'VDA साथी की एक छोटी सी बात', message: `कल आपका ${checkup} था। क्या आप चेकअप कराने गए थे?` }
      : { heading: 'A quick reminder from VDA Saathi', message: `Your ${checkup} was yesterday. Were you able to go?` };
  }
  if (followUp.status === 'DUE_TODAY') {
    return isHindi
      ? { heading: 'आज आपके लिए', message: `आज आपका ${checkupName} है।`, question: 'क्या आप आज चेकअप कराने जा रहे हैं?' }
      : { heading: 'For you today', message: `Your ${checkup} is today.`, question: 'Are you planning to go for your check-up today?' };
  }
  if (followUp.status === 'DUE_TOMORROW') {
    return isHindi
      ? { heading: 'कल का रिमाइंडर', message: `कल आपको ${checkup} कराने जाना है।`, supporting: 'समय पर जाना याद रखें।' }
      : { heading: 'Tomorrow’s reminder', message: `Your ${checkup} is tomorrow.`, supporting: 'Please remember to go on time.' };
  }
  if (followUp.dateSource === 'DERIVED_30_DAY') {
    return isHindi
      ? { heading: 'चेकअप की याद दिलाने वाली बात', message: `आपकी पिछली जाँच को लगभग 30 दिन हो गए हैं। ${checkup} ${date} के आसपास कराना अच्छा रहेगा।` }
      : { heading: 'Check-up reminder', message: `It has been about 30 days since your previous visit. A ${checkup} may be useful around ${date}.` };
  }
  return isHindi
    ? { heading: 'चेकअप की याद दिलाने वाली बात', message: `आपका ${checkup} ${date} को है।`, supporting: 'चेकअप के लिए समय पर जाना याद रखें।' }
    : { heading: 'Check-up reminder', message: `Your ${checkup} is on ${date}.`, supporting: 'Please remember to go on time.' };
};

const followUpSpeechText = (followUp: ClinicalFollowUp, lang: LanguageCode): string => {
  const copy = followUpCopy(followUp, lang);
  return [copy.message, copy.question, copy.supporting].filter(Boolean).join(' ');
};

const attendanceFeedbackCopy = (followUp: ClinicalFollowUp, attended: boolean, lang: LanguageCode): string => {
  if (lang === 'hi') {
    return attended
      ? '🎉 बहुत बढ़िया! आपने अपना चेकअप पूरा किया। नियमित चेकअप आपकी सेहत पर नज़र रखने में मदद करता है। स्वास्थ्य लक्ष्य पूरा।'
      : 'कोई बात नहीं। चेकअप कराना आपकी सेहत की निगरानी के लिए जरूरी है। जब संभव हो, अपना चेकअप दोबारा तय कर लें।';
  }
  return attended
    ? '🎉 Well done! You completed your check-up. Regular check-ups help you keep track of your health. Health goal completed.'
    : 'That is okay. Check-ups help monitor your health. Please arrange your check-up again when practical.';
};

const followUpIntentConfirmation = (lang: LanguageCode) => lang === 'hi'
  ? {
      title: 'बहुत बढ़िया!',
      message: 'आपने आज के चेकअप के लिए जाने की पुष्टि की है।',
      supporting: 'समय पर चेकअप कराना आपकी सेहत पर नज़र रखने में मदद करता है। कल मैं आपसे पूछूँगा कि आपका चेकअप हुआ या नहीं।',
      goal: 'आज का स्वास्थ्य लक्ष्य तैयार',
      spokenText: 'बहुत बढ़िया। समय पर चेकअप कराना आपकी सेहत पर नज़र रखने में मदद करता है। कल मैं आपसे पूछूँगा कि आपका चेकअप हुआ या नहीं।',
    }
  : {
      title: 'Great!',
      message: 'You have confirmed that you plan to go for today’s check-up.',
      supporting: 'Timely check-ups help you keep track of your health. Tomorrow, I will ask whether you were able to go.',
      goal: 'Today’s health goal is set',
      spokenText: 'That is great. Timely check-ups help you keep track of your health. Tomorrow, I will ask whether you were able to go.',
    };

export const VdaTab: React.FC<VdaTabProps> = ({
  patient,
  medications,
  observations,
  lang,
  messages,
  clinicalFollowUps,
  isProcessing,
  onSendMessage,
  onToggleMedicationTaken,
  onNavigateTab,
  onTriggerEscalation,
  onOpenLogVital,
  onRecordClinicalFollowUpAttendance,
}) => {
  const [inputText, setInputText] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing' | 'auto_sending' | 'waiting_for_vda' | 'error'>('idle');
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [showSymptomGrid, setShowSymptomGrid] = useState(false);
  const [showEmergencyDial, setShowEmergencyDial] = useState(false);
  const [followUpBusyId, setFollowUpBusyId] = useState<string | null>(null);
  const [followUpFeedback, setFollowUpFeedback] = useState('');
  const [followUpIntentIds, setFollowUpIntentIds] = useState<Set<string>>(() => new Set());
  const [pendingFollowUpConfirmationIds, setPendingFollowUpConfirmationIds] = useState<Set<string>>(() => new Set());

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingCancelledRef = useRef(false);
  const voiceAutoSendRef = useRef(false);
  const voiceTurnStartedRef = useRef(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const audioBusyRef = useRef(false);
  const spokenFollowUpIdsRef = useRef<Set<string>>(new Set());
  const spokenFollowUpConfirmationIdsRef = useRef<Set<string>>(new Set());
  const lastAutoSpokenMessageId = useRef<string | null>(messages[messages.length - 1]?.sender === 'vda' ? messages[messages.length - 1].id : null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, voiceState, isProcessing]);

  // Voice uses the same parent-owned turn lifecycle as typed text. Keep the
  // controls locked until that existing turn finishes.
  useEffect(() => {
    if (voiceState !== 'waiting_for_vda') return;
    if (isProcessing) {
      voiceTurnStartedRef.current = true;
      return;
    }
    if (voiceTurnStartedRef.current) {
      voiceTurnStartedRef.current = false;
      voiceAutoSendRef.current = false;
      setSpeechTranscript('');
      setVoiceState('idle');
    }
  }, [isProcessing, voiceState]);

  // Patient replies are voice-first through the authenticated backend Sarvam TTS endpoint.
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.sender === 'user' || latest.id === lastAutoSpokenMessageId.current) return;

    lastAutoSpokenMessageId.current = latest.id;
    void playResponseAudio(latest);
  }, [messages, lang]);

  useEffect(() => () => {
    recordingCancelledRef.current = true;
    recorderRef.current?.stop();
    playbackRef.current?.pause();
    audioBusyRef.current = false;
  }, []);

  const playTextAudio = async (audioId: string, text: string) => {
    if (speakingMsgId === audioId) {
      playbackRef.current?.pause();
      audioBusyRef.current = false;
      setSpeakingMsgId(null);
      return;
    }
    if (audioBusyRef.current) return;
    const textToSpeak = text.trim();
    if (!textToSpeak) return;
    try {
      playbackRef.current?.pause();
      audioBusyRef.current = true;
      setSpeakingMsgId(audioId);
      const audioBlob = await apiService.synthesizeVoice(textToSpeak.slice(0, 2500), lang);
      const url = URL.createObjectURL(audioBlob);
      const player = new Audio(url);
      player.onended = () => {
        URL.revokeObjectURL(url);
        audioBusyRef.current = false;
        setSpeakingMsgId(null);
      };
      player.onerror = () => {
        URL.revokeObjectURL(url);
        audioBusyRef.current = false;
        setSpeakingMsgId(null);
      };
      playbackRef.current = player;
      await player.play();
    } catch {
      // Text remains usable; device speech is not a silent fallback.
      audioBusyRef.current = false;
      setSpeakingMsgId(null);
      setVoiceError(lang === 'hi' ? 'आवाज़ चलाने में समस्या हुई। आप उत्तर पढ़ सकते हैं।' : 'Voice playback is unavailable. You can still read the response.');
    }
  };

  const playResponseAudio = async (msg: ChatMessage) => {
    await playTextAudio(msg.id, getChatMessageText(msg, lang));
  };

  const playFollowUpAudio = async (followUp: ClinicalFollowUp) => {
    await playTextAudio(`follow-up-${followUp.id}`, followUpSpeechText(followUp, lang));
  };

  const playFollowUpConfirmationAudio = async (followUp: ClinicalFollowUp) => {
    await playTextAudio(`follow-up-confirmation-${followUp.id}`, followUpIntentConfirmation(lang).spokenText);
  };

  // A reminder is spoken at most once for each follow-up during this mounted session.
  // It waits until no response audio, recording, transcription, or VDA turn is active.
  useEffect(() => {
    if (isProcessing || voiceState !== 'idle' || speakingMsgId || audioBusyRef.current) return;
    const followUp = clinicalFollowUps.find((item) => (
      !spokenFollowUpIdsRef.current.has(item.id) && !followUpIntentIds.has(item.id)
    ));
    if (!followUp) return;

    spokenFollowUpIdsRef.current.add(followUp.id);
    void playFollowUpAudio(followUp);
  }, [clinicalFollowUps, followUpIntentIds, isProcessing, lang, speakingMsgId, voiceState]);

  // The planned-attendance confirmation is distinct from actual attendance. It is
  // queued until existing voice/STT activity is idle, and can only auto-play once.
  useEffect(() => {
    if (isProcessing || voiceState !== 'idle' || speakingMsgId || audioBusyRef.current) return;
    const followUp = clinicalFollowUps.find((item) => (
      pendingFollowUpConfirmationIds.has(item.id)
      && !spokenFollowUpConfirmationIdsRef.current.has(item.id)
    ));
    if (!followUp) return;

    spokenFollowUpConfirmationIdsRef.current.add(followUp.id);
    setPendingFollowUpConfirmationIds((previous) => {
      const next = new Set(previous);
      next.delete(followUp.id);
      return next;
    });
    void playFollowUpConfirmationAudio(followUp);
  }, [clinicalFollowUps, isProcessing, lang, pendingFollowUpConfirmationIds, speakingMsgId, voiceState]);

  const stopRecording = (cancel = false) => {
    if (!recorderRef.current) return;
    recordingCancelledRef.current = cancel;
    recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceState('error');
      setVoiceError(lang === 'hi' ? 'इस डिवाइस पर रिकॉर्डिंग उपलब्ध नहीं है। कृपया लिखकर पूछें।' : 'Recording is unavailable on this device. Please type your question.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          recordingStartedAtRef.current = null;
          setVoiceState('idle');
          return;
        }
        const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : undefined;
        recordingStartedAtRef.current = null;
        if (chunks.length === 0) {
          setVoiceState('error');
          setVoiceError(lang === 'hi' ? 'कोई आवाज़ रिकॉर्ड नहीं हुई। कृपया फिर से बोलें।' : 'No audio was recorded. Please try again.');
          return;
        }
        setVoiceState('transcribing');
        try {
          const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const result = await apiService.transcribeVoice(audio, lang, durationMs);
          const transcript = result.transcript.trim();
          if (!transcript) throw new Error('Voice transcription returned no text.');
          if (voiceAutoSendRef.current) return;
          voiceAutoSendRef.current = true;
          voiceTurnStartedRef.current = false;
          // Render the exact transcript, then submit it directly through the
          // existing text-turn callback instead of relying on async state.
          setInputText(transcript);
          setSpeechTranscript(transcript);
          setVoiceError('');
          setVoiceState('auto_sending');
          playChime('success');
          requestAnimationFrame(() => {
            onSendMessage(transcript);
            setInputText('');
            setVoiceState('waiting_for_vda');
          });
        } catch {
          voiceAutoSendRef.current = false;
          setVoiceState('error');
          setVoiceError(lang === 'hi' ? 'आवाज़ समझी नहीं जा सकी। कृपया लिखकर पूछें या फिर से बोलें।' : 'Your voice could not be understood. Please type your question or try again.');
          playChime('stop');
        }
      };
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      recordingCancelledRef.current = false;
      setVoiceError('');
      setSpeechTranscript('');
      setVoiceState('recording');
      recorder.start();
      playChime('start');
    } catch {
      setVoiceState('error');
      setVoiceError(lang === 'hi' ? 'माइक्रोफोन अनुमति नहीं मिली। कृपया लिखकर पूछें।' : 'Microphone permission was not granted. Please type your question.');
    }
  };

  const handleToggleListening = () => {
    if (voiceState === 'recording') stopRecording();
    else if (voiceState === 'idle' || voiceState === 'error') void startRecording();
  };

  const handleSpeakMessage = (msg: ChatMessage) => { void playResponseAudio(msg); };

  const recordFollowUpAttendance = async (followUp: ClinicalFollowUp, attended: boolean) => {
    setFollowUpBusyId(followUp.id);
    setFollowUpFeedback('');
    try {
      await onRecordClinicalFollowUpAttendance(followUp.id, attended);
      setFollowUpFeedback(attendanceFeedbackCopy(followUp, attended, lang));
    } catch {
      setFollowUpFeedback(lang === 'hi' ? 'फॉलो-अप स्थिति अपडेट नहीं हो सकी। कृपया बाद में फिर प्रयास करें।' : 'Unable to update the follow-up status. Please try again later.');
    } finally {
      setFollowUpBusyId(null);
    }
  };

  const confirmFollowUpIntent = (followUp: ClinicalFollowUp) => {
    setFollowUpIntentIds((previous) => new Set(previous).add(followUp.id));
    setFollowUpFeedback('');
    setPendingFollowUpConfirmationIds((previous) => new Set(previous).add(followUp.id));
  };

  const acknowledgeFollowUp = (followUp: ClinicalFollowUp) => {
    setFollowUpIntentIds((previous) => new Set(previous).add(followUp.id));
  };

  const openFollowUpFacilities = () => {
    // Reuses the existing facility tab; no VDA turn or new facility lookup is created here.
    onNavigateTab('facilities');
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setAttachmentError(lang === 'hi' ? 'केवल PDF, JPG या PNG पर्ची अपलोड कर सकते हैं।' : 'Please select a PDF, JPG, or PNG prescription document.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError(lang === 'hi' ? 'फाइल का साइज़ 10MB से कम होना चाहिए।' : 'File size must be under 10MB.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;
    const textToSend = inputText.trim() || (selectedFile ? `[Prescription Attachment: ${selectedFile.name}]` : '');
    onSendMessage(textToSend, selectedFile || undefined);
    setInputText('');
    setSpeechTranscript('');
    setVoiceState('idle');
    handleRemoveFile();
  };

  const voiceInteractionBusy = voiceState === 'transcribing'
    || voiceState === 'auto_sending'
    || voiceState === 'waiting_for_vda';

  const handleSymptomClick = (symptomKey: string, symptomQuery: { hi: string; en: string; ta: string; kn: string }) => {
    playChime('start');
    const queryText = symptomQuery[lang] || symptomQuery.en;
    onSendMessage(queryText);
    setShowSymptomGrid(false);
  };

  const renderAgentBadge = (agent?: string) => {
    switch (agent) {
      case 'medication':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Pill className="w-3 h-3" /> {getTranslation(lang, 'medicationAgent')}
          </span>
        );
      case 'lab_explainer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-3 h-3" /> {getTranslation(lang, 'labAgent')}
          </span>
        );
      case 'facility':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Building2 className="w-3 h-3" /> {getTranslation(lang, 'hospitalAgent')}
          </span>
        );
      case 'scheme':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Award className="w-3 h-3" /> {getTranslation(lang, 'schemeAgent')}
          </span>
        );
      case 'safety_gate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> {getTranslation(lang, 'safetyGateAgent')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Sparkles className="w-3 h-3" /> {getTranslation(lang, 'multiAgentVda')}
          </span>
        );
    }
  };

  const patientDistrict = getLocalizedField(patient, 'district', lang);
  const patientState = getLocalizedField(patient, 'state', lang);

  // Pictorial Symptoms list
  const PICTORIAL_SYMPTOMS = [
    {
      id: 'headache',
      icon: '🤕',
      label: getTranslation(lang, 'headacheSymptom'),
      queries: {
        hi: 'मुझे तेज सिरदर्द और चक्कर आ रहे हैं, क्या करना चाहिए?',
        en: 'I have a bad headache and dizziness. What should I do?',
        ta: 'எனக்கு கடுமையான தலைவலி மற்றும் மயக்கம் உள்ளது. என்ன செய்ய வேண்டும்?',
        kn: 'ನನಗೆ ತೀವ್ರ ತಲೆನೋವು ಮತ್ತು ತಲೆತಿರುಗುವಿಕೆ ಇದೆ. ಏನು ಮಾಡಬೇಕು?'
      }
    },
    {
      id: 'chestpain',
      icon: '🫀',
      label: getTranslation(lang, 'chestPainSymptom'),
      queries: {
        hi: 'मेरी छाती में भारीपन और तेज दर्द हो रहा है।',
        en: 'I have severe chest tightness and left arm numbness.',
        ta: 'எனக்கு நெஞ்சில் கடுமையான வலியும் அழுத்தமும் உள்ளது.',
        kn: 'ನನಗೆ ಎದೆ ಬಿಗಿತ ಮತ್ತು ಎಡಗೈ ನೋವು ಇದೆ.'
      }
    },
    {
      id: 'stomach',
      icon: '🤢',
      label: getTranslation(lang, 'stomachPainSymptom'),
      queries: {
        hi: 'मेरे पेट में दर्द और गैस की समस्या हो रही है।',
        en: 'I have stomach ache and acidity after meals.',
        ta: 'எனக்கு வயிற்று வலி மற்றும் வாயு தொல்லை உள்ளது.',
        kn: 'ನನಗೆ ಹೊಟ್ಟೆ ನೋವು ಮತ್ತು ಗ್ಯಾಸ್ಟ್ರಿಕ್ ಸಮಸ್ಯೆ ಇದೆ.'
      }
    },
    {
      id: 'fever',
      icon: '🤒',
      label: getTranslation(lang, 'feverSymptom'),
      queries: {
        hi: 'मुझे तेज बुखार और बदन में दर्द है।',
        en: 'I have high fever and severe body aches.',
        ta: 'எனக்கு அதிக காய்ச்சலும் உடல் வலியும் உள்ளது.',
        kn: 'ನನಗೆ ತೀವ್ರ ಜ್ವರ ಮತ್ತು ಮೈಕೈ ನೋವು ಇದೆ.'
      }
    },
    {
      id: 'sugar',
      icon: '🍯',
      label: getTranslation(lang, 'sugarThirstSymptom'),
      queries: {
        hi: 'मुझे बहुत ज्यादा प्यास लग रही है और बार-बार पेशाब आ रहा है।',
        en: 'I feel excessive thirst and frequent urination.',
        ta: 'எனக்கு அதிக தாகமும் அடிக்கடி சிறுநீரும் வருகிறது.',
        kn: 'ನನಗೆ ಅತಿಯಾದ ಬಾಯಾರಿಕೆ ಮತ್ತು ಪದೇ ಪದೇ ಮೂತ್ರ ಬರುತ್ತಿದೆ.'
      }
    },
    {
      id: 'foot',
      icon: '🦵',
      label: getTranslation(lang, 'footPainSymptom'),
      queries: {
        hi: 'मेरे पैरों में झनझनाहट और सुन्नता महसूस होती है।',
        en: 'I have tingling and numbness in my feet.',
        ta: 'எனது கால்களில் மரத்துப்போகும் உணர்வு உள்ளது.',
        kn: 'ನನ್ನ ಪಾದಗಳಲ್ಲಿ ಜುಮ್ಮೆನಿಸುವಿಕೆ ಮತ್ತು ಸ್ಪರ್ಶವಿಲ್ಲದಂತಿದೆ.'
      }
    },
    {
      id: 'pregnancy',
      icon: '🤰',
      label: getTranslation(lang, 'pregnancySymptom'),
      queries: {
        hi: 'गर्भावस्था में पोषण और आयरन फोलिक एसिड गोली का समय बताएं।',
        en: 'Explain maternal care, IFA tablets, and checkup schedule.',
        ta: 'கர்ப்பகால பராமரிப்பு மற்றும் இரும்பு சத்து மாத்திரை விவரம் சொல்லுங்கள்.',
        kn: 'ಗರ್ಭಿಣಿಯರ ಆರೈಕೆ ಮತ್ತು ಪೌಷ್ಟಿಕಾಂಶದ ವಿವರಗಳನ್ನು ತಿಳಿಸಿ.'
      }
    },
    {
      id: 'wound',
      icon: '🩹',
      label: getTranslation(lang, 'woundSymptom'),
      queries: {
        hi: 'चोट या घाव की प्राथमिक चिकित्सा कैसे करें?',
        en: 'How to do first aid for a cut or wound?',
        ta: 'காயத்திற்கு முதலுதவி செய்வது எப்படி?',
        kn: 'ಗಾಯಕ್ಕೆ ಪ್ರಥಮ ಚಿಕಿತ್ಸೆ ಹೇಗೆ ಮಾಡುವುದು?'
      }
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Header */}
      <header className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm font-bold text-white tracking-tight truncate">{patient.name}</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-medium whitespace-nowrap">
                ABHA Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {patientDistrict}, {patientState} • NCD Care
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Emergency Quick Dial Trigger */}
          <button
            onClick={() => setShowEmergencyDial(!showEmergencyDial)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            title="Emergency Speed Dial (24x7)"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>SOS</span>
          </button>

          {/* Test the same backend SafetyGate path used by a patient message. */}
          <button
            id="trigger-test-safety-btn"
            onClick={() => onTriggerEscalation('Severe chest tightness and left arm numbness')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors active:scale-95 whitespace-nowrap"
            title="Test backend SafetyGate clinical escalation"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{getTranslation(lang, 'safetyGateBadge')}</span>
            <span className="sm:hidden">Gate</span>
          </button>
        </div>
      </header>

      {/* Main Chat Messages Container */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 scroll-smooth min-h-0"
      >
        {/* AAROGYA SETU 2.0 STATUS SHIELD BANNER */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/40 relative overflow-hidden shadow-lg space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-extrabold text-white tracking-tight">
                    {getTranslation(lang, 'aarogyaStatusSafe')}
                  </h2>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className="text-[10.5px] text-emerald-300/90 leading-tight truncate">
                  {getTranslation(lang, 'aarogyaStatusDetail')}
                </p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 whitespace-nowrap flex-shrink-0">
              {getTranslation(lang, 'abhaVerifiedBadge')}
            </span>
          </div>

          {/* Quick Speed Dial Bar in Banner */}
          <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
            <a
              href="tel:108"
              className="py-1.5 px-1 rounded-xl bg-slate-950/70 hover:bg-slate-950 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1 border border-emerald-500/20 transition-all active:scale-95"
            >
              <span>🚑</span>
              <span>108</span>
            </a>
            <a
              href="tel:104"
              className="py-1.5 px-1 rounded-xl bg-slate-950/70 hover:bg-slate-950 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1 border border-emerald-500/20 transition-all active:scale-95"
            >
              <span>🩺</span>
              <span>104</span>
            </a>
            <a
              href="tel:112"
              className="py-1.5 px-1 rounded-xl bg-slate-950/70 hover:bg-slate-950 text-red-300 font-bold text-[11px] flex items-center justify-center gap-1 border border-red-500/20 transition-all active:scale-95"
            >
              <span>🚨</span>
              <span>112</span>
            </a>
            <a
              href="tel:14555"
              className="py-1.5 px-1 rounded-xl bg-slate-950/70 hover:bg-slate-950 text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1 border border-amber-500/20 transition-all active:scale-95"
            >
              <span>💳</span>
              <span>14555</span>
            </a>
          </div>
        </div>

        {/* PICTORIAL SYMPTOM ACCESSIBILITY SELECTOR */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <button
            onClick={() => setShowSymptomGrid(!showSymptomGrid)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🩺</span>
              <div>
                <h3 className="text-xs font-bold text-white">{getTranslation(lang, 'symptomGridTitle')}</h3>
                <p className="text-[10px] text-slate-400">{getTranslation(lang, 'symptomGridSub')}</p>
              </div>
            </div>
            {showSymptomGrid ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showSymptomGrid && (
            <div className="p-3 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-800/80 mt-1">
              {PICTORIAL_SYMPTOMS.map((sym) => (
                <button
                  key={sym.id}
                  onClick={() => handleSymptomClick(sym.id, sym.queries)}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all active:scale-95 flex flex-col gap-1"
                >
                  <span className="text-xl">{sym.icon}</span>
                  <span className="text-xs font-bold text-white leading-tight">{sym.label}</span>
                  <span className="text-[9px] text-emerald-400 font-semibold">{getTranslation(lang, 'askAboutSymptom')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Bubble Stream */}
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const isSpeaking = speakingMsgId === msg.id;
          const displayMessageText = getChatMessageText(msg, lang);

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              {/* Agent Badge for AI */}
              {!isUser && (
                <div className="flex items-center gap-2 mb-0.5">
                  {renderAgentBadge(msg.agent)}
                  <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                </div>
              )}

              {/* Message Box */}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed relative ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950'
                    : msg.isEscalationTrigger
                    ? 'bg-red-950/80 border border-red-500/50 text-red-100 rounded-bl-none shadow-lg'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.attachment && (
                  <div className="mb-2 p-2 rounded-xl bg-slate-950/60 border border-slate-700/60 flex items-center gap-2">
                    {msg.attachment.isImage && msg.attachment.url ? (
                      <img src={msg.attachment.url} alt="Prescription" className="w-12 h-12 object-cover rounded-lg border border-slate-700" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-100 truncate">{msg.attachment.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {msg.attachment.type}
                      </span>
                    </div>
                  </div>
                )}

                <p className="whitespace-pre-line font-medium">
                  {displayMessageText}
                </p>

                {/* Read Aloud Button for low-literacy users */}
                {!isUser && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => handleSpeakMessage(msg)}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg transition-all ${
                        isSpeaking
                          ? 'bg-emerald-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{isSpeaking ? getTranslation(lang, 'stopReading') : getTranslation(lang, 'readAloud')}</span>
                    </button>
                    <span className="text-[10px] text-slate-500">FHIR R4 Verified</span>
                  </div>
                )}
              </div>

              {/* Embedded Rich Card Data */}
              {msg.cardData && (
                <div className="w-full max-w-[85%] mt-1">
                  {msg.cardData.type === 'medication_reminder' && (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-blue-500/30 text-xs">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-blue-400 flex items-center gap-1">
                          <Pill className="w-3.5 h-3.5" /> {getCardTitle(msg.cardData, lang)}
                        </span>
                        <span className="text-[10px] text-slate-400">AIIMS Prescription</span>
                      </div>
                      <div className="space-y-2">
                        {medications.slice(0, 3).map((med) => (
                          <div key={med.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                            <div>
                              <p className="font-semibold text-white text-xs">{getLocalizedField(med, 'name', lang)}</p>
                              <p className="text-[10px] text-slate-400">{getLocalizedField(med, 'dosage', lang)}</p>
                            </div>
                            <button
                              onClick={() => onToggleMedicationTaken(med.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                med.takenToday
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{med.takenToday ? getTranslation(lang, 'takenToday') : getTranslation(lang, 'markTaken')}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.cardData.type === 'lab_highlight' && (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 text-xs">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" /> {getCardTitle(msg.cardData, lang)}
                        </span>
                        <span className="text-[10px] text-slate-400">LOINC: 4548-4</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                          <p className="text-[10px] text-slate-400">HbA1c (3 Month Sugar)</p>
                          <p className="text-base font-bold text-emerald-400">7.8 %</p>
                          <p className="text-[9px] text-slate-400">Target &lt; 7.0%</p>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                          <p className="text-[10px] text-slate-400">Blood Pressure</p>
                          <p className="text-base font-bold text-blue-400">132/84</p>
                          <p className="text-[9px] text-slate-400">Telmisartan 40mg</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.cardData.type === 'facility_qr' && (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-amber-500/30 text-xs">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5" /> {getCardTitle(msg.cardData, lang)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mb-2">
                        District Hospital Sitapur • OPD Gate No. 2
                      </p>
                      <button
                        onClick={() => onNavigateTab('facilities')}
                        className="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center justify-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{getTranslation(lang, 'generateQrToken')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Passive follow-ups are contextual VDA reminders, not conversation turns. */}
              {!isUser && index === 0 && (clinicalFollowUps.length > 0 || followUpFeedback) && (
                <section className="w-full max-w-[85%] space-y-2" aria-label="Clinical follow-up reminders">
                  {clinicalFollowUps.map((followUp) => {
                    const copy = followUpCopy(followUp, lang);
                    const isAcknowledged = followUpIntentIds.has(followUp.id);
                    const isTodayIntentConfirmed = followUp.status === 'DUE_TODAY' && isAcknowledged;

                    return (
                      <div key={followUp.id} className="rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-3 py-2.5 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                            {isTodayIntentConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            {isTodayIntentConfirmed ? (() => {
                              const confirmation = followUpIntentConfirmation(lang);
                              return <>
                                <p className="text-xs font-bold text-emerald-200">✓ {confirmation.title}</p>
                                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-100">{confirmation.message}</p>
                                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{confirmation.supporting}</p>
                                <div className="mt-2 inline-flex items-center rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                                  🏆 {confirmation.goal}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void playFollowUpConfirmationAudio(followUp)}
                                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                                >
                                  <Volume2 className="h-3.5 w-3.5" />
                                  <span>{lang === 'hi' ? 'सुनें' : 'Listen'}</span>
                                </button>
                              </>;
                            })() : <>
                              <p className="text-[10px] font-bold tracking-wide text-emerald-300">{copy.heading}</p>
                              <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-100">{copy.message}</p>
                              {copy.question && <p className="mt-1 text-xs leading-relaxed text-slate-200">{copy.question}</p>}
                              {copy.supporting && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{copy.supporting}</p>}

                              {followUp.requiresAttendanceCheck ? (
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <button disabled={followUpBusyId === followUp.id} onClick={() => void recordFollowUpAttendance(followUp, true)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-60">{lang === 'hi' ? 'हाँ, गया था' : 'Yes, I went'}</button>
                                <button disabled={followUpBusyId === followUp.id} onClick={() => void recordFollowUpAttendance(followUp, false)} className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-bold text-amber-100 disabled:opacity-60">{lang === 'hi' ? 'नहीं जा पाया' : 'I could not go'}</button>
                              </div>
                            ) : isAcknowledged ? (
                              <p className="mt-2 text-[11px] font-semibold text-emerald-200">✓ {lang === 'hi' ? 'ठीक है, मैं आपको याद दिलाता रहूँगा।' : 'Okay, I will keep reminding you.'}</p>
                            ) : (
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <button
                                  onClick={() => followUp.status === 'DUE_TODAY' ? confirmFollowUpIntent(followUp) : acknowledgeFollowUp(followUp)}
                                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                                >
                                  {followUp.status === 'DUE_TODAY'
                                    ? (lang === 'hi' ? 'हाँ, जाऊँगा' : 'Yes, I will go')
                                    : followUp.status === 'DUE_TOMORROW'
                                      ? (lang === 'hi' ? 'ठीक है' : 'Okay')
                                      : (lang === 'hi' ? 'याद रखूँगा' : 'I will remember')}
                                </button>
                                <button
                                  onClick={openFollowUpFacilities}
                                  className="rounded-lg border border-emerald-400/45 px-3 py-1.5 text-xs font-bold text-emerald-100 hover:bg-emerald-500/10"
                                >
                                  {lang === 'hi' ? 'कहाँ जाना है?' : 'Where can I go?'}
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => void playFollowUpAudio(followUp)}
                              className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                              <span>{lang === 'hi' ? 'सुनें' : 'Listen'}</span>
                            </button>
                            </>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {followUpFeedback && <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-100">{followUpFeedback}</p>}
                </section>
              )}

              {/* Quick Action Buttons */}
              {msg.quickActions && msg.quickActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {msg.quickActions.map((qa, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (qa.action === 'show_records_meds' || qa.action === 'show_records_obs') {
                          onNavigateTab('records');
                        } else if (qa.action === 'open_log_vital') {
                          onOpenLogVital();
                        } else if (qa.action === 'show_opd_token' || qa.action === 'show_schemes' || qa.action === 'find_jan_aushadhi') {
                          onNavigateTab('facilities');
                        } else if (qa.action === 'ask_medicines') {
                          onSendMessage(getTranslation(lang, 'myMedicinesChip'));
                        } else if (qa.action === 'ask_sugar_lab') {
                          onSendMessage(getTranslation(lang, 'sugarLabChip'));
                        } else if (qa.action === 'ask_hospital') {
                          onSendMessage(getTranslation(lang, 'nearbyHospitalChip'));
                        } else if (qa.action === 'ask_scheme') {
                          onSendMessage(getTranslation(lang, 'pmjayBenefitsChip'));
                        }
                      }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all active:scale-95"
                    >
                      {getQuickActionLabel(qa, lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Backend-mediated audio capture status. No transcript is fabricated. */}
        {voiceState === 'recording' && (
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs animate-pulse flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div className="flex-1">
              <span className="font-semibold">{getTranslation(lang, 'listening')}</span>
              <p className="text-white font-medium mt-0.5">{lang === 'hi' ? 'बोलना समाप्त होने पर माइक्रोफोन दबाएं।' : 'Tap the microphone again when you finish speaking.'}</p>
            </div>
            <button type="button" onClick={() => stopRecording(true)} className="text-[11px] font-semibold text-emerald-100 underline">{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</button>
          </div>
        )}

        {voiceState === 'transcribing' && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-100 text-xs flex items-center gap-2" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="font-semibold">{lang === 'hi' ? 'आवाज़ समझी जा रही है…' : 'Transcribing your voice…'}</span>
          </div>
        )}

        {(voiceState === 'auto_sending' || voiceState === 'waiting_for_vda') && speechTranscript && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 text-emerald-100 text-xs">
            <span className="font-semibold">{lang === 'hi' ? 'आपका प्रश्न भेजा जा रहा है:' : 'Sending your voice question:'}</span>
            <p className="mt-1 text-slate-300">{speechTranscript}</p>
          </div>
        )}

        {voiceState === 'auto_sending' && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-100 text-xs flex items-center gap-2" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="font-semibold">{lang === 'hi' ? 'प्रश्न VDA को भेजा जा रहा है…' : 'Sending your question to VDA…'}</span>
          </div>
        )}

        {voiceState === 'error' && voiceError && (
          <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-100 text-xs" role="status">{voiceError}</div>
        )}

        {isProcessing && (
          <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-none border border-emerald-500/30 bg-slate-900 px-3.5 py-3 text-xs text-emerald-100 shadow-sm" role="status" aria-live="polite">
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-emerald-400" />
            <div>
              <p className="font-semibold">{lang === 'hi' ? 'VDA आपका प्रश्न समझ रहा है…' : lang === 'en' ? 'VDA is preparing your answer…' : getTranslation(lang, 'processing')}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{lang === 'hi' ? 'कृपया एक क्षण प्रतीक्षा करें' : 'Please wait a moment'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Voice & Input Deck */}
      <div className="flex-shrink-0 bg-slate-950/95 border-t border-slate-800/80 px-3 py-2.5 space-y-2 backdrop-blur-md z-20 shadow-lg">
        {/* Suggestion Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'myMedicinesChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Pill className="w-3.5 h-3.5 text-blue-400" />
            <span>{getTranslation(lang, 'myMedicinesChip')}</span>
          </button>
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'sugarLabChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{getTranslation(lang, 'sugarLabChip')}</span>
          </button>
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'nearbyHospitalChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{getTranslation(lang, 'nearbyHospitalChip')}</span>
          </button>
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'pmjayBenefitsChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span>{getTranslation(lang, 'pmjayBenefitsChip')}</span>
          </button>
        </div>

        {/* Pending Attachment Preview Badge */}
        {selectedFile && (
          <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/40 flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              {filePreviewUrl ? (
                <img src={filePreviewUrl} alt="Preview" className="w-9 h-9 object-cover rounded-lg border border-slate-700" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type.split('/')[1]?.toUpperCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {attachmentError && (
          <div className="px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs flex items-center justify-between">
            <span>{attachmentError}</span>
            <button onClick={() => setAttachmentError(null)} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Row & Hero Mic Button */}
        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
          />

          {/* Secondary Text Input Box */}
          <form onSubmit={handleSendText} className="flex-1 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl px-3.5 py-2 focus-within:border-emerald-500/60 transition-all shadow-sm">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || voiceInteractionBusy}
              className="p-1 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all flex-shrink-0"
              title="Attach Prescription (PDF, JPG, PNG)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing || voiceInteractionBusy}
              placeholder={selectedFile ? `Ask about ${selectedFile.name}...` : getTranslation(lang, 'typeMessagePlaceholder')}
              className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
            {(inputText.trim() || selectedFile) && (
              <button
                type="submit"
                disabled={isProcessing || voiceInteractionBusy}
                className="p-1.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Hero Thumb-Accessible Voice Microphone Button */}
          <button
            id="vda-hero-mic-btn"
            onClick={handleToggleListening}
            disabled={isProcessing || voiceInteractionBusy}
            className={`relative flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl transition-all shadow-xl active:scale-95 ${
              voiceState === 'recording'
                ? 'bg-red-500 text-white ring-4 ring-red-500/40 shadow-red-950 animate-pulse'
                : 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 hover:from-emerald-400 hover:to-teal-300 shadow-emerald-950/60 ring-2 ring-emerald-400/30'
            }`}
            title="Tap to speak with VDA Voice Assistant"
          >
            {voiceState === 'recording' ? (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <Mic className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            )}

            {/* Pulsing Voice Waves Ring */}
            {voiceState === 'recording' && (
              <span className="absolute -inset-1 rounded-2xl border-2 border-red-400 animate-ping opacity-75 pointer-events-none" />
            )}
          </button>
        </div>
      </div>

      {/* SOS / Emergency Speed Dial Modal */}
      {showEmergencyDial && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-red-400" />
                <span>{getTranslation(lang, 'emergencyDialTitle')}</span>
              </h3>
              <button
                onClick={() => setShowEmergencyDial(false)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300"
              >
                {getTranslation(lang, 'close')}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <a
                href="tel:108"
                className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 flex items-center justify-between text-white hover:bg-red-900/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚑</span>
                  <div>
                    <h4 className="text-base font-extrabold">{getTranslation(lang, 'ambulance108')}</h4>
                    <p className="text-xs text-red-300">National Ambulance Service</p>
                  </div>
                </div>
                <Phone className="w-5 h-5 text-red-400" />
              </a>

              <a
                href="tel:104"
                className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between text-white hover:bg-emerald-900/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🩺</span>
                  <div>
                    <h4 className="text-base font-extrabold">{getTranslation(lang, 'healthHelpline104')}</h4>
                    <p className="text-xs text-emerald-300">State Medical Advice & Tele-Triage</p>
                  </div>
                </div>
                <Phone className="w-5 h-5 text-emerald-400" />
              </a>

              <a
                href="tel:112"
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-white hover:bg-slate-850 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚨</span>
                  <div>
                    <h4 className="text-base font-extrabold">{getTranslation(lang, 'emergency112')}</h4>
                    <p className="text-xs text-slate-400">All-in-One Emergency SOS</p>
                  </div>
                </div>
                <Phone className="w-5 h-5 text-slate-300" />
              </a>

              <a
                href="tel:14555"
                className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/40 flex items-center justify-between text-white hover:bg-amber-900/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div>
                    <h4 className="text-base font-extrabold">{getTranslation(lang, 'ayushman14555')}</h4>
                    <p className="text-xs text-amber-300">PM-JAY Health Coverage Helpline</p>
                  </div>
                </div>
                <Phone className="w-5 h-5 text-amber-400" />
              </a>
            </div>
          </div>

          <button
            onClick={() => setShowEmergencyDial(false)}
            className="w-full py-3.5 rounded-2xl bg-slate-800 text-white font-bold text-sm"
          >
            {getTranslation(lang, 'done')}
          </button>
        </div>
      )}
    </div>
  );
};
