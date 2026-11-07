import { describe, it, expect } from 'vitest';
import {
  encodePath, decodePath, toSegments, toPathId, isSafePath, isForbiddenSegment, getAtPath, hasPath, setAtPath,
  deleteAtPath, compareForDeletion, toBracketPath, toDisplayPath,
} from '@/lib/utils/fieldPath';
import { buildFullUrl, buildQueryString, encodePathValue, encodeQueryPart } from '@/lib/utils/urlBuilder';
import { normalizeParsedCurl, splitUrl, syncRequestUrl, buildQueryString as reqQuery } from '@/lib/utils/requestUrl';
import { MASK, REDACTED_PLACEHOLDER } from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const pc = (o: Record<string, unknown>) => o as unknown as ParsedCurl;

describe('fieldPath: encoding', () => {
  it.each([
    [['a', 'b'], 'a.b'],
    [['a.b', 'c'], 'a\\.b.c'],
    [['a\\b'], 'a\\\\b'],
    [['a\\.b'], 'a\\\\\\.b'],
    [[''], ''],
    [['', ''], '.'],
    [['名', '🔑.x'], '名.🔑\\.x'],
  ])('encodePath(%j) = %j and round-trips', (segments, encoded) => {
    expect(encodePath(segments)).toBe(encoded);
    expect(decodePath(encoded)).toEqual(segments);
  });
  it('decodePath keeps a trailing lone backslash and handles empty input', () => {
    expect(decodePath('a\\')).toEqual(['a\\']);
    expect(decodePath('')).toEqual(['']);
    expect(decodePath('a..b')).toEqual(['a', '', 'b']);
  });
  it('toSegments / toPathId accept strings and arrays; toPathId canonicalises', () => {
    expect(toSegments('a.b')).toEqual(['a', 'b']);
    const arr = ['x', 'y'] as const;
    const out = toSegments(arr);
    expect(out).toEqual(['x', 'y']);
    expect(out).not.toBe(arr);
    expect(toPathId('a\\x.b')).toBe('ax.b');
    expect(toPathId(['a.b'])).toBe('a\\.b');
    expect(toDisplayPath(['a', '0', 'b'])).toBe('a.0.b');
  });
  it.each([
    [[], false], [['a'], true], [[''], false], [['a', ''], false],
    [['__proto__'], false], [['a', 'prototype'], false], [['constructor'], false], [['proto'], true],
  ])('isSafePath(%j) = %s', (segments, expected) => {
    expect(isSafePath(segments)).toBe(expected);
  });
  it('isForbiddenSegment', () => {
    for (const s of ['__proto__', 'prototype', 'constructor']) expect(isForbiddenSegment(s)).toBe(true);
    expect(isForbiddenSegment('toString')).toBe(false);
  });
});

describe('fieldPath: get / has', () => {
  const doc = { a: { b: [10, { c: 'x' }] }, n: null, z: 0, f: false, 'k.d': 1 };
  it.each([
    [['a', 'b', '0'], 10], [['a', 'b', '1', 'c'], 'x'], [['z'], 0], [['f'], false], [['n'], null],
    [['k.d'], 1], [['a', 'b', '2'], undefined], [['a', 'b', '-1'], undefined], [['a', 'b', 'x'], undefined],
    [['a', 'b', '01'], 10 /* leading zero parses as index 1? */],
    [['missing'], undefined], [['toString'], undefined], [['__proto__'], undefined], [['a', 'b', 'length'], undefined],
    [['z', 'x'], undefined], [[], undefined],
  ])('getAtPath(%j)', (segments, expected) => {
    if (segments.join() === 'a,b,01') {
      expect(getAtPath(doc, segments)).toEqual({ c: 'x' });
      return;
    }
    expect(getAtPath(doc, segments)).toBe(expected);
  });
  it('getAtPath: null at an intermediate step stops; root may be an array or a primitive', () => {
    expect(getAtPath({ n: null }, ['n', 'x'])).toBeUndefined();
    expect(getAtPath([[1]], ['0', '0'])).toBe(1);
    expect(getAtPath(5, ['a'])).toBeUndefined();
    expect(getAtPath(null, ['a'])).toBeUndefined();
  });
  it.each([
    [['a', 'b', '1', 'c'], true], [['n'], true], [['z'], true], [['a', 'b', '2'], false], [['a', 'x'], false],
    [['n', 'x'], false], [['toString'], false], [['__proto__'], false], [[], false], [['a', 'b', 'x'], false], [['z', 'x'], false],
  ])('hasPath(%j) = %s', (segments, expected) => {
    expect(hasPath(doc, segments)).toBe(expected);
  });
  it('an undefined-valued own key still counts for hasPath', () => {
    expect(hasPath({ u: undefined }, ['u'])).toBe(true);
    expect(getAtPath({ u: undefined }, ['u'])).toBeUndefined();
  });
});

describe('fieldPath: set / delete', () => {
  it('sets existing and new leaf keys, array elements and rejects unsafe/impossible writes', () => {
    const d: any = { a: { b: [1, 2] } };
    expect(setAtPath(d, ['a', 'c'], 5)).toBe(true);
    expect(setAtPath(d, ['a', 'b', '1'], 9)).toBe(true);
    expect(d).toEqual({ a: { b: [1, 9], c: 5 } });
    expect(setAtPath(d, ['a', 'b', '5'], 9)).toBe(false);
    expect(setAtPath(d, ['a', 'b', '2'], 9)).toBe(false); // one past the end needs shapeFrom
    expect(setAtPath(d, ['a', 'b', 'x'], 9)).toBe(false);
    expect(setAtPath(d, ['missing', 'x'], 1)).toBe(false);
    expect(setAtPath(d, ['__proto__', 'x'], 1)).toBe(false);
    expect(setAtPath(d, [], 1)).toBe(false);
    expect(setAtPath(null, ['a'], 1)).toBe(false);
    expect(setAtPath('str', ['a'], 1)).toBe(false);
    expect(({} as any).x).toBeUndefined();
  });
  it('shapeFrom recreates deleted parents with the right container type', () => {
    const original = { a: { list: [{ k: 1 }], obj: { x: 1 } } };
    const d: any = {};
    expect(setAtPath(d, ['a', 'obj', 'x'], 2, original)).toBe(true);
    expect(d).toEqual({ a: { obj: { x: 2 } } });
    const e: any = { a: {} };
    expect(setAtPath(e, ['a', 'list', '0'], { k: 1 }, original)).toBe(true);
    expect(Array.isArray(e.a.list)).toBe(true);
    // one past the end is allowed with shapeFrom (revert of a trailing item)
    const f: any = { a: { list: [] } };
    expect(setAtPath(f, ['a', 'list', '0'], 1, original)).toBe(true);
    // parent missing in the reference too: refuse
    expect(setAtPath({}, ['q', 'r'], 1, original)).toBe(false);
    // cannot invent an element inside an array parent
    expect(setAtPath({ l: [] }, ['l', '3', 'x'], 1, { l: [{ x: 1 }] })).toBe(false);
  });
  it('deleteAtPath removes keys, splices arrays, refuses missing paths', () => {
    const d: any = { a: [1, 2, 3], o: { k: 1, j: 2 }, top: 1 };
    expect(deleteAtPath(d, ['a', '1'])).toBe(true);
    expect(d.a).toEqual([1, 3]);
    expect(deleteAtPath(d, ['o', 'k'])).toBe(true);
    expect(d.o).toEqual({ j: 2 });
    expect(deleteAtPath(d, ['top'])).toBe(true);
    expect('top' in d).toBe(false);
    expect(deleteAtPath(d, ['nope'])).toBe(false);
    expect(deleteAtPath(d, ['a', '9'])).toBe(false);
    expect(deleteAtPath(d, ['__proto__'])).toBe(false);
    const arr: any = [1, 2];
    expect(deleteAtPath(arr, ['0'])).toBe(true);
    expect(arr).toEqual([2]);
  });
  it('compareForDeletion orders deeper/higher indices first so sequential deletes are safe', () => {
    const list = [['a', '0'], ['a', '2'], ['a', '1'], ['b'], ['a']];
    const sorted = [...list].sort(compareForDeletion).map((s) => s.join('.'));
    expect(sorted).toEqual(['a.2', 'a.1', 'a.0', 'a', 'b']);
    expect(compareForDeletion(['a'], ['a'])).toBe(0);
    expect(compareForDeletion(['x'], ['y'])).toBe(-1);
    expect(compareForDeletion(['y'], ['x'])).toBe(1);
    expect(compareForDeletion(['a', 'b'], ['a'])).toBeLessThan(0);
    const d: any = { a: [0, 1, 2, 3] };
    [['a', '0'], ['a', '2']].sort(compareForDeletion).forEach((s) => deleteAtPath(d, s));
    expect(d.a).toEqual([1, 3]);
  });
  it('toBracketPath uses brackets for arrays and dots for keys', () => {
    const d = { items: [{ sku: 1, tags: ['a'] }] };
    expect(toBracketPath(d, ['items', '0', 'sku'])).toBe('items[0].sku');
    expect(toBracketPath(d, ['items', '0', 'tags', '0'])).toBe('items[0].tags[0]');
    expect(toBracketPath([[1]], ['0', '0'])).toBe('[0][0]');
    expect(toBracketPath(d, [])).toBe('');
    expect(toBracketPath(d, ['gone', 'x'])).toBe('gone.x');
  });
});

describe('urlBuilder edges', () => {
  it.each([
    ['plain', 'a b', 'a%20b'], ['unicode', '名', '%E5%90%8D'], ['slash', 'a/b', 'a%2Fb'], ['already encoded kept', 'a%20b', 'a%20b'],
    ['zero', 0, '0'], ['false', false, 'false'], ['null', null, ''], ['undefined', undefined, ''], ['object', { a: 1 }, '%7B%22a%22%3A1%7D'],
    ['mask kept', MASK, MASK], ['redacted kept', REDACTED_PLACEHOLDER, REDACTED_PLACEHOLDER], ['mixed', `a b${MASK}c d`, `a%20b${MASK}c%20d`],
  ])('encodePathValue %s', (_n, v, expected) => {
    expect(encodePathValue(v)).toBe(expected);
  });
  it('encodeQueryPart keeps brackets only in keys', () => {
    expect(encodeQueryPart('a[0]', true)).toBe('a[0]');
    expect(encodeQueryPart('a[0]')).toBe('a%5B0%5D');
    expect(encodeQueryPart('é&=', true)).toBe('%C3%A9%26%3D');
  });
  it('buildQueryString: arrays repeat, undefined is a bare key, null is an empty value, non-objects are empty', () => {
    expect(buildQueryString({ a: [1, 2], b: undefined, c: null, d: 0, e: false, f: '' })).toBe('a=1&a=2&b&c=&d=0&e=false&f=');
    for (const v of [undefined, null, 'x', [1]]) expect(buildQueryString(v as never)).toBe('');
    expect(buildQueryString({ 'a b': 'c&d' })).toBe('a%20b=c%26d');
  });
  it('buildFullUrl: path params in list and map forms; missing values keep the placeholder', () => {
    const base = { base_url: 'https://a.test/', endpoint: '/u/{id}/{name}' };
    expect(buildFullUrl(pc({ ...base, path_parameters: [{ name: 'id', value: 7 }, { key: 'name', value: 'a b' }, { name: '', value: 'x' }, 'junk', { name: 'zz' }] }))).toBe('https://a.test/u/7/a%20b');
    expect(buildFullUrl(pc({ ...base, path_parameters: { id: { value: 0 }, name: 'plain' } }))).toBe('https://a.test/u/0/plain');
    expect(buildFullUrl(pc({ ...base, path_parameters: { id: null, name: { name: 'n' } } }))).toContain('{id}');
    expect(buildFullUrl(pc({ ...base, path_parameters: 'x' }))).toBe('https://a.test/u/{id}/{name}');
  });
  it('buildFullUrl: url fallback, query appended with ? or &, trailing slash trimmed', () => {
    expect(buildFullUrl(pc({ url: 'https://a.test/p?x=1#h' }))).toBe('https://a.test/p?x=1#h'); // a fragment after the query is kept verbatim
    expect(buildFullUrl(pc({ url: 'https://a.test/p#frag' }))).toBe('https://a.test/p');
    expect(buildFullUrl(pc({ url: 'https://a.test/p?x=1', query_params: { y: 2 } }))).toBe('https://a.test/p?x=1&y=2');
    expect(buildFullUrl(pc({ base_url: 'https://a.test', endpoint: '/p?x=1', query_params: { y: 2 } }))).toBe('https://a.test/p?x=1&y=2');
    expect(buildFullUrl(pc({ base_url: 'https://a.test', endpoint: '/p', query_params: {} }))).toBe('https://a.test/p');
    expect(buildFullUrl(pc({}))).toBe('');
    expect(buildFullUrl(pc({ base_url: 'https://a.test', url: 'https://ignored.test' }))).toBe('https://a.test');
  });
});

describe('requestUrl: splitUrl', () => {
  it.each([
    ['https://a.test/p/q?x=1', undefined, { base_url: 'https://a.test', endpoint: '/p/q', query_params: { x: '1' } }],
    ['  https://a.test  ', undefined, { base_url: 'https://a.test', endpoint: '/', query_params: {} }],
    ['http://a.test:8080/p', undefined, { base_url: 'http://a.test:8080', endpoint: '/p', query_params: {} }],
    ['https://a.test/v1/users?x=1', 'https://a.test/v1', { base_url: 'https://a.test/v1', endpoint: '/users', query_params: { x: '1' } }],
    ['https://a.test/v1?x=1', 'https://a.test/v1/', { base_url: 'https://a.test/v1/', endpoint: '/', query_params: { x: '1' } }],
    ['https://a.test/v10/users', 'https://a.test/v1', { base_url: 'https://a.test', endpoint: '/v10/users', query_params: {} }],
    ['https://a.test/p', 'https://other.test/v1', { base_url: 'https://a.test', endpoint: '/p', query_params: {} }],
    ['https://a.test/p?a=1&a=2&a=3&b=x', undefined, { base_url: 'https://a.test', endpoint: '/p', query_params: { a: ['1', '2', '3'], b: 'x' } }],
    ['https://a.test/p?__proto__=x&constructor=y&ok=1', undefined, { base_url: 'https://a.test', endpoint: '/p', query_params: { ok: '1' } }],
    ['https://a.test/%E5%90%8D?名=値', undefined, { base_url: 'https://a.test', endpoint: '/%E5%90%8D', query_params: { 名: '値' } }],
  ])('%s', (url, base, expected) => {
    expect(splitUrl(url, base)).toEqual(expected);
  });
  it.each([[undefined], [null], [5], [''], ['   '], ['a.test/p'], ['{{base}}/p'], ['ftp://a.test'], ['mailto:x@y.z'], ['http://']])('%j is not splittable', (u) => {
    expect(splitUrl(u)).toBeNull();
  });
});

describe('requestUrl: normalizeParsedCurl', () => {
  it('upper-cases / defaults the method, preferring raw_data only when data is absent', () => {
    expect(normalizeParsedCurl(pc({ method: ' post ' })).method).toBe('POST');
    for (const m of [undefined, '', '  ', 5]) expect(normalizeParsedCurl(pc({ method: m })).method).toBe('GET');
    expect(normalizeParsedCurl(pc({ raw_data: 'r' })).data).toBe('r');
    expect(normalizeParsedCurl(pc({ raw_data: 'r', data: null })).data).toBe('r');
    expect(normalizeParsedCurl(pc({ raw_data: 'r', data: '' })).data).toBe('');
    expect(normalizeParsedCurl(pc({ raw_data: '' })).data).toBeUndefined();
    expect(normalizeParsedCurl(pc({ raw_data: 'r', data: 0 })).data).toBe(0);
  });
  it('derives missing parts from url but keeps present ones, including falsy extras', () => {
    const n = normalizeParsedCurl(pc({ url: 'https://a.test/p?x=1', flags: { k: false }, retries: 0 }));
    expect(n).toMatchObject({ base_url: 'https://a.test', endpoint: '/p', query_params: { x: '1' }, flags: { k: false }, retries: 0 });
    const keep = normalizeParsedCurl(pc({ url: 'https://a.test/p?x=1', base_url: 'https://mine.test', endpoint: '/e', query_params: { y: '2' } }));
    expect(keep).toMatchObject({ base_url: 'https://mine.test', endpoint: '/e', query_params: { y: '2' } });
    expect(normalizeParsedCurl(pc({ url: 'https://a.test/p?x=1', base_url: '  ', endpoint: null, query_params: {} }))).toMatchObject({ base_url: 'https://a.test', endpoint: '/p', query_params: { x: '1' } });
    expect(normalizeParsedCurl(pc({ url: 'https://a.test/p' })).query_params).toBeUndefined();
  });
  it('builds url from parts when missing; leaves unparsable urls alone', () => {
    expect(normalizeParsedCurl(pc({ base_url: 'https://a.test', endpoint: '/p', query_params: { a: 1 } })).url).toBe('https://a.test/p?a=1');
    expect(normalizeParsedCurl(pc({ url: '{{base}}/p' })).url).toBe('{{base}}/p');
    expect(normalizeParsedCurl(pc({})).url).toBeUndefined();
    expect(normalizeParsedCurl(pc({ url: '', base_url: '' })).url).toBe('');
  });
  it('does not mutate its input', () => {
    const input = pc({ url: 'https://a.test/p' });
    const copy = JSON.stringify(input);
    normalizeParsedCurl(input);
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe('requestUrl: syncRequestUrl', () => {
  const prev = pc({ method: 'GET', url: 'https://a.test/v1/p?x=1', base_url: 'https://a.test/v1', endpoint: '/p', query_params: { x: '1' } });
  it('upper-cases an edited method only when it changed', () => {
    expect(syncRequestUrl(prev, { ...prev, method: ' put ' }).method).toBe('PUT');
    expect(syncRequestUrl(prev, { ...prev, method: 'PUT' }).method).toBe('PUT');
    const same = syncRequestUrl(prev, prev);
    expect(same).toBe(prev);
    expect(syncRequestUrl(pc({ method: 'get' }), pc({ method: 'get' })).method).toBe('get');
  });
  it('an edited url re-derives base, endpoint and query', () => {
    const out = syncRequestUrl(prev, { ...prev, url: 'https://a.test/v1/other?y=2' });
    expect(out).toMatchObject({ base_url: 'https://a.test/v1', endpoint: '/other', query_params: { y: '2' } });
  });
  it('an edited url without a query clears the query only if there was a query object', () => {
    const out = syncRequestUrl(prev, { ...prev, url: 'https://a.test/v1/p' });
    expect(out.query_params).toEqual({});
    const bare = pc({ url: 'https://a.test/p' });
    expect(syncRequestUrl(bare, { ...bare, url: 'https://a.test/q' })).not.toHaveProperty('query_params');
  });
  it('an unparsable edited url leaves the parts alone', () => {
    const out = syncRequestUrl(prev, { ...prev, url: '{{base}}/p' });
    expect(out.base_url).toBe(prev.base_url);
    expect(out.endpoint).toBe('/p');
  });
  it('edited base/endpoint rebuild the url; edited query rebuilds only the query string', () => {
    expect(syncRequestUrl(prev, { ...prev, endpoint: '/z' }).url).toBe('https://a.test/v1/z?x=1');
    expect(syncRequestUrl(prev, { ...prev, base_url: 'https://b.test' }).url).toBe('https://b.test/p?x=1');
    expect(syncRequestUrl(prev, { ...prev, query_params: { q: 'a b', r: ['1', '2'] } }).url).toBe('https://a.test/v1/p?q=a+b&r=1&r=2');
    expect(syncRequestUrl(prev, { ...prev, query_params: {} }).url).toBe('https://a.test/v1/p');
  });
  it('does nothing when url is not a string or the rebuilt url is identical', () => {
    const noUrl = pc({ base_url: 'https://a.test', endpoint: '/p' });
    expect(syncRequestUrl(noUrl, { ...noUrl, endpoint: '/q' })).toEqual({ base_url: 'https://a.test', endpoint: '/q' });
    expect(syncRequestUrl(prev, { ...prev, endpoint: '/p' })).toEqual(prev);
  });
  it('when url and its parts change together, the edit is taken as is', () => {
    const next = { ...prev, url: 'https://c.test/x', endpoint: '/x' };
    expect(syncRequestUrl(prev, next)).toEqual(next);
  });
  it('requestUrl.buildQueryString: arrays, null, undefined, non-objects', () => {
    expect(reqQuery({ a: [1, 2], b: null, c: undefined, d: 'é' })).toBe('a=1&a=2&b=&c=&d=%C3%A9');
    expect(reqQuery(undefined)).toBe('');
    expect(reqQuery('x' as never)).toBe('');
  });
});
