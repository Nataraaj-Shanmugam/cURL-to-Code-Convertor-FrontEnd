import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSectionManager, findExistingKey, getParsedField, VALID_SECTIONS, SYNTHETIC_SECTIONS,
} from '@/lib/hooks/useSectionManager';
import type { ParsedCurl } from '@/types/curl';

const pc = (o: Record<string, unknown>) => o as unknown as ParsedCurl;
const hasActive = (v: unknown) => !!v && typeof v === 'object' && Object.values(v as object).some((x) => x === true);
const hasValid = (v: unknown) => (Array.isArray(v) ? v.length > 0 : !!v && typeof v === 'object' ? Object.keys(v).length > 0 : !!v);
const setup = (parsed: ParsedCurl) => {
  const setParsed = vi.fn();
  const hook = renderHook(({ p }) => useSectionManager(p, setParsed, hasActive, hasValid), { initialProps: { p: parsed } });
  return { ...hook, setParsed };
};

describe('findExistingKey', () => {
  it.each([
    ['headers', { 'Content-Type': 'x' }, 'content-type', 'Content-Type'],
    ['headers', { 'content-type': 'x' }, 'CONTENT-TYPE', 'content-type'],
    ['headers', {}, 'x', undefined],
    ['cookies', { A: '1' }, 'a', undefined],
    ['cookies', { A: '1' }, 'A', 'A'],
    ['query_params', null, 'A', undefined],
    ['query_params', [1], '0', undefined],
    ['query_params', 'str', 'A', undefined],
  ])('%s %j %s -> %s', (section, record, key, expected) => {
    expect(findExistingKey(section, record, key)).toBe(expected);
  });
  it('getParsedField reads any key; constants cover every editable section', () => {
    expect(getParsedField(pc({ a: 1 }), 'a')).toBe(1);
    expect(getParsedField(pc({}), 'x')).toBeUndefined();
    expect(Object.keys(VALID_SECTIONS)).toContain('headers');
    expect(SYNTHETIC_SECTIONS).toEqual(['request', 'context']);
  });
});

describe('useSectionManager: open sections', () => {
  it.each([
    ['empty request', {}, []],
    ['only fixed fields', { method: 'GET', url: 'u' }, ['request']],
    ['empty-string fixed fields do not count', { method: '', url: null }, []],
    ['headers with data', { headers: { A: '1' } }, ['headers']],
    ['empty headers', { headers: {} }, []],
    ['skip keys never become sections', { meta: { a: 1 }, raw_data: 'x', all_options: { a: 1 } }, []],
    ['blank string ignored', { auth: '   ' }, []],
    ['null/undefined ignored', { cookies: null, headers: undefined }, []],
    ['path_parameters needs a non-empty list', { path_parameters: [{ name: 'a' }] }, ['path_parameters']],
    ['empty path_parameters', { path_parameters: [] }, []],
    ['path_parameters non-array', { path_parameters: { a: 1 } }, []],
    ['flags need an active flag', { flags: { k: true } }, ['flags']],
    ['inactive flags', { flags: { k: false } }, []],
    ['misc_flags active', { misc_flags: { v: true } }, ['misc_flags']],
    ['ssl_config with data', { ssl_config: { insecure: true } }, ['ssl_config']],
    ['ssl_config empty', { ssl_config: {} }, []],
    ['data object', { data: { a: 1 } }, ['data']],
    ['data empty object', { data: {} }, []],
    ['data array', { data: [1] }, ['data']],
    ['data empty array', { data: [] }, []],
    ['data string', { data: 'x' }, ['data']],
    ['data zero is not a body here', { data: 0 }, []],
    ['context fields', { user_agent: 'ua' }, ['context']],
    ['request + section + context order', { method: 'GET', headers: { A: '1' }, referer: 'r' }, ['request', 'headers', 'context']],
    ['proxy alone is context', { proxy: 'http://p' }, ['context']],
  ])('computeOpenSections: %s', (_n, parsed, expected) => {
    const { result } = setup(pc(parsed));
    expect(result.current.computeOpenSections(pc(parsed))).toEqual(expected);
  });
  it('getMissingSections lists sections that are absent or empty', () => {
    const { result } = setup(pc({ headers: { A: '1' }, cookies: {}, query_params: [], ssl_config: { insecure: true }, flags: { k: true }, auth: 'x', form_data: 0 }));
    const missing = result.current.getMissingSections().map(([k]) => k);
    expect(missing).not.toContain('headers');
    expect(missing).not.toContain('ssl_config');
    expect(missing).not.toContain('flags');
    expect(missing).not.toContain('auth');
    expect(missing).toEqual(expect.arrayContaining(['cookies', 'query_params', 'form_data', 'auth_config', 'proxy_config']));
  });
  it('getMissingSections treats inactive flags / ssl without a true value as missing', () => {
    const { result } = setup(pc({ flags: { k: false }, ssl_config: { a: 'x' } }));
    const missing = result.current.getMissingSections().map(([k]) => k);
    expect(missing).toEqual(expect.arrayContaining(['flags', 'ssl_config']));
    const labels = Object.fromEntries(result.current.getMissingSections());
    expect(labels.flags).toBe('Flags');
  });
  it('deleteSection removes the key and closes the section; the input object is untouched', () => {
    const parsed = pc({ headers: { A: '1' }, cookies: { c: '1' } });
    const { result, setParsed } = setup(parsed);
    act(() => result.current.setOpenSections(['headers', 'cookies']));
    act(() => result.current.deleteSection('headers'));
    expect(setParsed).toHaveBeenCalledWith({ cookies: { c: '1' } });
    expect(result.current.openSections).toEqual(['cookies']);
    expect((parsed as unknown as Record<string, unknown>).headers).toBeDefined();
  });
});

describe('useSectionManager: add entry', () => {
  const open = (r: ReturnType<typeof setup>, section: string, key: string, value = 'v') => {
    act(() => r.result.current.handleAddEntry(section));
    act(() => r.result.current.setNewKey(key));
    act(() => r.result.current.setNewValue(value));
  };
  it('handleAddEntry opens the dialog with cleared fields, but not for synthetic sections', () => {
    const r = setup(pc({}));
    act(() => r.result.current.handleAddEntry('request'));
    expect(r.result.current.showAddDialog).toBe(false);
    act(() => r.result.current.handleAddEntry('context'));
    expect(r.result.current.showAddDialog).toBe(false);
    act(() => r.result.current.handleAddEntry('headers'));
    expect(r.result.current).toMatchObject({ showAddDialog: true, addDialogSection: 'headers', newKey: '', newValue: '' });
  });
  it('adds a header, trims the key, opens the section and resets the dialog', () => {
    const r = setup(pc({ headers: { A: '1' } }));
    open(r, 'headers', '  B  ', 'two');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).toHaveBeenCalledWith({ headers: { A: '1', B: 'two' } });
    expect(r.result.current).toMatchObject({ showAddDialog: false, newKey: '', newValue: '', openSections: ['headers'] });
  });
  it('creates a missing section and keeps an already-open section listed once', () => {
    const r = setup(pc({}));
    act(() => r.result.current.setOpenSections(['cookies']));
    open(r, 'cookies', 'c');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).toHaveBeenCalledWith({ cookies: { c: 'v' } });
    expect(r.result.current.openSections).toEqual(['cookies']);
  });
  it('flag sections store true and ignore the value', () => {
    const r = setup(pc({}));
    open(r, 'flags', 'compressed', 'ignored');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).toHaveBeenCalledWith({ flags: { compressed: true } });
    const s = setup(pc({ ssl_config: { a: true } }));
    open(s, 'ssl_config', 'insecure');
    act(() => s.result.current.saveNewEntry());
    expect(s.setParsed).toHaveBeenCalledWith({ ssl_config: { a: true, insecure: true } });
  });
  it('array sections get { name, value } items', () => {
    const r = setup(pc({ path_parameters: [{ name: 'a', value: '1' }] }));
    open(r, 'path_parameters', 'id', '7');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).toHaveBeenCalledWith({ path_parameters: [{ name: 'a', value: '1' }, { name: 'id', value: '7' }] });
  });
  it('a duplicate key asks first; overwrite replaces it (headers: any case, renaming to the new spelling)', () => {
    const r = setup(pc({ headers: { 'Content-Type': 'old' } }));
    open(r, 'headers', 'content-type', 'new');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).not.toHaveBeenCalled();
    expect(r.result.current.duplicateKey).toBe('Content-Type');
    expect(r.result.current.showAddDialog).toBe(true);
    act(() => r.result.current.saveNewEntry({ overwrite: true }));
    expect(r.setParsed).toHaveBeenCalledWith({ headers: { 'content-type': 'new' } });
  });
  it('overwrite with the identical key keeps a single entry', () => {
    const r = setup(pc({ cookies: { a: 'old' } }));
    open(r, 'cookies', 'a', 'new');
    act(() => r.result.current.saveNewEntry({ overwrite: true }));
    expect(r.setParsed).toHaveBeenCalledWith({ cookies: { a: 'new' } });
  });
  it('editing the key clears the duplicate prompt and any error', () => {
    const r = setup(pc({ cookies: { a: 'old' } }));
    open(r, 'cookies', 'a');
    act(() => r.result.current.saveNewEntry());
    expect(r.result.current.duplicateKey).toBe('a');
    act(() => r.result.current.setNewKey('b'));
    expect(r.result.current.duplicateKey).toBeNull();
    expect(r.result.current.addEntryError).toBeNull();
  });
  it.each([['__proto__'], ['prototype'], ['constructor']])('rejects the forbidden key %s with a message and writes nothing', (key) => {
    const r = setup(pc({}));
    open(r, 'headers', key);
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).not.toHaveBeenCalled();
    expect(r.result.current.addEntryError).toBe(`"${key}" can't be used as a key.`);
  });
  it.each([[''], ['   ']])('a blank key %j is ignored silently', (key) => {
    const r = setup(pc({}));
    open(r, 'headers', key);
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).not.toHaveBeenCalled();
    expect(r.result.current.showAddDialog).toBe(true);
  });
  it('refuses a forbidden section name even if the dialog was forced open', () => {
    const r = setup(pc({}));
    open(r, '__proto__', 'k');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).not.toHaveBeenCalled();
  });
  it('a section holding a single value is not turned into an object', () => {
    const r = setup(pc({ auth: 'abc' }));
    open(r, 'auth', 'k');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).not.toHaveBeenCalled();
    expect(r.result.current.addEntryError).toBe('This section holds a single value; edit it instead.');
  });
  it('does not mutate the caller\'s parsed object', () => {
    const parsed = pc({ headers: { A: '1' } });
    const r = setup(parsed);
    open(r, 'headers', 'B');
    act(() => r.result.current.saveNewEntry());
    expect((parsed as unknown as { headers: object }).headers).toEqual({ A: '1' });
  });
  it('unicode keys and values are stored verbatim', () => {
    const r = setup(pc({}));
    open(r, 'headers', 'X-名', '値🔑');
    act(() => r.result.current.saveNewEntry());
    expect(r.setParsed).toHaveBeenCalledWith({ headers: { 'X-名': '値🔑' } });
  });
});

describe('useSectionManager: new section', () => {
  it('handleAddSection opens the dialog with an empty name', () => {
    const r = setup(pc({}));
    act(() => r.result.current.setNewSectionName('old'));
    act(() => r.result.current.handleAddSection());
    expect(r.result.current).toMatchObject({ showNewSectionDialog: true, newSectionName: '' });
  });
  it.each([
    ['flags', {}], ['ssl_config', {}], ['path_parameters', []], ['auth', ''], ['custom_section', {}],
  ])('saveNewSection(%s) creates the right empty container', (name, empty) => {
    const r = setup(pc({ headers: { A: '1' } }));
    act(() => r.result.current.setNewSectionName(name));
    act(() => r.result.current.saveNewSection());
    expect(r.setParsed).toHaveBeenCalledWith({ headers: { A: '1' }, [name]: empty });
    expect(r.result.current).toMatchObject({ showNewSectionDialog: false, newSectionName: '', openSections: [name] });
  });
  it('a blank name does nothing; an already-open section is not listed twice', () => {
    const r = setup(pc({}));
    act(() => r.result.current.setNewSectionName('   '));
    act(() => r.result.current.saveNewSection());
    expect(r.setParsed).not.toHaveBeenCalled();
    act(() => r.result.current.setOpenSections(['x']));
    act(() => r.result.current.setNewSectionName('x'));
    act(() => r.result.current.saveNewSection());
    expect(r.result.current.openSections).toEqual(['x']);
  });
  // BUG FE-UNIT-02 (low): unlike "Add entry", "Add section" does not reject `__proto__`/`prototype`/
  // `constructor`. `record['__proto__'] = {}` silently swaps the request's prototype instead of creating
  // a section, yet the dialog closes and the name is listed as an open section that has no data.
  it('FE-UNIT-02: a section named __proto__ is rejected like a key named __proto__ is', () => {
    const r = setup(pc({}));
    act(() => r.result.current.setNewSectionName('__proto__'));
    act(() => r.result.current.saveNewSection());
    expect(r.setParsed).not.toHaveBeenCalled();
  });
});
