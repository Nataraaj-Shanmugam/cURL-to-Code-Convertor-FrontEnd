/* eslint-disable @typescript-eslint/no-explicit-any -- loose fixtures for deliberately malformed/untyped inputs */
import { describe, it, expect } from 'vitest';
import {
  MASK,
  REDACTED_PLACEHOLDER as R,
  isSecretName,
  isSecretHeaderName,
  isSecretField,
  isRedactedValue,
  redactAuthorizationValue,
  redactBodyString,
  redactCookieString,
  redactCurlString,
  redactFieldValue,
  redactHeaderValue,
  redactParsedCurl,
  redactText,
  redactUrlString,
  listSecretFields,
  maskParsedCurl,
  collectSecretValues,
  countRedactions,
  containsRedaction,
} from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123_-sig';
const parsed = (extra: Record<string, unknown>) => ({ url: 'https://h.test', method: 'GET', ...extra }) as unknown as ParsedCurl;
const red = (extra: Record<string, unknown>, opts = {}) => redactParsedCurl(parsed(extra), opts) as unknown as Record<string, any>;

describe('redaction: name tests', () => {
  it.each([
    ['api_key', true], ['X-Auth-Token', true], ['password', true], ['passwd', true], ['client_secret', true],
    ['sessionId', true], ['X-Hub-Signature-256', true], ['csrf', true], ['code', true], ['user_pin', true],
    ['otpCode', true], ['X-Pass', true], ['sig', true],
    ['shipping', false], ['design', false], ['compass', false], ['footprint', false], ['name', false], ['', false],
    ['Code-Review', false], ['passenger', false],
  ])('isSecretName(%j) -> %s', (name, expected) => {
    expect(isSecretName(name)).toBe(expected);
  });
  it('isSecretHeaderName covers always-secret headers case-insensitively and with padding', () => {
    for (const n of [' Authorization ', 'PROXY-AUTHORIZATION', 'Cookie', 'set-cookie', 'X-Api-Key']) expect(isSecretHeaderName(n)).toBe(true);
    for (const n of ['Accept', 'Content-Type', 'X-Request-Id']) expect(isSecretHeaderName(n)).toBe(false);
  });
});

describe('redaction: value helpers', () => {
  it.each([
    ['Bearer abc', `Bearer ${R}`],
    ['  basic   dXNlcjpwdw==  ', `basic ${R}`],
    ['Digest username="u", response="r"', `Digest ${R}`],
    ['AWS4-HMAC-SHA256 Credential=x', `AWS4-HMAC-SHA256 ${R}`],
    ['rawtokenwithoutscheme', R],
    ['Unknown scheme', R],
    ['', ''],
    ['   ', '   '],
  ])('redactAuthorizationValue(%j)', (input, expected) => {
    expect(redactAuthorizationValue(input)).toBe(expected);
  });
  it.each([
    ['a=1; b=2', `a=${R}; b=${R}`],
    ['sid=abc; Path=/; HttpOnly; Secure', `sid=${R}; Path=/; HttpOnly; Secure`],
    ['a=; b=2', `a=; b=${R}`],
    ['flagonly', 'flagonly'],
    ['', ''],
    ['a= spaced ', `a= ${R}`],
    ['Max-Age=10; Expires=Wed', 'Max-Age=10; Expires=Wed'],
  ])('redactCookieString(%j)', (input, expected) => {
    expect(redactCookieString(input)).toBe(expected);
  });
  it.each([
    ['https://user:pw@h.test/p', `https://${R}@h.test/p`],
    ['https://h.test/?token=abc&x=1', `https://h.test/?token=${R}&x=1`],
    ['https://h.test/?to%6Ben=abc', `https://h.test/?to%6Ben=${R}`],
    ['https://h.test/#access_token=abc&state=ok', `https://h.test/#access_token=${R}&state=ok`],
    ['https://h.test/?token=&x=1', 'https://h.test/?token=&x=1'],
    ['https://h.test/?a=1', 'https://h.test/?a=1'],
    [`https://h.test/?x=${JWT}`, `https://h.test/?x=${R}`],
    ['', ''],
  ])('redactUrlString(%j)', (input, expected) => {
    expect(redactUrlString(input)).toBe(expected);
  });
  it.each([
    ['Authorization', 'Bearer abc', `Bearer ${R}`],
    ['proxy-authorization', 'Basic xyz', `Basic ${R}`],
    ['Cookie', 'a=1', `a=${R}`],
    ['Set-Cookie', 'a=1; Path=/', `a=${R}; Path=/`],
    ['X-Api-Key', 'k', R],
    ['Referer', 'https://h.test/?token=t', `https://h.test/?token=${R}`],
    ['Accept', 'text/html', 'text/html'],
  ])('redactHeaderValue(%s)', (name, value, expected) => {
    expect(redactHeaderValue(name, value)).toBe(expected);
  });
  it('non-string header values: secret names mask leaves, others are cloned', () => {
    expect(redactHeaderValue('X-Api-Key', ['a', 2, true, null, { n: 'x' }])).toEqual([R, R, true, null, { n: R }]);
    const original = { a: [1] };
    const copy = redactHeaderValue('X-Other', original) as typeof original;
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.a).not.toBe(original.a);
    expect(redactHeaderValue('X-Other', 5)).toBe(5);
  });
  it('custom placeholder, collect and idempotence', () => {
    const seen: string[] = [];
    const once = redactHeaderValue('X-Api-Key', 'secret', { placeholder: MASK, collect: (s) => seen.push(s) });
    expect(once).toBe(MASK);
    expect(seen).toEqual(['secret']);
    expect(redactHeaderValue('X-Api-Key', MASK, { placeholder: MASK, collect: (s) => seen.push(s) })).toBe(MASK);
    expect(redactHeaderValue('X-Api-Key', R)).toBe(R);
    expect(seen).toEqual(['secret']);
  });
});

describe('redaction: bodies', () => {
  it.each([
    ['json secret key', '{"password":"p","name":"n"}', `{"password":"${R}","name":"n"}`],
    ['json pretty keeps indentation', '{\n"token":"t"}', `{\n  "token": "${R}"\n}`],
    ['json without secrets is returned untouched', '{ "a" :  1 }', '{ "a" :  1 }'],
    ['json array of objects', '[{"secret":"s"},{"a":1}]', `[{"secret":"${R}"},{"a":1}]`],
    ['json booleans and null stay', '{"token":true,"key":null}', '{"token":true,"key":null}'],
    ['json numeric secret', '{"pin":1234}', `{"pin":"${R}"}`],
    ['nested stringified json', '{"payload":"{\\"token\\":\\"x\\"}"}', `{"payload":"{\\"token\\":\\"${R}\\"}"}`],
    ['name/value pair list', '[{"name":"Authorization","value":"Bearer b"}]', `[{"name":"Authorization","value":"Bearer ${R}"}]`],
    ['key/value pair list: "key" is itself a secret name so both leaves are masked', '[{"key":"X-Api-Key","value":"k"}]', `[{"key":"${R}","value":"${R}"}]`],
    ['form encoded', 'user=bob&password=p%40ss&note=hi', `user=bob&password=${R}&note=hi`],
    ['form with file ref untouched', 'password=@file.txt', 'password=@file.txt'],
    ['form empty value untouched', 'password=&a=1', 'password=&a=1'],
    ['leading ampersand form', '&token=abc', `&token=${R}`],
    ['empty', '', ''],
  ])('redactBodyString: %s', (_n, input, expected) => {
    expect(redactBodyString(input)).toBe(expected);
  });
  it('malformed JSON falls back to text redaction rather than throwing', () => {
    const out = redactBodyString('{"password": "hunter2", ');
    expect(out).not.toContain('hunter2');
  });
  it('plain text goes through redactText; JWTs are scrubbed everywhere', () => {
    expect(redactBodyString('password: "hunter22"')).not.toContain('hunter22');
    expect(redactBodyString(`a=${JWT}`)).not.toContain(JWT);
    expect(redactText(`see ${JWT} now`)).not.toContain(JWT);
  });
  it('unwrapping stops after a bounded depth instead of recursing forever', () => {
    let v: unknown = { token: 'deepsecret' };
    for (let i = 0; i < 8; i++) v = { wrap: JSON.stringify(v) };
    expect(() => redactBodyString(JSON.stringify(v))).not.toThrow();
  });
  it('handles unicode and very large bodies', () => {
    expect(redactBodyString('{"password":"пароль🔑","名":"值"}')).toBe(`{"password":"${R}","名":"值"}`);
    const big = JSON.stringify({ items: Array.from({ length: 5000 }, (_, i) => ({ id: i, token: `t${i}` })) });
    const out = redactBodyString(big);
    expect(out).not.toMatch(/"t\d+"/);
    expect(out.match(new RegExp(R.replace(/[[\]]/g, '\\$&'), 'g'))).toHaveLength(5000);
  });
});

describe('redaction: parsed curl sections', () => {
  it('headers object and non-object forms', () => {
    const r = red({ headers: { Authorization: 'Bearer abc', Accept: 'x', 'X-Api-Key': 'k' } });
    expect(r.headers).toEqual({ Authorization: `Bearer ${R}`, Accept: 'x', 'X-Api-Key': R });
    const list = red({ headers: [{ name: 'Authorization', value: 'Bearer q' }, 'junk'] });
    expect(list.headers).toEqual([{ name: 'Authorization', value: `Bearer ${R}` }, 'junk']);
  });
  it('cookies as string and as object', () => {
    expect(red({ cookies: 'a=1; b=2' }).cookies).toBe(`a=${R}; b=${R}`);
    expect(red({ cookies: { a: '1', b: 2 } }).cookies).toEqual({ a: R, b: R });
  });
  it('query_params and form_data keyed records', () => {
    const r = red({ query_params: { token: 'abc', page: '1' }, form_data: { password: 'p', name: 'n' } });
    expect(r.query_params).toEqual({ token: R, page: '1' });
    expect(r.form_data).toEqual({ password: R, name: 'n' });
  });
  it('data / raw_data as string and as structured value', () => {
    expect(red({ data: '{"token":"t"}' }).data).toBe(`{"token":"${R}"}`);
    expect(red({ raw_data: { password: 'p', ok: 'fine' } }).raw_data).toEqual({ password: R, ok: 'fine' });
    expect(red({ data: [{ secret: 's' }] }).data).toEqual([{ secret: R }]);
  });
  it('url fields: string redacted, non-string cloned', () => {
    expect(red({ url: 'https://u:p@h.test/?token=t' }).url).toBe(`https://${R}@h.test/?token=${R}`);
    const nested = { a: 1 };
    expect(red({ url: nested }).url).toEqual(nested);
  });
  it('path_parameters as list and as map', () => {
    const list = red({ path_parameters: [{ name: 'api_key', value: 'v' }, { name: 'id', value: '7' }, 'x', null] });
    expect(list.path_parameters).toEqual([{ name: 'api_key', value: R }, { name: 'id', value: '7' }, 'x', null]);
    const map = red({ path_parameters: { a: { key: 'token', value: 'v' }, b: { name: 'id', value: '1' }, c: 'plain' } });
    expect(map.path_parameters).toEqual({ a: { key: 'token', value: R }, b: { name: 'id', value: '1' }, c: 'plain' });
    expect(red({ path_parameters: 'oops' }).path_parameters).toBe('oops');
  });
  it('auth_config keeps descriptive keys and masks credentials', () => {
    const r = red({ auth_config: { type: 'basic', scheme: 'x', realm: 'r', username: 'u', password: 'p', nested: { tokenValue: 't' } } });
    expect(r.auth_config).toEqual({ type: 'basic', scheme: 'x', realm: 'r', username: R, password: R, nested: { tokenValue: R } });
  });
  it('other *_config sections mask credential-ish keys only', () => {
    const r = red({ proxy_config: { proxy_user: 'u', proxy_password: 'p', host: 'h', port: 8080 }, ftp_config: { user: 'bob', path: '/x' } });
    expect(r.proxy_config.host).toBe('h');
    expect(r.proxy_config.port).toBe(8080);
    expect(r.proxy_config.proxy_user).toBe(R);
    expect(r.proxy_config.proxy_password).toBe(R);
    expect(r.ftp_config).toEqual({ user: R, path: '/x' });
  });
  it('unknown sections go through the generic redactor, including JWTs under innocent names', () => {
    const r = red({ extra: { note: 'ok', apiKey: 'k', list: [{ secret: 's' }, 'plain'], deep: { token: 't' } }, weird: JWT });
    expect(r.extra).toEqual({ note: 'ok', apiKey: R, list: [{ secret: R }, 'plain'], deep: { token: R } });
    expect(r.weird).toBe(R);
  });
  it('null, undefined and missing sections pass through; input is not mutated', () => {
    const input = parsed({ headers: { Authorization: 'Bearer abc' }, cookies: null, data: undefined });
    const snapshot = JSON.stringify(input);
    const out = redactParsedCurl(input) as unknown as Record<string, unknown>;
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(out.cookies).toBeNull();
    expect(out.data).toBeUndefined();
  });
  it('knownSecrets are scrubbed from free text, but only when long enough', () => {
    const r = red({ data: 'hello superlongsecret and abc' }, { knownSecrets: ['superlongsecret', 'abc'] });
    expect(r.data).not.toContain('superlongsecret');
    expect(r.data).toContain('abc');
  });
});

describe('redaction: curl strings', () => {
  it.each([
    ["curl -u bob:pw https://h.test", 'bob', 'pw'],
    ["curl --user 'bob:pw' https://h.test", 'bob', 'pw'],
    ["curl --proxy-user bob:pw https://h.test", 'bob', 'pw'],
    ["curl -u onlyuser https://h.test", 'onlyuser', undefined],
    ["curl --oauth2-bearer tok123456 https://h.test", 'tok123456', undefined],
    ["curl --pass phrase99 https://h.test", 'phrase99', undefined],
    ["curl -H 'Authorization: Bearer abcdef' https://h.test", 'abcdef', undefined],
    ["curl --header 'X-Api-Key: abcdef' https://h.test", 'abcdef', undefined],
    ["curl --proxy-header 'Authorization: Basic abcdef' https://h.test", 'abcdef', undefined],
    ["curl -b 'sid=abcdef' https://h.test", 'abcdef', undefined],
    ["curl --cookie 'sid=abcdef' https://h.test", 'abcdef', undefined],
    ["curl -d 'password=abcdef' https://h.test", 'abcdef', undefined],
    ["curl --data-raw '{\"token\":\"abcdef\"}' https://h.test", 'abcdef', undefined],
    ["curl --json '{\"token\":\"abcdef\"}' https://h.test", 'abcdef', undefined],
    ["curl -F 'password=abcdef' https://h.test", 'abcdef', undefined],
    ["curl --form-string 'token=abcdef' https://h.test", 'abcdef', undefined],
    ["curl 'https://h.test/?token=abcdef'", 'abcdef', undefined],
    ["curl -H \"Authorization: Bearer abcdef\" https://h.test", 'abcdef', undefined],
    [`curl -H 'X-Foo: ${JWT}' https://h.test`, JWT, undefined],
  ])('%s', (input, secret, secret2) => {
    const out = redactCurlString(input);
    expect(out).not.toContain(secret);
    if (secret2) expect(out).not.toContain(secret2);
    expect(out).toContain('h.test');
    expect(out.startsWith('curl')).toBe(true);
  });
  it('leaves non-secret flags, methods and URLs intact', () => {
    const input = "curl -X POST -H 'Accept: application/json' -d 'a=1' https://h.test/x";
    expect(redactCurlString(input)).toBe(input);
  });
  it('a header with no colon and cookie without = are preserved', () => {
    expect(redactCurlString("curl -H 'nocolon' -b 'file.txt' https://h.test")).toBe("curl -H 'nocolon' -b 'file.txt' https://h.test");
  });
  it('is idempotent and tolerant of empty/odd input', () => {
    const once = redactCurlString("curl -u a:b -H 'Authorization: Bearer abcdef' https://h.test");
    expect(redactCurlString(once)).toBe(once);
    expect(redactCurlString('')).toBe('');
    expect(redactCurlString('not a curl command')).toBe('not a curl command');
    expect(redactCurlString("curl -d")).toBe('curl -d');
  });
  it('reports every redacted secret through collect', () => {
    const seen: string[] = [];
    redactCurlString("curl -u bob:pw -H 'X-Api-Key: kkkkkk' https://h.test", { collect: (s) => seen.push(s) });
    expect(seen).toEqual(expect.arrayContaining(['bob', 'pw', 'kkkkkk']));
  });
});

describe('redaction: fields, masking and discovery', () => {
  it.each([
    ['headers.Authorization', 'Bearer abc', true],
    ['headers.Accept', 'x', false],
    ['data.user.password', 'p', true],
    ['data.user.name', 'n', false],
    ['data.items[0].token', 't', true],
    ['query_params.token', 't', true],
    ['cookies', 'a=1', true],
    ['headers.Authorization', null, false],
    ['headers.Authorization', undefined, false],
  ])('isSecretField(%s)', (path, value, expected) => {
    expect(isSecretField(path, value)).toBe(expected);
  });
  it('redactFieldValue returns the value unchanged for a non-secret path and for unreachable shapes', () => {
    expect(redactFieldValue('headers.Accept', 'x')).toBe('x');
    expect(redactFieldValue('data.a', 'plain')).toBe('plain');
    expect(redactFieldValue('data.password', 'p')).toBe(R);
    expect(redactFieldValue('data.a.b.token', 'p')).toBe(R);
  });
  it('listSecretFields finds nested secret locations with labels', () => {
    const fields = listSecretFields(parsed({ headers: { Authorization: 'Bearer abcdef', Accept: 'x' }, data: { users: [{ password: 'p' }] }, cookies: 'a=1' }));
    const labels = fields.map((f) => f.label);
    expect(labels).toEqual(expect.arrayContaining(['headers.Authorization', 'cookies']));
    expect(labels.some((l) => l.includes('password'))).toBe(true);
    expect(labels).not.toContain('headers.Accept');
    for (const f of fields) expect(JSON.parse(f.id)).toEqual(f.path);
  });
  it('listSecretFields is empty when nothing is secret', () => {
    expect(listSecretFields(parsed({ headers: { Accept: 'x' } }))).toEqual([]);
  });
  it('maskParsedCurl hides everything, but a revealed id stays visible', () => {
    const p = parsed({ headers: { Authorization: 'Bearer abcdef', 'X-Api-Key': 'kkkkkk' } });
    const masked = maskParsedCurl(p) as unknown as Record<string, any>;
    expect(masked.headers.Authorization).toContain(MASK);
    const id = listSecretFields(p).find((f) => f.label === 'headers.Authorization')!.id;
    const partial = maskParsedCurl(p, new Set([id])) as unknown as Record<string, any>;
    expect(partial.headers.Authorization).toBe('Bearer abcdef');
    expect(partial.headers['X-Api-Key']).toContain(MASK);
  });
  it('collectSecretValues returns the real secret strings', () => {
    const values = collectSecretValues(parsed({ headers: { 'X-Api-Key': 'kkkkkk' }, data: { password: 'pppppp' } }));
    expect(values).toEqual(expect.arrayContaining(['kkkkkk', 'pppppp']));
    expect(collectSecretValues(parsed({}))).toEqual([]);
  });
  it('countRedactions / containsRedaction / isRedactedValue', () => {
    expect(countRedactions(`a ${R} b ${R}`)).toBe(2);
    expect(countRedactions({ a: [R, { b: R }], c: 5, d: null })).toBe(2);
    expect(countRedactions(5)).toBe(0);
    expect(countRedactions(null)).toBe(0);
    expect(containsRedaction({ a: R })).toBe(true);
    expect(containsRedaction('clean')).toBe(false);
    expect(isRedactedValue(`x${R}`)).toBe(true);
    expect(isRedactedValue('x')).toBe(false);
    expect(isRedactedValue(5)).toBe(false);
  });
});

describe('redactText: free-text patterns (generated code, logs, raw HTTP)', () => {
  it.each([
    ['REST Assured cookie', '.cookie("sid", "abcdef")', '.cookie("sid", "' + R + '")'],
    ['REST Assured cookies pairs', '.cookies("a", "1", "b", "2")', '.cookies("a", "' + R + '", "b", "' + R + '")'],
    ['REST Assured basic', '.auth().basic("bob", "pw")', '.auth().basic("' + R + '", "' + R + '")'],
    ['REST Assured oauth2', '.oauth2("tok")', '.oauth2("' + R + '")'],
    ['setter', 'setPassword("hunter22")', 'setPassword("' + R + '")'],
    ['builder', '.apiKey("abc")', '.apiKey("' + R + '")'],
    ['non-secret setter untouched', 'setName("bob")', 'setName("bob")'],
    ['empty setter value untouched', 'setPassword("")', 'setPassword("")'],
    ['unquoted js name', 'const x = { password: "hunter22" }', 'const x = { password: "' + R + '" }'],
    ['java local', 'String token = "abc123";', 'String token = "' + R + '";'],
    ['non-secret name untouched', 'String name = "bob";', 'String name = "bob";'],
    ['authorization header line', 'Authorization: Bearer abc', 'Authorization: Bearer ' + R],
    ['cookie header line', 'Cookie: a=1; b=2', 'Cookie: a=' + R + '; b=' + R],
    ['set-cookie header line', 'Set-Cookie: sid=1; Path=/', 'Set-Cookie: sid=' + R + '; Path=/'],
    ['header literal pair', '.header("Authorization", "Bearer abc")', '.header("Authorization", "Bearer ' + R + '")'],
    ['concatenated literal value', '.header("Authorization", "Bearer " + "abc")', '.header("Authorization", "Bearer ' + R + '")'],
    ['single-quoted pair', "{'X-Api-Key': 'kkk'}", "{'X-Api-Key': '" + R + "'}"],
    ['escaped-quote json', '{\\"password\\": \\"p1\\"}', '{\\"password\\": \\"' + R + '\\"}'],
    ['container under secret key', '{"auth": {"u": "a", "p": "b"}, "n": "ok"}', '{"auth": {"u": "' + R + '", "p": "' + R + '"}, "n": "ok"}'],
    ['array container', '{"tokens": ["a", "b"]}', '{"tokens": ["' + R + '", "' + R + '"]}'],
    ['userinfo and query', 'GET https://u:p@h.test/?token=abc', 'GET https://' + R + '@h.test/?token=' + R],
    ['attached -u', 'curl -ubob:pw https://h.test', 'curl -u' + R + ':' + R + ' https://h.test'],
    ['cookie jar name preserved', 'curl -b cookies.txt https://h.test', 'curl -b cookies.txt https://h.test'],
    ['attached cookie', 'curl -bsid=abcdef https://h.test', 'curl -bsid=' + R + ' https://h.test'],
    ['--data=@file preserved', "curl --data='@body.json' https://h.test", "curl --data='@body.json' https://h.test"],
    ['json data left to literal pairs', `curl -d '{"password":"abc"}' https://h.test`, `curl -d '{"password":"${R}"}' https://h.test`],
    ['empty', '', ''],
    ['plain prose', 'nothing secret here', 'nothing secret here'],
  ])('%s', (_n, input, expected) => {
    expect(redactText(input)).toBe(expected);
  });
  it('knownSecrets: plain, JSON-escaped and URL-encoded variants; short and placeholder values skipped', () => {
    const secret = 'p@ss"word 99';
    const text = `a ${secret} b ${JSON.stringify(secret).slice(1, -1)} c ${encodeURIComponent(secret)} d short`;
    const out = redactText(text, { knownSecrets: [secret, 'short', R] });
    expect(out).not.toContain('99');
    expect(out).toContain('short');
    expect(out.match(/\[REDACTED\]/g)).toHaveLength(3);
  });
  it('is idempotent', () => {
    const once = redactText('{"password":"abc","auth":{"u":"x"}} Authorization: Bearer zzz');
    expect(redactText(once)).toBe(once);
  });
});
