import React, { useState } from 'react';
import {
  Phone,
  Lock, 
  User, 
  Calendar, 
  MapPin, 
  Globe, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';
import { LanguageCode, UserProfile } from '../types';
import { authService } from '../services/auth.service';
import { playChime, toUiLang } from '../utils/i18n';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
  currentLang?: LanguageCode;
  onLangChange?: (lang: LanguageCode) => void;
}

const STATES_LIST = [
  'Haryana',
  'Himachal Pradesh',
  'Delhi',
  'Punjab',
  'Rajasthan',
  'Uttar Pradesh',
  'Karnataka',
  'Tamil Nadu',
  'Other'
];

const DISTRICTS_MAP: Record<string, string[]> = {
  'Haryana': ['Gurugram', 'Faridabad', 'Ambala', 'Karnal', 'Hisar', 'Rohtak', 'Panipat', 'Sonipat'],
  'Himachal Pradesh': ['Solan', 'Shimla', 'Kangra', 'Mandi', 'Kullu', 'Una', 'Hamirpur', 'Sirmaur'],
  'Delhi': ['New Delhi', 'South Delhi', 'North Delhi', 'East Delhi', 'West Delhi'],
  'Punjab': ['Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala', 'Mohali'],
  'Karnataka': ['Bengaluru Urban', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem']
};

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  currentLang = 'hi',
  onLangChange
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [lang, setLang] = useState<LanguageCode>(toUiLang(currentLang));
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [state, setState] = useState('Haryana');
  const [district, setDistrict] = useState('Gurugram');
  const [abhaNumber, setAbhaNumber] = useState('');

  const handleLangSelect = (selected: LanguageCode) => {
    setLang(selected);
    onLangChange?.(selected);
    playChime('start');
  };

  const handleStateChange = (newState: string) => {
    setState(newState);
    const districts = DISTRICTS_MAP[newState] || ['Central'];
    setDistrict(districts[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
          throw new Error(lang === 'hi' ? 'कृपया 10-अंकीय मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number');
        }
        if (pin.length !== 4) {
          throw new Error(lang === 'hi' ? 'कृपया अपना 4-अंकीय पिन दर्ज करें' : 'Please enter your 4-digit PIN');
        }

        const user = await authService.login(cleanPhone, pin);
        playChime('success');
        onAuthenticated(user);
      } else {
        // Sign Up
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
          throw new Error(lang === 'hi' ? 'कृपया 10-अंकीय मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number');
        }
        if (!fullName.trim()) {
          throw new Error(lang === 'hi' ? 'कृपया अपना पूरा नाम दर्ज करें' : 'Please enter your full name');
        }
        if (pin.length !== 4) {
          throw new Error(lang === 'hi' ? 'कम से कम 4 अंकों का पिन बनाएं' : 'PIN must be at least 4 digits');
        }
        const parsedAge = parseInt(age, 10);
        if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
          throw new Error(lang === 'hi' ? 'कृपया सही उम्र दर्ज करें (1-120)' : 'Please enter a valid age (1-120)');
        }

        const user = await authService.signup({
          phone: cleanPhone,
          pin,
          fullName: fullName.trim(),
          age: parsedAge,
          gender,
          state,
          district,
          language: lang,
          abhaNumber: abhaNumber.trim() || undefined,
        });

        playChime('success');
        onAuthenticated(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred. Please try again.');
      playChime('error');
    } finally {
      setLoading(false);
    }
  };

  const t = {
    hi: {
      appName: 'सेहत साथी',
      signInTab: 'साइन इन',
      signUpTab: 'नया खाता बनाएं',
      welcomeBack: 'पुनः स्वागत है',
      createAccount: 'प्रोफ़ाइल बनाएं',
      phoneLabel: 'मोबाइल नंबर',
      phonePlaceholder: '98XXXXXXXX',
      pinLabel: '4-अंकीय सुरक्षा पिन',
      pinPlaceholder: '••••',
      nameLabel: 'पूरा नाम',
      namePlaceholder: 'उदा. रमेश कुमार',
      ageLabel: 'उम्र',
      agePlaceholder: 'उदा. 45',
      genderLabel: 'लिंग',
      genderMale: 'पुरुष',
      genderFemale: 'महिला',
      genderOther: 'अन्य',
      stateLabel: 'राज्य',
      districtLabel: 'ज़िला',
      abhaLabel: 'ABHA स्वास्थ्य खाता (वैकल्पिक)',
      abhaPlaceholder: '98-XXXX-XXXX-XXXX',
      signInBtn: 'लॉग इन करें',
      signUpBtn: 'खाता बनाएं व आगे बढ़ें',
      privacyText: 'आपका प्रोफ़ाइल और अपलोड की गई पर्ची VDA सेवा द्वारा सुरक्षित रूप से प्रोसेस और सेव की जा सकती है। चुने हुए रिमाइंडर समय इस फोन में सेव रहते हैं।',
    },
    en: {
      appName: 'Sehat Saathi',
      signInTab: 'Sign In',
      signUpTab: 'Sign Up',
      welcomeBack: 'Welcome Back',
      createAccount: 'Create Profile',
      phoneLabel: 'Mobile Number',
      phonePlaceholder: '98XXXXXXXX',
      pinLabel: '4-Digit Security PIN',
      pinPlaceholder: '••••',
      nameLabel: 'Full Name',
      namePlaceholder: 'e.g. Ramesh Kumar',
      ageLabel: 'Age',
      agePlaceholder: 'e.g. 45',
      genderLabel: 'Gender',
      genderMale: 'Male',
      genderFemale: 'Female',
      genderOther: 'Other',
      stateLabel: 'State',
      districtLabel: 'District',
      abhaLabel: 'ABHA Health Number (Optional)',
      abhaPlaceholder: '98-XXXX-XXXX-XXXX',
      signInBtn: 'Sign In',
      signUpBtn: 'Create Account & Continue',
      privacyText: 'Your profile and uploaded prescription may be securely processed and stored by the VDA service. Chosen reminder times stay on this phone.',
    },
  }[toUiLang(lang)];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Header & Language Bar */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-emerald-950/50">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-bold text-white tracking-tight">{t.appName}</h1>
        </div>

        {/* Language Switcher Pills */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            { code: 'hi' as LanguageCode, label: 'हि', name: 'हिन्दी' },
            { code: 'en' as LanguageCode, label: 'EN', name: 'English' },
          ].map((l) => (
            <button
              key={l.code}
              type="button"
              aria-label={l.name}
              aria-pressed={lang === l.code}
              onClick={() => handleLangSelect(l.code)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                lang === l.code
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col justify-center">
        {/* Tab Toggle: Sign In vs Sign Up */}
        <div className="flex p-1 rounded-2xl bg-slate-900 border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'signin'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.signInTab}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'signup'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.signUpTab}
          </button>
        </div>

        <h2 className="mb-5 text-xl font-black text-white tracking-tight">
          {mode === 'signin' ? t.welcomeBack : t.createAccount}
        </h2>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="leading-snug">{errorMessage}</p>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SIGN UP ONLY: Full Name */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.nameLabel}</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t.namePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          )}

          {/* Mobile Number (Both Modes) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.phoneLabel}</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs font-bold text-slate-400 font-mono">
                +91
              </span>
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder={t.phonePlaceholder}
                className="w-full pl-12 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all tracking-wider"
              />
            </div>
          </div>

          {/* 4-Digit Security PIN (Both Modes) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.pinLabel}</span>
              </span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showPin ? 'text' : 'password'}
                required
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t.pinPlaceholder}
                className="w-full px-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                aria-label={lang === 'hi' ? (showPin ? 'पिन छिपाएँ' : 'पिन दिखाएँ') : (showPin ? 'Hide PIN' : 'Show PIN')}
                className="absolute right-3 text-slate-400 hover:text-white"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* SIGN UP ONLY: Demographics (Age, Gender, State, District, ABHA) */}
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Age */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.ageLabel}</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder={t.agePlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.genderLabel}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="male">{t.genderMale}</option>
                    <option value="female">{t.genderFemale}</option>
                    <option value="other">{t.genderOther}</option>
                  </select>
                </div>
              </div>

              {/* State & District */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.stateLabel}</span>
                  </label>
                  <select
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    {STATES_LIST.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.districtLabel}
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    {(DISTRICTS_MAP[state] || ['Central']).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional ABHA Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.abhaLabel}</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={abhaNumber}
                  onChange={(e) => setAbhaNumber(e.target.value)}
                  placeholder={t.abhaPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin text-base">⟳</span>
            ) : (
              <>
                <span>{mode === 'signin' ? t.signInBtn : t.signUpBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">{t.privacyText}</p>
        )}
      </div>
    </div>
  );
};
