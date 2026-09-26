import { beforeEach, describe, expect, it, vi } from 'vitest';

const preferenceValues = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    configure: vi.fn(async () => undefined),
    get: vi.fn(async ({ key }: { key: string }) => ({ value: preferenceValues.get(key) || null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { preferenceValues.set(key, value); }),
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    cancel: vi.fn(async () => undefined),
    schedule: vi.fn(async () => undefined),
    checkPermissions: vi.fn(async () => ({ display: 'denied' })),
    requestPermissions: vi.fn(async () => ({ display: 'denied' })),
    createChannel: vi.fn(async () => undefined),
    registerActionTypes: vi.fn(async () => undefined),
    addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })),
  },
}));

import { MedicineReminderService, PrescriptionReminderDraft, prescriptionToReminderDraft } from '../medicine-reminder.service';

const verifiedDraft = (patientId: string, prescriptionId: string, revision: number): PrescriptionReminderDraft => {
  const draft = prescriptionToReminderDraft(patientId, {
    id: prescriptionId,
    verificationStatus: 'VERIFIED',
    activePlan: true,
    planRevision: revision,
    medications: [{ medicationName: `Medicine ${revision}`, strength: '40 mg', frequency: 'once daily' }],
  });
  draft.medicines = draft.medicines.map((medicine) => ({
    ...medicine,
    enabled: true,
    confirmed: true,
    times: ['08:00'],
  }));
  return draft;
};

const activate = async (service: MedicineReminderService, draft: PrescriptionReminderDraft) => {
  await service.saveExtractedPrescription(draft);
  return service.confirmDraft(draft);
};

describe('local-only medication adherence', () => {
  beforeEach(() => preferenceValues.clear());

  it('keeps one explicit outcome per deterministic occurrence and counts only TAKEN', async () => {
    const service = new MedicineReminderService();
    const draft = verifiedDraft('patient-a', '11111111-1111-1111-1111-111111111111', 1);
    const initial = await activate(service, draft);
    const reminder = initial.reminders[0];

    expect(initial.todayOutcomeByKey).toEqual({});
    let snapshot = await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'TAKEN');
    expect(snapshot.todayOutcomeByKey[`${reminder.id}:08:00`]).toBe('TAKEN');
    expect(snapshot.progress.takenToday).toBe(1);

    await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'TAKEN');
    snapshot = await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'SKIPPED');
    expect(snapshot.todayOutcomeByKey[`${reminder.id}:08:00`]).toBe('SKIPPED');
    expect(snapshot.progress.takenToday).toBe(0);

    snapshot = await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'NOT_TAKEN');
    expect(snapshot.todayOutcomeByKey[`${reminder.id}:08:00`]).toBe('NOT_TAKEN');
    expect(snapshot.progress.takenToday).toBe(0);

    const stored = JSON.parse(preferenceValues.get('medicine-reminder-store-v1')!);
    const outcomes = stored.patients['patient-a'].events.filter((event: any) => event.status !== 'SNOOZED');
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      prescriptionId: draft.prescriptionId,
      planRevision: 1,
      medicineIndex: 0,
      scheduledTime: '08:00',
      status: 'NOT_TAKEN',
    });
    expect(outcomes[0].occurrenceId).toContain('patient-a');
  });

  it('keeps snooze separate, leaves ignored occurrences unconfirmed, and isolates accounts', async () => {
    const service = new MedicineReminderService();
    const draft = verifiedDraft('patient-a', '22222222-2222-2222-2222-222222222222', 1);
    const initial = await activate(service, draft);
    const reminder = initial.reminders[0];

    await service.snoozeFromApp('patient-a', reminder.id, '08:00');
    const patientA = await service.snapshot('patient-a');
    const patientB = await service.snapshot('patient-b');
    expect(patientA.todayOutcomeByKey).toEqual({});
    expect(patientA.progress.takenToday).toBe(0);
    expect(patientB.todayOutcomeByKey).toEqual({});
    expect(patientB.reminders).toEqual([]);
  });

  it('preserves old-plan history but excludes it from a superseding plan', async () => {
    const service = new MedicineReminderService();
    const oldDraft = verifiedDraft('patient-a', '33333333-3333-3333-3333-333333333333', 1);
    const oldSnapshot = await activate(service, oldDraft);
    await service.recordAdherenceFromApp('patient-a', oldSnapshot.reminders[0].id, '08:00', 'TAKEN');

    const newDraft = verifiedDraft('patient-a', '44444444-4444-4444-4444-444444444444', 2);
    const current = await activate(service, newDraft);
    expect(current.activePrescription?.id).toBe(newDraft.prescriptionId);
    expect(current.todayOutcomeByKey).toEqual({});
    expect(current.progress.takenToday).toBe(0);
    await expect(service.recordAdherenceFromApp('patient-a', oldSnapshot.reminders[0].id, '08:00', 'TAKEN'))
      .rejects.toThrow('ACTIVE_VERIFIED_REMINDER_REQUIRED');
    const newReminder = current.reminders[0];
    const updated = await service.recordAdherenceFromApp('patient-a', newReminder.id, '08:00', 'TAKEN');
    expect(updated.todayOutcomeByKey[`${newReminder.id}:08:00`]).toBe('TAKEN');

    const stored = JSON.parse(preferenceValues.get('medicine-reminder-store-v1')!);
    expect(stored.patients['patient-a'].events).toHaveLength(2);
    expect(stored.patients['patient-a'].events[0].prescriptionId).toBe(oldDraft.prescriptionId);
    expect(stored.patients['patient-a'].events[1].prescriptionId).toBe(newDraft.prescriptionId);
  });

  it('does not replace an active verified plan or its reminders with a pending extraction', async () => {
    const service = new MedicineReminderService();
    const active = verifiedDraft('patient-a', '55555555-5555-5555-5555-555555555555', 1);
    const before = await activate(service, active);
    const pending = prescriptionToReminderDraft('patient-a', {
      id: '66666666-6666-6666-6666-666666666666',
      verificationStatus: 'PENDING_VERIFICATION', activePlan: false,
      medications: [{ medicationName: 'Unverified B', strength: '5 mg', frequency: 'once daily' }],
    });
    expect(pending.medicines).toEqual([]);

    const after = await service.saveExtractedPrescription(pending);

    expect(after.activePrescription?.id).toBe(active.prescriptionId);
    expect(after.reminders.map((reminder) => reminder.id)).toEqual(before.reminders.map((reminder) => reminder.id));
    expect(after.reminders.every((reminder) => reminder.active)).toBe(true);
    expect(JSON.stringify(after.reminders)).not.toContain('Unverified B');
    expect((await service.snapshot('patient-b')).reminders).toEqual([]);
  });
});
