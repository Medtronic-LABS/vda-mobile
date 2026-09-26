import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RemindersTab } from '../RemindersTab';

const noOp = async () => undefined;

describe('RemindersTab prescription decision guidance', () => {
  it('shows a replacement rejection reason while preserving the existing active plan', () => {
    const onResubmit = vi.fn();
    render(<RemindersTab
      lang="hi"
      snapshot={{
        reminders: [],
        progress: { scheduledToday: 0, takenToday: 0, currentStreakDays: 0 },
        notificationPermission: 'granted',
        todayTakenKeys: [],
        todayOutcomeByKey: {},
        activePrescription: {
          id: 'active-a', processedAt: '2026-09-20T00:00:00Z', status: 'VERIFIED',
          verificationStatus: 'VERIFIED', activePlan: true, planRevision: 2,
          medicines: [{ id: 'medicine-a', medicineIndex: 0, medicineName: 'Telma 40', dosageText: '40 mg', frequency: 'once daily', administrationInstruction: null, extractedTimingText: null, confirmed: true, requiresConfirmation: false }],
        },
      }}
      prescriptionState={{
        id: 'draft-b', patientId: 'patient-a', prescriptionId: 'replacement-b', createdAt: '2026-09-23T00:00:00Z',
        extractionStatus: 'REVIEW_REQUIRED', verificationStatus: 'REJECTED', activePlan: false, planRevision: 3,
        patientReviewReason: 'फोटो में डॉक्टर की मुहर दिखाई नहीं दे रही है।', medicines: [],
      }}
      contextSyncError={null}
      onRecordAdherence={noOp}
      onSnooze={noOp}
      onDeleteReminder={noOp}
      onEnableNotifications={noOp}
      onOpenUploadPrescription={vi.fn()}
      onResubmitPrescription={onResubmit}
      onClearAllReminders={noOp}
    />);

    expect(screen.getByText('पर्ची स्वीकार नहीं हुई')).toBeTruthy();
    expect(screen.getByText('फोटो में डॉक्टर की मुहर दिखाई नहीं दे रही है।')).toBeTruthy();
    expect(screen.getByText('स्वास्थ्यकर्मी द्वारा सत्यापित दवाइयाँ')).toBeTruthy();
    expect(screen.getByText('Telma 40')).toBeTruthy();
    fireEvent.click(screen.getByText('दूसरी पर्ची अपलोड करें'));
    expect(onResubmit).toHaveBeenCalledTimes(1);
  });

  it('shows pending extraction and tests read-only without inventing missing fields or reminder actions', () => {
    const props = {
      lang: 'hi' as const,
      snapshot: {
        reminders: [], progress: { scheduledToday: 0, takenToday: 0, currentStreakDays: 0 },
        notificationPermission: 'granted' as const, todayTakenKeys: [], todayOutcomeByKey: {}, activePrescription: null,
      },
      prescriptionState: {
        id: 'draft-b', patientId: 'patient-a', prescriptionId: 'pending-b', createdAt: '2026-09-23T00:00:00Z',
        extractionStatus: 'REVIEW_REQUIRED' as const, verificationStatus: 'UNVERIFIED' as const,
        activePlan: false, planRevision: 1, medicines: [],
      },
      latestSubmission: {
        id: 'pending-b', extractionStatus: 'REVIEW_REQUIRED', verificationStatus: 'UNVERIFIED', activePlan: false,
        extractedDetails: {
          medications: [{ name: 'Telma 40', strength: null, frequency: null, timing: null, uncertain: true }],
          investigations: [{ name: 'HbA1c', uncertain: false }],
        },
      },
      contextSyncError: null,
      onRecordAdherence: noOp, onSnooze: noOp, onDeleteReminder: noOp,
      onEnableNotifications: noOp, onOpenUploadPrescription: vi.fn(),
      onResubmitPrescription: vi.fn(), onClearAllReminders: noOp,
    };
    const view = render(<RemindersTab {...props} />);
    expect(screen.getByText('आपकी नई पर्ची से मिली जानकारी')).toBeTruthy();
    expect(screen.getByText('Telma 40')).toBeTruthy();
    expect(screen.getByText(/HbA1c/)).toBeTruthy();
    expect(screen.queryByText('40 mg')).toBeNull();
    expect(screen.queryByText('रिमाइंडर समय चुनें')).toBeNull();
    expect(screen.queryByText('ले ली')).toBeNull();
    view.rerender(<RemindersTab {...props} latestSubmission={null} prescriptionState={null} />);
    expect(screen.queryByText('Telma 40')).toBeNull();
  });

  it('keeps verified A and its existing reminder visible beside pending B', () => {
    render(<RemindersTab
      lang="hi"
      snapshot={{
        reminders: [{
          id: 'reminder-a', prescriptionId: 'active-a', planRevision: 2, medicineId: 'medicine-a',
          medicineName: 'Verified A', dosageText: '40 mg', frequency: 'once daily',
          times: ['10:00'], active: true,
        } as any],
        progress: { scheduledToday: 1, takenToday: 0, currentStreakDays: 0 },
        notificationPermission: 'granted', todayTakenKeys: [], todayOutcomeByKey: {},
        activePrescription: {
          id: 'active-a', processedAt: '2026-09-20T00:00:00Z', status: 'VERIFIED',
          verificationStatus: 'VERIFIED', activePlan: true, planRevision: 2,
          medicines: [{ id: 'medicine-a', medicineIndex: 0, medicineName: 'Verified A', dosageText: '40 mg', frequency: 'once daily', administrationInstruction: null, extractedTimingText: null, confirmed: true, requiresConfirmation: false }],
        },
      }}
      prescriptionState={{
        id: 'draft-b', patientId: 'patient-a', prescriptionId: 'pending-b', createdAt: '2026-09-23T00:00:00Z',
        extractionStatus: 'EXTRACTED', verificationStatus: 'PENDING_VERIFICATION', activePlan: false, planRevision: 3, medicines: [],
      }}
      latestSubmission={{
        id: 'pending-b', extractionStatus: 'EXTRACTED', verificationStatus: 'PENDING_VERIFICATION', activePlan: false,
        extractedDetails: { medications: [{ name: 'Extracted B', strength: '5 mg', frequency: 'once daily', timing: null, uncertain: false }], investigations: [] },
      }}
      contextSyncError={null}
      onRecordAdherence={noOp} onSnooze={noOp} onDeleteReminder={noOp}
      onEnableNotifications={noOp} onOpenUploadPrescription={vi.fn()}
      onResubmitPrescription={vi.fn()} onClearAllReminders={noOp}
    />);
    expect(screen.getByText('Extracted B')).toBeTruthy();
    expect(screen.getByText('Verified A')).toBeTruthy();
    expect(screen.getByText('रिमाइंडर समय चुनें')).toBeTruthy();
  });
});
