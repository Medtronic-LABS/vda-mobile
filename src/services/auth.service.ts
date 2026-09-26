import { Preferences } from '@capacitor/preferences';
import { UserProfile } from '../types';
import { apiService, SignupDto } from './api';

const TOKEN_STORAGE_KEY = 'vda_auth_token';
type AuthListener = (user: UserProfile | null) => void;

export class AuthService {
  private currentUser: UserProfile | null = null;
  private token: string | null = null;
  private listeners = new Set<AuthListener>();
  private initialized = false;
  private initialization: Promise<UserProfile | null> | null = null;
  private authEpoch = 0;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(autoInitialize = true) {
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
    this.diagnostic('INITIALIZE_START', epoch);
    try {
      const { value: token } = await Preferences.get({ key: TOKEN_STORAGE_KEY });
      if (!token) {
        this.diagnostic('INITIALIZE_EMPTY', epoch);
        return null;
      }
      this.token = token;
      apiService.setAuthToken(token);
      const profile = await apiService.getProfile();
      if (epoch !== this.authEpoch) return this.currentUser;
      this.currentUser = profile;
      this.diagnostic('INITIALIZE_VALIDATED', epoch, profile.id);
      return profile;
    } catch {
      if (epoch === this.authEpoch) await this.clearAuthentication();
      return null;
    } finally {
      if (epoch === this.authEpoch) {
        this.initialized = true;
        this.initialization = null;
        this.notify();
      }
    }
  }

  public isAuthenticated(): boolean { return Boolean(this.currentUser && this.token); }
  public getUser(): UserProfile | null { return this.currentUser; }
  public getToken(): string | null { return this.token; }
  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener); listener(this.currentUser); return () => this.listeners.delete(listener);
  }

  public async signup(dto: SignupDto): Promise<UserProfile> {
    const epoch = ++this.authEpoch;
    this.diagnostic('SIGNUP_START', epoch);
    const response = await apiService.signup({ ...dto, phone: this.normalizePhone(dto.phone) });
    await this.acceptAuthentication(response.user, response.token, epoch);
    return response.user;
  }

  public async login(phone: string, pin: string): Promise<UserProfile> {
    const epoch = ++this.authEpoch;
    this.diagnostic('LOGIN_START', epoch);
    const response = await apiService.login({ phone: this.normalizePhone(phone), pin });
    await this.acceptAuthentication(response.user, response.token, epoch);
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

  public async logout(): Promise<void> {
    const epoch = ++this.authEpoch;
    this.diagnostic('LOGOUT_START', epoch);
    await this.clearAuthentication(epoch);
    this.initialized = true;
    this.notify();
  }

  public async invalidateAuthentication(): Promise<void> {
    const epoch = ++this.authEpoch;
    this.diagnostic('INVALIDATE_START', epoch);
    await this.clearAuthentication(epoch);
    this.initialized = true;
    this.notify();
  }

  private async acceptAuthentication(user: UserProfile, token: string, epoch: number): Promise<void> {
    if (epoch !== this.authEpoch) throw new Error('AUTH_OPERATION_SUPERSEDED');
    const persisted = await this.commitPersistedToken(epoch, token, user.id, 'LOGIN_COMMIT');
    if (!persisted || epoch !== this.authEpoch) throw new Error('AUTH_OPERATION_SUPERSEDED');
    this.currentUser = user;
    this.token = token;
    this.initialized = true;
    apiService.setAuthToken(token);
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
    this.currentUser = null;
    this.token = null;
    apiService.clearAuthToken();
    await this.commitPersistedToken(epoch, null, null, 'AUTH_CLEAR');
    // Remove values written by older builds. Preferences is now the sole
    // authentication store; these legacy values are never read.
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vda_user_profile');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  private async commitPersistedToken(
    epoch: number,
    token: string | null,
    userId: string | null,
    operation: string,
  ): Promise<boolean> {
    let committed = false;
    const write = this.persistenceQueue.then(async () => {
      if (epoch !== this.authEpoch) {
        this.diagnostic(`${operation}_SKIPPED`, epoch, userId);
        return;
      }
      if (token) await Preferences.set({ key: TOKEN_STORAGE_KEY, value: token });
      else await Preferences.remove({ key: TOKEN_STORAGE_KEY });
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

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }
}

export const authService = new AuthService();
