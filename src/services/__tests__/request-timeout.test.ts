import { afterEach, expect, it, vi } from 'vitest';
import { apiService, VdaApiError } from '../api';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  apiService.clearAuthToken();
});

it('aborts a stalled directory request and exposes a retryable timeout', async () => {
  vi.useFakeTimers();
  apiService.setAuthToken('synthetic-test-token');
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  const pending = apiService.getFacilities();
  const assertion = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' } satisfies Partial<VdaApiError>);
  await vi.advanceTimersByTimeAsync(20_000);
  await assertion;
});
