import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Pill, Activity, Building2, Award, AlertTriangle, ShieldAlert, Sparkles, Phone, Paperclip, FileText, X, LoaderCircle, Bell, Camera as CameraIcon, Upload } from 'lucide-react';
import { Camera, type MediaResult } from '@capacitor/camera';
import { App as CapacitorApp } from '@capacitor/app';
import { prescriptionCameraFile } from '../services/prescription-camera.service';
import { buildSpokenPlan } from '../services/voice-spoken-text';
import { voicePerformance } from '../services/voice-performance';
import { microphoneConstraints, preferredRecordingMime } from '../services/voice-capture';
import { waitForAudioPlayback } from '../services/voice-playback';
import { VdaApiError } from '../services/api';
import { ChatMessage, ClinicalReviewFacility, LanguageCode, PatientDemographics } from '../types';
import { getTranslation, playChime } from '../utils/i18n';
import { getChatMessageText, getQuickActionLabel, getCardTitle } from '../utils/vdaEngine';
import { apiService } from '../services/api';
import { Capacitor } from '@capacitor/core';
import { MedicineReminderSnapshot, PatientAdherenceAction } from '../services/medicine-reminder.service';
import { EmergencyFallbackCard } from './EmergencyFallbackCard';

interface VdaTabProps {
  patient: PatientDemographics;
  lang: LanguageCode;
  messages: ChatMessage[];
  medicineReminderSnapshot: MedicineReminderSnapshot;
  emergencyFallback: { nearbyFacilities: ClinicalReviewFacility[]; messageId: string } | null;
  isProcessing: boolean;
  onSendMessage: (text: string, file?: File) => void | Promise<void>;
  activeReportId: string | null;
  onReportQuestion: (text: string) => void;
  onClearReport: () => void;
  activeReminderStepId: string | null;
  reminderStepStates: Record<string, 'ACTIVE' | 'ANSWERED' | 'EXPIRED'>;
  onReminderQuickAction: (stepId: string, action: string) => void;
  onNavigateTab: (tab: 'vda' | 'records' | 'facilities' | 'profile') => void;
  onTriggerEscalation: (reason: string) => void;
  onOpenLogVital: () => void;
  onOpenMedicineReminders: () => void;
  onRecordMedicineAdherence: (reminderId: string, time: string, action: PatientAdherenceAction) => Promise<void>;
  onSnoozeMedicineReminder: (reminderId: string, time: string) => Promise<void>;
  onOpenEmergencyTeleconsultation: () => Promise<void>;
  onDismissEmergency: () => void;
}

export const VdaTab: React.FC<VdaTabProps> = ({
  patient,
  lang,
  messages,
  medicineReminderSnapshot,
  emergencyFallback,
  isProcessing,
  onSendMessage,
  activeReportId,
  onReportQuestion,
  onClearReport,
  activeReminderStepId,
  reminderStepStates,
  onReminderQuickAction,
  onNavigateTab,
  onTriggerEscalation,
  onOpenLogVital,
  onOpenMedicineReminders,
  onRecordMedicineAdherence,
  onSnoozeMedicineReminder,
  onOpenEmergencyTeleconsultation,
  onDismissEmergency,
}) => {
  const [inputText, setInputText] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing' | 'auto_sending' | 'waiting_for_vda' | 'error'>('idle');
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('vda-auto-voice');
    return saved === 'on' || (saved !== 'off' && import.meta.env.VITE_AUTO_VOICE_DEFAULT !== 'off');
  });
  const [speechPreparing, setSpeechPreparing] = useState(false);
  const [networkState, setNetworkState] = useState<'online' | 'offline' | 'restored'>(
    () => navigator.onLine ? 'online' : 'offline',
  );
  const [showEmergencyDial, setShowEmergencyDial] = useState(false);
  const [medicineActionBusy, setMedicineActionBusy] = useState<string | null>(null);
  const [medicineActionFeedback, setMedicineActionFeedback] = useState('');

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingCancelledRef = useRef(false);
  const recordingLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceAutoSendRef = useRef(false);
  const voiceTurnStartedRef = useRef(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const playbackCancelRef = useRef<(() => void) | null>(null);
  const audioBusyRef = useRef(false);
  const queuedAutoSpokenMessageIdsRef = useRef(new Set(messages.filter((message) => message.sender === 'vda').map((message) => message.id)));
  const autoSpeechQueueRef = useRef<ChatMessage[]>([]);
  const isAutoSpeechDrainingRef = useRef(false);
  const playbackGenerationRef = useRef(0);

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

  useEffect(() => () => {
    recordingCancelledRef.current = true;
    if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current);
    recorderRef.current?.stop();
    playbackRef.current?.pause();
    playbackCancelRef.current?.();
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    playbackGenerationRef.current += 1;
    audioBusyRef.current = false;
  }, []);

  useEffect(() => {
    let restoredTimer: ReturnType<typeof setTimeout> | null = null;
    const offline = () => { if (restoredTimer) clearTimeout(restoredTimer); setNetworkState('offline'); };
    const online = () => {
      setNetworkState('restored');
      if (restoredTimer) clearTimeout(restoredTimer);
      restoredTimer = setTimeout(() => setNetworkState('online'), 6000);
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      if (restoredTimer) clearTimeout(restoredTimer);
    };
  }, []);

  const stopPlayback = () => {
    playbackGenerationRef.current += 1;
    playbackRef.current?.pause();
    playbackCancelRef.current?.();
    playbackCancelRef.current = null;
    playbackRef.current = null;
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    audioBusyRef.current = false;
    setSpeechPreparing(false);
    setSpeakingMsgId(null);
  };

  const playTextAudio = async (audioId: string, chunks: string[], automatic: boolean, onFinished?: () => void) => {
    if (audioBusyRef.current) return;
    if (!chunks.length) { onFinished?.(); return; }
    const playbackGeneration = ++playbackGenerationRef.current;
    const finish = () => {
      if (playbackGeneration !== playbackGenerationRef.current) return;
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
      audioBusyRef.current = false;
      setSpeechPreparing(false);
      playbackRef.current = null;
      setSpeakingMsgId(null);
      onFinished?.();
    };
    try {
      audioBusyRef.current = true;
      setSpeakingMsgId(audioId);
      for (const chunk of chunks) {
        setSpeechPreparing(true);
        const audioBlob = await apiService.synthesizeVoice(chunk, lang);
        if (playbackGeneration !== playbackGenerationRef.current) return;
        const url = URL.createObjectURL(audioBlob);
        playbackUrlRef.current = url;
        const player = new Audio(url);
        playbackRef.current = player;
        const playback = waitForAudioPlayback(player, () => {
          if (playbackGeneration !== playbackGenerationRef.current) return;
          setSpeechPreparing(false);
          if (automatic) voicePerformance.firstAudiblePlayback();
        });
        playbackCancelRef.current = playback.cancel;
        await playback.finished;
        playbackCancelRef.current = null;
        if (playbackGeneration !== playbackGenerationRef.current) return;
        URL.revokeObjectURL(url);
        playbackUrlRef.current = null;
        playbackRef.current = null;
      }
      finish();
    } catch {
      if (playbackGeneration !== playbackGenerationRef.current) return;
      // Text remains usable; device speech is not a silent fallback.
      autoSpeechQueueRef.current = [];
      voicePerformance.failed('tts');
      finish();
      setVoiceError(lang === 'hi' ? 'आवाज़ चलाने में समस्या हुई। आप उत्तर पढ़ सकते हैं।' : 'Voice playback is unavailable. You can still read the response.');
    }
  };

  const drainAutoSpeechQueue = () => {
    if (isAutoSpeechDrainingRef.current || audioBusyRef.current) return;
    const next = autoSpeechQueueRef.current.shift();
    if (!next) return;
    const plan = buildSpokenPlan(next, lang, true);
    if (!plan.chunks.length) { voicePerformance.clear(); drainAutoSpeechQueue(); return; }
    isAutoSpeechDrainingRef.current = true;
    void playTextAudio(next.id, plan.chunks, true, () => {
      isAutoSpeechDrainingRef.current = false;
      drainAutoSpeechQueue();
    });
  };

  // Queue every newly-rendered VDA response in display order. The initial greeting
  // and historical chat are intentionally marked as already seen on mount.
  useEffect(() => {
    messages.forEach((message) => {
      if (message.sender !== 'vda' || queuedAutoSpokenMessageIdsRef.current.has(message.id)) return;
      queuedAutoSpokenMessageIdsRef.current.add(message.id);
      if (autoVoiceEnabled) autoSpeechQueueRef.current.push(message);
    });
    if (autoVoiceEnabled) drainAutoSpeechQueue();
    else voicePerformance.clear();
  }, [messages, lang, autoVoiceEnabled]);

  const lastUserMessageIdRef = useRef(messages.filter((message) => message.sender === 'user').at(-1)?.id);
  useEffect(() => {
    const latestId = messages.filter((message) => message.sender === 'user').at(-1)?.id;
    if (latestId && latestId !== lastUserMessageIdRef.current) {
      autoSpeechQueueRef.current = [];
      isAutoSpeechDrainingRef.current = false;
      stopPlayback();
    }
    lastUserMessageIdRef.current = latestId;
  }, [messages]);

  const toggleAutoVoice = () => {
    const enabled = !autoVoiceEnabled;
    setAutoVoiceEnabled(enabled);
    localStorage.setItem('vda-auto-voice', enabled ? 'on' : 'off');
    if (!enabled) {
      autoSpeechQueueRef.current = [];
      isAutoSpeechDrainingRef.current = false;
      stopPlayback();
    }
  };

  const playResponseAudio = async (msg: ChatMessage) => {
    // Manual listening intentionally interrupts the automatic queue and plays the selected message.
    autoSpeechQueueRef.current = [];
    isAutoSpeechDrainingRef.current = false;
    stopPlayback();
    await playTextAudio(msg.id, buildSpokenPlan(msg, lang, false).chunks, false);
  };


  const stopRecording = (cancel = false) => {
    if (!recorderRef.current) return;
    if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current);
    recordingLimitRef.current = null;
    recordingCancelledRef.current = cancel;
    if (!cancel) voicePerformance.microphoneStopped();
    else voicePerformance.clear();
    recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceState('error');
      setVoiceError(lang === 'hi' ? 'इस डिवाइस पर रिकॉर्डिंग उपलब्ध नहीं है। कृपया लिखकर पूछें।' : 'Recording is unavailable on this device. Please type your question.');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      const supported = navigator.mediaDevices.getSupportedConstraints?.();
      stream = await navigator.mediaDevices.getUserMedia(microphoneConstraints(supported || {}));
      const preferredMime = preferredRecordingMime(MediaRecorder.isTypeSupported?.bind(MediaRecorder));
      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      const settings = stream.getAudioTracks()[0]?.getSettings();
      if (import.meta.env.DEV) console.debug('[VDA voice capture]', {
        platform: Capacitor.getPlatform(), mimeType: recorder.mimeType,
        sampleRate: settings?.sampleRate ?? null, channelCount: settings?.channelCount ?? null,
        echoCancellation: settings?.echoCancellation ?? null,
        noiseSuppression: settings?.noiseSuppression ?? null,
        autoGainControl: settings?.autoGainControl ?? null,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current);
        recordingLimitRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          recordingStartedAtRef.current = null;
          setVoiceState('idle');
          return;
        }
        const durationMs = recordingStartedAtRef.current ? performance.now() - recordingStartedAtRef.current : undefined;
        recordingStartedAtRef.current = null;
        if (chunks.length === 0 || (durationMs !== undefined && durationMs < 350)) {
          voicePerformance.clear();
          setVoiceState('error');
          setVoiceError(lang === 'hi' ? 'कोई आवाज़ रिकॉर्ड नहीं हुई। कृपया फिर से बोलें।' : 'No audio was recorded. Please try again.');
          return;
        }
        setVoiceState('transcribing');
        try {
          const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (import.meta.env.DEV) console.debug('[VDA voice recording]', {
            platform: Capacitor.getPlatform(), mimeType: audio.type, bytes: audio.size,
            durationMs: durationMs ?? null,
          });
          if (audio.size < 512) throw new Error('RECORDED_AUDIO_TOO_SMALL');
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
            // Local reminder replies can complete before React observes an in-flight
            // parent turn. Mark the voice turn before dispatch so controls always reset.
            voiceTurnStartedRef.current = true;
            if (activeReportId) onReportQuestion(transcript);
            else onSendMessage(transcript);
            setInputText('');
            setVoiceState('waiting_for_vda');
          });
        } catch (error) {
          voicePerformance.failed('stt');
          voiceAutoSendRef.current = false;
          setVoiceState('error');
          const connectionFailure = error instanceof VdaApiError
            && ['REQUEST_TIMEOUT', 'NETWORK_UNAVAILABLE'].includes(error.code || '');
          setVoiceError(connectionFailure
            ? (lang === 'hi' ? 'नेटवर्क धीमा है या बंद है। आवाज़ दोबारा भेजने से पहले कनेक्शन जाँचें।' : 'The connection is slow or unavailable. Check it before trying your voice again.')
            : (lang === 'hi' ? 'आवाज़ समझी नहीं जा सकी। कृपया लिखकर पूछें या फिर से बोलें।' : 'Your voice could not be understood. Please type your question or try again.'));
          playChime('stop');
        }
      };
      recorderRef.current = recorder;
      recordingStartedAtRef.current = performance.now();
      recordingCancelledRef.current = false;
      setVoiceError('');
      setSpeechTranscript('');
      setVoiceState('recording');
      recorder.start();
      recordingLimitRef.current = setTimeout(() => stopRecording(), 120_000);
      playChime('start');
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      voicePerformance.clear();
      setVoiceState('error');
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      setVoiceError(denied
        ? (lang === 'hi' ? 'माइक्रोफोन अनुमति नहीं मिली। कृपया लिखकर पूछें।' : 'Microphone permission was not granted. Please type your question.')
        : (lang === 'hi' ? 'रिकॉर्डिंग शुरू नहीं हो सकी। कृपया फिर प्रयास करें या लिखकर पूछें।' : 'Recording could not start. Please try again or type your question.'));
    }
  };

  const handleToggleListening = () => {
    if (voiceState === 'recording') stopRecording();
    else if (voiceState === 'idle' || voiceState === 'error') {
      // Do not record the assistant's audio. A patient can take the floor at any
      // time; this safely stops the current read-aloud/automatic queue first.
      if (audioBusyRef.current) {
        autoSpeechQueueRef.current = [];
        isAutoSpeechDrainingRef.current = false;
        stopPlayback();
      }
      void startRecording();
    }
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (speakingMsgId === msg.id) {
      autoSpeechQueueRef.current = [];
      isAutoSpeechDrainingRef.current = false;
      stopPlayback();
      return;
    }
    void playResponseAudio(msg);
  };

  const recordMedicineAdherence = async (reminderId: string, time: string, action: PatientAdherenceAction) => {
    setMedicineActionBusy(`${reminderId}:${time}`);
    setMedicineActionFeedback('');
    try {
      await onRecordMedicineAdherence(reminderId, time, action);
      const feedback = action === 'TAKEN'
        ? ['दवा लेने की जानकारी इस फोन में सेव हो गई है।', 'Taken was saved on this device.']
        : action === 'SKIPPED'
          ? ['इस समय की दवा छोड़ने की जानकारी इस फोन में सेव हो गई है।', 'Skipped was saved on this device.']
          : ['दवा नहीं लेने की जानकारी इस फोन में सेव हो गई है।', 'Not taken was saved on this device.'];
      setMedicineActionFeedback(lang === 'hi' ? feedback[0] : feedback[1]);
    } finally {
      setMedicineActionBusy(null);
    }
  };

  const snoozeMedicineReminder = async (reminderId: string, time: string) => {
    setMedicineActionBusy(`${reminderId}:${time}`);
    setMedicineActionFeedback('');
    try {
      await onSnoozeMedicineReminder(reminderId, time);
      setMedicineActionFeedback(lang === 'hi'
        ? 'ठीक है, 15 मिनट बाद एक बार फिर याद दिलाया जाएगा।'
        : 'Okay, we will remind you once more in 15 minutes.');
    } finally {
      setMedicineActionBusy(null);
    }
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [cameraPhoto, setCameraPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraUploading, setCameraUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (activeReportId) onClearReport();

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

  const clearCameraPhoto = () => {
    setCameraPhoto((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return null;
    });
  };

  const prepareCameraPhoto = async (photo: MediaResult) => {
    const file = await prescriptionCameraFile(photo);
    if (activeReportId) onClearReport();
    clearCameraPhoto();
    handleRemoveFile();
    setCameraPhoto({ file, previewUrl: URL.createObjectURL(file) });
    setAttachmentError(null);
  };

  const takePrescriptionPhoto = async () => {
    if (cameraBusy || cameraUploading) return;
    setCameraBusy(true);
    setAttachmentError(null);
    try {
      const photo = await Camera.takePhoto({
        quality: 88, targetWidth: 2200, targetHeight: 3000,
        correctOrientation: true, saveToGallery: false,
      });
      await prepareCameraPhoto(photo);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'OS-PLUG-CAMR-0006') {
        setAttachmentError(code === 'OS-PLUG-CAMR-0003'
          ? (lang === 'hi' ? 'कैमरा उपलब्ध नहीं है। फोन की कैमरा अनुमति जाँचें।' : 'Camera is unavailable. Check camera access on your phone.')
          : (lang === 'hi' ? 'फोटो नहीं ली जा सकी। फिर कोशिश करें।' : 'Could not take a photo. Please try again.'));
      }
    } finally {
      setCameraBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    let remove = () => undefined;
    void CapacitorApp.addListener('appRestoredResult', (result) => {
      if (active && result.pluginId === 'Camera' && result.methodName === 'takePhoto' && result.data) {
        void prepareCameraPhoto(result.data as MediaResult).catch(() => {
          setAttachmentError(lang === 'hi' ? 'फोटो वापस नहीं खोली जा सकी। फिर फोटो लें।' : 'Could not restore the photo. Please retake it.');
        });
      }
    }).then((handle) => { remove = () => { void handle.remove(); }; });
    return () => { active = false; remove(); };
  }, [lang]);

  const confirmCameraUpload = async () => {
    if (!cameraPhoto || cameraUploading || isProcessing) return;
    setCameraUploading(true);
    try {
      await onSendMessage(`[Prescription Attachment: ${cameraPhoto.file.name}]`, cameraPhoto.file);
      clearCameraPhoto();
    } finally {
      setCameraUploading(false);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;
    const textToSend = inputText.trim() || (selectedFile ? `[Prescription Attachment: ${selectedFile.name}]` : '');
    if (activeReportId && !selectedFile) onReportQuestion(textToSend);
    else onSendMessage(textToSend, selectedFile || undefined);
    setInputText('');
    setSpeechTranscript('');
    setVoiceState('idle');
    handleRemoveFile();
  };

  const voiceInteractionBusy = voiceState === 'transcribing'
    || voiceState === 'auto_sending'
    || voiceState === 'waiting_for_vda';

  const renderAgentBadge = () => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
      <Sparkles className="w-3 h-3" /> {getTranslation(lang, 'multiAgentVda')}
    </span>
  );

  const patientDistrict = lang === 'hi' ? (patient.districtHi || patient.district) : patient.district;
  const patientState = patient.state;
  const activeMedicineReminders = medicineReminderSnapshot.activePrescription
    ? medicineReminderSnapshot.reminders.filter((reminder) => reminder.prescriptionId === medicineReminderSnapshot.activePrescription?.id)
    : [];

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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium whitespace-nowrap">
                Pilot profile
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {patientDistrict}, {patientState} • NCD Care
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button type="button" onClick={toggleAutoVoice} aria-pressed={autoVoiceEnabled}
            className="flex items-center gap-1 rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200"
            title={autoVoiceEnabled ? 'Turn automatic voice off' : 'Turn automatic voice on'}>
            {autoVoiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{autoVoiceEnabled ? 'Auto voice on' : 'Auto voice off'}</span>
          </button>
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
        {activeReportId && <div className="flex items-center gap-2 rounded-xl bg-amber-950/50 p-3 text-xs text-amber-100" role="status">
          <span className="flex-1">{lang === 'hi' ? 'चुनी हुई रिपोर्ट के बारे में पूछें।' : 'Ask about the selected report.'}</span>
          <button type="button" onClick={onClearReport} className="min-h-10 rounded-lg border border-amber-500/50 px-3 font-bold">{lang === 'hi' ? 'बंद करें' : 'Done'}</button>
        </div>}
        {/* Only prescription-confirmed, device-local medicine reminders appear here. */}
        {activeMedicineReminders.length > 0 && (
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3 shadow-sm" aria-label="Medicine reminders">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-100">
                <Bell className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-bold">{lang === 'hi' ? 'आज की दवाइयाँ' : 'Today’s medicines'}</h2>
              </div>
              <button type="button" onClick={onOpenMedicineReminders} className="text-[11px] font-semibold text-emerald-300 underline underline-offset-2">
                {lang === 'hi' ? 'दवा रिमाइंडर' : 'Manage'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              {lang === 'hi'
                ? `आज ${medicineReminderSnapshot.progress.takenToday}/${medicineReminderSnapshot.progress.scheduledToday} दवा लेने की पुष्टि हुई`
                : `${medicineReminderSnapshot.progress.takenToday}/${medicineReminderSnapshot.progress.scheduledToday} doses marked taken today`}
            </p>
            <div className="mt-2 space-y-1.5">
              {activeMedicineReminders.flatMap((reminder) => reminder.times.map((time) => ({ reminder, time }))).slice(0, 4).map(({ reminder, time }) => {
                const key = `${reminder.id}:${time}`;
                const outcome = medicineReminderSnapshot.todayOutcomeByKey[key];
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg bg-slate-950/50 px-2.5 py-2">
                    <span className="w-10 text-[11px] font-bold text-emerald-300">{time}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-100">{outcome === 'TAKEN' ? '✓ ' : '○ '}{reminder.medicineName}</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {(['TAKEN', 'SKIPPED', 'NOT_TAKEN'] as PatientAdherenceAction[]).map((action) => <button key={action} type="button" disabled={medicineActionBusy === key || outcome === action} onClick={() => void recordMedicineAdherence(reminder.id, time, action)} className={`rounded-md px-2 py-1 text-[10px] font-bold disabled:opacity-60 ${outcome === action ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border border-slate-600 text-slate-200'}`}>
                        {lang === 'hi' ? ({ TAKEN: 'ले ली', SKIPPED: 'छोड़ दी', NOT_TAKEN: 'नहीं ली' } as const)[action] : ({ TAKEN: 'Taken', SKIPPED: 'Skip', NOT_TAKEN: 'Not taken' } as const)[action]}
                      </button>)}
                      <button type="button" disabled={medicineActionBusy === key} onClick={() => void snoozeMedicineReminder(reminder.id, time)} className="rounded-md border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-200 disabled:opacity-60">
                        {lang === 'hi' ? 'बाद में' : 'Later'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {medicineActionFeedback && <p className="mt-2 text-[11px] font-medium text-emerald-200">{medicineActionFeedback}</p>}
          </section>
        )}

        {/* Message Bubble Stream */}
        {messages.map((msg) => {
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
                  {renderAgentBadge()}
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

                {msg.sections?.map((section, sectionIndex) => (
                  <section key={`${msg.id}-section-${sectionIndex}`} className="mt-2 space-y-1">
                    {section.title && <p className="font-semibold text-slate-100">{section.title}</p>}
                    {section.body && <p className="whitespace-pre-line font-medium">{section.body}</p>}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-5">
                        {section.bullets.map((bullet, bulletIndex) => (
                          <li key={`${msg.id}-section-${sectionIndex}-bullet-${bulletIndex}`}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}

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
                    {(msg.prescriptionScoped || msg.provenance === 'PRESCRIPTION') && (
                      <span className="text-[10px] text-slate-500">{lang === 'hi' ? 'पर्ची से' : 'From prescription'}</span>
                    )}
                    {msg.provenance === 'REMINDER' && (
                      <span className="text-[10px] text-slate-500">{lang === 'hi' ? 'रिमाइंडर से' : 'From reminder'}</span>
                    )}
                    {msg.provenance === 'KNOWLEDGE' && (
                      <span className="text-[10px] text-slate-500">{lang === 'hi' ? 'अधिकृत जानकारी से' : 'From approved guidance'}</span>
                    )}
                    {msg.provenance === 'PRESCRIPTION_AND_KNOWLEDGE' && (
                      <span className="text-[10px] text-slate-500">{lang === 'hi' ? 'पर्ची व अधिकृत जानकारी से' : 'From prescription and approved guidance'}</span>
                    )}
                  </div>
                )}
              </div>

              {isUser && emergencyFallback?.messageId === msg.id && (
                <EmergencyFallbackCard
                  nearbyFacilities={emergencyFallback.nearbyFacilities}
                  lang={lang}
                  onOpenTeleconsultation={() => void onOpenEmergencyTeleconsultation()}
                  onBack={onDismissEmergency}
                />
              )}

              {/* Embedded Rich Card Data */}
              {msg.cardData && (
                <div className="w-full max-w-[85%] mt-1">
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

                </div>
              )}

              {/* Quick Action Buttons */}
              {msg.quickActions && msg.quickActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {msg.quickActions.map((qa, i) => (
                    (() => {
                      const reminderAction = ['setup_medicine_reminders', 'confirm_medicine_reminders', 'skip_medicine_reminders', 'change_medicine_reminder_time'].includes(qa.action);
                      const reminderStepStatus = msg.reminderStepId ? reminderStepStates[msg.reminderStepId] : undefined;
                      const reminderActionable = !reminderAction || (
                        msg.reminderStepId === activeReminderStepId && reminderStepStatus === 'ACTIVE'
                      );
                      return <button
                      key={i}
                      disabled={!reminderActionable}
                      onClick={() => {
                        if (reminderAction) {
                          if (msg.reminderStepId) onReminderQuickAction(msg.reminderStepId, qa.action);
                          return;
                        }
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
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all active:scale-95 ${
                        reminderActionable
                          ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                          : 'bg-slate-950 border-slate-800 text-slate-600 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {getQuickActionLabel(qa, lang)}
                    </button>;
                    })()
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Backend-mediated audio capture status. No transcript is fabricated. */}
        {networkState !== 'online' && (
          <div className="p-3 rounded-2xl bg-amber-950/70 border border-amber-500/40 text-amber-100 text-xs" role="status">
            {networkState === 'offline'
              ? (lang === 'hi' ? 'इंटरनेट कनेक्शन नहीं है। कनेक्शन आने पर अपना प्रश्न फिर भेजें।' : 'You are offline. Send your question again when connected.')
              : (lang === 'hi' ? 'कनेक्शन वापस आ गया है। ज़रूरत हो तो अपना प्रश्न फिर भेजें।' : 'Connection restored. Retry your question if needed.')}
          </div>
        )}
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
            <span className="font-semibold">{lang === 'hi' ? 'आवाज़ भेजी और समझी जा रही है…' : 'Sending and transcribing your voice…'}</span>
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

        {speechPreparing && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-100 text-xs flex items-center gap-2" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="font-semibold">{lang === 'hi' ? 'आवाज़ में जवाब तैयार हो रहा है…' : 'Preparing spoken answer…'}</span>
          </div>
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

      {cameraPhoto && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 p-4 flex flex-col gap-4" role="dialog" aria-modal="true" aria-label={lang === 'hi' ? 'पर्ची की फोटो देखें' : 'Review prescription photo'}>
          <h2 className="text-lg font-bold text-white">{lang === 'hi' ? 'पर्ची की फोटो देखें' : 'Review prescription photo'}</h2>
          <p className="text-sm text-slate-300">{lang === 'hi' ? 'लिखावट साफ़ और पूरी दिख रही है? पुष्टि करने पर ही फोटो भेजी जाएगी।' : 'Is the whole prescription clear and readable? The photo is sent only after you confirm.'}</p>
          <img src={cameraPhoto.previewUrl} alt={lang === 'hi' ? 'खींची हुई पर्ची' : 'Captured prescription'} className="min-h-0 flex-1 w-full object-contain rounded-2xl bg-slate-900" />
          {cameraUploading && <p role="status" className="text-sm text-emerald-200 flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />{lang === 'hi' ? 'पर्ची अपलोड हो रही है…' : 'Uploading prescription…'}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={cameraUploading} onClick={takePrescriptionPhoto} className="min-h-12 rounded-xl border border-emerald-500 text-emerald-100 font-bold disabled:opacity-50">{lang === 'hi' ? 'फिर फोटो लें' : 'Retake'}</button>
            <button type="button" disabled={cameraUploading} onClick={() => clearCameraPhoto()} className="min-h-12 rounded-xl border border-slate-600 text-slate-200 font-bold disabled:opacity-50">{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</button>
          </div>
          <button type="button" disabled={cameraUploading || isProcessing} onClick={() => void confirmCameraUpload()} className="min-h-14 rounded-xl bg-emerald-500 text-slate-950 font-bold text-base disabled:opacity-50">{lang === 'hi' ? 'पुष्टि करें और अपलोड करें' : 'Confirm & Upload'}</button>
        </div>
      )}

      {/* Persistent Bottom Voice & Input Deck */}
      <div className="flex-shrink-0 bg-slate-950/95 border-t border-slate-800/80 px-3 py-2.5 space-y-2 backdrop-blur-md z-20 shadow-lg">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void takePrescriptionPhoto()} disabled={isProcessing || voiceInteractionBusy || cameraBusy} className="min-h-12 rounded-xl bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <CameraIcon className="h-5 w-5" />{cameraBusy ? (lang === 'hi' ? 'कैमरा खुल रहा है…' : 'Opening camera…') : (lang === 'hi' ? 'फोटो खींचें' : 'Take Photo')}
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing || voiceInteractionBusy} className="min-h-12 rounded-xl border border-emerald-500/70 text-emerald-100 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <Upload className="h-5 w-5" />{lang === 'hi' ? 'पर्ची अपलोड करें' : 'Upload Prescription'}
          </button>
        </div>
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
