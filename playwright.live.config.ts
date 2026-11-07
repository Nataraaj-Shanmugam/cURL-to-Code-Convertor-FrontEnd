import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Full-stack functional E2E: the real frontend (Vite dev server) against the real backend (uvicorn).
 * No API mocks: every /api call reaches the FastAPI app. Run with `npm run test:e2e:live`.
 *
 *   browser ──> Vite dev server (FE port) ──fetch──> gateway (GW port) ──> uvicorn backend (BE port)
 *
 * The gateway (e2e-live/support/gateway.mjs) is a pass-through that can also answer like a sleeping
 * hosting platform (HTML 503), so the cold-start states can be exercised against the real backend.
 *
 * Settings (environment variables, all optional):
 *   CURLCRAFT_BACKEND_DIR     backend checkout       (default: ../be-unit, then ../cURL-to-Code-Convertor-BackEnd)
 *   CURLCRAFT_BACKEND_PYTHON  Python with its deps   (default: <backend>/.venv/bin/python, then python3)
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Ask the OS for a free port. Synchronous so the config can use it; reused by the worker processes via env. */
function freePort(): string {
  return execFileSync(process.execPath, [
    '-e',
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close()})",
  ])
    .toString()
    .trim();
}

// Workers re-evaluate this file; the env set by the main process keeps every process on the same ports.
process.env.E2E_LIVE_BE_PORT ||= freePort();
process.env.E2E_LIVE_GW_PORT ||= freePort();
process.env.E2E_LIVE_FE_PORT ||= freePort();
const BE_PORT = process.env.E2E_LIVE_BE_PORT;
const GW_PORT = process.env.E2E_LIVE_GW_PORT;
const FE_PORT = process.env.E2E_LIVE_FE_PORT;

const backendDir =
  process.env.CURLCRAFT_BACKEND_DIR ??
  ['../be-unit', '../cURL-to-Code-Convertor-BackEnd']
    .map((p) => path.resolve(here, p))
    .find((p) => fs.existsSync(path.join(p, 'main.py'))) ??
  path.resolve(here, '../be-unit');

const python =
  process.env.CURLCRAFT_BACKEND_PYTHON ??
  [path.join(backendDir, '.venv/bin/python'), path.resolve(here, '../../be-venv/bin/python')].find((p) =>
    fs.existsSync(p),
  ) ??
  'python3';

const FRONTEND = `http://localhost:${FE_PORT}`;
const GATEWAY = `http://127.0.0.1:${GW_PORT}`;
process.env.E2E_LIVE_GATEWAY = GATEWAY;
process.env.E2E_LIVE_BACKEND = `http://127.0.0.1:${BE_PORT}`;

export default defineConfig({
  testDir: './e2e-live',
  outputDir: './test-results/live',
  forbidOnly: !!process.env.CI,
  retries: 0, // flakiness must show up, not be retried away
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/live' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: FRONTEND,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },

  projects: [
    {
      name: 'live',
      testIgnore: /backend-status\.spec\.ts/,
      fullyParallel: true,
    },
    {
      // Puts the gateway to sleep, which every other test would see: runs alone, after them.
      name: 'live-backend-status',
      testMatch: /backend-status\.spec\.ts/,
      dependencies: ['live'],
      fullyParallel: false,
      workers: 1,
    },
  ],

  webServer: [
    {
      command: `"${python}" e2e-live/support/run_backend.py "${backendDir}" ${BE_PORT}`,
      url: `http://127.0.0.1:${BE_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        ENVIRONMENT: 'development',
        ALLOWED_ORIGINS: `${FRONTEND},http://127.0.0.1:${FE_PORT}`,
        ALLOWED_ORIGIN_REGEX: '',
        // Feedback goes to Google Sheets only when credentials are configured; none are, on purpose.
        GOOGLE_SHEETS_ID: '',
        GOOGLE_CREDENTIALS_JSON: '',
        GOOGLE_CREDENTIALS_PATH: '',
        PYTHONUNBUFFERED: '1',
      },
    },
    {
      command: `node e2e-live/support/gateway.mjs ${GW_PORT} ${BE_PORT}`,
      url: `${GATEWAY}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npx vite --port ${FE_PORT} --strictPort --host localhost`,
      url: FRONTEND,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        BROWSER: 'none', // vite.config.ts sets server.open
        // Process env wins over .env.development; the endpoint paths are the ones it defines.
        VITE_CURL_CRAFT_API_URL: GATEWAY,
        VITE_CURL_CRAFT_API_HEALTH_ENDPOINT: '/api/health',
        VITE_CURL_CRAFT_API_PARSE_ENDPOINT: '/api/parse',
        VITE_CURL_CRAFT_API_GENERATE_ENDPOINT: '/api/generate-from-parsed',
        VITE_CURL_CRAFT_API_PARSE_AND_GENERATE_ENDPOINT: '/api/parse-and-generate',
        VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT: '/api/feedback',
      },
    },
  ],
});
