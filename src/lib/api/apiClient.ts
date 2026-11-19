import { ENV } from '@/lib/env';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const GENERATE_TIMEOUT_MS = 30_000;
/**
 * The hosted backend sleeps when idle, and its first response after a nap can take a long time.
 * Until a response has been seen recently, every request gets at least this long.
 */
export const COLD_START_TIMEOUT_MS = 20_000;
/** A response within this window counts as "the backend is awake". */
export const AWAKE_WINDOW_MS = 10 * 60_000;

/** Gateway statuses a sleeping or restarting backend answers with. Worth retrying. */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * Tunables. Tests shorten the backoff (see src/__tests__/setup.ts); the app never changes them.
 */
export const apiClientConfig = {
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 5_000,
  /** Largest Retry-After (from a 503) the client will honour instead of its own backoff. */
  maxRetryAfterMs: 10_000,
  /** Longest a 429 (rate limited) is waited out before the request fails instead. */
  maxRateLimitWaitMs: 30_000,
  /** How many 429s one call waits out (on top of `retries`, which they do not use up). */
  rateLimitRetries: 4,
  /** Shortest wait after a 429 (a Retry-After of 0 would otherwise retry at once). */
  minRateLimitWaitMs: 250,
};

/** The backend's rate limiter (token bucket per client IP) answers 429 with Retry-After. */
const RATE_LIMITED = 429;

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'aborted';

/** Every failure the client throws. `message` is written for the person using the app. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, when a response arrived. */
  readonly status?: number;
  /** Backend error code from `{ error: { code } }`, when present. */
  readonly code?: string;
  /** True for failures another attempt may fix (network, timeout, 429, 502/503/504). */
  readonly retryable: boolean;
  /** Server-requested wait before retrying (Retry-After, or the 429 body's retry_after), in milliseconds. */
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    opts: {
      kind: ApiErrorKind;
      status?: number;
      code?: string;
      retryable?: boolean;
      retryAfterMs?: number;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = opts.kind;
    this.status = opts.status;
    this.code = opts.code;
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export interface RequestOptions {
  /** Per-attempt timeout. Raised to COLD_START_TIMEOUT_MS while the backend isn't known to be awake. */
  timeout?: number;
  /**
   * Extra attempts after the first for network errors, timeouts and 502/503/504, with jittered
   * exponential backoff. Only for calls that don't change server state. Default: 2 for GET, 0 for POST.
   * A call with retries also waits out a 429 (Retry-After, at most maxRateLimitWaitMs), up to
   * rateLimitRetries times, without using these up.
   */
  retries?: number;
  /** Resolve with `data: null` for an empty body (e.g. 204) instead of failing. */
  allowEmpty?: boolean;
  /** Cancels the request, including any backoff wait. */
  signal?: AbortSignal;
}

// ── Backend liveness signals ────────────────────────────────────────────────
// Any real response from the backend proves it is awake; running out of attempts on network or
// gateway failures suggests it went back to sleep. The backend status provider listens to these.

export type BackendSignal = 'up' | 'down';
type SignalListener = (signal: BackendSignal) => void;

const signalListeners = new Set<SignalListener>();
let lastAwakeAt: number | null = null;

export function onBackendSignal(listener: SignalListener): () => void {
  signalListeners.add(listener);
  return () => {
    signalListeners.delete(listener);
  };
}

function emit(signal: BackendSignal) {
  signalListeners.forEach((listener) => listener(signal));
}

export function isBackendKnownAwake(now = Date.now()): boolean {
  return lastAwakeAt !== null && now - lastAwakeAt < AWAKE_WINDOW_MS;
}

/** Test hook: forget that the backend was ever seen awake. */
export function resetBackendAwareness() {
  lastAwakeAt = null;
}

function markAwake() {
  lastAwakeAt = Date.now();
  emit('up');
}

// ── Rate limiting ───────────────────────────────────────────────────────────
// The backend limits each client IP (a token bucket). A 429 holds EVERY request of this tab until
// the Retry-After has passed, so parallel callers (batch parsing runs several at once) back off
// together instead of each burning its attempts. Listeners get the time the hold ends, then null.

/** When the current hold ends (epoch ms), or null when not rate limited. */
export type RateLimitState = { until: number } | null;
type RateLimitListener = (state: RateLimitState) => void;

const rateLimitListeners = new Set<RateLimitListener>();
let rateLimitedUntil = 0;
let rateLimitTimer: ReturnType<typeof setTimeout> | undefined;

export function onRateLimit(listener: RateLimitListener): () => void {
  rateLimitListeners.add(listener);
  return () => {
    rateLimitListeners.delete(listener);
  };
}

function emitRateLimit(state: RateLimitState) {
  rateLimitListeners.forEach((listener) => listener(state));
}

/** Milliseconds until requests are let through again (0 when not rate limited). */
export function rateLimitRemainingMs(now = Date.now()): number {
  return Math.max(0, rateLimitedUntil - now);
}

/** Test hook: forget any rate-limit hold. */
export function resetRateLimit() {
  rateLimitedUntil = 0;
  clearTimeout(rateLimitTimer);
  rateLimitTimer = undefined;
}

function holdForRateLimit(ms: number) {
  const until = Date.now() + ms;
  if (until <= rateLimitedUntil) return;
  rateLimitedUntil = until;
  clearTimeout(rateLimitTimer);
  rateLimitTimer = setTimeout(() => {
    rateLimitTimer = undefined;
    emitRateLimit(null);
  }, ms);
  emitRateLimit({ until });
}

async function waitOutRateLimit(signal?: AbortSignal) {
  for (let remaining = rateLimitRemainingMs(); remaining > 0; remaining = rateLimitRemainingMs()) {
    await wait(remaining, signal);
  }
}

// ── Response handling ───────────────────────────────────────────────────────

const STATUS_TEXT: Record<number, string> = {
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

function describeStatus(response: Response): string {
  const text = response.statusText || STATUS_TEXT[response.status];
  return text ? `${response.status} ${text}` : String(response.status);
}

function httpFailureMessage(response: Response): string {
  const status = describeStatus(response);
  if (GATEWAY_STATUSES.has(response.status)) {
    return `The generator is starting up or temporarily unavailable (HTTP ${status}). Please try again in a moment.`;
  }
  if (response.status >= 500) {
    return `The generator hit an error (HTTP ${status}). Please try again.`;
  }
  return `The request was rejected (HTTP ${status}).`;
}

/** `{ error: { code, message } }`, `{ error: "..." }` or `{ message: "..." }`. */
function extractStructuredError(data: unknown): { message?: string; code?: string } {
  if (!data || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  const err = record.error;
  if (err && typeof err === 'object') {
    const { message, code } = err as { message?: unknown; code?: unknown };
    return {
      message: typeof message === 'string' && message ? message : undefined,
      code: typeof code === 'string' ? code : undefined,
    };
  }
  if (typeof err === 'string' && err) return { message: err };
  if (typeof record.message === 'string' && record.message) return { message: record.message };
  if (typeof record.detail === 'string' && record.detail) return { message: record.detail };
  return {};
}

/** Retry-After as delta-seconds or an HTTP date; undefined when absent or unusable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - now);
}

/** `{ error: { retry_after: 2 } }` or `{ retry_after: 2 }` (seconds), as the backend's 429 sends. */
function bodyRetryAfter(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as { retry_after?: unknown; error?: { retry_after?: unknown } };
  const value = (record.error && typeof record.error === 'object' ? record.error.retry_after : undefined) ?? record.retry_after;
  const seconds = typeof value === 'string' ? Number(value) : value;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

function looksLikeJson(contentType: string, text: string): boolean {
  if (/[/+]json\b/i.test(contentType)) return true;
  // Tolerate a JSON body served without a JSON content type, but never guess for HTML.
  if (/text\/html/i.test(contentType)) return false;
  const first = text.trimStart()[0];
  return first === '{' || first === '[';
}

async function readResponse(
  response: Response,
  allowEmpty: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any; status: number }> {
  const contentType = response.headers.get('content-type') ?? '';
  // 204/205 have no body by definition; reading one anyway is harmless and returns ''.
  const text = await response.text();
  const isEmpty = text.trim() === '';

  let data: unknown = undefined;
  let parsed = false;
  if (!isEmpty && looksLikeJson(contentType, text)) {
    try {
      data = JSON.parse(text);
      parsed = true;
    } catch {
      parsed = false;
    }
  }

  if (!response.ok) {
    // A structured backend message is shown as is; a gateway's HTML page is replaced by a
    // plain-language message that names the status.
    const structured = parsed ? extractStructuredError(data) : {};
    // Retry-After is not a CORS-safelisted header, so a cross-origin page may not see it; the
    // backend's 429 body carries the same value (`error.retry_after`, seconds).
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after')) ?? bodyRetryAfter(data);
    if (response.status === RATE_LIMITED) {
      const when = retryAfterMs !== undefined ? `in ${formatSeconds(retryAfterMs)}` : 'in a moment';
      throw new ApiError(`The generator is rate limiting requests (HTTP ${describeStatus(response)}). Please try again ${when}.`, {
        kind: 'http',
        status: response.status,
        code: structured.code,
        retryable: true,
        retryAfterMs,
      });
    }
    throw new ApiError(structured.message ?? httpFailureMessage(response), {
      kind: 'http',
      status: response.status,
      code: structured.code,
      retryable: GATEWAY_STATUSES.has(response.status),
      retryAfterMs,
    });
  }

  if (isEmpty) {
    if (allowEmpty) return { data: null, status: response.status };
    throw new ApiError(
      `The generator sent an empty response (HTTP ${describeStatus(response)}) where data was expected.`,
      { kind: 'invalid-response', status: response.status },
    );
  }

  if (!parsed) {
    const what = contentType ? contentType.split(';')[0]!.trim() : 'an unknown format';
    throw new ApiError(
      `The generator sent a response that isn't JSON (HTTP ${describeStatus(response)}, ${what}).`,
      { kind: 'invalid-response', status: response.status },
    );
  }

  return { data, status: response.status };
}

// ── Transport ──────────────────────────────────────────────────────────────

function formatSeconds(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

function abortedError() {
  return new ApiError('The request was cancelled.', { kind: 'aborted' });
}

async function attempt(
  url: string,
  init: RequestInit,
  timeout: number,
  allowEmpty: boolean,
  outerSignal?: AbortSignal,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any; status: number }> {
  if (outerSignal?.aborted) throw abortedError();

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  const forwardAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', forwardAbort);

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch {
      if (timedOut) {
        throw new ApiError(
          `The generator didn't respond within ${formatSeconds(timeout)}.`,
          { kind: 'timeout', retryable: true },
        );
      }
      if (outerSignal?.aborted) throw abortedError();
      // fetch() rejects with a TypeError ("Failed to fetch") for DNS, CORS, offline and refused
      // connections alike; a sleeping backend behind a proxy often looks like this too.
      throw new ApiError(
        "Couldn't reach the generator. Check your connection; if it was idle it may be waking up, so try again in a moment.",
        { kind: 'network', retryable: true },
      );
    }

    // Any response that isn't a gateway error came from the backend itself, so it is awake.
    if (!GATEWAY_STATUSES.has(response.status)) markAwake();

    try {
      return await readResponse(response, allowEmpty);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (timedOut) {
        throw new ApiError(
          `The generator didn't finish responding within ${formatSeconds(timeout)}.`,
          { kind: 'timeout', retryable: true },
        );
      }
      if (outerSignal?.aborted) throw abortedError();
      throw new ApiError("The generator's response was cut off. Please try again.", {
        kind: 'network',
        status: response.status,
        retryable: true,
      });
    }
  } finally {
    clearTimeout(timeoutId);
    outerSignal?.removeEventListener('abort', forwardAbort);
  }
}

/** Full jitter between half and all of the exponential step, capped. */
export function backoffDelay(retryNumber: number, random: () => number = Math.random): number {
  const { retryBaseDelayMs, retryMaxDelayMs } = apiClientConfig;
  const step = Math.min(retryMaxDelayMs, retryBaseDelayMs * 2 ** (retryNumber - 1));
  return Math.round(step * (0.5 + random() * 0.5));
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortedError());
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(abortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function request(
  url: string,
  init: RequestInit,
  options: RequestOptions,
  defaultRetries: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any; status: number }> {
  const retries = Math.max(0, options.retries ?? defaultRetries);
  const allowEmpty = options.allowEmpty ?? false;

  let rateLimitWaits = 0;
  for (let tryNumber = 0; ; tryNumber++) {
    // Awaited only while held, so a request starts in the same tick as the call otherwise.
    if (rateLimitRemainingMs() > 0) await waitOutRateLimit(options.signal);
    const baseTimeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const timeout = isBackendKnownAwake() ? baseTimeout : Math.max(baseTimeout, COLD_START_TIMEOUT_MS);
    try {
      return await attempt(url, init, timeout, allowEmpty, options.signal);
    } catch (err) {
      if (err instanceof ApiError && err.status === RATE_LIMITED) {
        // The backend is up and refused the request unprocessed: wait (bounded) and try again.
        const waitMs = Math.max(apiClientConfig.minRateLimitWaitMs, err.retryAfterMs ?? backoffDelay(rateLimitWaits + 1));
        if (waitMs > apiClientConfig.maxRateLimitWaitMs) throw err;
        holdForRateLimit(waitMs);
        if (retries === 0 || rateLimitWaits >= apiClientConfig.rateLimitRetries) throw err;
        rateLimitWaits++;
        tryNumber--; // a 429 does not use up the call's retries
        continue;
      }
      if (!(err instanceof ApiError) || !err.retryable) throw err;
      if (tryNumber >= retries) {
        // Out of attempts on a network, timeout or gateway failure: the backend may be asleep.
        emit('down');
        throw err;
      }
      const delay =
        err.retryAfterMs !== undefined && err.retryAfterMs <= apiClientConfig.maxRetryAfterMs
          ? err.retryAfterMs
          : backoffDelay(tryNumber + 1);
      await wait(delay, options.signal);
    }
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// SECURITY NOTE — CSRF: The API is served from a different origin (localhost:8000 vs localhost:5173)
// so same-origin cookie-based CSRF attacks do not apply. If you ever move the API to the same origin,
// add a CSRF token header here (e.g. 'X-CSRFToken') and set it from a cookie or meta tag.

export const apiClient = {
  /** GETs are retried twice by default. */
  get(path: string, options: RequestOptions = {}) {
    return request(`${ENV.API_URL}${path}`, { method: 'GET', headers: JSON_HEADERS }, options, 2);
  },

  /** POSTs are not retried unless the caller says the call is safe to repeat (`retries`). */
  post(path: string, body?: unknown, options: RequestOptions = {}) {
    return request(
      `${ENV.API_URL}${path}`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) },
      options,
      0,
    );
  },
};

/** Retries for calls that don't change server state (parse, generate, health). */
export const SAFE_RETRIES = 2;

// Keep for any external consumers
export const API_BASE_URL = ENV.API_URL;
