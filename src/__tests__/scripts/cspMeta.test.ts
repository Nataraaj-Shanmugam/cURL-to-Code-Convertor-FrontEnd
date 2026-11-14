import { describe, it, expect } from 'vitest';
import type { ResolvedConfig } from 'vite';
import { apiOrigins, cspMeta, productionCspMeta } from '../../../scripts/cspMeta';

const env = { VITE_CURL_CRAFT_API_URL: 'https://api.example.test', VITE_CURL_CRAFT_API_PARSE_ENDPOINT: '/api/parse' };

describe('cspMeta (SEC-9)', () => {
  it('collects the origins of absolute backend URLs only', () => {
    expect(
      apiOrigins({
        ...env,
        VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT: 'https://feedback.example.test/api/feedback',
        VITE_CURL_CRAFT_API_HEALTH_ENDPOINT: 'not a url',
        VITE_CURL_CRAFT_API_GENERATE_ENDPOINT: 'javascript:alert(1)',
      }),
    ).toEqual(['https://api.example.test', 'https://feedback.example.test']);
  });

  it('narrows connect-src to the API origin and script-src to self in a production build', () => {
    expect(productionCspMeta('build', 'production', env, undefined)).toBe(
      "connect-src 'self' https://api.example.test; script-src 'self'",
    );
    expect(productionCspMeta('build', 'production', env, 'production')).not.toBeNull();
    expect(productionCspMeta('build', 'preprod', env, undefined)).not.toBeNull();
  });

  it('leaves previews (Vercel toolbar, other backends), dev, perf and empty envs alone', () => {
    expect(productionCspMeta('build', 'production', env, 'preview')).toBeNull();
    expect(productionCspMeta('serve', 'production', env, undefined)).toBeNull();
    expect(productionCspMeta('build', 'perf', env, undefined)).toBeNull();
    expect(productionCspMeta('build', 'production', {}, undefined)).toBeNull();
  });

  it('injects the policy as the first tag of <head>', () => {
    const plugin = cspMeta();
    const saved = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV;
    try {
      (plugin.configResolved as (c: ResolvedConfig) => void)({ command: 'build', mode: 'production', env } as unknown as ResolvedConfig);
      const tags = (plugin.transformIndexHtml as () => unknown)();
      expect(tags).toEqual([
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: "connect-src 'self' https://api.example.test; script-src 'self'" },
          injectTo: 'head-prepend',
        },
      ]);
      (plugin.configResolved as (c: ResolvedConfig) => void)({ command: 'serve', mode: 'development', env } as unknown as ResolvedConfig);
      expect((plugin.transformIndexHtml as () => unknown)()).toEqual([]);
    } finally {
      if (saved !== undefined) process.env.VERCEL_ENV = saved;
    }
  });
});
