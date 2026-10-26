import { afterEach, expect, it, vi } from 'vitest';
import { apiService } from '../api';

afterEach(() => {
  vi.unstubAllGlobals();
  apiService.clearAuthToken();
});

it('uploads a report through the separate consented report API', async () => {
  apiService.setAuthToken('synthetic-test-token');
  const report = { id: 'report-a', facts: { tests: [] } };
  const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(report), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchSpy);

  const file = new File(['synthetic-image'], 'report.jpg', { type: 'image/jpeg' });
  await expect(apiService.uploadMedicalReport('session-a', file, 'hi')).resolves.toMatchObject(report);

  const [url, options] = fetchSpy.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/sessions\/session-a\/reports$/);
  expect(options.method).toBe('POST');
  expect(options.body).toBeInstanceOf(FormData);
  expect(options.body.get('file')).toBe(file);
  expect(options.body.get('report_consent')).toBe('true');
  expect(options.body.get('language')).toBe('hi');
  expect(new Headers(options.headers).get('Content-Type')).toBeNull();
});

it('binds a report question to its report ID and retains the turn key', async () => {
  apiService.setAuthToken('synthetic-test-token');
  const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    content: { en: 'Please discuss these results with a clinician.' }, response_type: 'answer', turn_number: 1,
  }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchSpy);

  await apiService.processVdaQuery('Explain this report', {} as never, [], [], 'en', 'session-a',
    { reportId: 'report-a', idempotencyKey: 'turn-a' });

  const [url, options] = fetchSpy.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/sessions\/session-a\/turns$/);
  expect(JSON.parse(options.body)).toMatchObject({ input_text: 'Explain this report', report_id: 'report-a' });
  expect(new Headers(options.headers).get('Idempotency-Key')).toBe('turn-a');
});

it('confirms a pending replacement through the patient report endpoint', async () => {
  apiService.setAuthToken('synthetic-test-token');
  const report = { id: 'new-report', isCurrent: true, replacementOf: null };
  const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(report), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchSpy);
  await expect(apiService.confirmMedicalReportReplacement('session-a', 'new-report')).resolves.toMatchObject(report);
  const [url, options] = fetchSpy.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/sessions\/session-a\/reports\/new-report\/confirm-replacement$/);
  expect(options.method).toBe('POST');
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer synthetic-test-token');
});
