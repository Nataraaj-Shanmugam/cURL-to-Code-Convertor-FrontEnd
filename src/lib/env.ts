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

export const ENV = {
  API_URL:            env('VITE_CURL_CRAFT_API_URL',                  'http://127.0.0.1:8000'),
  PARSE_ENDPOINT:     env('VITE_CURL_CRAFT_API_PARSE_ENDPOINT',       '/api/parse'),
  GENERATE_ENDPOINT:  env('VITE_CURL_CRAFT_API_GENERATE_ENDPOINT',    '/api/generate-from-parsed'),
  FEEDBACK_ENDPOINT:  env('VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT',    '/api/feedback'),
  BODY_EDIT_ENDPOINT: env('VITE_CURL_CRAFT_API_BODY_EDIT_ENDPOINT',   '/api/body/edit'),
  BODY_DELETE_ENDPOINT: env('VITE_CURL_CRAFT_API_BODY_DELETE_ENDPOINT', '/api/body/delete'),
} as const;
