import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'sonner';
import { computeDiff } from '@/lib/utils/diffEngine';
import {
  BATCH_LIVE_SLOT, redactBatchSnapshot, resolveBatchRestore, rememberBatchRequest, redactBatchHistoryState,
} from '@/lib/utils/batchStorage';
import { forgetAllLiveRequests, recallLiveRequest } from '@/lib/utils/liveRequestStore';
import { isModalOpen, isInsideDialog, isTextEntryTarget, isBlockedByModal } from '@/lib/utils/shortcuts';
import { copyToClipboard, notifyCopied, notifyCopyFailed, notifyDownloaded, notifySaved, NOTIFY_COPIED, NOTIFY_COPY_FAILED, NOTIFY_SAVED } from '@/lib/utils/notify';
import { REDACTED_PLACEHOLDER as R } from '@/lib/utils/redaction';

describe('computeDiff', () => {
  it.each([
    ['equal primitives', 1, 1, []],
    ['equal objects by reference are skipped', { a: 1 }, { a: 1 }, []],
    ['modified primitive', 1, 2, [{ path: '', type: 'modified', oldValue: 1, newValue: 2 }]],
    ['type change', 1, '1', [{ path: '', type: 'modified', oldValue: 1, newValue: '1' }]],
    ['added at root', undefined, 5, [{ path: '', type: 'added', newValue: 5 }]],
    ['removed at root', 5, undefined, [{ path: '', type: 'removed', oldValue: 5 }]],
    ['null to value is modified', null, 5, [{ path: '', type: 'modified', oldValue: null, newValue: 5 }]],
    ['object to primitive is modified', { a: 1 }, 5, [{ path: '', type: 'modified', oldValue: { a: 1 }, newValue: 5 }]],
    ['NaN is modified (NaN !== NaN)', NaN, NaN, [{ path: '', type: 'modified', oldValue: NaN, newValue: NaN }]],
    ['both undefined', undefined, undefined, []],
  ])('%s', (_n, a, b, expected) => {
    expect(computeDiff(a, b)).toEqual(expected);
  });
  it('walks nested objects and arrays; added, removed and modified keys', () => {
    const d = computeDiff({ a: 1, b: { c: [1, 2], gone: true }, keep: 0 }, { a: 2, b: { c: [1, 3, 4], new: 1 }, keep: 0 });
    expect(d).toEqual(
      expect.arrayContaining([
        { path: 'a', type: 'modified', oldValue: 1, newValue: 2 },
        { path: 'b.c.1', type: 'modified', oldValue: 2, newValue: 3 },
        { path: 'b.c.2', type: 'added', newValue: 4 },
        { path: 'b.gone', type: 'removed', oldValue: true },
        { path: 'b.new', type: 'added', newValue: 1 },
      ]),
    );
    expect(d).toHaveLength(5);
  });
  it('escapes dots and backslashes in keys so the path can be reverted', () => {
    expect(computeDiff({ 'a.b': 1, 'x\\y': 1 }, { 'a.b': 2, 'x\\y': 2 }).map((e) => e.path)).toEqual(['a\\.b', 'x\\\\y']);
    expect(computeDiff({ p: { 'a.b': 1 } }, { p: { 'a.b': 2 } }, 'base')[0]!.path).toBe('base.p.a\\.b'.replace('base.p', 'base.p'));
  });
  it('a falsy value replacing a value is modified, not removed', () => {
    expect(computeDiff({ a: 1 }, { a: 0 })).toEqual([{ path: 'a', type: 'modified', oldValue: 1, newValue: 0 }]);
    expect(computeDiff({ a: 1 }, { a: null })).toEqual([{ path: 'a', type: 'modified', oldValue: 1, newValue: null }]);
    expect(computeDiff({ a: null }, { a: { b: 1 } })).toEqual([{ path: 'a', type: 'modified', oldValue: null, newValue: { b: 1 } }]);
  });
  it('called with basePath "data", JSON strings are compared by value, not by text', () => {
    expect(computeDiff('{"a":1,"b":2}', '{ "b": 2,\n "a": 1 }', 'data')).toEqual([]);
    expect(computeDiff('{"a":1}', '{"a":2}', 'data')).toEqual([{ path: 'data.a', type: 'modified', oldValue: 1, newValue: 2 }]);
    expect(computeDiff('plain', 'other', 'data')).toEqual([{ path: 'data', type: 'modified', oldValue: 'plain', newValue: 'other' }]);
    expect(computeDiff('{"a":1}', { a: 1 }, 'data')).toEqual([]);
    expect(computeDiff('{bad', '{bad', 'data')).toEqual([]);
  });
  // BUG FE-UNIT-01 (low): the only caller (DiffViewDialog) diffs the whole request, so `data` is reached
  // through the key loop, which compares two strings directly and never normalises. A whitespace-only
  // reformat of a JSON body therefore shows as a modified `data` field even though the comment says
  // the body is compared by value. Remove .fails once the loop recurses with basePath "data".
  it.fails('BUG FE-UNIT-01: a whitespace-only change to a JSON string body is not a diff', () => {
    expect(computeDiff({ data: '{"a":1,"b":2}' }, { data: '{ "b": 2,\n "a": 1 }' })).toEqual([]);
  });
  it('handles very large arrays and unicode keys', () => {
    const a = Array.from({ length: 20_000 }, (_, i) => i);
    const b = [...a];
    b[19_999] = -1;
    expect(computeDiff(a, b)).toEqual([{ path: '19999', type: 'modified', oldValue: 19_999, newValue: -1 }]);
    expect(computeDiff({ 名: 1 }, { 名: 2 })[0]!.path).toBe('名');
  });
});

const entry = (curl: string, extra: Record<string, unknown> = {}) => ({ id: 'e', originalCurl: curl, parsed: { method: 'GET', base_url: 'https://a.test', endpoint: '/', headers: { Authorization: 'Bearer secret-token' } }, ...extra }) as never;

describe('batchStorage', () => {
  beforeEach(() => {
    forgetAllLiveRequests();
    window.history.replaceState(null, '');
  });
  it('redactBatchSnapshot scrubs parsed, originalCurl, failure curl and message; non-strings pass through', () => {
    const out = redactBatchSnapshot({
      items: [entry("curl -H 'Authorization: Bearer secret-token' x"), entry(undefined as never)],
      failures: [{ index: 3, curl: "curl -u bob:secretpw x", message: 'bad token "abcdefgh"' } as never, { index: 4, curl: undefined, message: undefined } as never],
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('secretpw');
    expect(out.items[0]!.parsed.headers!.Authorization).toBe(`Bearer ${R}`);
    expect(out.items[1]!.originalCurl).toBeUndefined();
    expect(out.failures[1]).toEqual({ index: 4, curl: undefined, message: undefined });
  });
  it.each([
    ['null', null], ['string', 'x'], ['empty object', {}], ['junk lists', { items: 'x', failures: 5 }], ['junk entries', { items: [null, 1, {}], failures: [null, {}, { index: 'a' }] }],
  ])('resolveBatchRestore(%s) -> none', (_n, state) => {
    expect(resolveBatchRestore(state)).toEqual({ source: 'none', items: [], failures: [] });
  });
  it('a fresh payload is live and filtered to valid entries/failures', () => {
    const good = entry('curl x');
    const r = resolveBatchRestore({ items: [good, null, { parsed: 'x' }], failures: [{ index: 0, curl: 'c', message: 'm' }, { index: 'x' }] });
    expect(r.source).toBe('live');
    expect(r.items).toEqual([good]);
    expect(r.failures).toHaveLength(1);
  });
  it('failures alone are enough to restore', () => {
    expect(resolveBatchRestore({ failures: [{ index: 1, curl: 'c', message: 'm' }] }).source).toBe('live');
  });
  it('a redacted copy is upgraded to the live batch when it matches; otherwise it stays redacted', () => {
    const live = { items: [entry("curl -H 'Authorization: Bearer secret-token' x")], failures: [] };
    rememberBatchRequest(live, 10);
    const redacted = redactBatchSnapshot(live);
    const up = resolveBatchRestore({ ...redacted, redacted: true }, 20);
    expect(up.source).toBe('live');
    expect(up.items[0]).toBe(live.items[0]);
    rememberBatchRequest({ items: [entry('curl other')], failures: [] }, 10);
    const stay = resolveBatchRestore({ ...redacted, redacted: true }, 20);
    expect(stay.source).toBe('redacted');
    expect(JSON.stringify(stay)).not.toContain('secret-token');
    forgetAllLiveRequests();
    expect(resolveBatchRestore({ ...redacted, redacted: true }, 20).source).toBe('redacted');
    expect(recallLiveRequest(BATCH_LIVE_SLOT, 0)).toBeNull();
  });
  it('redactBatchHistoryState rewrites history.state in place and keeps router keys', () => {
    window.history.replaceState({ key: 'k', usr: { items: [entry("curl -H 'Authorization: Bearer secret-token' x")], failures: [], extra: 1 } }, '');
    redactBatchHistoryState(55);
    const h = window.history.state;
    expect(h.key).toBe('k');
    expect(h.usr).toMatchObject({ redacted: true, savedAt: 55, extra: 1 });
    expect(JSON.stringify(h)).not.toContain('secret-token');
  });
  it.each([['no state', null], ['no usr', { key: 'k' }], ['usr is a string', { usr: 'x' }], ['usr without lists', { usr: { other: 1 } }]])('redactBatchHistoryState ignores %s', (_n, state) => {
    window.history.replaceState(state, '');
    redactBatchHistoryState(1);
    expect(window.history.state).toEqual(state);
  });
  it('failures-only usr is redacted too; replaceState throwing is swallowed', () => {
    window.history.replaceState({ usr: { failures: [{ index: 0, curl: "curl -u a:longsecret x", message: 'm' }] } }, '');
    redactBatchHistoryState(1);
    expect(JSON.stringify(window.history.state)).not.toContain('longsecret');
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => redactBatchHistoryState(1)).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('shortcuts guards', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  it('isModalOpen detects open dialogs, alert dialogs and aria-modal, ignoring closed ones', () => {
    expect(isModalOpen()).toBe(false);
    document.body.innerHTML = '<div role="dialog" data-state="closed"></div>';
    expect(isModalOpen()).toBe(false);
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    expect(isModalOpen()).toBe(true);
    document.body.innerHTML = '<div role="alertdialog" data-state="open"></div>';
    expect(isModalOpen()).toBe(true);
    document.body.innerHTML = '<div aria-modal="true"></div>';
    expect(isModalOpen()).toBe(true);
    const other = document.implementation.createHTMLDocument('x');
    expect(isModalOpen(other)).toBe(false);
  });
  it('isInsideDialog needs an element inside a dialog (open or closing)', () => {
    document.body.innerHTML = '<div role="dialog" data-state="closed"><button id="in"></button></div><button id="out"></button>';
    expect(isInsideDialog(document.getElementById('in'))).toBe(true);
    expect(isInsideDialog(document.getElementById('out'))).toBe(false);
    expect(isInsideDialog(null)).toBe(false);
    expect(isInsideDialog(window)).toBe(false);
  });
  it.each([
    ['text input', '<input type="text">', true], ['no type input', '<input>', true], ['email', '<input type="email">', true], ['textarea', '<textarea></textarea>', true],
    ['select', '<select></select>', true], ['checkbox', '<input type="checkbox">', false], ['radio', '<input type="radio">', false], ['button input', '<input type="button">', false],
    ['submit', '<input type="submit">', false], ['file', '<input type="file">', false], ['range', '<input type="range">', false], ['color', '<input type="color">', false],
    ['plain button', '<button></button>', false], ['div', '<div></div>', false],
  ])('isTextEntryTarget: %s', (_n, html, expected) => {
    document.body.innerHTML = html;
    expect(isTextEntryTarget(document.body.firstElementChild)).toBe(expected);
  });
  it('isTextEntryTarget: contenteditable (own or inherited) and non-elements', () => {
    document.body.innerHTML = '<div contenteditable="true"><span id="c"></span></div><div contenteditable="" id="e"></div><div contenteditable="false"><b id="f"></b></div>';
    const editable = document.querySelector('[contenteditable="true"]') as HTMLElement;
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTextEntryTarget(editable)).toBe(true);
    expect(isTextEntryTarget(document.getElementById('c'))).toBe(true); // jsdom lacks isContentEditable: closest() path
    expect(isTextEntryTarget(document.getElementById('e'))).toBe(true);
    expect(isTextEntryTarget(document.getElementById('f'))).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(window)).toBe(false);
  });
  it('isBlockedByModal: modal open, event inside a dialog, or neither', () => {
    const ev = (target: EventTarget | null) => ({ target }) as unknown as KeyboardEvent;
    expect(isBlockedByModal(ev(document.body))).toBe(false);
    document.body.innerHTML = '<div role="dialog" data-state="closed"><i id="i"></i></div>';
    expect(isBlockedByModal(ev(document.getElementById('i')))).toBe(true);
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    expect(isBlockedByModal(ev(document.body))).toBe(true);
  });
});

describe('notify', () => {
  afterEach(() => vi.restoreAllMocks());
  it('toast wording is stable', () => {
    const ok = vi.spyOn(toast, 'success').mockReturnValue(1);
    const err = vi.spyOn(toast, 'error').mockReturnValue(1);
    notifyCopied();
    notifyCopied('Code');
    notifyDownloaded('a.java');
    notifySaved();
    notifyCopyFailed();
    expect(ok.mock.calls.map((c) => c[0])).toEqual([NOTIFY_COPIED, 'Code copied to clipboard', 'Downloaded a.java', NOTIFY_SAVED]);
    expect(err).toHaveBeenCalledWith(NOTIFY_COPY_FAILED);
  });
  it('copyToClipboard writes the text and reports success, or reports failure', async () => {
    const ok = vi.spyOn(toast, 'success').mockReturnValue(1);
    const err = vi.spyOn(toast, 'error').mockReturnValue(1);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyToClipboard('hello', 'Snippet')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(ok).toHaveBeenCalledWith('Snippet copied to clipboard');
    writeText.mockRejectedValueOnce(new Error('denied'));
    await expect(copyToClipboard('x')).resolves.toBe(false);
    expect(err).toHaveBeenCalledWith(NOTIFY_COPY_FAILED);
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await expect(copyToClipboard('x')).resolves.toBe(false);
  });
});
