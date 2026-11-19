import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useParsedCurlEditor } from '@/lib/hooks/useParsedCurlEditor';
import { computeDiff } from '@/lib/utils/diffEngine';
import { encodePath } from '@/lib/utils/fieldPath';
import type { ParsedCurl } from '@/types/curl';

const request = (): ParsedCurl => ({
  method: 'POST',
  url: 'https://api.example.com/users?page=1&filter.name=bob',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  query_params: { page: '1', 'filter.name': 'bob' },
  headers: { Accept: 'application/json', 'X-Api.Version': '2' },
  data: {
    tags: ['a', 'b', 'c'],
    items: [{ sku: 'X1' }],
    'a.b': 'dotted',
    name: 'John',
    address: { zip: '10001' },
    count: 3,
    active: true,
  },
});

const setup = (data: ParsedCurl = request()) => renderHook(() => useParsedCurlEditor(data));
type Hook = ReturnType<typeof setup>['result'];

/** Open the editor on `path`, type `value`, save. */
async function edit(result: Hook, path: string[], value: unknown) {
  await act(async () => { await result.current.toggleEdit(path, 'ignored'); });
  act(() => result.current.handleEditChange(path, value));
  await act(async () => { await result.current.toggleEdit(path, 'ignored'); });
}

const body = (result: Hook) => result.current.parsed.data as Record<string, unknown>;

describe('editor paths (QF-2, QR-22, QF-3, QS-3)', () => {
  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it('edits array items and fields inside arrays in place, without stray keys', async () => {
    const { result } = setup();
    await edit(result, ['data', 'tags', '0'], 'ZZZ');
    await edit(result, ['data', 'items', '0', 'sku'], 'S9');
    expect(body(result).tags).toEqual(['ZZZ', 'b', 'c']);
    expect(body(result).items).toEqual([{ sku: 'S9' }]);
    expect(Object.keys(body(result)).filter(k => k.includes('['))).toEqual([]);
  });

  it('deletes an array item by splicing it out', () => {
    const { result } = setup();
    act(() => result.current.deleteSingle(['data', 'tags', '1']));
    expect(body(result).tags).toEqual(['a', 'c']);
  });

  it('bulk-deletes several items of one array correctly', () => {
    const { result } = setup({ ...request(), path_parameters: ['p0', 'p1', 'p2', 'p3'] });
    act(() => result.current.toggleSelect(['path_parameters', '1']));
    act(() => result.current.toggleSelect(['path_parameters', '2']));
    act(() => result.current.deleteSelected());
    expect(result.current.parsed.path_parameters).toEqual(['p0', 'p3']);
  });

  it('edits and deletes keys that contain a dot (query param, header, body)', async () => {
    const { result } = setup();
    await edit(result, ['query_params', 'filter.name'], 'alice');
    expect(result.current.parsed.query_params?.['filter.name']).toBe('alice');
    await edit(result, ['headers', 'X-Api.Version'], '3');
    expect(result.current.parsed.headers?.['X-Api.Version']).toBe('3');
    act(() => result.current.deleteSingle(['data', 'a.b']));
    expect(body(result)).not.toHaveProperty('a.b');
    // The escaped string form addresses the same field.
    act(() => result.current.deleteSingle('query_params.filter\\.name'));
    expect(result.current.parsed.query_params).not.toHaveProperty('filter.name');
  });

  it('a no-op edit or an edit to a missing path records no undo step', async () => {
    const { result } = setup();
    await act(async () => { await result.current.toggleEdit(['data', 'name'], 'John'); });
    await act(async () => { await result.current.toggleEdit(['data', 'name'], 'John'); });
    act(() => result.current.deleteSingle(['data', 'nope', 'deeper']));
    expect(result.current.canUndo).toBe(false);
  });

  it('reverts array items and dotted keys from the diff paths', async () => {
    const { result } = setup();
    await edit(result, ['data', 'tags', '0'], 'ZZZ');
    await edit(result, ['query_params', 'filter.name'], 'alice');
    const paths = computeDiff(result.current.originalParsed, result.current.parsed).map(e => e.path);
    expect(paths).toEqual(expect.arrayContaining(['data.tags.0', encodePath(['query_params', 'filter.name'])]));
    paths.forEach(p => act(() => result.current.revertField(p)));
    expect(result.current.isDirty).toBe(false);
  });

  it('revert restores a deleted nested object and removes an added key', async () => {
    const { result } = setup();
    act(() => result.current.deleteSingle(['data', 'items']));
    act(() => result.current.revertField('data.items'));
    expect(body(result).items).toEqual([{ sku: 'X1' }]);
    act(() => result.current.handleAddEntry('headers'));
    act(() => result.current.setNewKey('X-New'));
    act(() => result.current.setNewValue('1'));
    act(() => result.current.saveNewEntry());
    act(() => result.current.revertField('headers.X-New'));
    expect(result.current.parsed.headers).not.toHaveProperty('X-New');
    expect(result.current.isDirty).toBe(false);
  });

  it('never writes to Object.prototype through a __proto__ body key (QS-3)', async () => {
    const data = JSON.parse(
      '{"method":"POST","url":"https://a.test/x","base_url":"https://a.test","endpoint":"/x","data":{"__proto__":{"polluted":"x"},"ok":1}}',
    ) as ParsedCurl;
    const { result } = setup(data);
    act(() => result.current.deleteSingle('data.__proto__'));
    act(() => result.current.revertField('data.__proto__.polluted'));
    await edit(result, ['data', '__proto__', 'polluted'], 'EDIT-MARKER');
    act(() => result.current.toggleSelect('data.__proto__.polluted'));
    act(() => result.current.deleteSelected());
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result.current.canUndo).toBe(false);
  });
});

describe('edits keep the field type (QF-4)', () => {
  it('a string field stays a string, whatever is typed', async () => {
    const { result } = setup();
    await edit(result, ['data', 'address', 'zip'], '12345678901234567890');
    await edit(result, ['data', 'name'], '123');
    expect((body(result).address as Record<string, unknown>).zip).toBe('12345678901234567890');
    expect(body(result).name).toBe('123');
    await edit(result, ['data', 'name'], 'true');
    expect(body(result).name).toBe('true');
    await edit(result, ['data', 'name'], 'null');
    expect(body(result).name).toBe('null');
    await edit(result, ['query_params', 'page'], '2');
    expect(result.current.parsed.query_params?.page).toBe('2');
  });

  it('a number or boolean field is parsed back from the text', async () => {
    const { result } = setup();
    await edit(result, ['data', 'count'], '7');
    await edit(result, ['data', 'active'], 'false');
    expect(body(result).count).toBe(7);
    expect(body(result).active).toBe(false);
  });

  it('a string body edited as text stays a string', async () => {
    const { result } = setup({ ...request(), data: 'a=1&b=2' });
    await edit(result, ['data'], '123');
    expect(result.current.parsed.data).toBe('123');
  });
});

describe('Add Entry (QF-13, QF-23)', () => {
  const add = (result: Hook, section: string, key: string, value: string) => {
    act(() => result.current.handleAddEntry(section));
    act(() => result.current.setNewKey(key));
    act(() => result.current.setNewValue(value));
    act(() => result.current.saveNewEntry());
  };

  it('is not available for the synthetic Request Details / Client Context groups', () => {
    const { result } = setup();
    act(() => result.current.handleAddEntry('request'));
    expect(result.current.showAddDialog).toBe(false);
    act(() => result.current.handleAddEntry('context'));
    expect(result.current.showAddDialog).toBe(false);
    expect(result.current.parsed).not.toHaveProperty('request');
    expect(result.current.parsed).not.toHaveProperty('context');
  });

  it('asks before replacing an existing key, and replaces only on confirmation', () => {
    const { result } = setup();
    add(result, 'query_params', 'page', '9');
    expect(result.current.duplicateKey).toBe('page');
    expect(result.current.showAddDialog).toBe(true);
    expect(result.current.parsed.query_params?.page).toBe('1');
    act(() => result.current.saveNewEntry({ overwrite: true }));
    expect(result.current.parsed.query_params?.page).toBe('9');
    expect(result.current.showAddDialog).toBe(false);
  });

  it('matches header names case-insensitively and replaces rather than duplicates', () => {
    const { result } = setup();
    add(result, 'headers', 'accept', 'text/plain');
    expect(result.current.duplicateKey).toBe('Accept');
    act(() => result.current.saveNewEntry({ overwrite: true }));
    const names = Object.keys(result.current.parsed.headers ?? {}).filter(k => k.toLowerCase() === 'accept');
    expect(names).toEqual(['accept']);
    expect(result.current.parsed.headers?.accept).toBe('text/plain');
  });

  it('typing a different key clears the duplicate warning', () => {
    const { result } = setup();
    add(result, 'headers', 'Accept', 'x');
    expect(result.current.duplicateKey).toBe('Accept');
    act(() => result.current.setNewKey('X-Other'));
    expect(result.current.duplicateKey).toBeNull();
  });

  it('rejects __proto__ / constructor / prototype as keys', () => {
    const { result } = setup();
    add(result, 'headers', '__proto__', 'x');
    expect(result.current.addEntryError).toMatch(/can't be used/);
    expect(result.current.canUndo).toBe(false);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});
