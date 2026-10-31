import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  EDITOR_STATE_TTL_MS,
  EDITOR_STATE_VERSION,
  EDITOR_STORAGE_KEY,
  clearEditorRestore,
  clearEditorState,
  hasSavedEditorState,
  rememberEditorRequest,
  resolveEditorRestore,
  touchEditorRestore,
  loadEditorState,
  redactHistoryState,
  migrateLegacyEditorState,
  saveEditorState,
} from '@/lib/utils/editorStorage';
import { REDACTED_PLACEHOLDER as R } from '@/lib/utils/redaction';
import { forgetAllLiveRequests, recallLiveRequest } from '@/lib/utils/liveRequestStore';
import type { ParsedCurl } from '@/types/curl';

const TOKEN = 'sk_live_VERY_SECRET_TOKEN_1234';
const parsed: ParsedCurl = {
  method: 'GET',
  base_url: 'https://api.example.com',
  endpoint: '/me',
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  cookies: { sid: 'cookie-secret-value' },
  query_params: { api_key: 'qk-123456', page: '1' },
};
const curl = `curl https://api.example.com/me -H 'Authorization: Bearer ${TOKEN}' -b 'sid=cookie-secret-value'`;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('editorStorage', () => {
  it('saves to sessionStorage with secrets redacted and nothing in localStorage', () => {
    expect(saveEditorState(parsed, curl)).toBe(true);
    const raw = sessionStorage.getItem(EDITOR_STORAGE_KEY)!;
    for (const secret of [TOKEN, 'cookie-secret-value', 'qk-123456']) expect(raw).not.toContain(secret);
    expect(raw).toContain(R);
    expect(localStorage.length).toBe(0);
    expect(hasSavedEditorState()).toBe(true);
  });

  it('round-trips the non-secret parts', () => {
    saveEditorState(parsed, curl);
    const loaded = loadEditorState()!;
    expect(loaded.parsed.headers).toEqual({ Authorization: `Bearer ${R}`, Accept: 'application/json' });
    expect(loaded.parsed.query_params).toEqual({ api_key: R, page: '1' });
    expect(loaded.parsed.base_url).toBe('https://api.example.com');
    expect(loaded.originalCurl).toContain(`'Authorization: Bearer ${R}'`);
  });

  it('redacts again on load, in case an unredacted entry got into storage', () => {
    sessionStorage.setItem(
      EDITOR_STORAGE_KEY,
      JSON.stringify({ version: EDITOR_STATE_VERSION, savedAt: Date.now(), parsed, originalCurl: curl }),
    );
    expect(JSON.stringify(loadEditorState())).not.toContain(TOKEN);
  });

  it('expires entries after the TTL', () => {
    saveEditorState(parsed, curl, 1_000);
    expect(loadEditorState(1_000 + EDITOR_STATE_TTL_MS - 1)).not.toBeNull();
    expect(loadEditorState(1_000 + EDITOR_STATE_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
  });

  it('rejects unreadable, wrong-version and wrong-shape entries', () => {
    sessionStorage.setItem(EDITOR_STORAGE_KEY, '{nope');
    expect(loadEditorState()).toBeNull();
    sessionStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), parsed }));
    expect(loadEditorState()).toBeNull();
    sessionStorage.setItem(
      EDITOR_STORAGE_KEY,
      JSON.stringify({ version: EDITOR_STATE_VERSION, savedAt: Date.now(), parsed: 'x' }),
    );
    expect(loadEditorState()).toBeNull();
  });

  it('clearEditorState removes the session entry and any legacy entry', () => {
    saveEditorState(parsed, curl);
    localStorage.setItem(EDITOR_STORAGE_KEY, '{}');
    clearEditorState();
    expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    expect(hasSavedEditorState()).toBe(false);
  });

  describe('legacy localStorage entry', () => {
    it('is deleted and carried into sessionStorage, redacted', () => {
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ parsed, originalCurl: curl }));
      migrateLegacyEditorState();
      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
      const raw = sessionStorage.getItem(EDITOR_STORAGE_KEY)!;
      expect(raw).not.toContain(TOKEN);
      expect(loadEditorState()!.parsed.headers!.Accept).toBe('application/json');
    });

    it('does not overwrite a newer session entry', () => {
      saveEditorState({ ...parsed, endpoint: '/newer' }, curl);
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ parsed, originalCurl: curl }));
      migrateLegacyEditorState();
      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
      expect(loadEditorState()!.parsed.endpoint).toBe('/newer');
    });

    it('is deleted even when unreadable', () => {
      localStorage.setItem(EDITOR_STORAGE_KEY, 'garbage');
      migrateLegacyEditorState();
      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
      expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    });

    it('runs on load, so a reload after deploy never reads the raw entry', () => {
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ parsed, originalCurl: curl }));
      expect(JSON.stringify(loadEditorState())).not.toContain(TOKEN);
      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    });
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveEditorState(parsed, curl)).toBe(false);
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadEditorState()).toBeNull();
    expect(hasSavedEditorState()).toBe(false);
  });
});

describe('redactHistoryState', () => {
  afterEach(() => window.history.replaceState(null, ''));

  it('replaces router state in history.state with the redacted payload, keeping the rest of the entry', () => {
    window.history.replaceState({ usr: { parsed, originalCurl: curl, other: 1 }, key: 'abc', idx: 3 }, '');
    redactHistoryState();
    const state = window.history.state as { usr: { parsed: ParsedCurl; originalCurl: string; other: number }; key: string; idx: number };
    expect(JSON.stringify(state)).not.toContain(TOKEN);
    expect(JSON.stringify(state)).not.toContain('cookie-secret-value');
    expect(state.usr.parsed.headers!.Accept).toBe('application/json');
    expect(state.usr.originalCurl).toContain(R);
    expect(state.usr.other).toBe(1);
    expect(state.key).toBe('abc');
    expect(state.idx).toBe(3);
  });

  it('ignores history entries that carry no request', () => {
    window.history.replaceState({ usr: null, key: 'k' }, '');
    redactHistoryState();
    expect(window.history.state).toEqual({ usr: null, key: 'k' });
    window.history.replaceState(null, '');
    expect(() => redactHistoryState()).not.toThrow();
  });
});

describe('resolveEditorRestore / clearEditorRestore / touchEditorRestore', () => {
  const T0 = 1_700_000_000_000;
  const historyUsr = () => (window.history.state as { usr: Record<string, unknown> } | null)?.usr;
  beforeEach(() => forgetAllLiveRequests());
  afterEach(() => window.history.replaceState(null, ''));

  it('uses a fresh navigation payload as is', () => {
    expect(resolveEditorRestore({ parsed, originalCurl: curl }, T0)).toEqual({
      source: 'live',
      snapshot: { parsed, originalCurl: curl },
    });
  });

  it('upgrades the redacted history copy to the live values kept in memory (in-app Back/Forward)', () => {
    window.history.replaceState({ usr: { parsed, originalCurl: curl }, key: 'k', idx: 1 }, '');
    rememberEditorRequest({ parsed, originalCurl: curl }, T0);
    redactHistoryState(T0);
    const usr = historyUsr()!;
    expect(JSON.stringify(usr)).not.toContain(TOKEN);
    expect(usr).toMatchObject({ redacted: true, savedAt: T0 });

    const restored = resolveEditorRestore(usr, T0 + 1000);
    expect(restored.source).toBe('live');
    expect(restored.snapshot!.parsed.headers!.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('falls back to the redacted copy when memory is gone (reload) or holds another request', () => {
    window.history.replaceState({ usr: { parsed, originalCurl: curl } }, '');
    redactHistoryState(T0);
    const usr = historyUsr()!;
    expect(resolveEditorRestore(usr, T0).source).toBe('redacted');

    rememberEditorRequest({ parsed: { ...parsed, endpoint: '/other' } }, T0);
    const restored = resolveEditorRestore(usr, T0);
    expect(restored.source).toBe('redacted');
    expect(restored.snapshot!.parsed.headers!.Authorization).toBe(`Bearer ${R}`);
  });

  it('upgrades the sessionStorage copy the same way', () => {
    saveEditorState(parsed, curl, T0);
    rememberEditorRequest({ parsed, originalCurl: curl }, T0);
    expect(resolveEditorRestore(null, T0).snapshot!.originalCurl).toBe(curl);
    forgetAllLiveRequests();
    expect(resolveEditorRestore(null, T0)).toMatchObject({ source: 'redacted' });
  });

  it('reports an expired history or storage copy, and drops the expired live copy', () => {
    window.history.replaceState({ usr: { parsed } }, '');
    rememberEditorRequest({ parsed }, T0);
    redactHistoryState(T0);
    const later = T0 + EDITOR_STATE_TTL_MS + 1;
    expect(resolveEditorRestore(historyUsr(), later)).toEqual({ source: 'expired', snapshot: null });
    expect(recallLiveRequest('editor', later)).toBeNull();

    saveEditorState(parsed, curl, T0);
    expect(resolveEditorRestore(null, later)).toEqual({ source: 'expired', snapshot: null });
    expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    expect(resolveEditorRestore(null, later)).toEqual({ source: 'none', snapshot: null });
  });

  it('counts the TTL from the last activity, not from parse time', () => {
    window.history.replaceState({ usr: { parsed, originalCurl: curl } }, '');
    saveEditorState(parsed, curl, T0);
    rememberEditorRequest({ parsed, originalCurl: curl }, T0);
    redactHistoryState(T0);
    const active = T0 + EDITOR_STATE_TTL_MS - 1000;
    touchEditorRestore(active);
    const later = T0 + EDITOR_STATE_TTL_MS + 60_000;
    expect(resolveEditorRestore(historyUsr(), later).source).toBe('live');
    expect(resolveEditorRestore(null, later).source).toBe('live');
    expect(loadEditorState(later)).not.toBeNull();
  });

  it('Clear forgets the request in storage, in history.state and in memory, keeping router bookkeeping', () => {
    window.history.replaceState({ usr: { parsed, originalCurl: curl, other: 1 }, key: 'k', idx: 2 }, '');
    saveEditorState(parsed, curl, T0);
    rememberEditorRequest({ parsed, originalCurl: curl }, T0);
    redactHistoryState(T0);

    clearEditorRestore();
    expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    expect(window.history.state).toEqual({ usr: { other: 1 }, key: 'k', idx: 2 });
    expect(recallLiveRequest('editor', T0)).toBeNull();
    expect(resolveEditorRestore(historyUsr(), T0)).toEqual({ source: 'none', snapshot: null });
  });
});
