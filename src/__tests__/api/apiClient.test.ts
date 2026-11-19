import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../mocks/server';
import {
  apiClient,
  ApiError,
  apiClientConfig,
  backoffDelay,
  COLD_START_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  isBackendKnownAwake,
  onBackendSignal,
  parseRetryAfter,
  type BackendSignal,
} from '@/lib/api/apiClient';

const HTML_502 =
  '<html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center></body></html>';

/** Registers a POST handler that counts calls and answers with `respond(callNumber)`. */
function countingPost(path: string, respond: (call: number) => Response | Promise<Response>) {
  const calls = { count: 0 };
  server.use(
    http.post(`*${path}`, () => {
      calls.count += 1;
      return respond(calls.count);
    }),
  );
  return calls;
}

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    return err as ApiError;
  }
  throw new Error('expected the request to fail');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient', () => {
  describe('request configuration', () => {
    it('should export DEFAULT_TIMEOUT_MS of 10 seconds and a 20 second cold-start floor', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
      expect(COLD_START_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
    });

    it('should expose get and post methods', () => {
      expect(typeof apiClient.get).toBe('function');
      expect(typeof apiClient.post).toBe('function');
    });
  });

  describe('health check', () => {
    it('should call /api/health and return ok', async () => {
      const { data } = await apiClient.get('/api/health');
      expect(data.status).toBe('ok');
    });
  });

  describe('structured errors', () => {
    it('should extract error message from v2.0.0 error format (object)', async () => {
      server.use(
        http.post('*/api/test-error', () =>
          HttpResponse.json(
            { success: false, error: { code: 'TEST_ERROR', message: 'Something went wrong' } },
            { status: 400 },
          ),
        ),
      );

      await expect(apiClient.post('/api/test-error')).rejects.toThrow('Something went wrong');
    });

    it('keeps status and code on a structured 4xx, and does not retry it', async () => {
      const calls = countingPost('/api/test-422', () =>
        HttpResponse.json(
          { success: false, error: { code: 'PARSE_ERROR', message: 'Invalid cURL command format' } },
          { status: 422 },
        ),
      );

      const err = await caught(apiClient.post('/api/test-422', {}, { retries: 2 }));
      expect(err.message).toBe('Invalid cURL command format');
      expect(err).toMatchObject({ kind: 'http', status: 422, code: 'PARSE_ERROR', retryable: false });
      expect(calls.count).toBe(1);
    });

    it('should extract error message from string error format', async () => {
      server.use(
        http.post('*/api/test-error-str', () =>
          HttpResponse.json({ success: false, error: 'Plain string error' }, { status: 400 }),
        ),
      );

      await expect(apiClient.post('/api/test-error-str')).rejects.toThrow('Plain string error');
    });

    it('falls back to a message naming the status when the error body has no details', async () => {
      server.use(http.post('*/api/test-error-empty', () => HttpResponse.json({}, { status: 500 })));

      const err = await caught(apiClient.post('/api/test-error-empty'));
      expect(err.message).toMatch(/HTTP 500/);
      expect(err.status).toBe(500);
    });
  });

  describe('non-JSON and empty responses', () => {
    it('turns a 502 HTML page into a plain message with the status, not a JSON parse error', async () => {
      server.use(
        http.post('*/api/test-502', () => HttpResponse.html(HTML_502, { status: 502 })),
      );

      const err = await caught(apiClient.post('/api/test-502'));
      expect(err.message).toMatch(/HTTP 502/);
      expect(err.message).toMatch(/starting up or temporarily unavailable/);
      expect(err.message).not.toMatch(/Unexpected token|not valid JSON/);
      expect(err).toMatchObject({ kind: 'http', status: 502, retryable: true });
    });

    it('reports a non-JSON 4xx page by status', async () => {
      server.use(
        http.post('*/api/test-404', () => HttpResponse.text('Not here', { status: 404 })),
      );

      const err = await caught(apiClient.post('/api/test-404'));
      expect(err.message).toMatch(/HTTP 404/);
      expect(err.retryable).toBe(false);
    });

    it('fails clearly on a 204 where data was expected', async () => {
      server.use(http.post('*/api/test-204', () => new HttpResponse(null, { status: 204 })));

      const err = await caught(apiClient.post('/api/test-204'));
      expect(err.message).toMatch(/empty response \(HTTP 204/);
      expect(err.message).not.toMatch(/Unexpected end of JSON input/);
      expect(err.kind).toBe('invalid-response');
    });

    it('resolves a 204 with null data when the caller allows an empty body', async () => {
      server.use(http.get('*/api/test-204', () => new HttpResponse(null, { status: 204 })));

      await expect(apiClient.get('/api/test-204', { allowEmpty: true })).resolves.toEqual({
        data: null,
        status: 204,
      });
    });

    it('fails clearly when a 200 is HTML instead of JSON', async () => {
      server.use(http.post('*/api/test-html', () => HttpResponse.html('<html></html>')));

      const err = await caught(apiClient.post('/api/test-html'));
      expect(err.message).toMatch(/isn't JSON \(HTTP 200.*text\/html\)/);
      expect(err.kind).toBe('invalid-response');
    });

    it('accepts a JSON body served without a JSON content type', async () => {
      server.use(
        http.post('*/api/test-text-json', () =>
          HttpResponse.text('{"success":true}', { headers: { 'Content-Type': 'text/plain' } }),
        ),
      );

      await expect(apiClient.post('/api/test-text-json')).resolves.toMatchObject({
        data: { success: true },
      });
    });
  });

  describe('network errors and timeouts', () => {
    it('turns a network error into a plain-language, retryable error', async () => {
      server.use(http.post('*/api/test-network', () => HttpResponse.error()));

      const err = await caught(apiClient.post('/api/test-network'));
      expect(err.message).toMatch(/Couldn't reach the generator/);
      expect(err.message).not.toMatch(/Failed to fetch/);
      expect(err).toMatchObject({ kind: 'network', retryable: true });
    });

    it('times out with a message that says how long it waited', async () => {
      // Seen awake, so the caller's short timeout is not raised to the cold-start floor.
      await apiClient.get('/api/health');
      server.use(
        http.post('*/api/test-slow', async () => {
          await delay(2_000);
          return HttpResponse.json({ success: true });
        }),
      );

      const err = await caught(apiClient.post('/api/test-slow', {}, { timeout: 100 }));
      expect(err.message).toBe("The generator didn't respond within 1 second.");
      expect(err).toMatchObject({ kind: 'timeout', retryable: true });
    });

    it('raises the timeout to the cold-start floor until the backend has been seen awake', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      expect(isBackendKnownAwake()).toBe(false);

      await apiClient.post('/api/parse', { curl: 'curl https://a.example' });
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), COLD_START_TIMEOUT_MS);
      expect(isBackendKnownAwake()).toBe(true);

      setTimeoutSpy.mockClear();
      await apiClient.post('/api/parse', { curl: 'curl https://a.example' });
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), DEFAULT_TIMEOUT_MS);
      expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), COLD_START_TIMEOUT_MS);
    });

    it('can be cancelled with an AbortSignal', async () => {
      server.use(
        http.post('*/api/test-cancel', async () => {
          await delay(2_000);
          return HttpResponse.json({});
        }),
      );
      const controller = new AbortController();
      const pending = apiClient.post('/api/test-cancel', {}, { signal: controller.signal });
      controller.abort();

      const err = await caught(pending);
      expect(err.kind).toBe('aborted');
    });
  });

  describe('retries', () => {
    it('retries 502/503 and succeeds once the backend answers', async () => {
      const calls = countingPost('/api/test-retry', (call) =>
        call === 1
          ? HttpResponse.html(HTML_502, { status: 502 })
          : call === 2
            ? HttpResponse.text('', { status: 503 })
            : HttpResponse.json({ success: true, data: 'ok' }),
      );

      const { data } = await apiClient.post('/api/test-retry', {}, { retries: 2 });
      expect(data).toEqual({ success: true, data: 'ok' });
      expect(calls.count).toBe(3);
    });

    it('retries network errors, then gives up after three attempts', async () => {
      const calls = countingPost('/api/test-retry-net', () => HttpResponse.error());

      const err = await caught(apiClient.post('/api/test-retry-net', {}, { retries: 2 }));
      expect(err.kind).toBe('network');
      expect(calls.count).toBe(3);
    });

    it('does not retry a POST unless asked to', async () => {
      const calls = countingPost('/api/test-no-retry', () => HttpResponse.text('', { status: 503 }));

      await caught(apiClient.post('/api/test-no-retry'));
      expect(calls.count).toBe(1);
    });

    it('retries a GET twice by default', async () => {
      let count = 0;
      server.use(
        http.get('*/api/test-get', () => {
          count += 1;
          return HttpResponse.text('', { status: 504 });
        }),
      );

      await caught(apiClient.get('/api/test-get'));
      expect(count).toBe(3);
    });

    it('limits a once-only call (feedback) to two attempts', async () => {
      const calls = countingPost('/api/feedback', () => HttpResponse.error());

      await caught(apiClient.post('/api/feedback', { rating: 5 }, { retries: 1 }));
      expect(calls.count).toBe(2);
    });

    it('waits for a short Retry-After instead of its own backoff', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      countingPost('/api/test-retry-after', (call) =>
        call === 1
          ? HttpResponse.text('', { status: 503, headers: { 'Retry-After': '0.03' } })
          : HttpResponse.json({ ok: true }),
      );

      await apiClient.post('/api/test-retry-after', {}, { retries: 1 });
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30);
    });

    it('jitters the exponential backoff between half and all of each step, capped', () => {
      const saved = { ...apiClientConfig };
      Object.assign(apiClientConfig, { retryBaseDelayMs: 500, retryMaxDelayMs: 5_000 });
      try {
        expect(backoffDelay(1, () => 0)).toBe(250);
        expect(backoffDelay(1, () => 1)).toBe(500);
        expect(backoffDelay(2, () => 1)).toBe(1_000);
        expect(backoffDelay(3, () => 0.5)).toBe(1_500);
        expect(backoffDelay(10, () => 1)).toBe(5_000);
      } finally {
        Object.assign(apiClientConfig, saved);
      }
    });

    it('parses Retry-After seconds and dates', () => {
      expect(parseRetryAfter('3')).toBe(3_000);
      expect(parseRetryAfter(null)).toBeUndefined();
      expect(parseRetryAfter('soon')).toBeUndefined();
      const now = Date.parse('2026-10-30T10:00:00Z');
      expect(parseRetryAfter('Fri, 30 Oct 2026 10:00:05 GMT', now)).toBe(5_000);
    });
  });

  describe('backend signals', () => {
    it("signals 'up' on any backend response and 'down' when retries run out", async () => {
      const signals: BackendSignal[] = [];
      const stop = onBackendSignal((s) => signals.push(s));
      try {
        server.use(
          http.post('*/api/test-down', () => HttpResponse.html(HTML_502, { status: 502 })),
          http.post('*/api/test-4xx', () =>
            HttpResponse.json({ error: { message: 'nope' } }, { status: 400 }),
          ),
        );

        await caught(apiClient.post('/api/test-down', {}, { retries: 1 }));
        expect(signals).toEqual(['down']); // a gateway page is not the backend answering

        await caught(apiClient.post('/api/test-4xx'));
        expect(signals).toEqual(['down', 'up']); // a 4xx is
      } finally {
        stop();
      }
    });
  });
});
