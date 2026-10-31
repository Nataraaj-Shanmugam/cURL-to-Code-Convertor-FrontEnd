import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';
import { apiClientConfig, resetBackendAwareness } from '@/lib/api/apiClient';

// Keep the client's retry backoff to a few milliseconds so retried failures don't slow the suite.
apiClientConfig.retryBaseDelayMs = 1;
apiClientConfig.retryMaxDelayMs = 5;
apiClientConfig.maxRetryAfterMs = 50;

// Mock window.matchMedia (required by next-themes)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver (required by framer-motion whileInView)
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(private callback: IntersectionObserverCallback) {}
  observe() { /* trigger visible immediately */ this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: MockIntersectionObserver });
Object.defineProperty(globalThis, 'IntersectionObserver', { writable: true, value: MockIntersectionObserver });

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetBackendAwareness();
});
afterAll(() => server.close());
