import React, { useState } from 'react';
import {
  Globe,
  ShieldCheck, 
  LogOut, 
  Check, 
  User, 
  Edit3, 
  Trash2, 
  MapPin, 
  Phone, 
  Calendar, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { LanguageCode, UserProfile } from '../types';
import { getTranslation, playChime } from '../utils/i18n';
import { authService } from '../services/auth.service';

interface ProfileTabProps {
  user: UserProfile;
  lang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
  onProfileUpdated: (user: UserProfile) => void;
  onLogout: () => void;
  onClearLocalData: () => Promise<void>;
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

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  lang,
  onLangChange,
  onProfileUpdated,
  onLogout,
  onClearLocalData
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState(user.fullName);
  const [editAge, setEditAge] = useState(String(user.age || ''));
  const [editGender, setEditGender] = useState<'male' | 'female' | 'other'>(user.gender || 'male');
  const [editState, setEditState] = useState(user.state || 'Haryana');
  const [editDistrict, setEditDistrict] = useState(user.district || 'Gurugram');
  const [editAbha, setEditAbha] = useState(user.abhaNumber || '');

  const handleStateChange = (st: string) => {
    setEditState(st);
    const dList = DISTRICTS_MAP[st] || ['Central'];
    setEditDistrict(dList[0]);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditBusy(true);
    setEditError(null);

    try {
      const parsedAge = parseInt(editAge, 10);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        throw new Error('Please enter a valid age (1-120)');
      }

      const updated = await authService.updateProfile({
        fullName: editName.trim(),
        age: parsedAge,
        gender: editGender,
        state: editState,
        district: editDistrict,
        language: lang,
        abhaNumber: editAbha.trim() || undefined,
      });

      playChime('success');
      onProfileUpdated(updated);
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile');
      playChime('error');
    } finally {
      setEditBusy(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      playChime('start');
      await authService.logout();
      onLogout();
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Clear all local prescriptions and medicine reminders from this phone?')) {
      playChime('start');
      await onClearLocalData();
    }
  };

  const t = {
    hi: {
      profileTab: 'मेरी प्रोफ़ाइल',
      verifiedUser: 'सत्यापित उपयोगकर्ता',
      abhaCardTitle: 'डिजिटल स्वास्थ्य प्रोफ़ाइल',
      viewQr: 'QR कोड देखें',
      editProfile: 'प्रोफ़ाइल बदलें',
      phone: 'मोबाइल नंबर',
      ageGender: 'उम्र / लिंग',
      location: 'स्थान',
      language: 'पसंदीदा भाषा',
      abhaNumber: 'ABHA स्वास्थ्य खाता',
      privacyPromise: '🔒 आपका प्रोफ़ाइल और अपलोड की गई पर्ची VDA सेवा द्वारा सुरक्षित रूप से प्रोसेस और सेव की जा सकती है। रिमाइंडर समय इस फोन में सेव रहते हैं।',
      clearLocalData: 'स्थानीय दवा व पर्ची डेटा साफ़ करें',
      signOut: 'लॉग आउट (Sign Out)',
      saveChanges: 'परिवर्तन सहेजें',
      cancel: 'रद्द करें',
      genderMale: 'पुरुष',
      genderFemale: 'महिला',
      genderOther: 'अन्य',
    },
    en: {
      profileTab: 'My Profile',
      verifiedUser: 'Verified User',
      abhaCardTitle: 'Digital Health Profile',
      viewQr: 'View QR Code',
      editProfile: 'Edit Profile',
      phone: 'Mobile Number',
      ageGender: 'Age / Gender',
      location: 'Location',
      language: 'Language',
      abhaNumber: 'ABHA Number',
      privacyPromise: '🔒 Your profile and uploaded prescription may be securely processed and stored by the VDA service. Reminder times stay on this phone.',
      clearLocalData: 'Clear Local Prescription & Reminder Data',
      signOut: 'Sign Out',
      saveChanges: 'Save Changes',
      cancel: 'Cancel',
      genderMale: 'Male',
      genderFemale: 'Female',
      genderOther: 'Other',
    },
    ta: {
      profileTab: 'எனது சுயவிவரம்',
      verifiedUser: 'சரிபார்க்கப்பட்ட பயனர்',
      abhaCardTitle: 'டிஜிட்டல் சுகாதார சுயவிவரம்',
      viewQr: 'QR குறியீட்டைக் காண்க',
      editProfile: 'சுயவிவரத்தைத் திருத்து',
      phone: 'மொபைல் எண்',
      ageGender: 'வயது / பாலினம்',
      location: 'இடம்',
      language: 'மொழி',
      abhaNumber: 'ABHA எண்',
      privacyPromise: '🔒 உங்கள் சுயவிவரமும் பதிவேற்றிய மருந்துச் சீட்டும் VDA சேவையால் பாதுகாப்பாக செயலாக்கப்பட்டு சேமிக்கப்படலாம். நினைவூட்டல் நேரங்கள் இந்த தொலைபேசியில் இருக்கும்.',
      clearLocalData: 'சாதனத் தரவை அழிக்கவும்',
      signOut: 'வெளியேறு (Sign Out)',
      saveChanges: 'சேமிக்க',
      cancel: 'ரத்து செய்',
      genderMale: 'ஆண்',
      genderFemale: 'பெண்',
      genderOther: 'மற்றவை',
    },
    kn: {
      profileTab: 'ನನ್ನ ಪ್ರೊಫೈಲ್',
      verifiedUser: 'ದೃಢೀಕೃತ ಬಳಕೆದಾರ',
      abhaCardTitle: 'ಡಿಜಿಟಲ್ ಆರೋಗ್ಯ ಪ್ರೊಫೈಲ್',
      viewQr: 'QR ಕೋಡ್ ವೀಕ್ಷಿಸಿ',
      editProfile: 'ಪ್ರೊಫೈಲ್ ತಿದ್ದುಪಡಿ',
      phone: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
      ageGender: 'ವಯಸ್ಸು / ಲಿಂಗ',
      location: 'ಸ್ಥಳ',
      language: 'ಭಾಷೆ',
      abhaNumber: 'ABHA ಸಂಖ್ಯೆ',
      privacyPromise: '🔒 ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಅನ್ನು VDA ಸೇವೆ ಸುರಕ್ಷಿತವಾಗಿ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಿ ಸಂಗ್ರಹಿಸಬಹುದು. ರಿಮೈಂಡರ್ ಸಮಯಗಳು ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತವೆ.',
      clearLocalData: 'ಸ್ಥಳೀಯ ಡೇಟಾ ಅಳಿಸಿ',
      signOut: 'ಸೈನ್ ಔಟ್ (Sign Out)',
      saveChanges: 'ಉಳಿಸಿ',
      cancel: 'ರದ್ದು',
      genderMale: 'ಪುರುಷ',
      genderFemale: 'ಮಹಿಳೆ',
      genderOther: 'ಇತರ',
    }
  }[lang];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <User className="w-4 h-4 text-emerald-400" />
            <span>{t.profileTab}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
              {t.verifiedUser}
            </span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 transition-all"
        >
          <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.editProfile}</span>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-12">
        {/* User Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-tr from-slate-900 via-emerald-950/80 to-teal-900 border-2 border-emerald-500/40 shadow-xl shadow-emerald-950/50 relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">
                National Health Authority • VDA
              </p>
              <h2 className="text-base font-extrabold text-white">{t.abhaCardTitle}</h2>
            </div>
          </div>

          {/* User Details */}
          <div className="space-y-1.5 mb-4">
            <h3 className="text-lg font-black text-white">{user.fullName}</h3>
            <p className="text-xs font-mono font-bold text-emerald-300">
              +91 {user.phone}
            </p>
            {user.abhaNumber && (
              <p className="text-xs font-mono text-slate-300">
                ABHA: {user.abhaNumber}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-emerald-500/30 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-black/30">
              <span className="text-[10px] text-slate-400">{t.ageGender}</span>
              <p className="font-bold text-white mt-0.5">
                {user.age} / {user.gender === 'male' ? 'M' : user.gender === 'female' ? 'F' : 'O'}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-black/30">
              <span className="text-[10px] text-slate-400">{t.location}</span>
              <p className="font-bold text-emerald-300 mt-0.5 truncate">
                {user.district}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-black/30">
              <span className="text-[10px] text-slate-400">{t.language}</span>
              <p className="font-bold text-white mt-0.5 uppercase">
                {user.language || lang}
              </p>
            </div>
          </div>

        </div>

        {/* LANGUAGE SELECTOR */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>{t.language}</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { code: 'hi' as LanguageCode, label: 'हिन्दी (Hindi)' },
              { code: 'en' as LanguageCode, label: 'English' },
              { code: 'ta' as LanguageCode, label: 'தமிழ் (Tamil)' },
              { code: 'kn' as LanguageCode, label: 'ಕನ್ನಡ (Kannada)' }
            ].map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  onLangChange(l.code);
                  playChime('start');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${
                  lang === l.code
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <span>{l.label}</span>
                {lang === l.code && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* PRIVACY PROMISE */}
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-emerald-500/20 flex items-start gap-2.5 text-slate-300 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-400">
            {t.privacyPromise}
          </p>
        </div>

        {/* CLEAR LOCAL DATA */}
        <button
          type="button"
          onClick={handleClearData}
          className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
        >
          <Trash2 className="w-4 h-4 text-slate-500" />
          <span>{t.clearLocalData}</span>
        </button>

        {/* LOGOUT */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>{t.signOut}</span>
        </button>
      </div>

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4 max-w-md w-full mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>{t.editProfile}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300"
              >
                {t.cancel}
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="male">{t.genderMale}</option>
                    <option value="female">{t.genderFemale}</option>
                    <option value="other">{t.genderOther}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    State
                  </label>
                  <select
                    value={editState}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {STATES_LIST.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    District
                  </label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {(DISTRICTS_MAP[editState] || ['Central']).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ABHA Number (Optional)
                </label>
                <input
                  type="text"
                  value={editAbha}
                  onChange={(e) => setEditAbha(e.target.value)}
                  placeholder="98-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={editBusy}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {editBusy ? 'Saving...' : t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
