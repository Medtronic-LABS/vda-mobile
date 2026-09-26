# VDA Health Assistant (Voice & Digital Health Navigator)
### Production-Ready, ABDM-Compliant Multi-Agent AI Healthcare Mobile Application

[![ABDM Standard](https://img.shields.io/badge/ABDM-FHIR%20R4%20Compliant-10b981.svg)](https://abdm.gov.in/)
[![Capacitor Android](https://img.shields.io/badge/Capacitor-Android%20APK%20Ready-38bdf8.svg)](https://capacitorjs.com/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.x-a855f7.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)]()

**VDA Health Assistant** is a multilingual, voice-first digital health assistant designed in alignment with India's **Ayushman Bharat Digital Mission (ABDM)** and **FHIR R4 (Fast Healthcare Interoperability Resources)** standards. It empowers citizens—regardless of literacy levels—to seamlessly navigate their health records, monitor chronic illnesses, track daily medication schedules, extract and clarify doctor prescriptions, discover nearby public healthcare facilities (IPHS 2022), check government scheme benefits (e.g., Ayushman Bharat PM-JAY ₹5,00,000 cashless insurance, HIMCARE, Chirayu), and receive immediate triage intervention during clinical emergencies.

---

## 📱 Pre-Built Android APK (`VDA.apk`)

A production-ready Android Debug APK has been compiled and is available directly in the project and workspace root:
- **Primary Binary:** [`VDA.apk`](VDA.apk) (also mirrored as `vda-health-assistant.apk`)
- **Size:** `~4.5 MB`
- **Target Platform:** Android 7.0 (API 24) to Android 15/16 (API 36)
- **Active Backend Gateway:** `https://vda-api.mdtlabs.org`
- **Install on Device via ADB:**
  ```bash
  adb install -r VDA.apk
  ```

---

## 🌐 Live Production Cloud Endpoints

| Service | Endpoint URL | Status | Details |
| :--- | :--- | :--- | :--- |
| **Backend API Gateway** | [https://vda-api.mdtlabs.org](https://vda-api.mdtlabs.org) | **ACTIVE (HTTPS)** | Production NestJS API on AWS EC2 (`13.232.251.63`) |
| **Admin Supervision Portal** | [https://vda-admin.mdtlabs.org](https://vda-admin.mdtlabs.org) | **ACTIVE (HTTPS)** | Clinical supervision, RAG telemetry, and escalation review |
| **API Health Check** | [https://vda-api.mdtlabs.org/api/v1/health](https://vda-api.mdtlabs.org/api/v1/health) | **HEALTHY** | `{"database":"healthy","redis":"healthy"}` |
| **Dev Auth Token Generator** | [https://vda-api.mdtlabs.org/api/v1/dev/auth/token](https://vda-api.mdtlabs.org/api/v1/dev/auth/token) | **ACTIVE** | Issues bearer tokens for pilot and dev sessions |

---

## 💊 Medicine Reminders & Prescription Multimodal OCR

The mobile application features a specialized **Prescription Multimodal Assistant & Daily Medication Reminder System** (`src/components/MedicineRemindersModal.tsx` and `src/services/medicine-reminder.service.ts`):

```
                               ┌──────────────────────────────────────────────┐
                               │       User Prescription Photo or PDF        │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                                       [Prescription Upload Dialog]
                                       Upload via Camera or File Picker
                                                      │
                                                      ▼
                                  ┌───────────────────────────────────────┐
                                  │   POST /api/v1/sessions/:id/          │
                                  │   prescriptions (Multipart File)      │
                                  └───────────────────┬───────────────────┘
                                                      │
                                                      ▼
                                     [Gemini Multimodal OCR Extraction]
                                     Zero-hallucination structured parsing
                                                      │
                                   ┌──────────────────┴──────────────────┐
                                   ▼                                     ▼
                        [High Confidence: EXTRACTED]          [Low Confidence: REVIEW_REQ]
                        Ready for instant reminder save       Requires patient visual check
                                   │                                     │
                                   └──────────────────┬──────────────────┘
                                                      │
                                                      ▼
                                      [Local Medicine Reminder Storage]
                                      Capacitor Preferences & Local Notifications
                                                      │
                                                      ▼
                                    [Contextual Sync to Backend Session]
                                    POST /api/v1/sessions/:id/prescription-context
                                                      │
                                                      ▼
                                    [Context-Aware Voice/Text Queries]
                                    "कल रात की दवाई ली थी क्या?" / "दवाई कब लेनी है?"
```

### 1. Zero-Guessing Multimodal Extraction
- Accepts camera photos, gallery images (`image/jpeg`, `image/png`, `image/webp`), and clinical PDFs.
- Passes the document to the backend's Gemini Multimodal extractor with a strict JSON schema.
- Medications with ambiguous handwriting are flagged with `confidence: 'LOW'`, moving the prescription to `REVIEW_REQUIRED` so patients confirm dosages before alarms activate.

### 2. Daily Dose Reminders & Adherence Tracking
- **Time Slots:** Morning (सुबह), Afternoon (दोपहर), Evening (शाम), Night (रात).
- **Meal Associations:** Before food (खाली पेट / खाने से पहले), After food (खाने के बाद), With food (खाने के साथ).
- **Native Alarms:** Built using `@capacitor/local-notifications` with persistent device notifications.
- **Audio Prompts:** One-tap text-to-speech button reading out dose instructions in Hindi, English, Tamil, and Kannada.

### 3. Contextual Voice & Text Query Synchronization
When the user asks medicine-related questions in chat (e.g., *"कल रात की दवाई ली थी क्या?"*, *"मेरी शुगर की कौनसी दवाई है?"*, *"दवाई कब खानी है?"*):
- The app classifies the query as `prescription_context_required: true`.
- It automatically synchronizes active reminders and confirmed prescription medicines to the backend Redis session context via `POST /api/v1/sessions/:sessionId/prescription-context`.
- The backend AI evaluates the query strictly against the user's active prescriptions—preventing hallucinations from ungrounded generic medical knowledge.

---

## 🧬 VDA Gold Synthetic Patient Dataset (200 ABDM / FHIR R4 Records)

The application is natively integrated with the **VDA Gold Synthetic Patient Dataset**, generating **200 structurally faithful, statistically realistic, and Indian regulatory-compliant patient records** conforming to NRCeS C-DAC Pune ABDM FHIR IG v6.5.0 and VDA Engineering Spec §05.

### Key Dataset Characteristics
- **Dataset Generation Date:** September 1, 2026
- **Source Files:** `src/data/patients_200_summary.json` & `c:\Users\devil\Desktop\VDA\data\`
- **Non-issuable ABHA Prefix:** `98-XXXX-XXXX-XXXX` (guarantees zero collision with real Aadhaar-seeded ABHA identities)
- **Geographic Coverage:**
  - **Haryana:** 109 patients (Districts: Gurugram, Faridabad, Karnal, Ambala, Panipat, Rohtak, etc.)
  - **Himachal Pradesh:** 91 patients (Districts: Solan, Shimla, Kangra, Mandi, Una, Bilaspur, Kullu, etc.)
- **7 Pilot Testing Categories (200 Cases Total):**
  1. **NCD Glucose / BP queries** (40 cases, `synth-patient-001` .. `040`): Type-2 diabetes, essential hypertension, routine self-monitoring.
  2. **Prescription interpretation** (30 cases, `synth-patient-041` .. `070`): Polypharmacy, complex dosages (e.g. before/after food, empty stomach), refill alerts.
  3. **Lab report explanation** (30 cases, `synth-patient-071` .. `100`): Diagnostic panels, trend explanations, layperson interpretations.
  4. **Emergency escalation cases** (25 cases, `synth-patient-101` .. `125`): Critical red-flags, severe hyperglycemia ($>300\text{ mg/dL}$), hypertensive crises ($>180/110\text{ mmHg}$), automatic tele-triage triggering.
  5. **Scheme / benefits queries** (20 cases, `synth-patient-126` .. `145`): PM-JAY ₹5L annual cashless hospital coverage, state schemes (HIMCARE HP, Chirayu Haryana).
  6. **Facility search queries** (15 cases, `synth-patient-146` .. `160`): Geo-located Civil Hospitals, PHCs, CHCs, Jan Aushadhi Kendras, Blood Banks.
  7. **Multilingual parity cases** (40 cases, `synth-patient-161` .. `200`): Hindi, English, Tamil, and Kannada translations with audio read-aloud parity.

### 9 Canonical Clinical LOINC Markers
Every patient in the dataset contains observations mapped to standard international LOINC codes:

| Marker | Canonical LOINC | Standard Unit | Reference Range | Clinical Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Fasting Glucose** | `1558-6` | mg/dL | $70 - 100$ | Baseline glycemic control after 8h fast |
| **Post-Prandial Glucose** | `1521-4` | mg/dL | $< 140$ | Post-meal glycemic spike evaluation |
| **HbA1c** | `4548-4` | % | $4.0 - 5.6$ (Target $< 7.0$) | 3-month average plasma glucose |
| **Systolic BP** | `8480-6` | mmHg | $90 - 120$ | Ventricular contraction blood pressure |
| **Diastolic BP** | `8462-4` | mmHg | $60 - 80$ | Ventricular relaxation blood pressure |
| **LDL Cholesterol** | `2089-1` | mg/dL | $< 100$ | Atherogenic dyslipidemia assessment |
| **eGFR** | `62238-1` | mL/min/1.73m² | $> 60$ | Renal filtration & kidney stage evaluation |
| **Urine Microalbumin** | `14959-1` | mg/g | $< 30$ | Early diabetic nephropathy screening |
| **BMI** | `39156-5` | kg/m² | $18.5 - 24.9$ | Anthropometric nutritional & metabolic index |

---

## 🏛️ System Architecture

```
                                  ┌──────────────────────────────────────────────┐
                                  │      VDA Mobile UI (Android APK / Web)       │
                                  │ React 19 • TailwindCSS v4 • Lucide • WebSpeech │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                    ┌────────────────────┴───────────────────┐
                                    ▼                                        ▼
                         [Voice Input Engine]                     [Text Input & Chips]
                      SpeechRecognition (hi/en/ta/kn)         Pre-configured Quick Prompts
                                    │                                        │
                                    └────────────────────┬───────────────────┘
                                                         ▼
                                       ┌───────────────────────────────────┐
                                       │   Deterministic Clinical Safety   │
                                       │    Gate (Red Flag Emergency Rule) │
                                       └─────────────────┬─────────────────┘
                                                         │
                                      Is Emergency? ─────┴───── Safe Query
                                     /                              \
                                   YES                               NO
                                  /                                    \
          ┌───────────────────────────────┐           ┌────────────────────────────────┐
          │ Full-Screen Emergency Modal   │           │   Modular API Client Service   │
          │ • Live Doctor Tele-Triage     │           │       (src/services/api.ts)    │
          │ • Ambulance 108 / 102 Call    │           └───────────────┬────────────────┘
          │ • Immediate Vitals Telemetry  │                           │
          └───────────────────────────────┘             ┌─────────────┴────────────┐
                                                        ▼                          ▼
                                            [Backend Connected?]        [Offline / Standalone?]
                                                        │                          │
                                                       YES                         NO
                                                        │                          │
                                        ┌───────────────┴───────────────┐          ▼
                                        │ External REST NestJS API      │   [Local VDA Rule Engine &]
                                        │ • ABDM Gateway (M1, M2, M3)   │   [Synthetic FHIR Dataset ]
                                        │ • Gemini 3.5 Flash / Sarvam   │
                                        │ • Prescription OCR Context    │
                                        └───────────────────────────────┘
```

---

## 🚀 Key Features

1. **Multilingual Voice-First Experience**:
   - Native speech recognition and text-to-speech support for **Hindi (हिन्दी)**, **English**, **Tamil (தமிழ்)**, and **Kannada (ಕನ್ನಡ)**.
   - Low-literacy accessibility: every message, prescription, lab test, and scheme card has a one-tap "Listen (बोलकर सुनें)" button.
2. **Clinical Safety Gate & Emergency Escalation**:
   - Zero-hallucination deterministic guardrail inspecting all user queries for red-flag medical emergencies:
     - **Cardiac**: Chest pain, tightness, radiating left arm pain, profuse cold sweating.
     - **Stroke (FAST Protocol)**: Slurred speech, facial drooping, unilateral arm weakness.
     - **Respiratory Distress**: Acute breathlessness, gasping for air.
     - **Critical Hypoglycemia**: Blood sugar $< 50\text{ mg/dL}$ with tremors and confusion.
     - **Hypertensive Crisis**: Blood pressure $> 190/120\text{ mmHg}$ with severe headache.
   - Triggers an instant full-screen takeover modal connecting the patient to simulated tele-emergency clinicians and ambulance dispatch (108 / 102).
3. **ABDM & FHIR R4 Standard Compliance**:
   - **ABHA Identity**: 14-digit ABHA Number (`91-4589-2041-8832`) and ABHA Address (`ramesh.kumar@abdm`).
   - **FHIR Conditions**: SNOMED CT and ICD-10 coded chronic conditions (e.g., E11.9 Type 2 Diabetes, I10 Hypertension).
   - **FHIR Medications**: Dosage schedules, frequency, timing (before/after meals), refill counters, and real-time adherence tracking.
   - **FHIR Observations**: LOINC-coded lab reports (e.g., `4548-4` HbA1c, `85354-9` Blood Pressure) with layman interpretations and clinical trends.
   - **FHIR Document References**: Digital prescriptions, discharge summaries, and OPD slips.
   - **Consent Manager Artifacts**: Granular consent tracking and instant revocation.
4. **Public Health Navigation (IPHS 2022)**:
   - **Fast-Track OPD QR Check-in**: Eliminates long hospital queues through instant digital token generation.
   - **Facility Directory**: Real-time distance, bed availability, and 24x7 emergency status for District Hospitals, Sub-District Hospitals, CHCs, PHCs, and Blood Banks across Haryana and Himachal Pradesh.
   - **PM Jan Aushadhi Generic Matcher**: Compares expensive branded drugs with government Jan Aushadhi generic alternatives, showing up to 85% cost savings.
   - **Government Scheme Finder**: Automated eligibility matching for PM-JAY, Ayushman Vay Vandana, and state health protection programs.

---

## 🔌 Backend Integration Guide

The mobile app includes a production-grade, typed API communication client located at [`src/services/api.ts`](src/services/api.ts).

### 1. Environment Configuration
Create or configure `.env.local` or `.env` in the project root:

```bash
# Production Backend URL (AWS EC2)
VITE_API_BASE_URL="https://vda-api.mdtlabs.org"

# Strict Live Connection (false ensures network errors surface during testing)
VITE_ENABLE_MOCK_FALLBACK="false"

# Pilot Dev Demo Credentials
VITE_DEV_DEMO_MODE="true"
VITE_DEV_AUTH_TOKEN="vda-pilot-secret-dev-token-2026"
```

> **Note for Local Testing & Android Emulators:**
> - Local NestJS Backend on development machine: `http://localhost:3000`
> - Android Emulator: Use `http://10.0.2.2:3000` to reach the development machine.
> - Physical Android Device: Connect to the production endpoint `https://vda-api.mdtlabs.org` or your local machine IP (e.g., `http://192.168.1.50:3000`).

---

### 2. Core Backend REST Endpoints Connected

| Operation | Method & Endpoint | Payload / Params | Purpose |
| :--- | :--- | :--- | :--- |
| **Dev Auth Token** | `GET /api/v1/dev/auth/token` | None | Retrieves initial session bearer token |
| **Session Initiation** | `POST /api/v1/sessions` | `{ "patientId": "synth-patient-001" }` | Establishes authenticated conversation session |
| **VDA Conversation Turn** | `POST /api/v1/conversations/turns` | `{ "sessionId", "userQuery", "language", "prescription_context_required" }` | Executes multi-agent RAG, safety gates, and AI orchestration |
| **Prescription Upload (OCR)** | `POST /api/v1/sessions/:id/prescriptions` | `multipart/form-data` (`file`) | Gemini Multimodal extraction of medicine, dosage, and frequency |
| **Prescription Context Sync** | `POST /api/v1/sessions/:id/prescription-context` | `{ "medicines", "reminders", "rawNotes" }` | Caches active medicine schedule in Redis for contextual query evaluation |
| **Get Active Prescription Context** | `GET /api/v1/sessions/:id/prescription-context` | None | Checks current active prescription context for session |
| **Clear Prescription Context** | `DELETE /api/v1/sessions/:id/prescription-context` | None | Flushes prescription context from session |
| **Public Facilities Search** | `GET /api/v1/facilities` | `?state=Haryana&district=Gurugram` | Retrieves IPHS-classified healthcare facilities |
| **Health Diagnostics** | `GET /api/v1/health` | None | Returns database, pgvector, and Redis health status |

---

## 🏃 Running the Project Locally

### Prerequisites
- **Node.js**: v20+ (tested on Node v22.18.0)
- **npm**: v10+ (tested on npm 10.9.3)
- **Java JDK**: JDK 17, 21, or 22 (tested with Oracle Java 22.0.2)
- **Android SDK**: Build tools 34.0.0+ and platform `android-34` / `android-35` / `android-36`

### 1. Run the Web App (Development Mode)
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Building the Android APK

### One-Command APK Build
To compile web assets, synchronize with Capacitor, and build the native Android debug APK via Gradle:
```bash
npm run build:apk
```

### Step-by-Step Manual Android Build
```bash
# 1. Compile Vite production bundle
npm run build

# 2. Sync web bundle to Android native project
npx cap sync android

# 3. Enter Android project and compile APK
cd android
./gradlew assembleDebug       # Linux/macOS
.\gradlew.bat assembleDebug   # Windows PowerShell / CMD
cd ..
```

The compiled APK will be created at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```
Copy it to the project root for testing:
```bash
cp android/app/build/outputs/apk/debug/app-debug.apk ./VDA.apk
```

### Opening in Android Studio
```bash
npx cap open android
```

---

## 📂 Project Directory Structure

```
android-pilot/
├── android/                             # Native Android Studio project (Capacitor wrapper)
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml# Android permissions (Audio recording, Internet, Camera)
│   │   ├── src/main/assets/public/     # Synced production web bundle
│   │   └── build.gradle                # Android app build configuration
│   └── local.properties                # Android SDK location
├── src/
│   ├── components/
│   │   ├── VdaTab.tsx                  # Voice assistant conversation, audio controls & chips
│   │   ├── RecordsTab.tsx              # FHIR R4 medical history, lab graphs & adherence
│   │   ├── FacilitiesTab.tsx           # Hospital locator, OPD QR tokens, Jan Aushadhi & Schemes
│   │   ├── ProfileTab.tsx              # Official ABDM ABHA card & consent management
│   │   ├── MedicineRemindersModal.tsx  # Daily medicine schedule, alarms & prescription OCR upload
│   │   ├── EscalationModal.tsx         # Clinical emergency takeover modal & tele-triage
│   │   ├── LogVitalModal.tsx           # Self-reporting vitals dialog (Sugar, BP, SpO2)
│   │   ├── EmergencyFallbackCard.tsx   # Offline/emergency action card
│   │   └── OnboardingModal.tsx         # Multilingual onboarding & ABHA setup
│   ├── services/
│   │   ├── api.ts                      # Unified NestJS API client (auth, sessions, OCR, turns)
│   │   └── medicine-reminder.service.ts# Local reminders, OCR extraction & context synchronization
│   ├── data/
│   │   ├── syntheticData.ts            # ABDM synthetic patient personas & facility databases
│   │   └── patients_200_summary.json   # 200 Gold synthetic patient registry
│   ├── utils/
│   │   ├── i18n.ts                     # Multilingual translations & Web Speech TTS engine
│   │   ├── safetyGate.ts               # Deterministic clinical emergency red-flag rules
│   │   └── vdaEngine.ts                # Domain routing and health query interpreter
│   ├── types/
│   │   └── index.ts                    # ABDM & FHIR R4 TypeScript interface definitions
│   ├── App.tsx                         # Main app layout, tab navigation & state coordinator
│   └── main.tsx                        # React application entry point
├── capacitor.config.ts                 # Capacitor configuration (App ID: in.gov.abdm.vdahealth)
├── VDA.apk                             # Compiled Production Android Debug APK (~4.5 MB)
├── vda-health-assistant.apk            # Mirrored Android Debug APK
├── vite.config.ts                      # Vite build & TailwindCSS v4 plugin setup
└── package.json                        # Scripts, Capacitor dependencies and project metadata
```

---

## 🧪 Comprehensive Vitest Test Suite

The mobile application features complete unit and integration test coverage verifying the VDA Engine, clinical safety gates, prescription reminder workflows, and API fallback mechanisms:

```bash
npm test
```

```
Test Files  8 passed (8)
     Tests  113 passed (113)
  Duration  2.75s (100% pass)
```

- `src/__tests__/security.test.ts`: Injection defense, XSS sanitation, red-flag triage.
- `src/utils/__tests__/vdaEngine.test.ts`: Query classification and response generation.
- `src/services/__tests__/api.test.ts`: Live backend session management and offline fallback.
- `src/components/__tests__/EscalationModal.test.tsx`: Clinical escalation, tele-triage, and hospital locator.
- `src/components/__tests__/LogVitalModal.test.tsx`: Patient vitals logging.
- `src/utils/__tests__/safetyGate.test.ts`: Red-flag rule triggers & emergency routing.
- `src/utils/__tests__/i18n.test.ts`: Multilingual text parity and language switching.

---

## 🔗 Repository Links

- **Medtronic LABS Organization:** [https://github.com/Medtronic-LABS/vda-mobile](https://github.com/Medtronic-LABS/vda-mobile)
- **Personal Repository:** [https://github.com/denispaul2406/VDA-mobile](https://github.com/denispaul2406/VDA-mobile)

---

## 📄 License
This project is licensed under the MIT License. Developed for the Ayushman Bharat Digital Mission (ABDM) digital health ecosystem.
