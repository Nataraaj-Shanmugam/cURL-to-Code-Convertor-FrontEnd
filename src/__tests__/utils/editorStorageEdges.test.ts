import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EDITOR_STORAGE_KEY,
  EDITOR_STATE_VERSION,
  EDITOR_STATE_TTL_MS,
  EDITOR_LIVE_SLOT,
  saveEditorState,
  loadEditorState,
  migrateLegacyEditorState,
  redactHistoryState,
  resolveEditorRestore,
  rememberEditorRequest,
  touchEditorRestore,
  clearEditorRestore,
  clearEditorState,
  hasSavedEditorState,
} from '@/lib/utils/editorStorage';
import { forgetAllLiveRequests, recallLiveRequest } from '@/lib/utils/liveRequestStore';
import { REDACTED_PLACEHOLDER as R } from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const p = (extra: Record<string, unknown> = {}) => ({ method: 'GET', base_url: 'https://a.test', endpoint: '/x', headers: { Authorization: 'Bearer secret-token' }, ...extra }) as unknown as ParsedCurl;
const stored = () => JSON.parse(sessionStorage.getItem(EDITOR_STORAGE_KEY)!);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '');
  forgetAllLiveRequests();
});
afterEach(() => vi.restoreAllMocks());

/** Makes window.<name> throw on access, like a browser with storage blocked. */
const block = (name: 'sessionStorage' | 'localStorage') =>
  vi.spyOn(window, name, 'get').mockImplementation(() => {
    throw new Error('blocked');
  });

describe('saveEditorState / loadEditorState', () => {
  it('stores a redacted, versioned, time-stamped copy and never the secret', () => {
    expect(saveEditorState(p(), "curl -H 'Authorization: Bearer secret-token' https://a.test", 1000)).toBe(true);
    const raw = sessionStorage.getItem(EDITOR_STORAGE_KEY)!;
    expect(raw).not.toContain('secret-token');
    expect(stored()).toMatchObject({ version: EDITOR_STATE_VERSION, savedAt: 1000 });
    expect(stored().parsed.headers.Authorization).toBe(`Bearer ${R}`);
    expect(stored().originalCurl).toContain(R);
  });
  it('omits originalCurl when it is not a string', () => {
    saveEditorState(p(), undefined, 1);
    expect(stored().originalCurl).toBeUndefined();
  });
  it('load round-trips and re-redacts anything written by another route', () => {
    sessionStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ version: EDITOR_STATE_VERSION, savedAt: 5, parsed: p(), originalCurl: "curl -u a:b-long https://a.test" }));
    const snap = loadEditorState(6)!;
    expect(JSON.stringify(snap)).not.toContain('secret-token');
    expect(snap.originalCurl).not.toContain('b-long');
  });
  it.each([
    ['empty', ''],
    ['not json', '{'],
    ['wrong version', JSON.stringify({ version: 1, savedAt: 1, parsed: {} })],
    ['missing savedAt', JSON.stringify({ version: EDITOR_STATE_VERSION, parsed: {} })],
    ['parsed is an array', JSON.stringify({ version: EDITOR_STATE_VERSION, savedAt: 1, parsed: [] })],
    ['parsed is null', JSON.stringify({ version: EDITOR_STATE_VERSION, savedAt: 1, parsed: null })],
    ['json null', 'null'],
  ])('unreadable entry (%s) loads as null', (_n, raw) => {
    sessionStorage.setItem(EDITOR_STORAGE_KEY, raw);
    expect(loadEditorState(2)).toBeNull();
  });
  it('removes entries that are invalid or expired', () => {
    sessionStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ version: 99, savedAt: 1, parsed: {} }));
    loadEditorState(2);
    expect(hasSavedEditorState()).toBe(false);
    saveEditorState(p(), undefined, 0);
    expect(loadEditorState(EDITOR_STATE_TTL_MS)).not.toBeNull();
    expect(loadEditorState(EDITOR_STATE_TTL_MS + 1)).toBeNull();
    expect(hasSavedEditorState()).toBe(false);
  });
  it('save returns false when storage is blocked or full; load/has/clear tolerate it', () => {
    const spy = block('sessionStorage');
    expect(saveEditorState(p())).toBe(false);
    expect(loadEditorState()).toBeNull();
    expect(hasSavedEditorState()).toBe(false);
    expect(() => clearEditorState()).not.toThrow();
    expect(() => touchEditorRestore()).not.toThrow();
    spy.mockRestore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveEditorState(p())).toBe(false);
  });
  it('getItem throwing during load is treated as nothing saved', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(loadEditorState()).toBeNull();
    expect(hasSavedEditorState()).toBe(false);
  });
  it('handles unicode and very large requests', () => {
    const big = p({ data: { text: 'é🔑'.repeat(50_000) } });
    expect(saveEditorState(big, undefined, 1)).toBe(true);
    expect((loadEditorState(2)!.parsed as unknown as { data: { text: string } }).data.text.length).toBe(150_000);
  });
});

describe('legacy localStorage migration', () => {
  const legacy = (value: unknown) => localStorage.setItem(EDITOR_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
  it('does nothing without a legacy entry', () => {
    expect(() => migrateLegacyEditorState()).not.toThrow();
    expect(hasSavedEditorState()).toBe(false);
  });
  it('carries a legacy entry over redacted and deletes it', () => {
    legacy({ parsed: p(), originalCurl: 'curl https://a.test' });
    migrateLegacyEditorState(10);
    expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    expect(stored().parsed.headers.Authorization).toBe(`Bearer ${R}`);
    expect(stored().originalCurl).toBe('curl https://a.test');
  });
  it('keeps the newer session entry and still deletes the legacy one', () => {
    saveEditorState(p({ endpoint: '/new' }), undefined, 1);
    legacy({ parsed: p({ endpoint: '/old' }) });
    migrateLegacyEditorState(2);
    expect(stored().parsed.endpoint).toBe('/new');
    expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
  });
  it.each([['garbage', 'not json'], ['no parsed', '{}'], ['array parsed', '{"parsed":[]}']])('unusable legacy (%s) is dropped without a session entry', (_n, raw) => {
    legacy(raw);
    migrateLegacyEditorState();
    expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    expect(hasSavedEditorState()).toBe(false);
  });
  it('non-string originalCurl in legacy is ignored', () => {
    legacy({ parsed: p(), originalCurl: 5 });
    migrateLegacyEditorState();
    expect(stored().originalCurl).toBeUndefined();
  });
  it('blocked localStorage or failing getItem/removeItem never throws', () => {
    const spy = block('localStorage');
    expect(() => migrateLegacyEditorState()).not.toThrow();
    spy.mockRestore();
    legacy({ parsed: p() });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => migrateLegacyEditorState()).not.toThrow();
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => migrateLegacyEditorState()).not.toThrow();
  });
  it('loading migrates first', () => {
    legacy({ parsed: p() });
    expect(loadEditorState(1)).not.toBeNull();
    expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
  });
});

describe('history state', () => {
  const setHistory = (state: unknown) => window.history.replaceState(state, '');
  it('redactHistoryState replaces the payload with a redacted, stamped copy and keeps router keys', () => {
    setHistory({ key: 'k1', usr: { parsed: p(), originalCurl: "curl -H 'Authorization: Bearer secret-token' x", other: 1 } });
    redactHistoryState(77);
    const h = window.history.state;
    expect(h.key).toBe('k1');
    expect(h.usr).toMatchObject({ redacted: true, savedAt: 77, other: 1 });
    expect(JSON.stringify(h)).not.toContain('secret-token');
  });
  it.each([
    ['no state', null],
    ['state without usr', { key: 'a' }],
    ['usr without parsed', { usr: { x: 1 } }],
    ['usr.parsed is array', { usr: { parsed: [] } }],
    ['state is a string', 'str'],
  ])('redactHistoryState is a no-op for %s', (_n, state) => {
    setHistory(state);
    redactHistoryState(1);
    expect(window.history.state).toEqual(state);
  });
  it('redactHistoryState survives replaceState throwing and a non-string originalCurl', () => {
    setHistory({ usr: { parsed: p(), originalCurl: 5 } });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => redactHistoryState(1)).not.toThrow();
  });
  it('history.state getter throwing is tolerated', () => {
    vi.spyOn(window.history, 'state', 'get').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => redactHistoryState(1)).not.toThrow();
    expect(() => touchEditorRestore(1)).not.toThrow();
    expect(() => clearEditorRestore()).not.toThrow();
  });
});

describe('resolveEditorRestore', () => {
  it.each([
    ['null', null], ['string', 'x'], ['no parsed', {}], ['parsed array', { parsed: [] }],
  ])('route state %s with nothing saved -> none', (_n, state) => {
    expect(resolveEditorRestore(state)).toEqual({ source: 'none', snapshot: null });
  });
  it('a fresh payload (not redacted) is live as is, even when stale-looking', () => {
    const r = resolveEditorRestore({ parsed: p(), originalCurl: 'c', savedAt: 0 }, 10 * EDITOR_STATE_TTL_MS);
    expect(r.source).toBe('live');
    expect(r.snapshot).toEqual({ parsed: p(), originalCurl: 'c' });
    expect(resolveEditorRestore({ parsed: p(), originalCurl: 5 }).snapshot!.originalCurl).toBeUndefined();
  });
  it('a redacted history copy is upgraded to live when the same request is in memory', () => {
    const live = { parsed: p(), originalCurl: 'curl https://a.test' };
    rememberEditorRequest(live, 100);
    saveEditorState(live.parsed, live.originalCurl, 100);
    const r = resolveEditorRestore({ parsed: loadEditorState(100)!.parsed, originalCurl: live.originalCurl, redacted: true, savedAt: 100 }, 200);
    expect(r.source).toBe('live');
    expect(r.snapshot).toBe(live);
  });
  it('a redacted copy for a different request, or with nothing in memory, stays redacted', () => {
    rememberEditorRequest({ parsed: p({ endpoint: '/other' }) }, 100);
    const r = resolveEditorRestore({ parsed: p(), redacted: true, savedAt: 100 }, 200);
    expect(r.source).toBe('redacted');
    expect(JSON.stringify(r.snapshot)).not.toContain('secret-token');
    forgetAllLiveRequests();
    expect(resolveEditorRestore({ parsed: p(), redacted: true }, 200).source).toBe('redacted');
  });
  it('redacted history copy: TTL boundary, missing savedAt means fresh', () => {
    const state = { parsed: p(), redacted: true, savedAt: 0 };
    expect(resolveEditorRestore(state, EDITOR_STATE_TTL_MS).source).toBe('redacted');
    expect(resolveEditorRestore(state, EDITOR_STATE_TTL_MS + 1)).toEqual({ source: 'expired', snapshot: null });
  });
  it('falls back to sessionStorage, upgrading to live; reports expiry', () => {
    const live = { parsed: p() };
    saveEditorState(live.parsed, undefined, 0);
    rememberEditorRequest(live, 0);
    expect(resolveEditorRestore(null, 5).source).toBe('live');
    forgetAllLiveRequests();
    expect(resolveEditorRestore(null, 5).source).toBe('redacted');
    expect(resolveEditorRestore(null, EDITOR_STATE_TTL_MS + 1)).toEqual({ source: 'expired', snapshot: null });
    expect(resolveEditorRestore(null, EDITOR_STATE_TTL_MS + 2)).toEqual({ source: 'none', snapshot: null });
  });
  it('an expired live copy is not used to upgrade', () => {
    saveEditorState(p(), undefined, 0);
    rememberEditorRequest({ parsed: p() }, 0);
    expect(resolveEditorRestore(null, EDITOR_STATE_TTL_MS).source).toBe('live');
    rememberEditorRequest({ parsed: p() }, 0);
    expect(resolveEditorRestore({ parsed: p(), redacted: true, savedAt: EDITOR_STATE_TTL_MS }, EDITOR_STATE_TTL_MS + 1).source).toBe('redacted');
  });
});

describe('touch and clear', () => {
  it('touchEditorRestore restarts the saved, in-memory and history clocks', () => {
    saveEditorState(p(), undefined, 0);
    rememberEditorRequest({ parsed: p() }, 0);
    window.history.replaceState({ usr: { parsed: p(), redacted: true, savedAt: 0 } }, '');
    touchEditorRestore(EDITOR_STATE_TTL_MS);
    expect(stored().savedAt).toBe(EDITOR_STATE_TTL_MS);
    expect(recallLiveRequest(EDITOR_LIVE_SLOT, EDITOR_STATE_TTL_MS * 2)).not.toBeNull();
    expect(window.history.state.usr.savedAt).toBe(EDITOR_STATE_TTL_MS);
  });
  it('touch leaves history alone when it was not redacted, and ignores unusable saved entries', () => {
    window.history.replaceState({ usr: { parsed: p() } }, '');
    touchEditorRestore(5);
    expect(window.history.state.usr.savedAt).toBeUndefined();
    sessionStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ version: 1, savedAt: 1 }));
    touchEditorRestore(9);
    expect(stored().savedAt).toBe(1);
    sessionStorage.setItem(EDITOR_STORAGE_KEY, 'junk');
    expect(() => touchEditorRestore(9)).not.toThrow();
    sessionStorage.clear();
    expect(() => touchEditorRestore(9)).not.toThrow();
    expect(hasSavedEditorState()).toBe(false);
  });
  it('clearEditorRestore forgets everything: storage, legacy, history payload (router keys stay), memory', () => {
    saveEditorState(p(), undefined, 1);
    localStorage.setItem(EDITOR_STORAGE_KEY, '{}');
    rememberEditorRequest({ parsed: p() }, 1);
    window.history.replaceState({ key: 'k', usr: { parsed: p(), originalCurl: 'c', redacted: true, savedAt: 1, keep: 1 } }, '');
    clearEditorRestore();
    expect(hasSavedEditorState()).toBe(false);
    expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    expect(recallLiveRequest(EDITOR_LIVE_SLOT, 1)).toBeNull();
    expect(window.history.state).toEqual({ key: 'k', usr: { keep: 1 } });
  });
  it('clearEditorRestore is harmless when history has nothing to strip', () => {
    window.history.replaceState({ usr: { other: 1 } }, '');
    clearEditorRestore();
    expect(window.history.state).toEqual({ usr: { other: 1 } });
    window.history.replaceState(null, '');
    expect(() => clearEditorRestore()).not.toThrow();
  });
  it('clearEditorState tolerates removeItem throwing', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => clearEditorState()).not.toThrow();
  });
});
