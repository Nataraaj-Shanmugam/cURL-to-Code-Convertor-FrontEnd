import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimChunkReload,
  installChunkLoadRecovery,
  isChunkLoadError,
} from '@/lib/utils/chunkLoadRecovery';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => { data.delete(k); },
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
  } as Storage;
}

describe('isChunkLoadError', () => {
  it('recognises the dynamic import failures browsers and bundlers report', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Playground-abc.js'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Network Error'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('claimChunkReload', () => {
  it('allows one reload, then blocks further reloads inside the window', () => {
    const storage = memoryStorage();
    expect(claimChunkReload(storage, 1_000_000)).toBe(true);
    expect(claimChunkReload(storage, 1_000_500)).toBe(false);
    expect(claimChunkReload(storage, 1_000_000 + 59_000)).toBe(false);
  });

  it('allows a reload again once the window has passed', () => {
    const storage = memoryStorage();
    claimChunkReload(storage, 1_000_000);
    expect(claimChunkReload(storage, 1_000_000 + 61_000)).toBe(true);
  });

  it('does not reload when sessionStorage is unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    } as unknown as Storage;
    expect(claimChunkReload(broken, 1)).toBe(false);
  });
});

describe('installChunkLoadRecovery', () => {
  afterEach(() => vi.restoreAllMocks());

  function fakeWindow() {
    const target = new EventTarget();
    const reload = vi.fn();
    const win = Object.assign(target, {
      sessionStorage: memoryStorage(),
      location: { reload },
    });
    return { win: win as unknown as Window, reload };
  }

  function preloadError() {
    const event = new Event('vite:preloadError', { cancelable: true });
    return event;
  }

  it('reloads once and cancels the error on the first chunk failure', () => {
    const { win, reload } = fakeWindow();
    installChunkLoadRecovery(win);
    const event = preloadError();
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lets the error through on a second failure so the boundary can show it', () => {
    const { win, reload } = fakeWindow();
    installChunkLoadRecovery(win);
    win.dispatchEvent(preloadError());
    const second = preloadError();
    win.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
