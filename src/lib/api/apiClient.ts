import { ENV } from '@/lib/env';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const GENERATE_TIMEOUT_MS = 30_000;

function extractErrorMessage(data: Record<string, unknown>): string {
  const err = data?.error as { message?: string } | string | undefined;
  if (err && typeof err === 'object') return err.message || 'Request failed';
  if (typeof err === 'string') return err;
  return (data?.message as string) || 'Request failed';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(
  url: string,
  init: RequestInit & { timeout?: number },
): Promise<{ data: any }> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...rest, signal: controller.signal });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    if (!response.ok) {
      throw new Error(extractErrorMessage(data as Record<string, unknown>));
    }

    return { data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// SECURITY NOTE — CSRF: The API is served from a different origin (localhost:8000 vs localhost:5173)
// so same-origin cookie-based CSRF attacks do not apply. If you ever move the API to the same origin,
// add a CSRF token header here (e.g. 'X-CSRFToken') and set it from a cookie or meta tag.

export const apiClient = {
  get(path: string, options?: { timeout?: number }) {
    return fetchJson(`${ENV.API_URL}${path}`, {
      method: 'GET',
      headers: JSON_HEADERS,
      timeout: options?.timeout,
    });
  },

  post(path: string, body: unknown, options?: { timeout?: number }) {
    return fetchJson(`${ENV.API_URL}${path}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
      timeout: options?.timeout,
    });
  },
};

// Keep for any external consumers
export const API_BASE_URL = ENV.API_URL;
