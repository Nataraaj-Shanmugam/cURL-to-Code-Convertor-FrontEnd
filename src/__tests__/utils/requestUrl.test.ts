import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { normalizeParsedCurl, splitUrl, syncRequestUrl } from '@/lib/utils/requestUrl';
import { useParsedCurlEditor } from '@/lib/hooks/useParsedCurlEditor';
import type { ParsedCurl } from '@/types/curl';

const base: ParsedCurl = {
  method: 'GET',
  url: 'https://api.example.com/users?page=1',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  query_params: { page: '1' },
};

describe('normalizeParsedCurl (QR-10)', () => {
  it('derives base_url, endpoint and query_params from a sparse parse result', () => {
    const sparse = { method: 'get', url: 'https://api.example.com/users?page=1&tag=a&tag=b', headers: {}, cookies: {}, flags: { verbose: false }, data: '' } as unknown as ParsedCurl;
    const out = normalizeParsedCurl(sparse);
    expect(out).toMatchObject({
      method: 'GET',
      base_url: 'https://api.example.com',
      endpoint: '/users',
      query_params: { page: '1', tag: ['a', 'b'] },
    });
    // Unlike production, false / empty values and blocks survive.
    expect(out.flags).toEqual({ verbose: false });
    expect(out.headers).toEqual({});
    expect(out.data).toBe('');
  });

  it('keeps fields the backend did return, and every config section', () => {
    const full = {
      ...base,
      base_url: 'https://api.example.com/v1',
      endpoint: '/x',
      ssl_config: { insecure: false, cert: 'c.pem', ciphers: 'X' },
      transfer_config: { compressed: true },
      network_config: { timeout: 0 },
    } as ParsedCurl;
    expect(normalizeParsedCurl(full)).toEqual(full);
  });

  it('builds url from its parts when url is missing, and falls back to raw_data for the body', () => {
    const out = normalizeParsedCurl({ method: 'POST', base_url: 'https://a.test', endpoint: '/p', query_params: { q: '1' }, raw_data: 'x=1' } as ParsedCurl);
    expect(out.url).toBe('https://a.test/p?q=1');
    expect(out.data).toBe('x=1');
  });

  it('defaults a missing method to GET', () => {
    expect(normalizeParsedCurl({ url: 'https://a.test/' } as ParsedCurl).method).toBe('GET');
  });
});

describe('splitUrl', () => {
  it('keeps a base_url that carries a path prefix', () => {
    expect(splitUrl('https://api.example.com/v1/things?x=1', 'https://api.example.com/v1')).toEqual({
      base_url: 'https://api.example.com/v1',
      endpoint: '/things',
      query_params: { x: '1' },
    });
  });

  it('returns null for URLs it cannot parse', () => {
    expect(splitUrl('{{host}}/users')).toBeNull();
    expect(splitUrl('api.example.com/users')).toBeNull();
  });
});

describe('syncRequestUrl (QF-14)', () => {
  it('re-derives the parts when url is edited', () => {
    const next = syncRequestUrl(base, { ...base, url: 'https://other.example.org/v2/things?z=9' });
    expect(next).toMatchObject({ base_url: 'https://other.example.org', endpoint: '/v2/things', query_params: { z: '9' } });
  });

  it('rebuilds url when a query param, endpoint or base_url is edited', () => {
    expect(syncRequestUrl(base, { ...base, query_params: { page: '2', q: 'a b' } }).url).toBe(
      'https://api.example.com/users?page=2&q=a+b',
    );
    expect(syncRequestUrl(base, { ...base, query_params: undefined }).url).toBe('https://api.example.com/users');
    expect(syncRequestUrl(base, { ...base, endpoint: '/people' }).url).toBe('https://api.example.com/people?page=1');
  });

  it('upper-cases an edited method', () => {
    expect(syncRequestUrl(base, { ...base, method: 'patch' }).method).toBe('PATCH');
  });

  it('leaves the parts alone when the edited url cannot be parsed', () => {
    const next = syncRequestUrl(base, { ...base, url: '{{host}}/users' });
    expect(next).toMatchObject({ base_url: base.base_url, endpoint: base.endpoint });
  });
});

describe('editor keeps url and its parts in sync', () => {
  async function edit(result: { current: ReturnType<typeof useParsedCurlEditor> }, path: string[], value: string) {
    await act(async () => { await result.current.toggleEdit(path, ''); });
    act(() => result.current.handleEditChange(path, value));
    await act(async () => { await result.current.toggleEdit(path, ''); });
  }

  it('url -> parts and parts -> url, and undo restores both', async () => {
    const { result } = renderHook(() => useParsedCurlEditor(base));
    await edit(result, ['url'], 'https://other.example.org/v2/things?z=9');
    expect(result.current.parsed).toMatchObject({
      base_url: 'https://other.example.org',
      endpoint: '/v2/things',
      query_params: { z: '9' },
    });

    await edit(result, ['query_params', 'z'], '10');
    expect(result.current.parsed.url).toBe('https://other.example.org/v2/things?z=10');

    act(() => result.current.deleteSingle(['query_params', 'z']));
    expect(result.current.parsed.url).toBe('https://other.example.org/v2/things');

    act(() => result.current.undo());
    act(() => result.current.undo());
    act(() => result.current.undo());
    expect(result.current.parsed).toEqual(result.current.originalParsed);
  });

  it('a sparse parse result is complete in the editor and is not reported as an edit', () => {
    const { result } = renderHook(() =>
      useParsedCurlEditor({ method: 'GET', url: 'https://api.example.com/users?page=1' } as ParsedCurl),
    );
    expect(result.current.parsed).toMatchObject({ base_url: 'https://api.example.com', endpoint: '/users', query_params: { page: '1' } });
    expect(result.current.isDirty).toBe(false);
  });
});
