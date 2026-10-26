import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_STORAGE_KEY = 'vda_auth_token';
export interface StoredCredentials {
  accessToken: string;
  refreshToken?: string;
  pendingRefreshToken?: string;
  expiresAt?: string;
}
const SecureToken = registerPlugin<{
  get(): Promise<{ value: string | null }>;
  set(options: { value: string }): Promise<void>;
  remove(): Promise<void>;
}>('SecureToken');

export const authTokenStorage = {
  async getCredentials(): Promise<StoredCredentials | null> {
    const value = await this.get();
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as StoredCredentials;
      if (parsed && typeof parsed.accessToken === 'string') return parsed;
    } catch { /* Older builds stored the access token directly. */ }
    return { accessToken: value };
  },
  async setCredentials(credentials: StoredCredentials): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.set(JSON.stringify(credentials));
    } else {
      // Browser Preferences are plaintext localStorage. Never persist a refresh token there.
      await this.set(credentials.accessToken);
    }
  },
  async get(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
      return (await Preferences.get({ key: TOKEN_STORAGE_KEY })).value;
    }
    const secure = await SecureToken.get();
    if (secure.value) return secure.value;
    // Migrate older app versions. Delete the plaintext copy only after the
    // encrypted write succeeds; a failed migration must not log out the user.
    const legacy = (await Preferences.get({ key: TOKEN_STORAGE_KEY })).value;
    if (!legacy) return null;
    await SecureToken.set({ value: legacy });
    await Preferences.remove({ key: TOKEN_STORAGE_KEY });
    return legacy;
  },
  async set(value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await SecureToken.set({ value });
      await Preferences.remove({ key: TOKEN_STORAGE_KEY });
    } else {
      await Preferences.set({ key: TOKEN_STORAGE_KEY, value });
    }
  },
  async remove(): Promise<void> {
    if (Capacitor.isNativePlatform()) await SecureToken.remove();
    await Preferences.remove({ key: TOKEN_STORAGE_KEY });
  },
};
