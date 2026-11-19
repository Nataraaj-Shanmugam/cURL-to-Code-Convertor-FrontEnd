/**
 * Build-time guard for the backend URL.
 *
 * src/lib/env.ts falls back to http://127.0.0.1:8000 so `npm run dev` works with
 * no setup. That fallback must never reach a deployed bundle: a visitor's browser
 * would call its own localhost. This plugin fails `vite build` in the deployed
 * modes (production, preprod) when VITE_CURL_CRAFT_API_URL is missing, malformed
 * or loopback. Dev, preview and Vitest are untouched.
 */
import type { Plugin } from 'vite';

export const API_URL_VAR = 'VITE_CURL_CRAFT_API_URL';

/** Modes whose output is deployed and so must carry a real backend URL. */
export const GUARDED_MODES: readonly string[] = ['production', 'preprod'];

/**
 * True for hosts that only ever reach the machine running the browser:
 * localhost (and *.localhost), 127.0.0.0/8, ::1 and 0.0.0.0, plus the IPv6
 * unspecified address and IPv4-mapped forms of those.
 *
 * Expects `URL.hostname`, which has already canonicalised alternative spellings
 * (http://2130706433, http://0x7f.1, http://[0:0:0:0:0:0:0:1], ...).
 */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');

  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0') return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;

  if (host.startsWith('[') && host.endsWith(']')) {
    const v6 = host.slice(1, -1);
    if (v6 === '::1' || v6 === '::') return true;
    // IPv4-mapped, as URL() prints them: ::ffff:7f00:1 is 127.0.0.1, ::ffff:0:0 is 0.0.0.0
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
    if (mapped) {
      const [, highHex = '', lowHex = ''] = mapped;
      const high = parseInt(highHex, 16);
      const low = parseInt(lowHex, 16);
      return high >> 8 === 127 || (high === 0 && low === 0);
    }
  }
  return false;
}

/** Returns what is wrong with the value, or null when it is acceptable. */
export function validateApiUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return 'it is not set (or is empty)';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `"${value}" is not an absolute URL; include the scheme, e.g. https://api.example.com`;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `"${value}" is not an absolute http(s) URL; include the scheme, e.g. https://api.example.com`;
  }
  if (isLoopbackHost(url.hostname)) {
    return `"${value}" points at a loopback host (${url.hostname}), which visitors' browsers cannot use as the backend`;
  }
  return null;
}

export function envGuardMessage(mode: string, problem: string): string {
  return [
    '',
    `[env-guard] Refusing to build in "${mode}" mode: ${API_URL_VAR} is invalid: ${problem}.`,
    `Set ${API_URL_VAR} to the public URL of the CurlCraft backend and rebuild:`,
    '  - Vercel: Project Settings > Environment Variables (scope it to the environment being built)',
    `  - Local: ${API_URL_VAR}=https://api.example.com npm run build`,
    '    (or put it in .env.production.local / .env.preprod, which are git-ignored)',
    'The localhost fallback only applies to `npm run dev`. See "Environment variables" in README.md.',
    '',
  ].join('\n');
}

export function envGuard(): Plugin {
  return {
    name: 'curlcraft:env-guard',
    // `config.env` is what Vite inlines into the bundle: .env files for the mode
    // merged with VITE_* variables from process.env (how Vercel supplies them).
    configResolved(config) {
      if (config.command !== 'build' || !GUARDED_MODES.includes(config.mode)) return;
      const problem = validateApiUrl(config.env[API_URL_VAR] as string | undefined);
      if (problem) throw new Error(envGuardMessage(config.mode, problem));
    },
  };
}
