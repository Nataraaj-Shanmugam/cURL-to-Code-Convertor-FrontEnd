/**
 * Build-time narrowing of the Content-Security-Policy for production deployments (SEC-9).
 *
 * vercel.json's CSP header is shared by every deployment of the project: production and the
 * preview/preprod deployments, which talk to different backends (VITE_CURL_CRAFT_API_URL is set per
 * Vercel environment) and load the Vercel preview toolbar from https://vercel.live. So the header
 * keeps `connect-src 'self' https:` and `script-src ... https://vercel.live`.
 *
 * A production build adds a <meta http-equiv="Content-Security-Policy"> to index.html. A browser
 * enforces every policy it is given (header AND meta), so this narrows, never widens:
 *  - connect-src: 'self' plus the origin(s) of the backend URLs this bundle was built with, so an
 *    injected script cannot send data to any other https host;
 *  - script-src: 'self' (no vercel.live in production).
 * Preview deployments (VERCEL_ENV=preview), dev, Vitest and the perf mode are untouched.
 */
import type { Plugin } from 'vite';
import { GUARDED_MODES } from './envGuard';

/** Env vars that may hold an absolute backend URL (the base URL, or an endpoint given in full). */
const URL_VARS = [
  'VITE_CURL_CRAFT_API_URL',
  'VITE_CURL_CRAFT_API_PARSE_ENDPOINT',
  'VITE_CURL_CRAFT_API_GENERATE_ENDPOINT',
  'VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT',
  'VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT',
  'VITE_CURL_CRAFT_API_HEALTH_ENDPOINT',
  'VITE_CURL_CRAFT_API_BODY_EDIT_ENDPOINT',
  'VITE_CURL_CRAFT_API_BODY_DELETE_ENDPOINT',
] as const;

/** The http(s) origins the bundle calls, from the env it was built with. */
export function apiOrigins(env: Record<string, string | undefined>): string[] {
  const origins = new Set<string>();
  for (const name of URL_VARS) {
    const value = env[name]?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
    } catch {
      // a relative endpoint ("/api/parse"): served from the API base URL
    }
  }
  return [...origins];
}

/** The meta policy for a build, or null when this build must not carry one. */
export function productionCspMeta(
  command: string,
  mode: string,
  env: Record<string, string | undefined>,
  vercelEnv: string | undefined,
): string | null {
  if (command !== 'build' || !GUARDED_MODES.includes(mode)) return null;
  // Preview deployments keep the header policy as is (other backends, Vercel toolbar).
  if (vercelEnv && vercelEnv !== 'production') return null;
  const origins = apiOrigins(env);
  if (origins.length === 0) return null; // the env guard rejects such a build anyway
  return [`connect-src 'self' ${origins.join(' ')}`, "script-src 'self'"].join('; ');
}

export function cspMeta(): Plugin {
  let policy: string | null = null;
  return {
    name: 'curlcraft:csp-meta',
    configResolved(config) {
      policy = productionCspMeta(config.command, config.mode, config.env as Record<string, string>, process.env.VERCEL_ENV);
    },
    transformIndexHtml() {
      if (!policy) return [];
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}
