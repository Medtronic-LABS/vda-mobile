import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

import { MedicineReminderService, PrescriptionReminderDraft, classifyAdherenceQuestion, classifyPrescriptionMedicineQuery, prescriptionToReminderDraft } from '../medicine-reminder.service';
import { RemindersTab } from '../../components/RemindersTab';

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
  afterEach(() => vi.useRealTimers());

  it.each([
    ['Aaj ki kaunsi medicine pending hai?', 'PENDING'],
    ['Kal ki missed medicines dikhao.', 'MISSED'],
    ['Meri medicine lene ki streak kitni hai?', 'STREAK'],
    ['Maine galti se medicine taken mark kar di.', 'CORRECTION'],
  ] as const)('recognizes %s as %s rather than a prescription list', (question, kind) => {
    expect(classifyAdherenceQuestion(question)).toBe(kind);
  });

  it.each([
    'Aaj ki pending medicine kya abhi le lu?',
    'Should I take a missed dose now?',
    'Can I double my pending medicine?',
  ])('does not answer a clinical dose decision locally: %s', (question) => {
    expect(classifyAdherenceQuestion(question)).toBeNull();
  });

  it('sends a named medicine timing question to verified prescription context', async () => {
    const service = new MedicineReminderService();
    const snapshot = await service.snapshot('patient-a');
    expect(classifyPrescriptionMedicineQuery('Mujhe Metformin kab leni hai?', snapshot).route).toBe('PRESCRIPTION_FACT');
  });

  it('answers from the current patient device record and never another account', async () => {
    const service = new MedicineReminderService();
    const draft = verifiedDraft('patient-a', '77777777-7777-7777-7777-777777777777', 1);
    const current = await activate(service, draft);
    const question = 'Aaj ki kaunsi medicine pending hai?';
    expect(await service.answerAdherenceQuestion('patient-a', question, 'hi')).toContain('Medicine 1');
    expect(await service.answerAdherenceQuestion('patient-b', question, 'hi')).not.toContain('Medicine 1');
    await service.recordAdherenceFromApp('patient-a', current.reminders[0].id, '08:00', 'TAKEN');
    expect(await service.answerAdherenceQuestion('patient-a', question, 'hi')).toContain('सभी पुष्ट रिमाइंडर');
    expect(await service.answerAdherenceQuestion('patient-a', 'Meri medicine lene ki streak kitni hai?', 'hi')).toContain('1 दिन');
  });

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

  it('keeps India-day pending and missed answers stable and separates recorded outcomes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T03:30:00Z')); // 09:00 India time
    const service = new MedicineReminderService();
    const draft = verifiedDraft('patient-a', '88888888-8888-8888-8888-888888888888', 1);
    const activated = await activate(service, draft);
    const reminder = activated.reminders[0];
    await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'TAKEN');

    vi.setSystemTime(new Date('2026-10-18T19:00:00Z')); // 00:30 on 19 October in India
    const question = 'Aaj ki kaunsi medicine pending hai?';
    const first = await service.answerAdherenceQuestion('patient-a', question, 'hi');
    expect(first).toContain('आगे के रिमाइंडर: Medicine 1 — 08:00');
    expect(await service.answerAdherenceQuestion('patient-a', question, 'hi')).toBe(first);
    expect(await service.answerAdherenceQuestion('patient-a', 'Kal ki missed medicines dikhao.', 'hi'))
      .toContain('सभी पुष्ट रिमाइंडर');
    expect(await service.answerAdherenceQuestion('patient-a', 'Meri medicine lene ki streak kitni hai?', 'hi'))
      .toContain('1 दिन');

    vi.setSystemTime(new Date('2026-10-19T04:00:00Z')); // 09:30 India time
    expect(await service.answerAdherenceQuestion('patient-a', question, 'hi'))
      .toContain('समय बीत गया, लेने का रिकॉर्ड नहीं');
    await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'SKIPPED');
    expect(await service.answerAdherenceQuestion('patient-a', question, 'hi'))
      .toContain('“छोड़ दी” दर्ज');
    await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'NOT_TAKEN');
    expect(await service.answerAdherenceQuestion('patient-a', question, 'hi'))
      .toContain('“नहीं ली” दर्ज');
  });

  it('corrects an accidentally marked dose through the real Medicines tab control and local store', async () => {
    const service = new MedicineReminderService();
    const draft = verifiedDraft('patient-a', '99999999-9999-9999-9999-999999999999', 1);
    const initial = await activate(service, draft);
    const reminder = initial.reminders[0];
    let snapshot = await service.recordAdherenceFromApp('patient-a', reminder.id, '08:00', 'TAKEN');
    const onRecordAdherence = async (id: string, time: string, action: any) => {
      snapshot = await service.recordAdherenceFromApp('patient-a', id, time, action);
      view.rerender(element());
    };
    const element = () => React.createElement(RemindersTab, {
      lang: 'hi', snapshot, prescriptionState: null, contextSyncError: null,
      onRecordAdherence, onSnooze: async () => undefined, onDeleteReminder: async () => undefined,
      onEnableNotifications: async () => undefined, onOpenUploadPrescription: () => undefined,
      onResubmitPrescription: () => undefined, onClearAllReminders: async () => undefined,
    });
    const view = render(element());
    expect(await service.answerAdherenceQuestion('patient-a', 'Maine galti se medicine taken mark kar di.', 'hi'))
      .toContain('“नहीं ली” चुनें');
    expect(await service.answerAdherenceQuestion('patient-a', 'Kal galti se medicine taken mark kar di.', 'hi'))
      .toContain('कल का रिकॉर्ड दवाइयाँ टैब से अभी नहीं बदल सकता');
    fireEvent.click(screen.getByRole('button', { name: 'नहीं ली' }));
    await waitFor(() => expect(snapshot.todayOutcomeByKey[`${reminder.id}:08:00`]).toBe('NOT_TAKEN'));
    expect(snapshot.progress.takenToday).toBe(0);
    expect((await service.snapshot('patient-a')).todayOutcomeByKey[`${reminder.id}:08:00`]).toBe('NOT_TAKEN');
    const events = JSON.parse(preferenceValues.get('medicine-reminder-store-v1')!).patients['patient-a'].events;
    expect(events.filter((event: any) => event.status !== 'SNOOZED')).toHaveLength(1);
  });
});
