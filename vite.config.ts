/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { envGuard } from './scripts/envGuard';

export default defineConfig({
  plugins: [react(), envGuard()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Test code, fixtures, mocks and setup are not product code.
        'src/__tests__/**',
        // main.tsx only calls createRoot(...).render() against the real DOM root and mounts the
        // router; it has no logic, and its behaviour is covered by the e2e suite (Playwright).
        'src/main.tsx',
        // Type declarations only: they compile to nothing, so there is nothing to execute.
        'src/types/**',
        'src/**/*.d.ts',
      ],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      // CI gate: `npm run test:coverage` fails when any metric drops below 90%.
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
    // Same values as the fallbacks in src/lib/env.ts, so tests behave as before but no longer warn
    // "[env] ... is not set" on every run.
    env: {
      VITE_CURL_CRAFT_API_URL: 'http://127.0.0.1:8000',
      VITE_CURL_CRAFT_API_PARSE_ENDPOINT: '/api/parse',
      VITE_CURL_CRAFT_API_GENERATE_ENDPOINT: '/api/generate-from-parsed',
      VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT: '/api/feedback',
      VITE_CURL_CRAFT_API_BODY_EDIT_ENDPOINT: '/api/body/edit',
      VITE_CURL_CRAFT_API_BODY_DELETE_ENDPOINT: '/api/body/delete',
    },
  },
});