import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  stored: '' as string,
  scheduled: [] as Array<{ notifications: Array<{ id: number }> }>,
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: {
  configure: vi.fn(async () => undefined),
  get: vi.fn(async () => ({ value: state.stored || null })),
  set: vi.fn(async ({ value }: { value: string }) => { state.stored = value; }),
} }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  getPending: vi.fn(async () => ({ notifications: [] })),
  cancel: vi.fn(async () => undefined),
  schedule: vi.fn(async (options: { notifications: Array<{ id: number }> }) => {
    state.scheduled.push(options);
  }),
} }));

import { MedicineReminderService } from '../medicine-reminder.service';

const storedPlan = (verificationStatus: 'VERIFIED' | 'UNVERIFIED') => JSON.stringify({ patients: {
  patient: {
    activePrescriptionId: 'plan', notificationPermission: 'granted', events: [],
    prescriptions: [{ id: 'plan', status: verificationStatus, verificationStatus,
      activePlan: true, planRevision: 1, medicines: [{ id: 'medicine', medicineIndex: 0,
        medicineName: 'Test medicine', confirmed: true }] }],
    reminders: [{ id: 'reminder', prescriptionId: 'plan', planRevision: 1,
      medicineId: 'medicine', medicineIndex: 0, medicineName: 'Test medicine', dosageText: '',
      frequency: null, times: ['09:00'], startDate: '2026-10-07', active: true,
      confirmed: true, notificationIds: [], createdAt: '2026-10-07T00:00:00Z' }],
  },
} });

describe('medicine reminders after reboot', () => {
  beforeEach(() => { state.scheduled = []; state.stored = ''; });

  it('restores a missing alarm for an active worker-verified plan', async () => {
    state.stored = storedPlan('VERIFIED');
    await new MedicineReminderService().reconcileNotifications('patient');
    expect(state.scheduled).toHaveLength(1);
    expect(state.scheduled[0].notifications).toHaveLength(1);
  });

  it('never creates an alarm from an unverified plan', async () => {
    state.stored = storedPlan('UNVERIFIED');
    await new MedicineReminderService().reconcileNotifications('patient');
    expect(state.scheduled).toHaveLength(0);
  });
});
