declare const __VDA_FCM_CONFIGURED__: boolean;
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiService } from './api';

type Notice = { prescriptionId: string; eventId: string };

class PushNotificationService {
  private userId: string | null = null;
  private handles: PluginListenerHandle[] = [];
  private onNotice: ((notice: Notice, tapped: boolean) => void) | null = null;
  private lastEventId: string | null = null;
  private initialized = false;

  private notice(data: Record<string, unknown> | undefined): Notice | null {
    if (data?.type !== 'PRESCRIPTION_REVIEW') return null;
    if (typeof data.prescriptionId !== 'string' || typeof data.eventId !== 'string') return null;
    if (!/^[0-9a-f-]{36}$/i.test(data.prescriptionId) || !/^[0-9a-f-]{36}$/i.test(data.eventId)) return null;
    return { prescriptionId: data.prescriptionId, eventId: data.eventId };
  }

  async initialize(onNotice: (notice: Notice, tapped: boolean) => void): Promise<void> {
    this.onNotice = onNotice;
    if (this.initialized || !__VDA_FCM_CONFIGURED__ || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    this.initialized = true;
    try {
      this.handles = await Promise.all([
        PushNotifications.addListener('registration', ({ value }) => {
          if (this.userId && value) void apiService.registerPushDevice(value).catch(() => undefined);
        }),
        PushNotifications.addListener('registrationError', () => undefined),
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          const notice = this.notice(notification.data);
          if (notice && this.userId && notice.eventId !== this.lastEventId) {
            this.lastEventId = notice.eventId;
            this.onNotice?.(notice, false);
          }
        }),
        PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const notice = this.notice(notification.data);
          if (notice) this.onNotice?.(notice, true);
        }),
      ]);
    } catch {
      this.initialized = false;
      this.handles.forEach((handle) => void handle.remove());
      this.handles = [];
    }
  }

  async register(userId: string): Promise<void> {
    this.userId = userId;
    if (!this.initialized) return;
    try {
      await PushNotifications.createChannel({
        id: 'prescription_updates', name: 'VDA Health updates',
        description: 'Updates about your VDA Health account', importance: 4,
      });
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
      if (permission.receive === 'granted' && this.userId === userId) await PushNotifications.register();
    } catch {
      // Firebase configuration or notification permission may be unavailable.
      // Existing in-app prescription notices remain the fallback.
    }
  }

  async unregister(): Promise<void> {
    this.userId = null;
    this.lastEventId = null;
    await apiService.unregisterPushDevices().catch(() => undefined);
  }

  clearLocal(): void {
    this.userId = null;
    this.lastEventId = null;
  }
}

export const pushNotificationService = new PushNotificationService();
