import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  apiClient,
  ApiError,
  isApiError,
  apiClientConfig,
  backoffDelay,
  parseRetryAfter,
  onBackendSignal,
  isBackendKnownAwake,
  AWAKE_WINDOW_MS,
  API_BASE_URL,
  type BackendSignal,
} from '@/lib/api/apiClient';
import { curlApi, generationErrorMessage } from '@/lib/api/curl';

const reply = (body: string | null, init: { status?: number; statusText?: string; type?: string; headers?: Record<string, string> } = {}) => {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  const type = init.type === undefined ? 'application/json' : init.type;
  if (type) headers['content-type'] = type;
  return new Response(body, { status: init.status ?? 200, statusText: init.statusText, headers });
};
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseRetryAfter', () => {
  it.each([
    [null, undefined],
    ['', undefined],
    ['0', 0],
    ['2', 2000],
    [' 3 ', 3000],
    ['1.5', 1500],
    ['-4', 0],
    ['garbage', undefined],
  ])('%j -> %s', (v, expected) => {
    expect(parseRetryAfter(v as string | null)).toBe(expected);
  });
  it('parses an HTTP date relative to now and clamps the past to 0', () => {
    const now = Date.parse('2024-01-01T00:00:00Z');
    expect(parseRetryAfter('Mon, 01 Jan 2024 00:00:10 GMT', now)).toBe(10_000);
    expect(parseRetryAfter('Sun, 31 Dec 2023 23:00:00 GMT', now)).toBe(0);
  });
});

describe('backoffDelay', () => {
  it.each([
    [1, 0, 0.5], [1, 1, 1], [2, 0, 0.5], [3, 1, 1], [20, 0.5, 0.75],
  ])('retry %i with random %s', (n, rnd, factor) => {
    const saved = { ...apiClientConfig };
    Object.assign(apiClientConfig, { retryBaseDelayMs: 100, retryMaxDelayMs: 1000 });
    try {
      const step = Math.min(1000, 100 * 2 ** (n - 1));
      expect(backoffDelay(n, () => rnd)).toBe(Math.round(step * factor));
    } finally {
      Object.assign(apiClientConfig, saved);
    }
  });
});

describe('ApiError', () => {
  it('defaults retryable to false and carries optional fields', () => {
    const e = new ApiError('m', { kind: 'http', status: 400, code: 'c', retryAfterMs: 5 });
    expect(e.name).toBe('ApiError');
    expect(e.retryable).toBe(false);
    expect([e.kind, e.status, e.code, e.retryAfterMs]).toEqual(['http', 400, 'c', 5]);
    expect(isApiError(e)).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

describe('apiClient: response interpretation', () => {
  it.each([
    ['400 structured object', 400, '{"error":{"code":"bad","message":"Nope"}}', 'application/json', 'Nope', 'bad'],
    ['422 object without message', 422, '{"error":{"code":"x"}}', 'application/json', 'The request was rejected (HTTP 422 Unprocessable Entity).', 'x'],
    ['object with non-string code and empty message', 400, '{"error":{"code":5,"message":""}}', 'application/json', 'The request was rejected (HTTP 400 Bad Request).', undefined],
    ['error string', 400, '{"error":"plain"}', 'application/json', 'plain', undefined],
    ['message field', 400, '{"message":"msg"}', 'application/json', 'msg', undefined],
    ['detail field', 400, '{"detail":"det"}', 'application/json', 'det', undefined],
    ['empty error string falls through', 400, '{"error":""}', 'application/json', 'The request was rejected (HTTP 400 Bad Request).', undefined],
    ['unknown shape', 400, '{"x":1}', 'application/json', 'The request was rejected (HTTP 400 Bad Request).', undefined],
    ['json array', 400, '[1]', 'application/json', 'The request was rejected (HTTP 400 Bad Request).', undefined],
    ['json null', 400, 'null', 'application/json', 'The request was rejected (HTTP 400 Bad Request).', undefined],
    ['500', 500, '{}', 'application/json', 'The generator hit an error (HTTP 500 Internal Server Error). Please try again.', undefined],
    ['unknown status code', 418, '', 'text/plain', 'The request was rejected (HTTP 418).', undefined],
    ['HTML 404 is never shown', 404, '<html>nope</html>', 'text/html', 'The request was rejected (HTTP 404 Not Found).', undefined],
    ['json body without content-type', 400, '{"error":"sniffed"}', '', 'sniffed', undefined],
    ['invalid JSON body on error', 400, '{oops', 'application/json', 'The request was rejected (HTTP 400 Bad Request).', undefined],
  ])('%s', async (_n, status, body, type, message, code) => {
    stubFetch(() => reply(body, { status, type }));
    const e = await fail(apiClient.post('/x', {}));
    expect(e.kind).toBe('http');
    expect(e.status).toBe(status);
    expect(e.message).toBe(message);
    expect(e.code).toBe(code);
    expect(e.retryable).toBe(false);
  });
  it('uses the response statusText over the table when provided', async () => {
    stubFetch(() => reply('{}', { status: 400, statusText: 'Custom Text' }));
    expect((await fail(apiClient.post('/x'))).message).toContain('400 Custom Text');
  });
  it('gateway statuses are retryable, name the wake-up and expose Retry-After', async () => {
    stubFetch(() => reply('<html/>', { status: 503, type: 'text/html', headers: { 'retry-after': '1' } }));
    const e = await fail(apiClient.post('/x'));
    expect(e.retryable).toBe(true);
    expect(e.message).toContain('starting up');
    expect(e.retryAfterMs).toBe(1000);
  });
  it.each([
    ['empty 200 without allowEmpty', '', 'application/json', false, 'empty response'],
    ['whitespace body', '  \n', 'application/json', false, 'empty response'],
    ['non-json content type', 'hello', 'text/plain; charset=utf-8', false, "isn't JSON (HTTP 200, text/plain)"],
    ['html is never sniffed as JSON', '{"a":1}', 'text/html', false, "isn't JSON"],
    ['broken json', '{"a":', 'application/json', false, "isn't JSON"],
  ])('invalid response: %s', async (_n, body, type, allowEmpty, fragment) => {
    stubFetch(() => reply(body, { type }));
    const e = await fail(apiClient.post('/x', {}, { allowEmpty }));
    expect(e.kind).toBe('invalid-response');
    expect(e.message).toContain(fragment);
  });
  it('allowEmpty resolves null; a sniffed JSON body without content type parses', async () => {
    stubFetch(() => reply(null, { status: 204, type: '' }));
    await expect(apiClient.post('/x', {}, { allowEmpty: true })).resolves.toEqual({ data: null, status: 204 });
    stubFetch(() => reply('[1,2]', { type: '' }));
    await expect(apiClient.get('/x')).resolves.toEqual({ data: [1, 2], status: 200 });
  });
  it('names an unknown format when the response has no content type', async () => {
    stubFetch(() => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: async () => 'hello' }) as unknown as Response);
    expect((await fail(apiClient.post('/x'))).message).toContain('an unknown format');
  });
  it('sends JSON headers and a serialised body to API_URL + path', async () => {
    const f = stubFetch(() => reply('{"ok":true}'));
    await apiClient.post('/p', { a: 'é' });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(`${API_BASE_URL}/p`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"a":"é"}');
    await apiClient.get('/g');
    expect(f.mock.calls[1]![1].method).toBe('GET');
    expect(f.mock.calls[1]![1].body).toBeUndefined();
  });
});

describe('apiClient: failures, retries and signals', () => {
  it('a rejected fetch is a retryable network error and POST is not retried by default', async () => {
    const f = stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const e = await fail(apiClient.post('/x'));
    expect(e.kind).toBe('network');
    expect(e.retryable).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('GET retries twice by default and emits down after the last failure', async () => {
    const f = stubFetch(() => Promise.reject(new TypeError('x')));
    const signals: BackendSignal[] = [];
    const off = onBackendSignal((s) => signals.push(s));
    await fail(apiClient.get('/x'));
    off();
    expect(f).toHaveBeenCalledTimes(3);
    expect(signals).toEqual(['down']);
  });
  it('explicit retries, negative retries are clamped to 0, success after failure marks awake', async () => {
    let n = 0;
    const f = stubFetch(() => (++n < 3 ? reply('<h/>', { status: 502, type: 'text/html' }) : reply('{"ok":1}')));
    const signals: BackendSignal[] = [];
    const off = onBackendSignal((s) => signals.push(s));
    expect(isBackendKnownAwake()).toBe(false);
    await expect(apiClient.post('/x', {}, { retries: 2 })).resolves.toMatchObject({ data: { ok: 1 } });
    off();
    expect(f).toHaveBeenCalledTimes(3);
    expect(signals).toEqual(['up']);
    expect(isBackendKnownAwake()).toBe(true);
    expect(isBackendKnownAwake(Date.now() + AWAKE_WINDOW_MS + 1)).toBe(false);
    const g = stubFetch(() => Promise.reject(new TypeError('x')));
    await fail(apiClient.get('/x', { retries: -5 }));
    expect(g).toHaveBeenCalledTimes(1);
  });
  it('honours a small Retry-After and ignores one above the cap', async () => {
    vi.useFakeTimers();
    let n = 0;
    stubFetch(() => (++n === 1 ? reply('{}', { status: 503, headers: { 'retry-after': '0' } }) : reply('{"ok":1}')));
    const p = apiClient.post('/x', {}, { retries: 1 });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ status: 200 });
    n = 0;
    stubFetch(() => (++n === 1 ? reply('{}', { status: 503, headers: { 'retry-after': '3600' } }) : reply('{"ok":1}')));
    const q = apiClient.post('/x', {}, { retries: 1 });
    await vi.runAllTimersAsync();
    await expect(q).resolves.toMatchObject({ status: 200 });
  });
  it('times out a hung request with the configured seconds; cold start raises short timeouts', async () => {
    vi.useFakeTimers();
    stubFetch((_u, init) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')))));
    const p = fail(apiClient.post('/x', {}, { timeout: 1000 }));
    await vi.advanceTimersByTimeAsync(19_999);
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false); // cold start floor is 20s, not 1s
    await vi.advanceTimersByTimeAsync(2);
    const e = await p;
    expect(e.kind).toBe('timeout');
    expect(e.message).toContain('20 seconds');
    expect(e.retryable).toBe(true);
  });
  it('a body that stalls past the timeout is a timeout; a truncated body is a network error', async () => {
    vi.useFakeTimers();
    const stalled = { ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: () => new Promise<string>((_r, rej) => setTimeout(() => rej(new Error('abort')), 25_000)) };
    stubFetch(() => stalled as unknown as Response);
    const p = fail(apiClient.post('/x', {}, { timeout: 100 }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await p).message).toContain("didn't finish responding");
    vi.useRealTimers();
    const cut = { ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: () => Promise.reject(new Error('reset')) };
    stubFetch(() => cut as unknown as Response);
    const e = await fail(apiClient.post('/x'));
    expect(e.kind).toBe('network');
    expect(e.status).toBe(200);
    expect(e.message).toContain('cut off');
  });
  it('an already-aborted signal fails fast without calling fetch', async () => {
    const f = stubFetch(() => reply('{}'));
    const c = new AbortController();
    c.abort();
    const e = await fail(apiClient.post('/x', {}, { signal: c.signal }));
    expect(e).toMatchObject({ kind: 'aborted', retryable: false, message: 'The request was cancelled.' });
    expect(f).not.toHaveBeenCalled();
  });
  it('aborting mid-flight rejects as aborted and removes its listener', async () => {
    const c = new AbortController();
    const remove = vi.spyOn(c.signal, 'removeEventListener');
    stubFetch((_u, init) => new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')))));
    const p = fail(apiClient.post('/x', {}, { signal: c.signal }));
    c.abort();
    expect((await p).kind).toBe('aborted');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  it('aborting while the body is being read is also aborted', async () => {
    const c = new AbortController();
    stubFetch(() => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: () => new Promise<string>((_r, rej) => c.signal.addEventListener('abort', () => rej(new Error('x')))) }) as unknown as Response);
    const p = fail(apiClient.post('/x', {}, { signal: c.signal }));
    await new Promise((r) => setTimeout(r, 5));
    c.abort();
    expect((await p).kind).toBe('aborted');
  });
  it('aborting during backoff cancels the wait; an aborted signal before the wait rejects immediately', async () => {
    const c = new AbortController();
    stubFetch(() => reply('{}', { status: 503, headers: { 'retry-after': '1000' } }));
    const saved = apiClientConfig.maxRetryAfterMs;
    apiClientConfig.maxRetryAfterMs = 10_000_000;
    try {
      const p = fail(apiClient.post('/x', {}, { retries: 3, signal: c.signal }));
      await new Promise((r) => setTimeout(r, 20));
      c.abort();
      expect((await p).kind).toBe('aborted');
    } finally {
      apiClientConfig.maxRetryAfterMs = saved;
    }
  });
  it('listeners can unsubscribe and receive nothing afterwards', async () => {
    stubFetch(() => reply('{}'));
    const seen: BackendSignal[] = [];
    const off = onBackendSignal((s) => seen.push(s));
    await apiClient.get('/x');
    off();
    await apiClient.get('/x');
    expect(seen).toEqual(['up']);
  });
});

describe('curlApi.generateFromParsed', () => {
  it('posts { parsed_data, config } with the generate timeout and returns the body', async () => {
    const f = stubFetch(() => reply('{"success":true,"code":"x"}'));
    const parsed = { method: 'GET', base_url: 'https://a.test', endpoint: '/' } as never;
    const config = { language: 'java' } as never;
    await expect(curlApi.generateFromParsed(parsed, config)).resolves.toEqual({ success: true, code: 'x' });
    expect(f.mock.calls[0]![0]).toContain('/api/generate-from-parsed');
    expect(JSON.parse(f.mock.calls[0]![1].body as string)).toEqual({ parsed_data: parsed, config });
  });
  it('safe retries apply: a 502 then success resolves', async () => {
    let n = 0;
    stubFetch(() => (++n === 1 ? reply('', { status: 502, type: 'text/html' }) : reply('{"success":true}')));
    await expect(curlApi.generateFromParsed({} as never, {} as never)).resolves.toEqual({ success: true });
    expect(n).toBe(2);
  });
  it.each([
    [undefined, 'Unknown error'],
    ['', 'Unknown error'],
    ['boom', 'boom'],
    [{ code: 'c', message: 'obj message' }, 'obj message'],
    [{ code: 'c', message: '' }, 'Unknown error'],
    [{ code: 'c' }, 'Unknown error'],
  ])('generationErrorMessage(%j) -> %s', (err, expected) => {
    expect(generationErrorMessage(err as never)).toBe(expected);
  });
});
