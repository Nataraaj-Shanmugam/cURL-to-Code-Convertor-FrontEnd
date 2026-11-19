/**
 * REL-9: a 429 from the backend's rate limiter is waited out (Retry-After, bounded) for calls that
 * may be repeated, holds every other request of the tab meanwhile, and is shown as
 * "Rate limited by the generator, retrying in Ns".
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Toaster } from 'sonner';
import {
  apiClient,
  apiClientConfig,
  isApiError,
  onBackendSignal,
  onRateLimit,
  rateLimitRemainingMs,
  SAFE_RETRIES,
  type ApiError,
  type BackendSignal,
  type RateLimitState,
} from '@/lib/api/apiClient';
import { parseCurlBatch } from '@/lib/utils/parseCurlBatch';
import RateLimitNotice, { rateLimitMessage } from '@/components/layout/RateLimitNotice';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
/** The backend's 429: Retry-After header plus the same value in the body. */
const tooMany = (seconds: number, { header = true } = {}) =>
  json(
    { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Please try again later.', retry_after: seconds } },
    429,
    header ? { 'retry-after': String(seconds) } : {},
  );
const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response> | Response) => {
  const fn = vi.fn(async (url: string, init: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fn);
  return fn;
};
const fail = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(isApiError(e)).toBe(true);
    return e as ApiError;
  }
  throw new Error('expected failure');
};

const saved = { ...apiClientConfig };
afterEach(() => {
  vi.unstubAllGlobals();
  Object.assign(apiClientConfig, saved);
});

describe('apiClient: 429 rate limiting (REL-9)', () => {
  it('waits out Retry-After and retries a parse, without using up its retries', async () => {
    const replies = [tooMany(0.3), json({}, 503), json({}, 503), json({ success: true })];
    const fetchMock = stubFetch(() => replies.shift()!);
    const states: RateLimitState[] = [];
    const off = onRateLimit((s) => states.push(s));
    const started = Date.now();

    const { data } = await apiClient.post('/api/parse', { curl: 'curl x' }, { retries: SAFE_RETRIES });
    off();

    expect(data).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(4); // 429 + the two 503 retries still available + success
    expect(Date.now() - started).toBeGreaterThanOrEqual(280);
    expect(states[0]).toEqual({ until: expect.any(Number) });
  });

  it('reads the wait from the body when the Retry-After header is not exposed (CORS)', async () => {
    const replies = [tooMany(0.3, { header: false }), json({ ok: true })];
    stubFetch(() => replies.shift()!);
    const started = Date.now();
    await apiClient.post('/api/generate-from-parsed', {}, { retries: SAFE_RETRIES });
    expect(Date.now() - started).toBeGreaterThanOrEqual(280);
  });

  it('gives up with a clear, retryable error when the wait is longer than the bound', async () => {
    const fetchMock = stubFetch(() => tooMany(120));
    const signals: BackendSignal[] = [];
    const off = onBackendSignal((s) => signals.push(s));
    const err = await fail(apiClient.post('/api/parse', {}, { retries: SAFE_RETRIES }));
    off();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.message).toBe('The generator is rate limiting requests (HTTP 429 Too Many Requests). Please try again in 120 seconds.');
    // A 429 proves the backend is awake: never reported as down.
    expect(signals).not.toContain('down');
  });

  it('stops after rateLimitRetries waits', async () => {
    apiClientConfig.rateLimitRetries = 2;
    apiClientConfig.minRateLimitWaitMs = 1;
    const fetchMock = stubFetch(() => tooMany(0));
    const err = await fail(apiClient.post('/api/parse', {}, { retries: SAFE_RETRIES }));
    expect(err.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not repeat a call without retries, but holds the next request until the wait is over', async () => {
    const replies = [tooMany(0.3), json({ ok: true })];
    const fetchMock = stubFetch(() => replies.shift()!);
    const err = await fail(apiClient.post('/api/feedback', {}));
    expect(err.status).toBe(429);
    expect(rateLimitRemainingMs()).toBeGreaterThan(0);

    const started = Date.now();
    await apiClient.post('/api/feedback', {});
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('batch parsing: every parallel parse backs off together and all of them succeed', async () => {
    let limited = false;
    const sentAt: number[] = [];
    let holdEnds = 0;
    stubFetch(() => {
      sentAt.push(Date.now());
      if (!limited) {
        limited = true;
        holdEnds = Date.now() + 300;
        return tooMany(0.3);
      }
      return json({ success: true, data: { method: 'GET', base_url: 'https://x.test', endpoint: '/' } });
    });

    const { items, failures } = await parseCurlBatch(Array.from({ length: 8 }, (_, i) => `curl https://x.test/${i}`));

    expect(failures).toEqual([]);
    expect(items).toHaveLength(8);
    // The four parses sent in the same burst as the 429 may already be in flight; every request
    // sent after it waited for the hold to end.
    const after = sentAt.slice(5);
    expect(after.length).toBeGreaterThan(0);
    for (const t of after) expect(t).toBeGreaterThanOrEqual(holdEnds - 20);
  });
});

describe('RateLimitNotice', () => {
  it('formats the countdown', () => {
    expect(rateLimitMessage(2_400)).toBe('Rate limited by the generator, retrying in 3s');
    expect(rateLimitMessage(10)).toBe('Rate limited by the generator, retrying in 1s');
  });

  it('shows "rate limited, retrying in Ns" while a 429 is waited out, then goes away', async () => {
    render(
      <>
        <Toaster />
        <RateLimitNotice />
      </>,
    );
    const replies = [tooMany(1), json({ ok: true })];
    stubFetch(() => replies.shift()!);
    const done = apiClient.post('/api/parse', {}, { retries: SAFE_RETRIES });

    expect(await screen.findByText(/Rate limited by the generator, retrying in [12]s/)).toBeInTheDocument();
    await done;
    await waitFor(() => expect(screen.queryByText(/Rate limited by the generator/)).not.toBeInTheDocument(), { timeout: 3000 });
  });
});
