import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const NEW = 'VITE_CURL_CRAFT_API_GENERATE_ENDPOINT';
const OLD = 'VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT';

async function loadEnv() {
  vi.resetModules();
  return (await import('@/lib/env')).ENV;
}

describe('ENV.GENERATE_ENDPOINT', () => {
  beforeEach(() => {
    vi.stubEnv(NEW, '');
    vi.stubEnv(OLD, '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('defaults to the backend route', async () => {
    expect((await loadEnv()).GENERATE_ENDPOINT).toBe('/api/generate-from-parsed');
  });

  it("falls back to production's variable name (the one Vercel sets)", async () => {
    vi.stubEnv(OLD, '/custom/generate');
    expect((await loadEnv()).GENERATE_ENDPOINT).toBe('/custom/generate');
  });

  it('prefers the V3 name when both are set', async () => {
    vi.stubEnv(NEW, '/v3/generate');
    vi.stubEnv(OLD, '/custom/generate');
    expect((await loadEnv()).GENERATE_ENDPOINT).toBe('/v3/generate');
  });
});
