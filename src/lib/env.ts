/**
 * Centralised env-var access with dev-time warnings for missing vars.
 * All VITE_* env vars should be read through this module.
 */
function env(key: string, fallback: string): string {
  const value = import.meta.env[key] as string | undefined;
  if (!value && import.meta.env.DEV) {
    console.warn(`[env] ${key} is not set — using fallback "${fallback}"`);
  }
  return value || fallback;
}

/** Optional boolean flag: only the literal string "true" turns it on; unset means off (no dev warning). */
function flag(key: string): boolean {
  return (import.meta.env[key] as string | undefined)?.trim().toLowerCase() === 'true';
}

export const ENV = {
  API_URL:            env('VITE_CURL_CRAFT_API_URL',                  'http://127.0.0.1:8000'),
  PARSE_ENDPOINT:     env('VITE_CURL_CRAFT_API_PARSE_ENDPOINT',       '/api/parse'),
  GENERATE_ENDPOINT:  env('VITE_CURL_CRAFT_API_GENERATE_ENDPOINT',    '/api/generate-from-parsed'),
  FEEDBACK_ENDPOINT:  env('VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT',    '/api/feedback'),
  BODY_EDIT_ENDPOINT: env('VITE_CURL_CRAFT_API_BODY_EDIT_ENDPOINT',   '/api/body/edit'),
  BODY_DELETE_ENDPOINT: env('VITE_CURL_CRAFT_API_BODY_DELETE_ENDPOINT', '/api/body/delete'),
  /**
   * Off by default. Body edits and deletes always apply locally; when this is on, the editor also
   * mirrors them to BODY_EDIT_ENDPOINT / BODY_DELETE_ENDPOINT, and a failure never undoes the edit.
   */
  BODY_API_ENABLED:   flag('VITE_CURL_CRAFT_BODY_API_ENABLED'),
} as const;
