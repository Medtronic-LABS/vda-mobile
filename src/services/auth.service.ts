import { UserProfile } from '../types';
import { apiService, AuthResponse, SignupDto, VdaApiError } from './api';
import { authTokenStorage, StoredCredentials } from './auth-token-storage';
import { Preferences } from '@capacitor/preferences';
import { medicineReminderService } from './medicine-reminder.service';
import { pushNotificationService } from './push-notification.service';

const TOKEN_STORAGE_KEY = 'vda_auth_token';
type AuthListener = (user: UserProfile | null) => void;

export class AuthService {
  private currentUser: UserProfile | null = null;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private pendingRefreshToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private listeners = new Set<AuthListener>();
  private initialized = false;
  private initialization: Promise<UserProfile | null> | null = null;
  private authEpoch = 0;
  private persistenceQueue: Promise<void> = Promise.resolve();
  private sessionPersisted = true;

  constructor(autoInitialize = true) {
    apiService.setRefreshHandler(() => this.renewSession());
    if (autoInitialize) void this.init();
  }

  public async init(): Promise<UserProfile | null> {
    if (this.initialized) return this.currentUser;
    if (this.initialization) return this.initialization;
    this.initialization = this.restoreAuthenticatedSession();
    return this.initialization;
  }

  private async restoreAuthenticatedSession(): Promise<UserProfile | null> {
    const epoch = this.authEpoch;
    let completed = false;
    this.diagnostic('INITIALIZE_START', epoch);
    try {
      const credentials = await authTokenStorage.getCredentials();
      if (epoch !== this.authEpoch) return this.currentUser;
      if (!credentials) {
        completed = true;
        this.diagnostic('INITIALIZE_EMPTY', epoch);
        return null;
      }
      this.token = credentials.accessToken;
      this.refreshToken = credentials.refreshToken || null;
      this.pendingRefreshToken = credentials.pendingRefreshToken || null;
      apiService.setAuthToken(credentials.accessToken);
      apiService.setAccessExpiry(credentials.expiresAt);
      const profile = await apiService.getProfile();
      if (epoch !== this.authEpoch) return this.currentUser;
      this.currentUser = profile;
      apiService.setAccountId(profile.id);
      this.sessionPersisted = true;
      completed = true;
      this.diagnostic('INITIALIZE_VALIDATED', epoch, profile.id);
      return profile;
    } catch (error) {
      if (epoch !== this.authEpoch) return this.currentUser;
      if (error instanceof VdaApiError && (error.status === 401 || error.status === 403)) {
        await this.clearAuthentication();
        completed = true;
        return null;
      }
      // A timeout, offline device, or server failure is not evidence that the
      // saved credential is invalid. Keep it for a later validation attempt.
      this.diagnostic('INITIALIZE_RETRYABLE', epoch);
      throw error;
    } finally {
      if (epoch === this.authEpoch) {
        this.initialized = completed;
        this.initialization = null;
        if (completed) this.notify();
      }
    }
  }

  public isAuthenticated(): boolean { return Boolean(this.currentUser && this.token); }
  public getUser(): UserProfile | null { return this.currentUser; }
  public getToken(): string | null { return this.token; }
  public isSessionPersisted(): boolean { return this.sessionPersisted; }
  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener); listener(this.currentUser); return () => this.listeners.delete(listener);
  }

  public async signup(dto: SignupDto): Promise<UserProfile> {
    const epoch = ++this.authEpoch;
    this.diagnostic('SIGNUP_START', epoch);
    const response = await apiService.signup({ ...dto, phone: this.normalizePhone(dto.phone) });
    await this.acceptAuthentication(response, epoch);
    return response.user;
  }

  public async login(phone: string, pin: string): Promise<UserProfile> {
    const epoch = ++this.authEpoch;
    this.diagnostic('LOGIN_START', epoch);
    const response = await apiService.login({ phone: this.normalizePhone(phone), pin });
    await this.acceptAuthentication(response, epoch);
    return response.user;
  }

  public async updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.currentUser || !this.token) throw new Error('No authenticated user.');
    const epoch = this.authEpoch;
    const userId = this.currentUser.id;
    const updated = await apiService.updateProfile(patch);
    if (epoch !== this.authEpoch || this.currentUser?.id !== userId) {
      throw new Error('AUTH_OPERATION_SUPERSEDED');
    }
    this.currentUser = updated;
    this.notify();
    return updated;
  }

  public async refreshProfile(): Promise<UserProfile | null> {
    if (!this.currentUser || !this.token) return null;
    const epoch = this.authEpoch;
    const userId = this.currentUser.id;
    const profile = await apiService.getProfile();
    if (epoch !== this.authEpoch || this.currentUser?.id !== userId || profile.id !== userId) return null;
    this.currentUser = profile;
    this.notify();
    return profile;
  }

  public async logout(): Promise<void> {
    const epoch = ++this.authEpoch;
    const userId = this.currentUser?.id;
    const refreshToken = this.refreshToken;
    this.diagnostic('LOGOUT_START', epoch);
    if (userId) await medicineReminderService.suspendNotifications(userId);
    if (userId) await pushNotificationService.unregister();
    if (refreshToken) await apiService.revokeRefreshSession(refreshToken).catch(() => undefined);
    await this.clearAuthentication(epoch);
    this.initialized = true;
    this.notify();
    if (userId) {
      // A stale conversation session is a cache, not a credential. Failure to
      // remove it must never leave the patient appearing signed in.
      await Preferences.remove({ key: `vda-active-session:${userId}` }).catch(() => undefined);
      await Preferences.remove({ key: `vda-prescription-status:${userId}` }).catch(() => undefined);
      await Preferences.remove({ key: `vda-prescription-notice:${userId}` }).catch(() => undefined);
    }
  }

  public async invalidateAuthentication(): Promise<void> {
    const epoch = ++this.authEpoch;
    this.diagnostic('INVALIDATE_START', epoch);
    pushNotificationService.clearLocal();
    await this.clearAuthentication(epoch);
    this.initialized = true;
    this.notify();
  }

  private async acceptAuthentication(response: AuthResponse, epoch: number): Promise<void> {
    if (epoch !== this.authEpoch) throw new Error('AUTH_OPERATION_SUPERSEDED');
    const { user, token } = response;
    const previousUserId = this.currentUser?.id;
    const previousRefreshToken = this.refreshToken;
    if (previousUserId && previousUserId !== user.id) {
      await medicineReminderService.suspendNotifications(previousUserId);
      await pushNotificationService.unregister();
      await Preferences.remove({ key: `vda-active-session:${previousUserId}` }).catch(() => undefined);
      await Preferences.remove({ key: `vda-prescription-status:${previousUserId}` }).catch(() => undefined);
      await Preferences.remove({ key: `vda-prescription-notice:${previousUserId}` }).catch(() => undefined);
      if (previousRefreshToken) await apiService.revokeRefreshSession(previousRefreshToken).catch(() => undefined);
    }
    if (epoch !== this.authEpoch) throw new Error('AUTH_OPERATION_SUPERSEDED');
    const credentials: StoredCredentials = { accessToken: token, refreshToken: response.refreshToken, expiresAt: response.expiresAt };
    let persisted = false;
    try {
      persisted = await this.commitPersistedToken(epoch, credentials, user.id, 'LOGIN_COMMIT');
    } catch {
      // The backend has already created or authenticated this account. Keep
      // this session in memory without falling back to plaintext token storage.
      // Remove any previously saved account before accepting a different one.
      await this.commitPersistedToken(epoch, null, user.id, 'STORAGE_FALLBACK_CLEAR');
      this.diagnostic('SECURE_STORAGE_UNAVAILABLE', epoch, user.id);
    }
    if (epoch !== this.authEpoch) throw new Error('AUTH_OPERATION_SUPERSEDED');
    this.currentUser = user;
    this.token = token;
    this.refreshToken = response.refreshToken || null;
    this.pendingRefreshToken = null;
    this.sessionPersisted = persisted;
    this.initialized = true;
    apiService.setAuthToken(token);
    apiService.setAccountId(user.id);
    apiService.setAccessExpiry(response.expiresAt);
    this.initialization = null;
    this.diagnostic('LOGIN_ACCEPTED', epoch, user.id);
    this.notify();
  }

  private normalizePhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) throw new Error('Please enter a valid 10-digit Indian mobile number');
    return digits;
  }

  private async clearAuthentication(epoch = this.authEpoch): Promise<void> {
    const cleared = await this.commitPersistedToken(epoch, null, null, 'AUTH_CLEAR');
    if (!cleared || epoch !== this.authEpoch) throw new Error('AUTH_OPERATION_SUPERSEDED');
    this.currentUser = null;
    pushNotificationService.clearLocal();
    this.token = null;
    this.refreshToken = null;
    this.pendingRefreshToken = null;
    apiService.clearAuthToken();
    this.sessionPersisted = true;
    // Remove values written by older builds; legacy WebView values are never read.
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vda_user_profile');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  private async commitPersistedToken(
    epoch: number,
    credentials: StoredCredentials | null,
    userId: string | null,
    operation: string,
  ): Promise<boolean> {
    let committed = false;
    const write = this.persistenceQueue.then(async () => {
      if (epoch !== this.authEpoch) {
        this.diagnostic(`${operation}_SKIPPED`, epoch, userId);
        return;
      }
      if (credentials) await authTokenStorage.setCredentials(credentials);
      else await authTokenStorage.remove();
      // A newer operation may have started while a native persistence call was
      // in flight. Its queued commit will run next; this operation must not
      // publish an older account as successfully persisted.
      if (epoch !== this.authEpoch) {
        this.diagnostic(`${operation}_SUPERSEDED`, epoch, userId);
        return;
      }
      committed = true;
      this.diagnostic(operation, epoch, userId);
    });
    this.persistenceQueue = write.catch(() => undefined);
    await write;
    return committed;
  }

  private diagnostic(operation: string, epoch: number, persistedUserId?: string | null): void {
    if (!import.meta.env.DEV) return;
    console.debug('[VDA Auth]', {
      operation,
      generation: epoch,
      persistedUserId: persistedUserId || null,
      activeUserId: this.currentUser?.id || null,
      initialized: this.initialized,
    });
  }

  private async renewSession(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    if (!this.refreshToken) return false;
    const epoch = this.authEpoch;
    const oldRefreshToken = this.refreshToken;
    const renewal = (async () => {
      let nextRefreshToken = this.pendingRefreshToken;
      if (!nextRefreshToken) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        nextRefreshToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const pending: StoredCredentials = {
          accessToken: this.token || '', refreshToken: oldRefreshToken, pendingRefreshToken: nextRefreshToken,
        };
        try {
          await this.commitPersistedToken(epoch, pending, this.currentUser?.id || null, 'REFRESH_PENDING');
        } catch {
          this.sessionPersisted = false;
          throw new VdaApiError('Secure storage is unavailable. Please retry.', 0, 'SECURE_STORAGE_UNAVAILABLE');
        }
        if (epoch !== this.authEpoch) return false;
        this.pendingRefreshToken = nextRefreshToken;
      }
      let response: AuthResponse;
      try {
        response = await apiService.refresh(oldRefreshToken, nextRefreshToken);
      } catch (error) {
        if (error instanceof VdaApiError && (error.status === 401 || error.status === 403)) {
          if (epoch === this.authEpoch) await this.invalidateAuthentication();
          return false;
        }
        throw error;
      }
      if (epoch !== this.authEpoch || this.refreshToken !== oldRefreshToken) return false;
      if (response.refreshToken !== nextRefreshToken || (this.currentUser !== null && response.user.id !== this.currentUser.id)) {
        await this.invalidateAuthentication();
        return false;
      }
      const credentials: StoredCredentials = {
        accessToken: response.token, refreshToken: response.refreshToken, expiresAt: response.expiresAt,
      };
      // Keep the newly rotated token in memory even if secure storage is temporarily unavailable.
      // The old persisted token must be removed because the server has revoked it.
      this.token = response.token;
      this.refreshToken = response.refreshToken;
      this.pendingRefreshToken = null;
      this.currentUser = response.user;
      apiService.setAuthToken(response.token);
      apiService.setAccountId(response.user.id);
      apiService.setAccessExpiry(response.expiresAt);
      try {
        this.sessionPersisted = await this.commitPersistedToken(epoch, credentials, response.user.id, 'REFRESH_COMMIT');
      } catch {
        this.sessionPersisted = false;
        // The encrypted pending pair can recover this rotation on restart.
      }
      return true;
    })();
    this.refreshPromise = renewal;
    try { return await renewal; }
    finally { if (this.refreshPromise === renewal) this.refreshPromise = null; }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }
}

// App owns startup validation so a transient failure can show a retry state.
export const authService = new AuthService(false);
