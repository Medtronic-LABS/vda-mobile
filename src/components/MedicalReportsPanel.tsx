import React, { useEffect, useRef, useState } from 'react';
import { Camera, type MediaResult } from '@capacitor/camera';
import { App as CapacitorApp } from '@capacitor/app';
import { ArrowLeft, Camera as CameraIcon, FileText, Image as ImageIcon, LoaderCircle, Volume2, VolumeX } from 'lucide-react';
import { apiService, VdaApiError, type PatientMedicalReport } from '../services/api';
import { prescriptionCameraFile } from '../services/prescription-camera.service';
import type { LanguageCode } from '../types';

interface Props {
  sessionId: string | null;
  lang: LanguageCode;
  onClose: () => void;
  onAskReport: (reportId: string) => void;
  onDeleteReport: (reportId: string) => void;
}

const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export function MedicalReportsPanel({ sessionId, lang, onClose, onAskReport, onDeleteReport }: Props) {
  const hindi = lang === 'hi';
  const sessionRef = useRef(sessionId);
  const [reports, setReports] = useState<PatientMedicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'camera' | 'upload' | 'source' | 'delete' | 'replace' | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('');
  const [uploadConsent, setUploadConsent] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef(0);
  const [speaking, setSpeaking] = useState(false);

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelected(null);
    setUploadConsent(false);
    if (galleryInput.current) galleryInput.current.value = '';
    if (pdfInput.current) pdfInput.current.value = '';
  };

  const chooseFile = (file?: File) => {
    setError('');
    if (!file) return;
    if (!allowed.has(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError(hindi ? 'केवल 10 MB तक की PDF, JPG या PNG रिपोर्ट चुनें।' : 'Choose a PDF, JPG or PNG report under 10 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelected(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadConsent(false);
  };

  const preparePhoto = async (photo: MediaResult) => {
    const clean = await prescriptionCameraFile(photo);
    chooseFile(new File([clean], `report-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  };

  useEffect(() => {
    let active = true;
    let remove = () => undefined;
    void CapacitorApp.addListener('appRestoredResult', (result) => {
      if (active && result.pluginId === 'Camera' && result.methodName === 'takePhoto' && result.data) {
        void preparePhoto(result.data as MediaResult).catch(() => {
          setError(hindi ? 'फोटो वापस नहीं खुली। फिर फोटो लें।' : 'The photo could not be restored. Please retake it.');
        });
      }
    }).then((handle) => { remove = () => { void handle.remove(); }; });
    return () => { active = false; remove(); };
  }, [lang]);

  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);

  const ensureSession = async () => {
    if (sessionRef.current) return sessionRef.current;
    const created = await apiService.createPatientSession(lang);
    if (!created?.session_id) throw new Error('SESSION_UNAVAILABLE');
    sessionRef.current = created.session_id;
    return created.session_id;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const id = await ensureSession();
      try {
        setReports(await apiService.listMedicalReports(id));
      } catch (cause) {
        if (!(cause instanceof VdaApiError) || !['SESSION_EXPIRED', 'SESSION_CLOSED', 'SESSION_NOT_FOUND'].includes(cause.code || '')) throw cause;
        const replacement = await apiService.createPatientSession(lang);
        if (!replacement?.session_id) throw cause;
        sessionRef.current = replacement.session_id;
        setReports(await apiService.listMedicalReports(replacement.session_id));
      }
    } catch {
      setError(hindi ? 'रिपोर्ट अभी नहीं खुल रही हैं। इंटरनेट जाँचकर फिर कोशिश करें।' : 'Reports cannot be loaded now. Check the connection and try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [sessionId, lang]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, [previewUrl, sourceUrl]);

  const takePhoto = async () => {
    setBusy('camera');
    setError('');
    try {
      await preparePhoto(await Camera.takePhoto({ quality: 88, targetWidth: 2200, targetHeight: 3000,
        correctOrientation: true, saveToGallery: false }));
    } catch (cause) {
      if ((cause as { code?: string })?.code !== 'OS-PLUG-CAMR-0006') {
        setError(hindi ? 'कैमरा नहीं खुला। अनुमति जाँचें या गैलरी से चुनें।' : 'Camera could not open. Check permission or choose from the gallery.');
      }
    } finally { setBusy(null); }
  };

  const upload = async () => {
    if (!selected || !uploadConsent || busy) return;
    setBusy('upload');
    setError('');
    try {
      const id = await ensureSession();
      const report = await apiService.uploadMedicalReport(id, selected, lang);
      setReports((previous) => [report, ...previous]);
      setExpandedId(report.id);
      clearSelection();
    } catch {
      setError(hindi ? 'रिपोर्ट अपलोड नहीं हुई। इंटरनेट जाँचें और फिर कोशिश करें।' : 'Report upload failed. Check the connection and try again.');
    } finally { setBusy(null); }
  };

  const confirmReplacement = async (report: PatientMedicalReport) => {
    if (!report.replacementOf || busy) return;
    setBusy('replace');
    setError('');
    try {
      const updated = await apiService.confirmMedicalReportReplacement(await ensureSession(), report.id);
      setReports((previous) => previous.map((item) => item.id === updated.id ? updated
        : item.id === report.replacementOf ? { ...item, isCurrent: false } : item));
    } catch {
      setError(hindi ? 'पुरानी रिपोर्ट बदली नहीं जा सकी। फिर कोशिश करें।' : 'The report could not be replaced. Please try again.');
      await load();
    } finally { setBusy(null); }
  };

  const openSource = async (report: PatientMedicalReport) => {
    setBusy('source');
    setError('');
    try {
      const id = await ensureSession();
      const blob = await apiService.getMedicalReportSource(id, report.id);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceMime(report.mimeType);
      setSourceUrl(URL.createObjectURL(blob));
    } catch {
      setError(hindi ? 'असली रिपोर्ट नहीं खुली। फिर कोशिश करें।' : 'The original report could not be opened. Try again.');
    } finally { setBusy(null); }
  };

  const stopSpeaking = () => {
    speechRequestRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const readAloud = async (report: PatientMedicalReport) => {
    if (speaking) { stopSpeaking(); return; }
    if (!report.explanation) return;
    const requestId = ++speechRequestRef.current;
    setError('');
    setSpeaking(true);
    try {
      const audio = await apiService.synthesizeVoice(report.explanation, lang);
      if (requestId !== speechRequestRef.current) return;
      const url = URL.createObjectURL(audio);
      audioUrlRef.current = url;
      const player = new Audio(url);
      audioRef.current = player;
      player.onended = stopSpeaking;
      player.onerror = stopSpeaking;
      await player.play();
    } catch {
      if (requestId !== speechRequestRef.current) return;
      stopSpeaking();
      if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
        const utterance = new SpeechSynthesisUtterance(report.explanation);
        utterance.lang = hindi ? 'hi-IN' : 'en-IN';
        utterance.rate = 0.9;
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => {
          setSpeaking(false);
          setError(hindi ? 'आवाज़ नहीं चली। जवाब पढ़कर देखें।' : 'Audio is unavailable. Please read the explanation.');
        };
        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
      } else {
        setError(hindi ? 'आवाज़ नहीं चली। जवाब पढ़कर देखें।' : 'Audio is unavailable. Please read the explanation.');
      }
    }
  };

  const remove = async (report: PatientMedicalReport) => {
    if (!window.confirm(hindi ? 'यह रिपोर्ट हमेशा के लिए हटाएँ?' : 'Delete this report permanently?')) return;
    setBusy('delete');
    setError('');
    try {
      await apiService.deleteMedicalReport(await ensureSession(), report.id);
      setReports((previous) => previous.filter((item) => item.id !== report.id));
      onDeleteReport(report.id);
    } catch {
      setError(hindi ? 'रिपोर्ट नहीं हटी। फिर कोशिश करें।' : 'Report could not be deleted. Try again.');
    } finally { setBusy(null); }
  };

  return <div className="flex min-h-0 flex-1 flex-col bg-slate-950 text-slate-100">
    <header className="flex items-center gap-3 border-b border-slate-800 p-4">
      <button type="button" onClick={onClose} className="min-h-12 min-w-12 rounded-xl bg-slate-800" aria-label={hindi ? 'वापस' : 'Back'}><ArrowLeft className="mx-auto" /></button>
      <div><h1 className="text-xl font-bold">{hindi ? 'मेरी रिपोर्ट' : 'My Health Reports'}</h1>
        <p className="text-xs text-slate-300">{hindi ? 'रिपोर्ट सुरक्षित रखें और आसान भाषा में पढ़ें' : 'Keep and understand your reports'}</p></div>
    </header>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 pb-8">
      <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-lg font-bold">{hindi ? 'रिपोर्ट जोड़ें' : 'Add a report'}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" disabled={!!busy} onClick={() => void takePhoto()} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-2 font-bold text-slate-950 disabled:opacity-50"><CameraIcon size={20} />{hindi ? 'फोटो लें' : 'Take Photo'}</button>
          <button type="button" disabled={!!busy} onClick={() => galleryInput.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-700 px-2 font-bold disabled:opacity-50"><ImageIcon size={20} />{hindi ? 'गैलरी' : 'Gallery'}</button>
          <button type="button" disabled={!!busy} onClick={() => pdfInput.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-700 px-2 font-bold disabled:opacity-50"><FileText size={20} />PDF</button>
        </div>
        <input ref={galleryInput} type="file" className="hidden" accept="image/jpeg,image/png" onChange={(event) => chooseFile(event.target.files?.[0])} />
        <input ref={pdfInput} type="file" className="hidden" accept="application/pdf" onChange={(event) => chooseFile(event.target.files?.[0])} />
        {selected && <div className="space-y-3">
          <p className="break-all text-sm">{selected.name}</p>
          {previewUrl && (selected.type === 'application/pdf'
            ? <iframe title={hindi ? 'रिपोर्ट की झलक' : 'Report preview'} src={previewUrl} className="h-56 w-full rounded-xl bg-white" />
            : <img src={previewUrl} alt={hindi ? 'रिपोर्ट की झलक' : 'Report preview'} className="max-h-56 w-full rounded-xl object-contain" />)}
          <button type="button" onClick={clearSelection} className="min-h-12 rounded-xl border border-slate-500 px-4">{hindi ? 'फिर से चुनें' : 'Retake / choose again'}</button>
          <label className="flex items-start gap-3 rounded-xl bg-slate-800 p-3 text-sm">
            <input type="checkbox" checked={uploadConsent} onChange={(event) => setUploadConsent(event.target.checked)} className="mt-1 h-5 w-5" />
            <span>{hindi ? 'मैं अपनी रिपोर्ट सुरक्षित रखने और उसे समझाने के लिए भेजने की अनुमति देता/देती हूँ।' : 'I agree to upload and store this report so VDA can explain its contents.'}</span>
          </label>
          <button type="button" disabled={!uploadConsent || !!busy} onClick={() => void upload()} className="min-h-14 w-full rounded-xl bg-emerald-500 px-4 text-base font-bold text-slate-950 disabled:opacity-50">{hindi ? 'रिपोर्ट अपलोड करें' : 'Upload Report'}</button>
        </div>}
        {busy === 'upload' && <p role="status" className="flex items-center gap-2 text-sm text-emerald-200"><LoaderCircle className="animate-spin" size={18} />{hindi ? 'रिपोर्ट भेजी और पढ़ी जा रही है…' : 'Sending and reading your report…'}</p>}
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-100">{error}</p>}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">{hindi ? 'मेरी सेव की हुई रिपोर्ट' : 'Saved reports'}</h2>
        {loading && <p role="status" className="text-sm">{hindi ? 'रिपोर्ट खुल रही हैं…' : 'Loading reports…'}</p>}
        {!loading && !reports.length && <p className="text-sm text-slate-300">{hindi ? 'अभी कोई रिपोर्ट नहीं है।' : 'No reports yet.'}</p>}
        {reports.map((report) => <article key={report.id} className={`space-y-3 rounded-2xl border bg-slate-900 p-4 ${report.replacementOf ? 'border-amber-500' : 'border-slate-700'}`}>
          <p className="text-sm font-bold text-emerald-200">{report.category === 'BLOOD_GLUCOSE' ? (hindi ? 'ब्लड शुगर' : 'Blood glucose') : report.category === 'HBA1C' ? 'HbA1c' : report.category === 'GLUCOSE_HBA1C' ? (hindi ? 'शुगर और HbA1c' : 'Glucose and HbA1c') : (hindi ? 'श्रेणी स्पष्ट नहीं' : 'Category not identified')}
            {' · '}{report.replacementOf ? (hindi ? 'बदलने की पुष्टि बाकी' : 'Replacement pending') : report.isCurrent ? (hindi ? 'मौजूदा रिपोर्ट' : 'Current report') : (hindi ? 'पुरानी रिपोर्ट' : 'Earlier version')}</p>
          {report.replacementOf && <div className="space-y-2 rounded-xl bg-amber-950/40 p-3 text-sm">
            <p>{hindi ? `मौजूदा रिपोर्ट: ${reports.find((item) => item.id === report.replacementOf)?.filename || 'पुरानी रिपोर्ट'}` : `Current report: ${reports.find((item) => item.id === report.replacementOf)?.filename || 'Earlier report'}`}</p>
            <p>{hindi ? 'नई रिपोर्ट को मौजूदा बनाने से पहले दोनों जाँचें। पुरानी प्रति सुरक्षित रहेगी।' : 'Check both reports before making the new one current. The previous copy is retained.'}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-12 rounded-xl border border-slate-500 px-3" onClick={() => { const old = reports.find((item) => item.id === report.replacementOf); if (old) void openSource(old); }}>{hindi ? 'पुरानी देखें' : 'View Old'}</button>
              <button type="button" className="min-h-12 rounded-xl bg-emerald-500 px-3 font-bold text-slate-950 disabled:opacity-50" disabled={!!busy} onClick={() => void confirmReplacement(report)}>{hindi ? 'नई रिपोर्ट को मौजूदा बनाएँ' : 'Make New Report Current'}</button>
            </div>
          </div>}
          <button type="button" onClick={() => setExpandedId(expandedId === report.id ? null : report.id)} className="flex min-h-12 w-full items-center gap-3 text-left font-bold">
            <FileText className="shrink-0 text-emerald-400" /><span className="break-all">{report.facts.reportName || report.filename}</span>
          </button>
          {expandedId === report.id && <div className="space-y-3 text-sm">
            <p>{report.explanation}</p>
            {report.extractionStatus !== 'EXTRACTED' && <p role="alert" className="rounded-lg border border-amber-500 p-2 text-amber-100">{hindi ? 'रिपोर्ट पूरी तरह साफ़ नहीं पढ़ी जा सकी। असली रिपोर्ट देखें।' : 'This report could not be read confidently. View the original.'}</p>}
            <p className="text-amber-100">{hindi
              ? 'ये शब्द कंप्यूटर ने रिपोर्ट से पढ़े हैं। असली रिपोर्ट से मिलान करें।'
              : 'These words were read by a computer. Check them against the original report.'}</p>
            {report.facts.reportDate && <p>{hindi ? 'रिपोर्ट की तारीख' : 'Report date'}: {report.facts.reportDate}</p>}
            {report.facts.tests.length > 0 && <div className="space-y-2">{report.facts.tests.map((test, index) =>
              <p key={`${report.id}-${index}`} className="rounded-lg bg-slate-800 p-2">{test.name}: {test.value}{test.unit ? ` ${test.unit}` : ''}{test.referenceRange ? ` · ${hindi ? 'लिखी सीमा' : 'Printed range'}: ${test.referenceRange}` : ''}</p>)}</div>}
            <p className="font-medium text-amber-200">{hindi ? 'नतीजों के बारे में डॉक्टर से बात करें।' : 'Discuss the results with a clinician.'}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onAskReport(report.id)} className="min-h-12 rounded-xl bg-emerald-500 px-2 font-bold text-slate-950">{hindi ? 'आसान भाषा में समझें' : 'Explain Simply'}</button>
              <button type="button" onClick={() => void readAloud(report)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-700 px-2 font-bold">{speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}{hindi ? 'सुनें' : 'Read Aloud'}</button>
              <button type="button" disabled={!!busy} onClick={() => void openSource(report)} className="min-h-12 rounded-xl border border-slate-500 px-2 disabled:opacity-50">{hindi ? 'असली रिपोर्ट देखें' : 'View Original'}</button>
              <button type="button" disabled={!!busy} onClick={() => void remove(report)} className="min-h-12 rounded-xl border border-red-500 px-2 text-red-200 disabled:opacity-50">{hindi ? 'रिपोर्ट हटाएँ' : 'Delete Report'}</button>
            </div>
          </div>}
        </article>)}
      </section>
    </div>
    {sourceUrl && <div role="dialog" aria-modal="true" className="absolute inset-0 z-50 flex flex-col bg-slate-950 p-4">
      <button type="button" className="mb-3 min-h-12 rounded-xl bg-slate-700 px-4 text-left" onClick={() => { URL.revokeObjectURL(sourceUrl); setSourceUrl(null); }}>{hindi ? 'वापस' : 'Back'}</button>
      {sourceMime === 'application/pdf' ? <iframe title={hindi ? 'असली रिपोर्ट' : 'Original report'} src={sourceUrl} className="min-h-0 flex-1 bg-white" />
        : <img src={sourceUrl} alt={hindi ? 'असली रिपोर्ट' : 'Original report'} className="min-h-0 flex-1 object-contain" />}
    </div>}
  </div>;
}
