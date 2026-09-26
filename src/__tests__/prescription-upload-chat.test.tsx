import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '../types';

const harness = vi.hoisted(() => ({
  listener: null as null | ((user: UserProfile | null) => void),
  currentUser: null as UserProfile | null,
  uploaded: false,
  processTurn: vi.fn(),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(async () => ({ value: null })), set: vi.fn(async () => undefined) },
}));

vi.mock('../services/auth.service', () => ({
  authService: {
    init: vi.fn(async () => undefined),
    subscribe: vi.fn((listener: (user: UserProfile | null) => void) => {
      harness.listener = listener;
      listener(harness.currentUser);
      return () => { harness.listener = null; };
    }),
    getUser: vi.fn(() => harness.currentUser),
    invalidateAuthentication: vi.fn(async () => undefined),
  },
}));

vi.mock('../services/api', () => ({
  VdaApiError: class VdaApiError extends Error {},
  apiService: {
    initAuthToken: vi.fn(async () => undefined),
    createPatientSession: vi.fn(async () => ({ session_id: `session-${harness.currentUser?.id}` })),
    getCurrentPrescriptionState: vi.fn(async () => harness.currentUser?.id === 'patient-a' && harness.uploaded
      ? {
          activePlan: null,
          latestSubmission: {
            id: 'pending-a', extractionStatus: 'EXTRACTED', verificationStatus: 'PENDING_VERIFICATION', activePlan: false,
            extractedDetails: {
              medications: [{ name: 'Telma 40', strength: '40 mg', frequency: null, timing: null, uncertain: false }],
              investigations: [{ name: 'HbA1c', uncertain: false }],
            },
          },
        }
      : { activePlan: null, latestSubmission: null }),
    uploadPrescription: vi.fn(async () => {
      harness.uploaded = true;
      return { id: 'pending-a', extractionStatus: 'EXTRACTED', verificationStatus: 'PENDING_VERIFICATION', activePlan: false, planRevision: 1, medications: [] };
    }),
    processVdaQuery: harness.processTurn,
  },
}));

vi.mock('../services/medicine-reminder.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/medicine-reminder.service')>();
  const emptySnapshot = () => ({
    reminders: [], progress: { scheduledToday: 0, takenToday: 0, currentStreakDays: 0 },
    notificationPermission: 'granted', todayTakenKeys: [], todayOutcomeByKey: {}, activePrescription: null,
  });
  return {
    ...actual,
    medicineReminderService: {
      snapshot: vi.fn(async () => emptySnapshot()),
      initialize: vi.fn(async () => () => undefined),
      beginPrescriptionProcessing: vi.fn(async () => undefined),
      saveExtractedPrescription: vi.fn(async () => emptySnapshot()),
    },
  };
});

vi.mock('../components/VdaTab', () => ({
  VdaTab: ({ messages, onSendMessage }: {
    messages: Array<{ textHi?: string; sections?: Array<{ title?: string; body?: string; bullets?: string[] }> }>;
    onSendMessage: (text: string, attachment: File) => Promise<void>;
  }) => <div>
    {messages.map((message, index) => <div key={index}>{message.textHi}{message.sections?.map((section, sectionIndex) =>
      <div key={sectionIndex}>{section.title} {section.body} {section.bullets?.join(' ')}</div>)}</div>)}
    <button onClick={() => void onSendMessage('upload', new File(['prescription'], 'rx.png', { type: 'image/png' }))}>Upload test prescription</button>
  </div>,
}));

import App from '../App';

const user = (id: string): UserProfile => ({
  id, phone: '0000000000', fullName: id, age: 40, gender: 'female', state: 'Haryana', district: 'Faridabad', language: 'hi',
});

describe('prescription upload chat isolation', () => {
  beforeEach(() => {
    harness.currentUser = user('patient-a');
    harness.uploaded = false;
    harness.processTurn.mockClear();
  });

  it('shows the safe extraction after upload, never sends a turn, and clears it on account switch', async () => {
    render(<App />);
    fireEvent.click(await screen.findByText('Upload test prescription'));
    expect(await screen.findByText(/Telma 40 — 40 mg/)).toBeTruthy();
    expect(screen.getByText(/HbA1c/)).toBeTruthy();
    expect(screen.getByText(/सत्यापन बाकी है/)).toBeTruthy();
    expect(harness.processTurn).not.toHaveBeenCalled();

    await act(async () => {
      harness.currentUser = user('patient-b');
      harness.listener?.(harness.currentUser);
    });
    await waitFor(() => expect(screen.queryByText(/Telma 40 — 40 mg/)).toBeNull());
    expect(screen.queryByText(/HbA1c/)).toBeNull();
  });
});
