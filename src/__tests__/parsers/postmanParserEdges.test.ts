import { describe, it, expect } from 'vitest';
import { parsePostmanCollection, variablesFromList, environmentVariables } from '@/lib/parsers/postmanParser';
import type { PostmanCollection, PostmanEnvironment } from '@/types/import';

const flat = (curl: string) => curl.replace(/ \\\n\s*/g, ' ');
const coll = (item: unknown[], extra: Record<string, unknown> = {}) => ({ info: { name: 'c' }, item, ...extra }) as unknown as PostmanCollection;
const req = (request: unknown, extra: Record<string, unknown> = {}) => ({ name: 'r', request, ...extra });
const run = (request: unknown, extra: Record<string, unknown> = {}, env?: PostmanEnvironment | null, c: Record<string, unknown> = {}) =>
  parsePostmanCollection(coll([req(request, extra)], c), env)[0]!;
const curl = (request: unknown, extra: Record<string, unknown> = {}, env?: PostmanEnvironment | null, c: Record<string, unknown> = {}) =>
  flat(run(request, extra, env, c).curlCommand);

describe('postman: variable helpers', () => {
  it('variablesFromList uses key, falls back to id, skips disabled and keyless, stringifies', () => {
    expect(
      variablesFromList([
        { key: 'a', value: 1 },
        { id: 'b', value: { x: 1 } },
        { key: 'c', value: 'x', disabled: true },
        { value: 'nokey' },
        { key: 'd' },
        null as never,
      ] as never),
    ).toEqual({ a: '1', b: '{"x":1}', d: '' });
    expect(variablesFromList(undefined)).toEqual({});
  });
  it('environmentVariables: null, disabled entries, and values over variable[]', () => {
    expect(environmentVariables(null)).toEqual({});
    expect(environmentVariables(undefined)).toEqual({});
    expect(
      environmentVariables({
        values: [{ key: 'a', value: '1' }, { key: 'b', value: '2', enabled: false }, { value: 'x' }, null as never],
        variable: [{ key: 'a', value: 'old' }, { key: 'z', value: 'z' }],
      } as unknown as PostmanEnvironment),
    ).toEqual({ a: '1', z: 'z' });
    expect(environmentVariables({} as PostmanEnvironment)).toEqual({});
  });
});

describe('postman: collection walking', () => {
  it('handles empty collections and null items', () => {
    expect(parsePostmanCollection({ info: { name: 'x' } } as unknown as PostmanCollection)).toEqual([]);
    expect(parsePostmanCollection(coll([null, { name: 'folder-only' }]))).toEqual([]);
  });
  it('builds folder paths, applies inner folder variables and defaults the name', () => {
    const out = parsePostmanCollection(
      coll(
        [
          {
            name: 'A',
            variable: [{ key: 'h', value: 'a.test' }],
            item: [
              { item: [{ request: { url: 'https://{{h}}/x' } }] },
              { name: 'B', variable: [{ key: 'h', value: 'b.test' }], item: [req({ url: 'https://{{h}}/y' }, { name: '' })] },
            ],
          },
        ],
        { variable: [{ key: 'h', value: 'root.test' }] },
      ),
    );
    expect(out.map((r) => [r.name, r.folder, r.url])).toEqual([
      ['Request', 'A', 'https://a.test/x'],
      ['Request', 'A / B', 'https://b.test/y'],
    ]);
    expect(out.map((r) => r.id)).toEqual(['0', '1']);
  });
  it('request variables beat folder variables, environment beats both', () => {
    const items = [req({ url: 'https://{{h}}' }, { variable: [{ key: 'h', value: 'req.test' }] })];
    expect(parsePostmanCollection(coll(items, { variable: [{ key: 'h', value: 'c' }] }))[0]!.url).toBe('https://req.test');
    expect(parsePostmanCollection(coll(items), { values: [{ key: 'h', value: 'env.test' }] } as PostmanEnvironment)[0]!.url).toBe('https://env.test');
  });
  it('reports unresolved variables and path vars, and warnings, only when present', () => {
    const r = run({ url: 'https://h.test/:id/{{missing}}', auth: { type: 'hawk' } });
    expect(r.unresolvedVariables).toEqual(['missing', ':id']);
    expect(r.warnings).toEqual(['Auth type "hawk" is not converted; add its credentials manually.']);
    const clean = run({ url: 'https://h.test' });
    expect(clean.unresolvedVariables).toBeUndefined();
    expect(clean.warnings).toBeUndefined();
  });
  it('accepts a string request and defaults the method to GET', () => {
    const r = parsePostmanCollection(coll([{ name: 's', request: 'https://s.test' }]))[0]!;
    expect(r.method).toBe('GET');
    expect(flat(r.curlCommand)).toBe("curl 'https://s.test'");
    expect(run({ url: 'https://s.test', method: 'patch' }).method).toBe('PATCH');
  });
});

describe('postman: auth', () => {
  const withAuth = (auth: unknown, collAuth?: unknown, itemAuth?: unknown) =>
    curl({ url: 'https://h.test', auth }, itemAuth ? { auth: itemAuth } : {}, null, collAuth ? { auth: collAuth } : {});
  it.each([
    ['bearer', { type: 'bearer', bearer: [{ key: 'token', value: 'T' }] }, "-H 'Authorization: Bearer T'"],
    ['bearer no token', { type: 'bearer' }, "-H 'Authorization: Bearer '"],
    ['bearer object form', { type: 'bearer', bearer: { token: 'O' } }, 'Bearer O'],
    ['basic', { type: 'basic', basic: [{ key: 'username', value: 'u' }, { key: 'password', value: 'p' }] }, "-u 'u:p'"],
    ['basic empty', { type: 'basic' }, "-u ':'"],
    ['digest', { type: 'digest', digest: [{ key: 'username', value: 'u' }, { key: 'password', value: 'p' }] }, '--digest'],
    ['apikey header default', { type: 'apikey', apikey: [{ key: 'key', value: 'X-K' }, { key: 'value', value: 'v' }] }, "-H 'X-K: v'"],
    ['apikey query', { type: 'apikey', apikey: [{ key: 'key', value: 'k' }, { key: 'value', value: 'v' }, { key: 'in', value: 'query' }] }, '?k=v'],
    ['apikey no key', { type: 'apikey', apikey: [{ key: 'value', value: 'v' }] }, "curl 'https://h.test'"],
    ['oauth2 token', { type: 'oauth2', oauth2: [{ key: 'accessToken', value: 'AT' }] }, "'Authorization: Bearer AT'"],
    ['oauth2 prefix', { type: 'oauth2', oauth2: [{ key: 'accessToken', value: 'AT' }, { key: 'headerPrefix', value: 'Token' }] }, 'Token AT'],
    ['oauth2 empty prefix', { type: 'oauth2', oauth2: [{ key: 'accessToken', value: 'AT' }, { key: 'headerPrefix', value: '' }] }, "'Authorization: AT'"],
    ['oauth2 missing token -> variable', { type: 'oauth2', oauth2: [] }, '{{accessToken}}'],
    ['oauth2 query', { type: 'oauth2', oauth2: [{ key: 'accessToken', value: 'AT' }, { key: 'addTokenTo', value: 'queryParams' }] }, '?access_token=AT'],
    ['noauth', { type: 'noauth' }, "curl 'https://h.test'"],
    ['no type', {}, "curl 'https://h.test'"],
  ])('%s', (_n, auth, expected) => {
    expect(withAuth(auth)).toContain(expected);
  });
  it('malformed auth param entries are ignored', () => {
    expect(withAuth({ type: 'bearer', bearer: [null, 'x', { nokey: 1 }, { key: 'token', value: 'ok' }] })).toContain('Bearer ok');
  });
  it('resolves variables inside auth values', () => {
    const c = curl({ url: 'https://h.test', auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{tok}}' }] } }, {}, { values: [{ key: 'tok', value: 'S' }] } as PostmanEnvironment);
    expect(c).toContain('Bearer S');
  });
  it('request auth beats item, folder and collection auth; inherit falls through', () => {
    const bearer = (t: string) => ({ type: 'bearer', bearer: [{ key: 'token', value: t }] });
    expect(withAuth(bearer('req'), bearer('coll'), bearer('item'))).toContain('Bearer req');
    expect(withAuth({ type: 'inherit' }, bearer('coll'), bearer('item'))).toContain('Bearer item');
    expect(withAuth(undefined, bearer('coll'))).toContain('Bearer coll');
    expect(withAuth(undefined, { type: 'inherit' })).not.toContain('Authorization');
  });
  it('folder auth is inherited by nested requests', () => {
    const out = parsePostmanCollection(coll([{ name: 'f', auth: { type: 'bearer', bearer: [{ key: 'token', value: 'F' }] }, item: [req({ url: 'https://h.test' })] }]));
    expect(out[0]!.curlCommand).toContain('Bearer F');
  });
  it('an explicit Authorization header beats auth and suppresses -u', () => {
    const c = curl({ url: 'https://h.test', header: [{ key: 'authorization', value: 'mine' }], auth: { type: 'basic', basic: [{ key: 'username', value: 'u' }] } });
    expect(c).toContain("-H 'authorization: mine'");
    expect(c).not.toContain('-u');
    expect(curl({ url: 'https://h.test', header: [{ key: 'authorization', value: 'mine' }], auth: { type: 'bearer', bearer: [{ key: 'token', value: 'x' }] } })).not.toContain('Bearer');
  });
});

describe('postman: urls', () => {
  it.each([
    ['structured host/path/query', { host: ['api', 'test'], protocol: 'http', path: ['v1', 'a b'], query: [{ key: 'q', value: 'x y' }, { key: 'off', value: '1', disabled: true }, { key: '' }, { key: 'flag', value: null }] }, "'http://api.test/v1/a%20b?q=x%20y&flag'"],
    ['host string with port', { host: 'h.test', port: '8080', path: 'a/b' }, "'https://h.test:8080/a/b'"],
    ['port already in host', { host: 'h.test:9', port: '8080' }, "'https://h.test:9'"],
    ['scheme already in host', { host: 'http://h.test/', protocol: 'https' }, "'http://h.test'"],
    ['protocol with ://', { host: 'h.test', protocol: 'http://' }, "'http://h.test'"],
    ['trailing empty segment kept', { host: 'h.test', path: ['a', ''] }, "'https://h.test/a/'"],
    ['empty middle segments dropped', { host: 'h.test', path: ['a', '', 'b'] }, "'https://h.test/a/b'"],
    ['variable host', { host: '{{base}}', path: ['x'] }, "'{{base}}/x'"],
    ['raw with query, fragment', { raw: 'h.test/p?a=1&b&&c=%20#frag' }, "'https://h.test/p?a=1&b&c=%20'"],
    ['raw host only', { raw: 'https://h.test' }, "'https://h.test'"],
    ['raw with scheme and port', { raw: 'http://h.test:81/x/y' }, "'http://h.test:81/x/y'"],
    ['raw unicode path', { raw: 'https://h.test/é' }, "'https://h.test/%C3%A9'"],
    ['raw unicode query', { raw: 'https://h.test/?名=值' }, "'https://h.test/?%E5%90%8D=%E5%80%BC'"],
  ])('%s', (_n, url, expected) => {
    expect(curl({ url })).toContain(expected);
  });
  it('fills :path variables (structured and raw), encodes values, marks missing ones', () => {
    const c = curl({ url: { raw: 'https://h.test/u/:id/:name/:none', variable: [{ key: 'id', value: '1/2' }, { key: 'name', value: '' }, { value: 'x' }] } });
    expect(c).toContain("'https://h.test/u/1%2F2/:name/:none'");
    const s = run({ url: { host: 'h.test', path: [':id'], variable: [{ key: 'id', value: '{{v}}' }] } }, {}, { values: [{ key: 'v', value: 'a b' }] } as PostmanEnvironment);
    expect(s.url).toBe('https://h.test/a%20b');
    expect(s.unresolvedVariables).toBeUndefined();
  });
  it('an empty or missing url produces a bare curl', () => {
    expect(flat(run({}).curlCommand)).toBe("curl ''");
    expect(run({ url: {} }).url).toBe('');
  });
  it('auth query params are appended with encoding', () => {
    expect(curl({ url: 'https://h.test?x=1', auth: { type: 'apikey', apikey: [{ key: 'key', value: 'a b' }, { key: 'value', value: 'c&d' }, { key: 'in', value: 'query' }] } })).toContain('?x=1&a%20b=c%26d');
  });
  it('keeps {{placeholders}} and %XX escapes untouched while encoding the rest', () => {
    expect(curl({ url: 'https://h.test/{{p}}/a%2Fb c?q={{v}} x' })).toContain("'https://h.test/{{p}}/a%2Fb%20c?q={{v}}%20x'");
  });
});

const NOBODY = Symbol('no body');
describe('postman: headers and bodies', () => {
  it('header as a string block, array, with disabled/keyless/invalid entries', () => {
    expect(curl({ url: 'https://h.test', header: 'A: 1\r\nB:2\nbad\n: x\n' })).toMatch(/-H 'A: 1' -H 'B: 2'$/);
    expect(curl({ url: 'https://h.test', header: [{ key: 'A', value: 1 }, { key: 'B', value: 'x', disabled: true }, { value: 'nokey' }, null] })).toContain("-H 'A: 1'");
    expect(curl({ url: 'https://h.test', header: 5 })).toBe("curl 'https://h.test'");
  });
  it.each([
    ['raw json language', { mode: 'raw', raw: '{"a":1}', options: { raw: { language: 'json' } } }, ["-H 'Content-Type: application/json'", `-d '{"a":1}'`]],
    ['raw xml', { mode: 'raw', raw: '<a/>', options: { raw: { language: 'xml' } } }, ['application/xml']],
    ['raw unknown language', { mode: 'raw', raw: 'x', options: { raw: { language: 'yaml' } } }, ["-d 'x'"]],
    ['raw empty', { mode: 'raw', raw: '' }, NOBODY],
    ['raw undefined', { mode: 'raw' }, NOBODY],
    ['urlencoded', { mode: 'urlencoded', urlencoded: [{ key: 'a b', value: 'x&y' }, { key: 'off', value: '1', disabled: true }, { key: '' }, { key: 'n', value: 0 }] }, ["-d 'a%20b=x%26y&n=0'"]],
    ['urlencoded empty', { mode: 'urlencoded', urlencoded: [] }, NOBODY],
    ['urlencoded missing list', { mode: 'urlencoded' }, NOBODY],
    ['formdata', { mode: 'formdata', formdata: [{ key: 'a', value: 'v', contentType: 'text/x' }, { key: 'b', value: '@lit' }, { key: 'c', type: 'file', src: ['/p/f.txt', 'x'] }, { key: 'd', type: 'file', src: '/p/g' }, { key: 'e', type: 'file' }, { key: 'off', value: '1', disabled: true }, { value: 'nokey' }] }, ["-F 'a=v;type=text/x'", "--form-string 'b=@lit'", "-F 'c=@/p/f.txt'", "-F 'd=@/p/g'", "-F 'e=@path/to/file'"]],
    ['formdata empty', { mode: 'formdata', formdata: [] }, NOBODY],
    ['file body', { mode: 'file', file: { src: '/tmp/x' } }, ["--data-binary '@/tmp/x'"]],
    ['file body without src', { mode: 'file' }, ["--data-binary '@path/to/file'"]],
    ['graphql with string vars', { mode: 'graphql', graphql: { query: '{ a }', variables: '{"x":1}' } }, ['"variables": {', 'Content-Type: application/json']],
    ['graphql invalid string vars kept', { mode: 'graphql', graphql: { query: '{ a }', variables: 'not json' } }, ['"variables": "not json"']],
    ['graphql object vars', { mode: 'graphql', graphql: { query: '{ a }', variables: { y: 2 } } }, ['"y": 2']],
    ['graphql no vars', { mode: 'graphql', graphql: { query: '{ a }', variables: '' } }, ['"query": "{ a }"']],
    ['graphql empty', { mode: 'graphql' }, ['"query": ""']],
    ['unknown mode', { mode: 'binary' }, NOBODY],
  ])('%s', (_n, body, expected) => {
    const c = curl({ url: 'https://h.test', method: 'POST', body });
    if (expected === NOBODY) {
      expect(c).toBe("curl -X POST 'https://h.test'");
      return;
    }
    for (const e of expected as string[]) expect(c).toContain(e);
  });
  it('body warnings for file placeholders', () => {
    expect(run({ url: 'https://h.test', body: { mode: 'file' } }).warnings).toEqual(['File body has no source path; replace the placeholder.']);
    expect(run({ url: 'https://h.test', body: { mode: 'formdata', formdata: [{ key: 'f', type: 'file' }] } }).warnings).toEqual(['File field "f" has no source path; replace the placeholder.']);
  });
  it('resolves variables inside bodies recursively, and stops runaway self-references', () => {
    const env = { values: [{ key: 'a', value: '{{b}}' }, { key: 'b', value: 'deep' }, { key: 'loop', value: '{{loop}}' }] } as PostmanEnvironment;
    expect(curl({ url: 'https://h.test', body: { mode: 'raw', raw: '{{a}}' } }, {}, env)).toContain("-d 'deep'");
    expect(curl({ url: 'https://h.test', body: { mode: 'raw', raw: '{{loop}}' } }, {}, env)).toContain("-d '{{loop}}'");
  });
  it('does not override an explicit Content-Type header', () => {
    const c = curl({ url: 'https://h.test', header: [{ key: 'content-type', value: 'x/y' }], body: { mode: 'raw', raw: '{}', options: { raw: { language: 'json' } } } });
    expect(c.match(/content-type/gi)).toHaveLength(1);
  });
  it('shell-escapes single quotes in bodies', () => {
    expect(curl({ url: 'https://h.test', body: { mode: 'raw', raw: "it's" } })).toContain("-d 'it'\\''s'");
  });
});

import { parseInput, parseEnvironmentText, detectFormat } from '@/lib/parsers/importUtils';

describe('importUtils: input parsing edges', () => {
  it.each([
    ['broken JSON object', '{"a":', 'Invalid JSON: '],
    ['broken JSON array', '[1,', 'Invalid JSON: '],
    ['broken YAML', 'a: [1, 2', 'Invalid YAML: '],
    ['tab-indented YAML', 'a:\n\t- b', 'Invalid YAML: '],
  ])('%s is reported with a readable error', async (_n, text, prefix) => {
    const r = await parseInput(text);
    expect(r.format).toBe('unknown');
    expect(r.data).toBeNull();
    expect(r.error).toMatch(new RegExp('^' + prefix));
  });
  it.each([['empty', ''], ['whitespace', '   \n '], ['scalar yaml', 'hello'], ['json array', '[1,2]'], ['yaml list', '- a\n- b']])('%s input is not a recognisable format', async (_n, text) => {
    const r = await parseInput(text);
    expect(r.format).toBe('unknown');
    expect(r.error).toContain('Could not detect format');
  });
  it('parses YAML OpenAPI and surrounding whitespace', async () => {
    const r = await parseInput('\n  openapi: 3.0.0\npaths: {}\n');
    expect(r.format).toBe('openapi');
  });
  it('detectFormat: non-objects, schema URL, info+item', () => {
    for (const v of [null, undefined, 5, 'x', false]) expect(detectFormat(v)).toBe('unknown');
    expect(detectFormat({ info: { schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' } })).toBe('postman');
    expect(detectFormat({ info: { schema: 'https://example.com/other' } })).toBe('unknown');
    expect(detectFormat({ info: {}, item: [] })).toBe('postman');
    expect(detectFormat({ info: 'str', item: [] })).toBe('unknown');
  });
  it.each([
    ['empty', '', null, undefined],
    ['whitespace', '  ', null, undefined],
    ['invalid JSON', '{', null, 'Invalid environment JSON: '],
    ['null', 'null', null, 'Not a Postman environment'],
    ['number', '5', null, 'Not a Postman environment'],
    ['no values', '{"name":"x"}', null, 'Not a Postman environment'],
    ['values not array', '{"values":{}}', null, 'Not a Postman environment'],
  ])('environment %s', (_n, text, env, err) => {
    const r = parseEnvironmentText(text);
    expect(r.env).toBe(env);
    if (err) expect(r.error).toContain(err);
    else expect(r.error).toBeUndefined();
  });
  it('environment accepts values[] or variable[] (globals)', () => {
    expect(parseEnvironmentText('{"values":[]}').env).toEqual({ values: [] });
    expect(parseEnvironmentText('{"variable":[{"key":"a","value":"1"}]}').env).not.toBeNull();
  });
});
