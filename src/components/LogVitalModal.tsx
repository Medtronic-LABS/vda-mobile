import React, { useState } from 'react';
import { Activity, Check, X, Heart, Droplets } from 'lucide-react';
import { FhirObservation, LanguageCode } from '../types';
import { getTranslation, playChime } from '../utils/i18n';

interface LogVitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveVital: (obs: FhirObservation) => void;
  lang: LanguageCode;
}

export const LogVitalModal: React.FC<LogVitalModalProps> = ({
  isOpen,
  onClose,
  onSaveVital,
  lang
}) => {
  const [vitalType, setVitalType] = useState<'sugar' | 'bp'>('sugar');
  const [sugarValue, setSugarValue] = useState('130');
  const [bpSystolic, setBpSystolic] = useState('130');
  const [bpDiastolic, setBpDiastolic] = useState('82');
  const [timing, setTiming] = useState<'fasting' | 'post_prandial'>('fasting');

  if (!isOpen) return null;

  const handleSave = () => {
    playChime('success');
    const nowStr = new Date().toISOString().slice(0, 10);

    if (vitalType === 'sugar') {
      const val = parseFloat(sugarValue) || 120;
      const isHigh = val > 140;
      const obs: FhirObservation = {
        id: `obs-self-${Date.now()}`,
        code: timing === 'fasting' ? 'LOINC: 1558-6 (Fasting Glucose)' : 'LOINC: 1521-4 (Post Meal Glucose)',
        display: timing === 'fasting' ? 'Fasting Blood Sugar (FBS)' : 'Post Prandial Glucose (PPBS)',
        displayHi: timing === 'fasting' ? 'खाली पेट ब्लड शुगर' : 'भोजन के बाद शुगर',
        displayTa: timing === 'fasting' ? 'வெறும் வயிற்றில் இரத்த சர்க்கரை' : 'உணவுக்குப் பின் சர்க்கரை',
        displayKn: timing === 'fasting' ? 'ಖಾಲಿ ಹೊಟ್ಟೆಯಲ್ಲಿ ರಕ್ತದ ಸಕ್ಕರೆ' : 'ಊಟದ ನಂತರದ ಸಕ್ಕರೆ',
        category: 'laboratory',
        value: val,
        unit: 'mg/dL',
        interpretation: isHigh ? 'high' : 'normal',
        referenceRange: timing === 'fasting' ? '70 - 99 mg/dL' : '< 140 mg/dL',
        effectiveDateTime: nowStr,
        sourceFacility: 'Self-reported via VDA / Patient Glucometer',
        clinicalMeaning: `Reading recorded at ${val} mg/dL. ${isHigh ? 'Slightly above normal fasting target.' : 'Good target control.'}`,
        clinicalMeaningHi: `${val} mg/dL दर्ज किया गया। ${isHigh ? 'लक्ष्य से हल्का अधिक है।' : 'शुगर अच्छी व नियंत्रित है।'}`,
        clinicalMeaningTa: `${val} mg/dL பதிவு செய்யப்பட்டது. ${isHigh ? 'இலக்கை விட சற்று அதிகம்.' : 'சர்க்கரை நல்ல கட்டுப்பாட்டில் உள்ளது.'}`,
        clinicalMeaningKn: `${val} mg/dL ದಾಖಲಿಸಲಾಗಿದೆ. ${isHigh ? 'ಸಾಮಾನ್ಯ ಮಟ್ಟಕ್ಕಿಂತ ಸ್ವಲ್ಪ ಹೆಚ್ಚು.' : 'ಸಕ್ಕರೆ ಉತ್ತಮ ನಿಯಂತ್ರಣದಲ್ಲಿದೆ.'}`
      };
      onSaveVital(obs);
    } else {
      const sys = parseInt(bpSystolic, 10) || 120;
      const dia = parseInt(bpDiastolic, 10) || 80;
      const isHigh = sys >= 140 || dia >= 90;
      const obs: FhirObservation = {
        id: `obs-self-${Date.now()}`,
        code: 'LOINC: 85354-9 (Blood Pressure Panel)',
        display: `Blood Pressure (${sys}/${dia})`,
        displayHi: `रक्तचाप BP (${sys}/${dia})`,
        displayTa: `இரத்த அழுத்தம் BP (${sys}/${dia})`,
        displayKn: `ರಕ್ತದೊತ್ತಡ BP (${sys}/${dia})`,
        category: 'vital-signs',
        value: sys,
        unit: `mmHg (${sys}/${dia})`,
        interpretation: isHigh ? 'high' : 'normal',
        referenceRange: '120/80 mmHg',
        effectiveDateTime: nowStr,
        sourceFacility: 'Self-reported via VDA / Digital BP Monitor',
        clinicalMeaning: `BP recorded as ${sys}/${dia} mmHg.`,
        clinicalMeaningHi: `बीपी ${sys}/${dia} mmHg सफलतापूर्वक दर्ज किया गया।`,
        clinicalMeaningTa: `இரத்த அழுத்தம் ${sys}/${dia} mmHg வெற்றிகரமாக பதிவு செய்யப்பட்டது.`,
        clinicalMeaningKn: `ರಕ್ತದೊತ್ತಡ ${sys}/${dia} mmHg ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ.`
      };
      onSaveVital(obs);
    }

    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-4 sm:p-5 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {getTranslation(lang, 'selfReportVital')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vital Type Selector */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setVitalType('sugar')}
            className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
              vitalType === 'sugar'
                ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Droplets className="w-5 h-5 text-emerald-400" />
            <span className="text-xs">{getTranslation(lang, 'logBloodSugar')}</span>
          </button>

          <button
            onClick={() => setVitalType('bp')}
            className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
              vitalType === 'bp'
                ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Heart className="w-5 h-5 text-red-400" />
            <span className="text-xs">{getTranslation(lang, 'logBloodPressure')}</span>
          </button>
        </div>

        {/* Inputs */}
        {vitalType === 'sugar' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTiming('fasting')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                  timing === 'fasting'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {getTranslation(lang, 'fastingSugar')}
              </button>
              <button
                onClick={() => setTiming('post_prandial')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                  timing === 'post_prandial'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {getTranslation(lang, 'afterFoodSugar')}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
              <label className="text-xs text-slate-400 block mb-2">{getTranslation(lang, 'sugarReading')} (mg/dL)</label>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setSugarValue(String(Math.max(40, parseInt(sugarValue, 10) - 5)))}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold text-lg active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  value={sugarValue}
                  onChange={(e) => setSugarValue(e.target.value)}
                  className="w-28 text-center text-3xl font-black bg-slate-950 rounded-2xl border border-slate-700 text-emerald-400 p-2"
                />
                <button
                  onClick={() => setSugarValue(String(parseInt(sugarValue, 10) + 5))}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold text-lg active:scale-95"
                >
                  +
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 block">Normal Range: 70-99 mg/dL</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{getTranslation(lang, 'upperBp')}</span>
              <input
                type="number"
                value={bpSystolic}
                onChange={(e) => setBpSystolic(e.target.value)}
                className="w-24 text-center text-xl font-bold bg-slate-950 rounded-xl border border-slate-700 text-white p-2"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{getTranslation(lang, 'lowerBp')}</span>
              <input
                type="number"
                value={bpDiastolic}
                onChange={(e) => setBpDiastolic(e.target.value)}
                className="w-24 text-center text-xl font-bold bg-slate-950 rounded-xl border border-slate-700 text-white p-2"
              />
            </div>
          </div>
        )}
      </div>

      <button
        id="save-vital-btn"
        onClick={handleSave}
        className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all active:scale-[0.98]"
      >
        <Check className="w-5 h-5" />
        <span>{getTranslation(lang, 'readingSaved')}</span>
      </button>
    </div>
  );
};
