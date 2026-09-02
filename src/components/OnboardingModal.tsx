import React, { useState } from 'react';
import { Check, ShieldCheck, Fingerprint, Volume2, Globe, ArrowRight, UserCheck, Heart } from 'lucide-react';
import { LanguageCode } from '../types';
import { speakText, playChime, getTranslation } from '../utils/i18n';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (lang: LanguageCode) => void;
  selectedLang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  selectedLang,
  onLangChange
}) => {
  const [step, setStep] = useState<'language' | 'abha_auth' | 'consent'>('language');
  const [isVerifying, setIsVerifying] = useState(false);
  const [authMethod, setAuthMethod] = useState<'face' | 'otp'>('face');
  const [consents, setConsents] = useState({
    teleconsult: true,
    records: true,
    digilocker: true
  });

  if (!isOpen) return null;

  const languages: { code: LanguageCode; label: string; subLabel: string; audioGreet: string }[] = [
    { code: 'hi', label: 'हिन्दी', subLabel: 'Hindi', audioGreet: 'नमस्ते! VDA स्वास्थ्य साथी में आपका स्वागत है।' },
    { code: 'en', label: 'English', subLabel: 'English', audioGreet: 'Welcome to VDA Health Navigator.' },
    { code: 'ta', label: 'தமிழ்', subLabel: 'Tamil', audioGreet: 'வணக்கம்! VDA சுகாதார உதவியாளருக்கு வரவேற்கிறோம்.' },
    { code: 'kn', label: 'ಕನ್ನಡ', subLabel: 'Kannada', audioGreet: 'ನಮಸ್ಕಾರ! VDA ಆರೋಗ್ಯ ಸಹಾಯಕಕ್ಕೆ ಸುಸ್ವಾಗತ.' }
  ];

  const handleLanguageSelect = (code: LanguageCode, audioGreet: string) => {
    onLangChange(code);
    playChime('start');
    speakText(audioGreet, code);
  };

  const handleSimulateAuth = () => {
    setIsVerifying(true);
    playChime('start');
    setTimeout(() => {
      setIsVerifying(false);
      playChime('success');
      setStep('consent');
    }, 1800);
  };

  const handleFinish = () => {
    playChime('success');
    onComplete(selectedLang);
  };

  const l = selectedLang;

  const consentLabels: Record<LanguageCode, {
    c1Title: string; c1Desc: string;
    c2Title: string; c2Desc: string;
    c3Title: string; c3Desc: string;
    authTitle: string; authSubtitle: string;
    consentTitle: string; consentSubtitle: string;
    back: string; verifyBtn: string; verifying: string;
    agreeBtn: string; continueBtn: string;
  }> = {
    hi: {
      c1Title: 'टेली-परामर्श व एम्स ट्राइएज साझाकरण',
      c1Desc: 'आपातकालीन स्थिति में तुरंत डॉक्टर को जांच रिकॉर्ड भेजना।',
      c2Title: 'स्वास्थ्य रिकॉर्ड व जांच रिपोर्ट विश्लेषण',
      c2Desc: 'दवाइयों के समय और शुगर/बीपी रिपोर्ट को आसान भाषा में समझाने हेतु।',
      c3Title: 'डिजिलॉकर (DigiLocker) बैकअप',
      c3Desc: 'पर्चे व डिस्चार्ज सारांश को सरकारी वॉल्ट में सुरक्षित रखना।',
      authTitle: 'ABHA डिजिटल पहचान',
      authSubtitle: 'Aadhaar Face-Auth / OTP द्वारा सुरक्षित सत्यापन (सिम्युलेटेड डेमो)',
      consentTitle: 'डेटा सहमति (ABDM Consent)',
      consentSubtitle: 'आपकी अनुमति के बिना कोई भी डेटा साझा नहीं किया जाएगा। आप कभी भी अनुमति रद्द कर सकते हैं।',
      back: 'पीछे',
      verifyBtn: 'प्रमाणित करें / Authenticate',
      verifying: 'सत्यापन हो रहा है...',
      agreeBtn: 'सहमत हैं व शुरू करें',
      continueBtn: 'आगे बढ़ें / Continue'
    },
    en: {
      c1Title: 'Teleconsultation & Clinical Triage Sharing',
      c1Desc: 'Instant transmission of vital health records to doctors during emergencies.',
      c2Title: 'Health Records & Diagnostic Report Analysis',
      c2Desc: 'For simplified voice explanations of medications, sugar, and BP logs.',
      c3Title: 'DigiLocker Government Vault Backup',
      c3Desc: 'Securely sync and backup prescriptions in National Health Vault.',
      authTitle: 'ABHA Digital Identity',
      authSubtitle: 'Secure authentication via Aadhaar Face-Auth / OTP (Simulated Demo)',
      consentTitle: 'Data Consent (ABDM Consent)',
      consentSubtitle: 'No data is shared without your explicit consent. You can revoke anytime.',
      back: 'Back',
      verifyBtn: 'Authenticate ABHA',
      verifying: 'Verifying with ABDM...',
      agreeBtn: 'Agree & Get Started',
      continueBtn: 'Continue'
    },
    ta: {
      c1Title: 'டெலி-ஆலோசனை & அவசர மருத்துவ பகிர்வு',
      c1Desc: 'அவசர காலங்களில் மருத்துவருக்கு உடல்நிலை பதிவுகளை உடனடியாக அனுப்புதல்.',
      c2Title: 'சுகாதார பதிவுகள் & ஆய்வு அறிக்கை பகுப்பாய்வு',
      c2Desc: 'மருந்துகள் மற்றும் இரத்த சர்க்கரை/அழுத்த அறிக்கைகளை எளிய மொழியில் விளக்க.',
      c3Title: 'டிஜிலாக்கர் (DigiLocker) காப்புப்பிரதி',
      c3Desc: 'மருத்துவ சீட்டுகளை அரசு பாதுகாப்பில் பத்திரமாக சேமிக்க.',
      authTitle: 'ABHA டிஜிட்டல் அடையாளம்',
      authSubtitle: 'ஆதார் முகம் / OTP மூலம் பாதுகாப்பான சரிபார்ப்பு',
      consentTitle: 'தரவு ஒப்புதல் (ABDM Consent)',
      consentSubtitle: 'உங்கள் அனுமதியின்றி எந்த தகவலும் பகிரப்படாது. எப்போது வேண்டுமானாலும் ரத்து செய்யலாம்.',
      back: 'பின்செல்க',
      verifyBtn: 'சரிபார்க்கவும் / Authenticate',
      verifying: 'சரிபார்க்கப்படுகிறது...',
      agreeBtn: 'ஒப்புக்கொண்டு தொடங்கவும்',
      continueBtn: 'தொடரவும் / Continue'
    },
    kn: {
      c1Title: 'ಟೆಲಿ-ಸಮಾಲೋಚನೆ ಮತ್ತು ತುರ್ತು ವೈದ್ಯಕೀಯ ಹಂಚಿಕೆ',
      c1Desc: 'ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಲ್ಲಿ ತಕ್ಷಣವೇ ವೈದ್ಯರಿಗೆ ಆರೋಗ್ಯ ದಾಖಲೆಗಳನ್ನು ರವಾನಿಸುವುದು.',
      c2Title: 'ಆರೋಗ್ಯ ದಾಖಲೆಗಳು ಮತ್ತು ಲ್ಯಾಬ್ ವರದಿ ವಿಶ್ಲೇಷಣೆ',
      c2Desc: 'ಔಷಧಿಗಳ ಸಮಯ ಮತ್ತು ರಕ್ತದೊತ್ತಡ/ಸಕ್ಕರೆ ವರದಿಗಳನ್ನು ಸರಳ ಭಾಷೆಯಲ್ಲಿ ವಿವರಿಸಲು.',
      c3Title: 'ಡಿಜಿಲಾಕರ್ (DigiLocker) ಬ್ಯಾಕಪ್',
      c3Desc: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್‌ಗಳನ್ನು ಸರ್ಕಾರಿ ವಾಲ್ಟ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿಡಲು.',
      authTitle: 'ABHA ಡಿಜಿಟಲ್ ಗುರುತು',
      authSubtitle: 'ಆಧಾರ್ ಮುಖ ದೃಢೀಕರಣ / OTP ಮೂಲಕ ಸುರಕ್ಷಿತ ಪರಿಶೀಲನೆ',
      consentTitle: 'ದತ್ತಾಂಶ ಸಮ್ಮತಿ (ABDM Consent)',
      consentSubtitle: 'ನಿಮ್ಮ ಅನುಮತಿಯಿಲ್ಲದೆ ಯಾವುದೇ ಮಾಹಿತಿಯನ್ನು ಹಂಚಿಕೊಳ್ಳಲಾಗುವುದಿಲ್ಲ.',
      back: 'ಹಿಂದೆ',
      verifyBtn: 'ದೃಢೀಕರಿಸಿ / Authenticate',
      verifying: 'ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ...',
      agreeBtn: 'ಒಪ್ಪಿ ಪ್ರಾರಂಭಿಸಿ',
      continueBtn: 'ಮುಂದುವರಿಯಿರಿ / Continue'
    }
  };

  const curr = consentLabels[l] || consentLabels.en;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-5 overflow-y-auto">
      {/* Header Banner */}
      <div className="text-center pt-3 pb-4 border-b border-slate-800">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-900/40 mb-2">
          <Heart className="w-7 h-7 fill-white/20" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">{getTranslation(selectedLang, 'appTitle')}</h1>
        <p className="text-xs text-emerald-400 font-medium">Aarogya Setu 2.0 • ABDM Ecosystem</p>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className={`h-1.5 rounded-full transition-all ${step === 'language' ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-700'}`} />
        <div className={`h-1.5 rounded-full transition-all ${step === 'abha_auth' ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-700'}`} />
        <div className={`h-1.5 rounded-full transition-all ${step === 'consent' ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-700'}`} />
      </div>

      {/* STEP 1: Language Selection */}
      {step === 'language' && (
        <div className="flex-1 flex flex-col justify-between py-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">भाषा चुनें / Select Language</h2>
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400 mb-4">
              अपनी पसंदीदा भाषा चुनें (Select your preferred language)
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  id={`lang-btn-${lang.code}`}
                  onClick={() => handleLanguageSelect(lang.code, lang.audioGreet)}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 ${
                    selectedLang === lang.code
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-950'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-xl font-bold">{lang.label}</span>
                    {selectedLang === lang.code ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{lang.subLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            id="continue-to-auth-btn"
            onClick={() => {
              playChime('start');
              setStep('abha_auth');
            }}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all active:scale-[0.98]"
          >
            <span>{curr.continueBtn}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* STEP 2: Mocked ABHA / Aadhaar Authentication */}
      {step === 'abha_auth' && (
        <div className="flex-1 flex flex-col justify-between py-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">{curr.authTitle}</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {curr.authSubtitle}
            </p>

            {/* Auth Mode Toggle */}
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 mb-4">
              <button
                id="auth-mode-face"
                onClick={() => setAuthMethod('face')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  authMethod === 'face' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                <Fingerprint className="w-4 h-4" />
                <span>Face Auth</span>
              </button>
              <button
                id="auth-mode-otp"
                onClick={() => setAuthMethod('otp')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  authMethod === 'otp' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Aadhaar OTP</span>
              </button>
            </div>

            {/* Visual Scan Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center relative overflow-hidden mb-4">
              {isVerifying && (
                <div className="absolute inset-0 bg-emerald-500/10 flex flex-col items-center justify-center backdrop-blur-xs">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin mb-3" />
                  <p className="text-xs font-semibold text-emerald-300">UIDAI / ABDM ...</p>
                </div>
              )}

              <div className="w-20 h-20 mx-auto rounded-full bg-slate-800 border-2 border-dashed border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-3">
                <Fingerprint className="w-10 h-10" />
              </div>

              <h3 className="text-sm font-semibold text-white mb-1">Ramesh Kumar (रमेश कुमार)</h3>
              <p className="text-xs font-mono text-emerald-400 mb-2">ABHA: 91-4589-2041-8832</p>
              <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Sitapur, Uttar Pradesh • 54 / M
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('language')}
              className="px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-sm font-medium"
            >
              {curr.back}
            </button>
            <button
              id="verify-abha-btn"
              disabled={isVerifying}
              onClick={handleSimulateAuth}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
            >
              <span>{isVerifying ? curr.verifying : curr.verifyBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Consent Artifacts Review */}
      {step === 'consent' && (
        <div className="flex-1 flex flex-col justify-between py-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">{curr.consentTitle}</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {curr.consentSubtitle}
            </p>

            <div className="space-y-3 mb-4">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3">
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-white mb-0.5">{curr.c1Title}</h4>
                  <p className="text-[11px] text-slate-400">{curr.c1Desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={consents.teleconsult}
                  onChange={(e) => setConsents({ ...consents, teleconsult: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer mt-0.5"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3">
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-white mb-0.5">{curr.c2Title}</h4>
                  <p className="text-[11px] text-slate-400">{curr.c2Desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={consents.records}
                  onChange={(e) => setConsents({ ...consents, records: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer mt-0.5"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3">
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-white mb-0.5">{curr.c3Title}</h4>
                  <p className="text-[11px] text-slate-400">{curr.c3Desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={consents.digilocker}
                  onChange={(e) => setConsents({ ...consents, digilocker: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer mt-0.5"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('abha_auth')}
              className="px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-sm font-medium"
            >
              {curr.back}
            </button>
            <button
              id="consent-agree-btn"
              onClick={handleFinish}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
            >
              <span>{curr.agreeBtn}</span>
              <Check className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
