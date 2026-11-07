import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec } from '@/lib/parsers/openApiParser';
import type { OpenApiSpec } from '@/types/import';

const flat = (curl: string) => curl.replace(/ \\\n\s*/g, ' ');
const spec = (extra: Record<string, unknown>): OpenApiSpec => ({ openapi: '3.0.0', info: { title: 't', version: '1' }, ...extra }) as unknown as OpenApiSpec;
/** One operation on `/p` with the given operation-level overrides. */
const op = (operation: Record<string, unknown>, extra: Record<string, unknown> = {}, method = 'post', path = '/p') =>
  flat(parseOpenApiSpec(spec({ servers: [{ url: 'https://h.test' }], paths: { [path]: { [method]: operation } }, ...extra }))[0]!.curlCommand);
const jsonBody = (schema: unknown, extra: Record<string, unknown> = {}) =>
  op({ requestBody: { content: { 'application/json': { schema } } } }, extra);

describe('openApi: structure and naming', () => {
  it('skips non-object path items, non-object operations and unknown methods', () => {
    const out = parseOpenApiSpec(spec({ paths: { '/a': 'nope', '/b': { get: 'nope', trace: {} }, '/c': { get: {} } } }));
    expect(out.map((r) => r.url)).toEqual(['https://api.example.com/c']);
  });
  it('returns an empty list when there are no paths', () => {
    expect(parseOpenApiSpec(spec({}))).toEqual([]);
  });
  it('names by summary, then operationId, then METHOD path', () => {
    const out = parseOpenApiSpec(spec({ paths: { '/a': { get: { summary: 'S', operationId: 'o' }, put: { operationId: 'op1' }, delete: {}, patch: { summary: '' } } } }));
    expect(out.map((r) => r.name)).toEqual(['S', 'op1', 'PATCH /a', 'DELETE /a']);
    expect(out.map((r) => r.id)).toEqual(['0', '1', '2', '3']);
  });
  it('follows a $ref path item and ignores a dangling one', () => {
    const out = parseOpenApiSpec(spec({ components: { x: { get: { summary: 'ok' } } }, paths: { '/a': { $ref: '#/components/x' }, '/b': { $ref: '#/components/missing' } } }));
    expect(out.map((r) => r.name)).toEqual(['ok']);
  });
});

describe('openApi: base url resolution', () => {
  const base = (s: Record<string, unknown>) => parseOpenApiSpec(spec({ paths: { '/x': { get: {} } }, ...s }))[0]!.url;
  it.each([
    ['default', {}, 'https://api.example.com/x'],
    ['server url', { servers: [{ url: 'https://a.test/v1/' }] }, 'https://a.test/v1/x'],
    ['variable default', { servers: [{ url: 'https://{h}.test', variables: { h: { default: 'dev' } } }] }, 'https://dev.test/x'],
    ['variable enum', { servers: [{ url: 'https://{h}.test', variables: { h: { enum: ['e1', 'e2'] } } }] }, 'https://e1.test/x'],
    ['variable without default', { servers: [{ url: 'https://{h}.test', variables: { h: {} } }] }, 'https://{h}.test/x'],
    ['unknown variable', { servers: [{ url: 'https://{z}.test' }] }, 'https://{z}.test/x'],
    ['protocol relative', { servers: [{ url: '//cdn.test' }] }, 'https://cdn.test/x'],
    ['relative with slash', { servers: [{ url: '/api' }] }, 'https://api.example.com/api/x'],
    ['relative without slash', { servers: [{ url: './api' }] }, 'https://api.example.com/api/x'],
    ['server without url string', { servers: [{ url: 5 }] }, 'https://api.example.com/x'],
    ['swagger host https default', { host: 'h.test', basePath: '/b' }, 'https://h.test/b/x'],
    ['swagger host http', { host: 'h.test', schemes: ['http'] }, 'http://h.test/x'],
    ['swagger host both', { host: 'h.test', schemes: ['http', 'https'] }, 'https://h.test/x'],
    ['swagger host ws first', { host: 'h.test', schemes: ['ws'] }, 'ws://h.test/x'],
    ['basePath only', { basePath: '/only/' }, 'https://api.example.com/only/x'],
  ])('%s', (_n, s, expected) => {
    expect(base(s as Record<string, unknown>)).toBe(expected);
  });
  it('operation servers beat path servers beat root servers', () => {
    const out = parseOpenApiSpec(
      spec({
        servers: [{ url: 'https://root.test' }],
        paths: { '/x': { servers: [{ url: 'https://path.test' }], get: { servers: [{ url: 'https://op.test' }] }, post: {} } },
      }),
    );
    expect(out.map((r) => r.url)).toEqual(['https://op.test/x', 'https://path.test/x']);
  });
});

describe('openApi: parameters', () => {
  it('path-level parameters merge, and an operation overrides by name+location', () => {
    const out = parseOpenApiSpec(
      spec({ paths: { '/x': { parameters: [{ name: 'a', in: 'query', example: 1 }, { name: 'b', in: 'query', example: 2 }], get: { parameters: [{ name: 'a', in: 'query', example: 9 }] } } } }),
    );
    expect(flat(out[0]!.curlCommand)).toContain("'https://api.example.com/x?a=9&b=2'");
  });
  it('ignores malformed parameter entries and non-array lists', () => {
    const c = op({ parameters: [null, { name: 1, in: 'query' }, { name: 'ok', in: 7 }, { $ref: '#/nope' }, { name: 'q', in: 'query', example: 'v' }] }, {}, 'get');
    expect(c).toContain("'https://h.test/p?q=v'");
    expect(op({ parameters: 'x' }, {}, 'get')).toContain("'https://h.test/p'");
  });
  it('resolves $ref parameters', () => {
    const c = op({ parameters: [{ $ref: '#/components/parameters/Q' }] }, { components: { parameters: { Q: { name: 'q', in: 'query', example: 'r' } } } }, 'get');
    expect(c).toContain('?q=r');
  });
  it.each([
    ['example', { example: 'ex' }, 'ex'],
    ['named examples', { examples: { a: { value: 'named' } } }, 'named'],
    ['x-example', { 'x-example': 'xe' }, 'xe'],
    ['schema default', { schema: { type: 'string', default: 'def' } }, 'def'],
    ['swagger2 inline type', { type: 'integer' }, '0'],
    ['swagger2 inline enum', { type: 'string', enum: ['one', 'two'] }, 'one'],
    ['boolean', { schema: { type: 'boolean' } }, 'true'],
    ['no schema at all', {}, 'string'],
  ])('query value from %s', (_n, p, expected) => {
    expect(op({ parameters: [{ name: 'q', in: 'query', ...p }] }, {}, 'get')).toContain(`?q=${expected}'`);
  });
  it.each([
    ['exploded array', { explode: true }, 'q=1&q=2'],
    ['explode default', {}, 'q=1&q=2'],
    ['explode false', { explode: false }, 'q=1%2C2'],
    ['csv collectionFormat', { collectionFormat: 'csv' }, 'q=1%2C2'],
    ['pipeDelimited', { style: 'pipeDelimited' }, 'q=1%7C2'],
    ['pipes collectionFormat', { collectionFormat: 'pipes', explode: false }, 'q=1%7C2'],
    ['spaceDelimited', { style: 'spaceDelimited' }, 'q=1%202'],
    ['ssv collectionFormat', { collectionFormat: 'ssv', explode: false }, 'q=1%202'],
  ])('array query: %s', (_n, p, expected) => {
    expect(op({ parameters: [{ name: 'q', in: 'query', example: [1, 2], ...p }] }, {}, 'get')).toContain(expected);
  });
  it('serialises object and null array items', () => {
    expect(op({ parameters: [{ name: 'q', in: 'query', example: [{ a: 1 }, null] }] }, {}, 'get')).toContain('q=%7B%22a%22%3A1%7D&q=');
  });
  it('fills path params (arrays joined) and replaces undefined templates with a stand-in', () => {
    const c = op({ parameters: [{ name: 'id', in: 'path', example: [1, 2] }, { name: 'n', in: 'path', example: 'a b/c' }] }, {}, 'get', '/u/{id}/{n}/{ghost}');
    expect(c).toContain("'https://h.test/u/1%2C2/a%20b%2Fc/value'");
  });
  it('sends header and cookie parameters, joined for arrays', () => {
    const c = op({
      parameters: [
        { name: 'X-A', in: 'header', example: ['a', 'b'] },
        { name: 'sid', in: 'cookie', example: 'abc' },
        { name: 'k', in: 'cookie', example: 'v' },
      ],
    }, {}, 'get');
    expect(c).toContain("-H 'X-A: a,b'");
    expect(c).toContain("-b 'sid=abc; k=v'");
  });
});

describe('openApi: schema example generation', () => {
  const body = (schema: unknown, extra: Record<string, unknown> = {}) => {
    const c = jsonBody(schema, extra);
    return JSON.parse(c.match(/-d '([\s\S]*)'$/)![1]!.replace(/'\\''/g, "'"));
  };
  it.each([
    ['const', { const: 'k' }, 'k'],
    ['schema.example', { example: 5 }, 5],
    ['x-example', { 'x-example': 'xe' }, 'xe'],
    ['examples array', { examples: ['first', 'second'] }, 'first'],
    ['examples map via $ref', { examples: { a: { $ref: '#/components/examples/E' } } }, 'refd'],
    ['examples map without value', { type: 'string', examples: { a: { summary: 's' } } }, 'string'],
    ['examples not object', { type: 'integer', examples: 5 }, 0],
    ['enum', { enum: ['a', 'b'] }, 'a'],
    ['empty enum falls through', { type: 'boolean', enum: [] }, true],
    ['nullable type array', { type: ['null', 'integer'] }, 0],
    ['number', { type: 'number' }, 0],
    ['file', { type: 'file' }, 'string'],
    ['unknown type', { type: 'weird' }, 'string'],
    ['untyped', {}, 'string'],
    ['non-object schema', 'str', 'string'],
    ['array via items', { items: { type: 'integer' } }, [0]],
    ['object via properties', { properties: { a: { type: 'boolean' } } }, { a: true }],
    ['oneOf first', { oneOf: [{ type: 'integer' }, { type: 'string' }] }, 0],
    ['anyOf first', { anyOf: [{ type: 'boolean' }] }, true],
    ['empty oneOf', { oneOf: [], type: 'integer' }, 0],
    ['readOnly omitted', { type: 'object', properties: { id: { type: 'integer', readOnly: true }, n: { type: 'string' } } }, { n: 'string' }],
    ['readOnly through $ref omitted', { type: 'object', properties: { id: { $ref: '#/components/schemas/RO' }, n: { type: 'string' } } }, { n: 'string' }],
    ['allOf merged with own props', { allOf: [{ type: 'object', properties: { a: { type: 'integer' } } }], properties: { b: { type: 'boolean' } } }, { a: 0, b: true }],
    ['allOf of scalars', { allOf: [{ type: 'integer' }] }, 0],
    ['allOf of nothing', { allOf: [] }, 'string'],
    ['self reference ends at null', { $ref: '#/components/schemas/Node' }, { child: null }],
    ['dangling $ref', { $ref: '#/components/schemas/Nope' }, 'string'],
  ])('%s', (_n, schema, expected) => {
    const comps = {
      components: {
        examples: { E: { value: 'refd' } },
        schemas: { RO: { type: 'integer', readOnly: true }, Node: { type: 'object', properties: { child: { $ref: '#/components/schemas/Node' } } } },
      },
    };
    expect(body(schema, comps)).toEqual(expected);
  });
  it.each([
    ['date-time', '2024-01-01T00:00:00Z'],
    ['email', 'user@example.com'],
    ['uuid', '00000000-0000-0000-0000-000000000000'],
    ['hostname', 'example.com'],
    ['made-up', 'string'],
  ])('string format %s', (format, expected) => {
    expect(JSON.parse(op({ requestBody: { content: { 'application/json': { schema: { type: 'string', format } } } } }).match(/-d '(.*)'$/)![1]!)).toBe(expected);
  });
  it('stops nesting deeper than 10 levels with null', () => {
    let schema: Record<string, unknown> = { type: 'integer' };
    for (let i = 0; i < 14; i++) schema = { type: 'object', properties: { n: schema } };
    expect(jsonBody(schema)).toContain('null');
  });
});

describe('openApi: security', () => {
  const sec = (schemes: Record<string, unknown>, security: unknown, operation: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    op({ ...operation }, { components: { securitySchemes: schemes }, security, ...extra }, 'get');
  it.each([
    ['basic', { s: { type: 'basic' } }, "-u 'YOUR_USERNAME:YOUR_PASSWORD'"],
    ['http basic', { s: { type: 'http', scheme: 'basic' } }, "-u 'YOUR_USERNAME:YOUR_PASSWORD'"],
    ['http digest', { s: { type: 'http', scheme: 'digest' } }, '--digest'],
    ['http bearer', { s: { type: 'http', scheme: 'Bearer' } }, "-H 'Authorization: Bearer YOUR_BEARER_TOKEN'"],
    ['http custom', { s: { type: 'http', scheme: 'hoba' } }, "-H 'Authorization: hoba YOUR_CREDENTIALS'"],
    ['http without scheme', { s: { type: 'http' } }, "-H 'Authorization: Bearer YOUR_CREDENTIALS'"],
    ['apiKey header', { s: { type: 'apiKey', name: 'X-K', in: 'header' } }, "-H 'X-K: YOUR_API_KEY'"],
    ['apiKey default', { s: { type: 'apiKey' } }, "-H 'api_key: YOUR_API_KEY'"],
    ['apiKey query', { s: { type: 'apiKey', name: 'k', in: 'query' } }, '?k=YOUR_API_KEY'],
    ['apiKey cookie', { s: { type: 'apiKey', name: 'ck', in: 'cookie' } }, "-b 'ck=YOUR_API_KEY'"],
    ['oauth2', { s: { type: 'oauth2' } }, "-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'"],
    ['openIdConnect', { s: { type: 'openIdConnect' } }, "-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'"],
  ])('%s scheme', (_n, schemes, expected) => {
    expect(sec(schemes, [{ s: [] }])).toContain(expected);
  });
  it('unknown scheme type adds nothing', () => {
    const c = sec({ s: { type: 'mutualTLS' } }, [{ s: [] }]);
    expect(c).not.toContain('-H');
    expect(c).not.toContain('-u');
  });
  it('uses the first requirement that names a known scheme, skipping junk', () => {
    const c = sec({ a: { type: 'http', scheme: 'bearer' }, b: { type: 'oauth2' } }, ['junk', { missing: [] }, { a: [] }, { b: [] }]);
    expect(c).toContain('YOUR_BEARER_TOKEN');
    expect(c).not.toContain('YOUR_ACCESS_TOKEN');
  });
  it('applies every scheme inside one requirement (AND)', () => {
    const c = sec({ a: { type: 'apiKey', name: 'X-A' }, b: { type: 'apiKey', name: 'X-B' } }, [{ a: [], b: [] }]);
    expect(c).toContain("-H 'X-A: YOUR_API_KEY'");
    expect(c).toContain("-H 'X-B: YOUR_API_KEY'");
  });
  it('an operation-level empty security list removes root security', () => {
    expect(sec({ s: { type: 'oauth2' } }, [{ s: [] }], { security: [] })).not.toContain('Authorization');
  });
  it('non-array security is ignored', () => {
    expect(sec({ s: { type: 'oauth2' } }, { s: [] })).not.toContain('Authorization');
  });
  it('reads Swagger 2 securityDefinitions and $ref schemes', () => {
    const c = op({}, { securityDefinitions: { s: { $ref: '#/x/real' } }, x: { real: { type: 'oauth2' } }, security: [{ s: [] }] }, 'get');
    expect(c).toContain('YOUR_ACCESS_TOKEN');
  });
  it('no schemes object at all means no credentials', () => {
    expect(op({}, { security: [{ s: [] }] }, 'get')).not.toContain('Authorization');
  });
  it('does not duplicate a header, query or cookie the operation already declares', () => {
    const c = sec(
      { h: { type: 'apiKey', name: 'authorization', in: 'header' }, q: { type: 'apiKey', name: 'k', in: 'query' }, c: { type: 'apiKey', name: 'ck', in: 'cookie' } },
      [{ h: [], q: [], c: [] }],
      { parameters: [{ name: 'Authorization', in: 'header', example: 'mine' }, { name: 'k', in: 'query', example: 'mine' }, { name: 'ck', in: 'cookie', example: 'mine' }] },
    );
    expect(c).toContain("-H 'Authorization: mine'");
    expect(c).not.toContain('YOUR_API_KEY');
  });
  it('an Authorization header suppresses -u', () => {
    const c = sec({ b: { type: 'basic' }, h: { type: 'oauth2' } }, [{ b: [], h: [] }]);
    expect(c).not.toContain('-u');
    expect(c).toContain('Authorization');
  });
});

describe('openApi: request bodies', () => {
  const media = (content: unknown) => op({ requestBody: { content } });
  it('prefers application/json, then any +json type, and sets Content-Type', () => {
    expect(media({ 'text/plain': { example: 'x' }, 'application/vnd.api+json': { example: { a: 1 } } })).toContain("-H 'Content-Type: application/vnd.api+json'");
    expect(media({ 'application/vnd.api+json': { example: 1 }, 'application/json': { example: 2 } })).toContain("-d '2'");
  });
  it('uses media example, then named examples, then schema; empty when none', () => {
    expect(media({ 'application/json': { example: { a: 1 } } })).toContain('"a": 1');
    expect(media({ 'application/json': { examples: { x: { value: { b: 2 } } } } })).toContain('"b": 2');
    expect(media({ 'application/json': {} })).not.toContain('-d');
  });
  it('keeps an already serialised JSON string example verbatim and quotes a plain string', () => {
    expect(media({ 'application/json': { example: '{"a":1}' } })).toContain(`-d '{"a":1}'`);
    expect(media({ 'application/json': { example: 'plain' } })).toContain(`-d '"plain"'`);
  });
  it('does not override an existing Content-Type header', () => {
    const c = op({ parameters: [{ name: 'content-type', in: 'header', example: 'application/json;v=2' }], requestBody: { content: { 'application/json': { example: 1 } } } });
    expect(c.match(/Content-Type/gi)).toHaveLength(1);
  });
  it('multipart: files, text, json parts, literal @ values, readOnly skipped, allOf and $ref schemas', () => {
    const full = op(
      { requestBody: { content: { 'multipart/form-data': { schema: { allOf: [{ $ref: '#/components/schemas/Base' }], properties: { photo: { type: 'string', format: 'binary' }, docs: { type: 'array', items: { type: 'file' } }, meta: { type: 'object', properties: { a: { type: 'integer' } } }, tag: { type: 'array', items: { type: 'string', example: '@x' } }, id: { type: 'integer', readOnly: true } } }, example: { title: 'T' } } } } },
      { components: { schemas: { Base: { properties: { title: { type: 'string' } } } } } },
    );
    expect(full).toContain("-F 'photo=@path/to/file'");
    expect(full).toContain("-F 'docs=@path/to/file'");
    expect(full).toContain('-F \'meta={"a":0};type=application/json\'');
    expect(full).toContain("--form-string 'tag=@x'");
    expect(full).toContain("-F 'title=T'");
    expect(full).not.toContain('id=');
  });
  it('multipart with no properties yields no body', () => {
    expect(media({ 'multipart/form-data': { schema: { type: 'object' } } })).not.toContain('-F');
  });
  it('urlencoded: encodes pairs, expands arrays, skips readOnly; empty when no fields', () => {
    const c = media({ 'application/x-www-form-urlencoded': { schema: { properties: { 'a b': { type: 'string', example: 'x&y' }, l: { type: 'array', items: { type: 'integer' } }, r: { type: 'integer', readOnly: true } } } } });
    expect(c).toContain("-d 'a%20b=x%26y&l=0'");
    expect(c).not.toContain('r=');
    expect(media({ 'application/x-www-form-urlencoded': {} })).not.toContain('-d');
  });
  it('falls back to the first string example of any other media type', () => {
    expect(media({ 'text/plain': { example: 'hello' } })).toContain("-H 'Content-Type: text/plain'");
    expect(media({ 'text/plain': { example: 5 } })).not.toContain('-d');
    expect(media({ 'text/plain': 'junk' })).not.toContain('-d');
  });
  it('a body on GET adds -X GET', () => {
    expect(op({ requestBody: { content: { 'application/json': { example: 1 } } } }, {}, 'get')).toContain('-X GET');
  });
  it('requestBody via $ref', () => {
    const c = op({ requestBody: { $ref: '#/components/requestBodies/B' } }, { components: { requestBodies: { B: { content: { 'application/json': { example: 7 } } } } } });
    expect(c).toContain("-d '7'");
  });
});

describe('openApi: Swagger 2 bodies', () => {
  const sw = (operation: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    flat(parseOpenApiSpec({ swagger: '2.0', info: { title: 't', version: '1' }, host: 'h.test', paths: { '/p': { post: operation } }, ...extra } as unknown as OpenApiSpec)[0]!.curlCommand);
  it('body parameter: json by default, consumes preferred, x-example wins', () => {
    expect(sw({ parameters: [{ name: 'b', in: 'body', schema: { type: 'integer' } }] })).toContain("-H 'Content-Type: application/json'");
    expect(sw({ consumes: ['text/plain', 'application/json'], parameters: [{ name: 'b', in: 'body', 'x-example': { a: 1 }, schema: {} }] })).toContain('"a": 1');
    expect(sw({ consumes: ['text/plain'], parameters: [{ name: 'b', in: 'body', schema: { type: 'integer' } }] })).toContain("-H 'Content-Type: text/plain' \\ -d '0'".replace(' \\', ''));
  });
  it('spec-level consumes are used when the operation has none', () => {
    expect(sw({ parameters: [{ name: 'b', in: 'body', schema: { type: 'integer' } }] }, { consumes: ['application/xml'] })).toContain('application/xml');
  });
  it.each([
    ['file => multipart', [{ name: 'f', in: 'formData', type: 'file' }], undefined, "-F 'f=@path/to/file'"],
    ['urlencoded consumes', [{ name: 'a', in: 'formData', type: 'string', 'x-example': 'v' }], ['application/x-www-form-urlencoded'], "-d 'a=v'"],
    ['multipart consumes', [{ name: 'a', in: 'formData', type: 'string', 'x-example': 'v' }], ['multipart/form-data'], "-F 'a=v'"],
    ['no consumes => multipart', [{ name: 'a', in: 'formData', type: 'string', 'x-example': 'v' }], undefined, "-F 'a=v'"],
  ])('formData %s', (_n, parameters, consumes, expected) => {
    expect(sw({ parameters, ...(consumes ? { consumes } : {}) })).toContain(expected);
  });
  it('no body or form params means no body', () => {
    expect(sw({ parameters: [{ name: 'q', in: 'query', type: 'string' }] })).not.toContain('-d');
  });
});
