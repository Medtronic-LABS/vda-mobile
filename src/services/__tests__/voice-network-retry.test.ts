import { afterEach, expect, it, vi } from 'vitest';
import { apiService } from '../api';

afterEach(() => {
  vi.unstubAllGlobals();
  apiService.clearAuthToken();
});

it('keeps an uncertain turn retry on the same caller idempotency key', async () => {
  apiService.setAuthToken('synthetic-test-token');
  const fetchSpy = vi.fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      content: { en: 'The response is available.' }, response_type: 'answer', turn_number: 1,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchSpy);
  const send = () => apiService.processVdaQuery(
    'synthetic question', {} as never, [], [], 'en', 'synthetic-session',
    { idempotencyKey: 'same-turn-key' },
  );

  await expect(send()).rejects.toMatchObject({
    status: 0, code: 'NETWORK_UNAVAILABLE',
  });
  const answer = await send();
  expect(answer.message.text).toBe('The response is available.');
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  for (const call of fetchSpy.mock.calls) {
    expect(new Headers(call[1].headers).get('Idempotency-Key')).toBe('same-turn-key');
  }
});
