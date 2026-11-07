import { describe, it, expect } from 'vitest';
import { reconstructCurl, bodyToString } from '@/lib/utils/curlReconstructor';
import type { ParsedCurl } from '@/types/curl';

const base = { method: 'GET', base_url: 'https://a.test', endpoint: '/x' } as unknown as ParsedCurl;
const flat = (c: string) => c.replace(/ \\\n\s*/g, ' ');
const rc = (extra: Record<string, unknown>) => flat(reconstructCurl({ ...base, ...extra } as ParsedCurl));

describe('bodyToString (table)', () => {
  it.each([
    [undefined, ''], [null, ''], ['', ''], ['text', 'text'], [0, '0'], [false, 'false'], [true, 'true'],
    [{}, '{}'], [[], '[]'], [{ a: 1 }, '{\n  "a": 1\n}'], [[1, 'é'], '[\n  1,\n  "é"\n]'], ['0', '0'],
  ])('%j -> %j', (input, expected) => {
    expect(bodyToString(input as never)).toBe(expected);
  });
});

describe('reconstructCurl: methods', () => {
  it.each([
    ['GET', {}, "curl 'https://a.test/x'"],
    ['', {}, "curl 'https://a.test/x'"],
    ['get', {}, "curl 'https://a.test/x'"],
    ['HEAD', {}, "curl -I 'https://a.test/x'"],
    ['head', { data: 'x' }, "curl -X HEAD 'https://a.test/x' -d 'x'"],
    ['POST', {}, "curl -X POST 'https://a.test/x'"],
    ['delete', {}, "curl -X DELETE 'https://a.test/x'"],
    ['PATCH', { form_data: { a: 'b' } }, "curl -X PATCH 'https://a.test/x' -F 'a=b'"],
    ['GET', { form_data: { a: 'b' } }, "curl -X GET 'https://a.test/x' -F 'a=b'"],
  ])('method %j', (method, extra, expected) => {
    expect(rc({ method, ...extra })).toBe(expected);
  });
  it('empty form_data is not a body; a non-object form_data is ignored', () => {
    expect(rc({ form_data: {} })).toBe("curl 'https://a.test/x'");
    expect(rc({ form_data: 'x' })).toBe("curl 'https://a.test/x'");
    expect(rc({ form_data: ['a'] })).not.toContain('-F');
  });
  it('a body wins over form data; object bodies are pretty-printed; quotes are shell-escaped', () => {
    const c = rc({ method: 'POST', data: { n: "it's" }, form_data: { a: 'b' } });
    expect(c).toContain(`-d '{\n  "n": "it'\\''s"\n}'`);
    expect(c).not.toContain('-F');
  });
});

describe('reconstructCurl: transfer options', () => {
  it.each([
    ['compressed in transfer_config', { transfer_config: { compressed: true } }, '--compressed'],
    ['compressed as string', { transfer_config: { compressed: 'true' } }, '--compressed'],
    ['compressed top level', { compressed: true }, '--compressed'],
    ['dashed key normalised', { network_config: { '--compressed': true } }, '--compressed'],
    ['follow_redirects', { protocol_config: { follow_redirects: true } }, ' -L '],
    ['location flag', { misc_flags: { location: 'true' } }, ' -L '],
    ['short -L key', { flags: { L: true } }, ' -L '],
    ['follow_location in auth_config section', { auth_config: { follow_location: true } }, ' -L '],
    ['max-redirs with follow', { transfer_config: { location: true, max_redirs: 5 } }, '--max-redirs 5'],
  ])('%s', (_n, extra, fragment) => {
    expect(rc(extra) + ' ').toContain(fragment);
  });
  it.each([
    ['false flag', { transfer_config: { compressed: false } }],
    ['string false', { transfer_config: { compressed: 'false' } }],
    ['null value', { transfer_config: { compressed: null } }],
    ['max_redirs without follow', { transfer_config: { max_redirs: 5 } }],
    ['section is not an object', { transfer_config: 'x' }],
  ])('%s adds nothing', (_n, extra) => {
    expect(rc(extra)).toBe("curl 'https://a.test/x'");
  });
  it('only a numeric max_redirs is emitted (a string value is dropped, -L stays)', () => {
    expect(rc({ transfer_config: { location: true, max_redirs: '5' } })).toBe("curl -L 'https://a.test/x'");
  });
  it('a top-level null does not shadow a section value', () => {
    expect(rc({ compressed: null, transfer_config: { compressed: true } })).toContain('--compressed');
  });
  it('insecure flag adds -k', () => {
    expect(rc({ ssl_config: { insecure: true } })).toContain(' -k ');
  });
});

describe('reconstructCurl: proxy', () => {
  it.each([
    ['proxy key', { proxy_config: { proxy: 'http://p:1' } }, "-x 'http://p:1'", undefined],
    ['proxy_url key', { proxy_config: { proxy_url: 'http://p:2' } }, "-x 'http://p:2'", undefined],
    ['url key inside the section', { proxy_config: { url: 'http://p:3' } }, "-x 'http://p:3'", undefined],
    ['top-level proxy', { proxy: 'http://p:4' }, "-x 'http://p:4'", undefined],
    ['user variants', { proxy_config: { proxy: 'http://p', proxy_userpwd: 'a:b' } }, "-U 'a:b'", undefined],
    ['credentials variant', { proxy_config: { proxy_credentials: 'c:d' } }, "-U 'c:d'", undefined],
    ['short u', { proxy_config: { u: 'e:f' } }, "-U 'e:f'", undefined],
  ])('%s', (_n, extra, expected) => {
    expect(rc(extra)).toContain(expected);
  });
  it('ignores empty and non-string proxy values and a non-object section; top-level url is not a proxy', () => {
    expect(rc({ proxy_config: { proxy: '', proxy_user: 5 } })).toBe("curl 'https://a.test/x'");
    expect(rc({ proxy_config: 'x' })).toBe("curl 'https://a.test/x'");
    expect(rc({ url: 'https://a.test/x' })).not.toContain('-x');
  });
});

describe('reconstructCurl: credentials', () => {
  it.each([
    ['string auth', { auth_config: 'bob:pw' }, ["-u 'bob:pw'"], []],
    ['empty string auth', { auth_config: '' }, [], ['-u']],
    ['legacy auth key', { auth: 'x:y' }, ["-u 'x:y'"], []],
    ['username + password', { auth_config: { username: 'u', password: 'p' } }, ["-u 'u:p'"], ['--digest']],
    ['user/pass aliases', { auth_config: { user: 'u', pass: 'p' } }, ["-u 'u:p'"], []],
    ['login/pwd aliases', { auth_config: { login: 'u', pwd: 'p' } }, ["-u 'u:p'"], []],
    ['username already has colon', { auth_config: { username: 'u:p', password: 'zzz' } }, ["-u 'u:p'"], ['zzz']],
    ['no password', { auth_config: { username: 'u' } }, ["-u 'u'"], []],
    ['numeric username', { auth_config: { username: 0 } }, ["-u '0'"], []],
    ['digest via auth_type', { auth_config: { auth_type: 'DIGEST', username: 'u', password: 'p' } }, ['--digest', "-u 'u:p'"], []],
    ['ntlm via scheme', { auth_config: { scheme: 'ntlm', username: 'u', password: 'p' } }, ['--ntlm'], []],
    ['blank username', { auth_config: { username: '', password: 'p' } }, [], ['-u']],
    ['non-object non-string', { auth_config: 5 }, [], ['-u']],
    ['array auth', { auth_config: ['a'] }, [], ['-u']],
  ])('%s', (_n, extra, has, hasNot) => {
    const c = rc(extra);
    for (const h of has) expect(c).toContain(h);
    for (const h of hasNot) expect(c).not.toContain(h);
  });
  it('bearer token becomes an Authorization header unless one exists', () => {
    for (const key of ['token', 'bearer_token', 'access_token']) {
      expect(rc({ auth_config: { type: 'bearer', [key]: 'T' } })).toContain("-H 'Authorization: Bearer T'");
    }
    expect(rc({ auth_config: { auth_type: 'Bearer', token: 'T' } })).toContain('Bearer T');
    expect(rc({ headers: { authorization: 'mine' }, auth_config: { type: 'bearer', token: 'T' } })).not.toContain('Bearer');
    expect(rc({ auth_config: { type: 'bearer', token: '' } })).not.toContain('Authorization');
    expect(rc({ auth_config: { type: 'basic', token: 'T' } })).not.toContain('Bearer');
    expect(rc({ auth_config: 'x:y' })).not.toContain('Bearer');
  });
});

describe('reconstructCurl: headers, cookies, agents', () => {
  it('headers keep order and escape quotes; non-object headers are ignored', () => {
    expect(rc({ headers: { B: '1', A: "it's" } })).toBe(`curl 'https://a.test/x' -H 'B: 1' -H 'A: it'\\''s'`);
    expect(rc({ headers: [['A', 'b']] })).toBe("curl 'https://a.test/x'");
    expect(rc({ headers: null })).toBe("curl 'https://a.test/x'");
  });
  it('user_agent and referer use -A / -e unless a header already provides them', () => {
    expect(rc({ user_agent: 'UA/1', referer: 'https://r.test' })).toContain("-A 'UA/1' -e 'https://r.test'");
    expect(rc({ headers: { 'User-Agent': 'h' }, user_agent: 'UA' })).not.toContain(' -A ');
    expect(rc({ headers: { REFERER: 'h' }, referer: 'r' })).not.toContain(' -e ');
    expect(rc({ user_agent: '', referer: 5 })).toBe("curl 'https://a.test/x'");
  });
  it('cookies join with "; ", empty or non-object cookies are skipped', () => {
    expect(rc({ cookies: { a: '1', b: 2 } })).toContain("-b 'a=1; b=2'");
    expect(rc({ cookies: {} })).toBe("curl 'https://a.test/x'");
    expect(rc({ cookies: 'a=1' })).toBe("curl 'https://a.test/x'");
    expect(rc({ cookies: ['a'] })).not.toContain('-b');
  });
  it('handles unicode and very large values without truncation', () => {
    const big = 'x'.repeat(100_000);
    expect(rc({ method: 'POST', data: big }).length).toBeGreaterThan(100_000);
    expect(rc({ headers: { 'X-名': '値🔑' } })).toContain("-H 'X-名: 値🔑'");
  });
  it('uses a continuation layout between parts', () => {
    expect(reconstructCurl({ ...base, method: 'POST' } as ParsedCurl)).toBe("curl \\\n  -X POST \\\n  'https://a.test/x'");
  });
});
