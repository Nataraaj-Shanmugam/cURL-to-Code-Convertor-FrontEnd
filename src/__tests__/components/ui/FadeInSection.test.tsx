import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FadeInSection } from '@/components/ui/fade-in-section';

const realMatchMedia = window.matchMedia;
const RealIO = globalThis.IntersectionObserver;

// The shared test setup defines IntersectionObserver as writable but not configurable: assign, don't redefine.
function setObserver(value: unknown) {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = value;
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = value;
}

/** An IntersectionObserver that only fires when the test says so. */
function installObserver() {
  const instances: { callback: IntersectionObserverCallback; disconnected: boolean }[] = [];
  class ManualObserver {
    disconnected = false;
    constructor(public callback: IntersectionObserverCallback) {
      instances.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
    takeRecords() {
      return [];
    }
  }
  setObserver(ManualObserver);
  return instances;
}

function setTop(top: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

const section = () => screen.getByText('content').parentElement!;

afterEach(() => {
  vi.restoreAllMocks();
  window.matchMedia = realMatchMedia;
  setObserver(RealIO);
});

describe('FadeInSection', () => {
  it('is visible by default when there is no IntersectionObserver', () => {
    setObserver(undefined);
    setTop(5000);
    render(<FadeInSection><p>content</p></FadeInSection>);
    expect(section()).toHaveStyle({ opacity: '1' });
  });

  it('is visible when it starts on screen', () => {
    installObserver();
    setTop(100);
    render(<FadeInSection><p>content</p></FadeInSection>);
    expect(section()).toHaveStyle({ opacity: '1' });
    expect(section()).toHaveAttribute('data-reveal', 'done');
  });

  it('stays visible with prefers-reduced-motion, even below the fold', () => {
    const instances = installObserver();
    setReducedMotion(true);
    setTop(5000);
    render(<FadeInSection><p>content</p></FadeInSection>);
    expect(section()).toHaveStyle({ opacity: '1', transform: 'none' });
    expect(instances).toHaveLength(0);
  });

  it('fades in below-the-fold content only when it scrolls into view', () => {
    const instances = installObserver();
    setReducedMotion(false);
    setTop(5000);
    render(<FadeInSection><p>content</p></FadeInSection>);
    expect(section()).toHaveAttribute('data-reveal', 'pending');
    expect(section()).toHaveStyle({ opacity: '0' });

    act(() => instances[0]!.callback([{ isIntersecting: true } as IntersectionObserverEntry], instances[0] as unknown as IntersectionObserver));
    expect(section()).toHaveAttribute('data-reveal', 'done');
    expect(section()).toHaveStyle({ opacity: '1' });
    expect(instances[0]!.disconnected).toBe(true);
  });
});

describe('prefers-reduced-motion stylesheet', () => {
  it('switches off animations and transitions app-wide', () => {
    const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });
});
