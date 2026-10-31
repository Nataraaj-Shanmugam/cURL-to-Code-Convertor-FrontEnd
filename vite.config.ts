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