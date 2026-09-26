import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  store: new Map<string, string>(),
  setCount: 0,
  delayWrites: false,
  delayProfile: false,
  rejectProfile: false,
  releaseOlder: null as null | (() => void),
  releaseNewest: null as null | (() => void),
  releaseProfile: null as null | (() => void),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: state.store.get(key) ?? null })),
    remove: vi.fn(async ({ key }: { key: string }) => { state.store.delete(key); }),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      state.setCount += 1;
      if (state.delayWrites && state.setCount === 2) {
        await new Promise<void>((resolve) => { state.releaseOlder = resolve; });
        state.store.set(key, value);
        return;
      }
      if (state.delayWrites && state.setCount === 3) {
        state.store.set(key, value);
        await new Promise<void>((resolve) => { state.releaseNewest = resolve; });
        return;
      }
      state.store.set(key, value);
    }),
  },
}));

const profiles = {
  '9000000001': { id: 'paras-id', fullName: 'Paras', phone: '9000000001', language: 'hi' },
  '9000000002': { id: 'neha-id', fullName: 'Neha', phone: '9000000002', language: 'hi' },
};

const apiMock = vi.hoisted(() => ({
  currentToken: null as string | null,
  setAuthToken: vi.fn((token: string) => { apiMock.currentToken = token; }),
  clearAuthToken: vi.fn(() => { apiMock.currentToken = null; }),
  login: vi.fn(async ({ phone }: { phone: keyof typeof profiles }) => ({
    token: phone === '9000000001' ? 'token-paras' : 'token-neha',
    user: profiles[phone],
  })),
  signup: vi.fn(),
  getProfile: vi.fn(async () => {
    const tokenAtRequest = apiMock.currentToken;
    if (state.delayProfile) {
      await new Promise<void>((resolve) => { state.releaseProfile = resolve; });
    }
    if (state.rejectProfile) throw new Error('Access token is invalid or expired.');
    return tokenAtRequest === 'token-neha' ? profiles['9000000002'] : profiles['9000000001'];
  }),
  updateProfile: vi.fn(),
}));

vi.mock('../api', () => ({ apiService: apiMock }));

import { AuthService } from '../auth.service';

describe('browser authentication restoration ordering', () => {
  beforeEach(() => {
    state.store.clear();
    state.setCount = 0;
    state.delayWrites = false;
    state.delayProfile = false;
    state.rejectProfile = false;
    state.releaseOlder = null;
    state.releaseNewest = null;
    state.releaseProfile = null;
    apiMock.currentToken = null;
    vi.clearAllMocks();
  });

  it('persists the newest successful account when older and newer writes complete out of order', async () => {
    state.delayWrites = true;
    const auth = new AuthService(false);
    await auth.login('9000000001', '1234');

    const older = auth.login('9000000001', '1234');
    await vi.waitFor(() => expect(state.releaseOlder).toBeTypeOf('function'));
    const newest = auth.login('9000000002', '1234');
    state.releaseOlder?.();
    await expect(older).rejects.toThrow('AUTH_OPERATION_SUPERSEDED');
    await vi.waitFor(() => expect(state.releaseNewest).toBeTypeOf('function'));
    state.releaseNewest?.();
    await newest;

    expect(auth.getUser()?.id).toBe('neha-id');
    expect(state.store.get('vda_auth_token')).toBe('token-neha');
  });

  it('restores the latest account across repeated refreshes and later account switches', async () => {
    const auth = new AuthService(false);
    await auth.login('9000000001', '1234');
    await auth.logout();
    expect(state.store.has('vda_auth_token')).toBe(false);
    await auth.login('9000000002', '1234');

    const refreshOne = new AuthService(false);
    const profileCalls = apiMock.getProfile.mock.calls.length;
    const [strictModeOne, strictModeTwo] = await Promise.all([refreshOne.init(), refreshOne.init()]);
    expect(strictModeOne?.id).toBe('neha-id');
    expect(strictModeTwo?.id).toBe('neha-id');
    expect(apiMock.getProfile.mock.calls.length - profileCalls).toBe(1);
    const refreshTwo = new AuthService(false);
    expect((await refreshTwo.init())?.id).toBe('neha-id');

    await refreshTwo.logout();
    await refreshTwo.login('9000000001', '1234');
    const refreshThree = new AuthService(false);
    expect((await refreshThree.init())?.id).toBe('paras-id');
  });

  it('does not let a delayed previous profile response overwrite a newer login', async () => {
    state.store.set('vda_auth_token', 'token-paras');
    state.delayProfile = true;
    const auth = new AuthService(false);
    const staleRestore = auth.init();
    await vi.waitFor(() => expect(state.releaseProfile).toBeTypeOf('function'));

    await auth.logout();
    state.delayProfile = false;
    await auth.login('9000000002', '1234');
    state.releaseProfile?.();
    await staleRestore;

    expect(auth.getUser()?.id).toBe('neha-id');
    expect(state.store.get('vda_auth_token')).toBe('token-neha');
  });

  it('clears an invalid persisted token instead of restoring a profile', async () => {
    state.store.set('vda_auth_token', 'invalid-token');
    state.rejectProfile = true;
    const auth = new AuthService(false);

    expect(await auth.init()).toBeNull();
    expect(auth.getUser()).toBeNull();
    expect(state.store.has('vda_auth_token')).toBe(false);
  });
});
