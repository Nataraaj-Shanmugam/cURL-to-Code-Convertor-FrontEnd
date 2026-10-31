import { describe, it, expect } from 'vitest';
import {
  MASK,
  REDACTED_PLACEHOLDER as R,
  collectSecretValues,
  containsRedaction,
  countRedactions,
  isSecretField,
  listSecretFields,
  maskParsedCurl,
  redactBodyString,
  redactCurlString,
  redactFieldValue,
  redactParsedCurl,
  redactText,
} from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.SECRET-PAYLOAD.sig';

const parsed: ParsedCurl = {
  method: 'POST',
  url: 'https://api.example.com/users?api_key=KEY123456&page=1',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
    'Proxy-Authorization': 'Basic cHJveHk6cHc=',
    Cookie: 'sid=abc123; theme=dark',
    'X-Api-Key': 'key-987654',
    'X-Request-Id': 'req-1',
  },
  query_params: { page: '1', access_token: 'tok-555555', limit: '10' },
  cookies: { session_id: 'abc123', theme: 'dark' },
  data: { name: 'John', password: 'hunter2hunter2', nested: { client_secret: 'shh-shh-shh', city: 'NYC' } },
  form_data: { username: 'john', password: 'formpass1' },
  auth_config: { type: 'basic', username: 'admin', password: 'adminpw' },
  proxy_config: { proxy: 'http://u:p@proxy.local:8080', proxy_user: 'pu:pp' },
  network_config: { timeout: 5 },
  ssl_config: { insecure: true },
  user_agent: 'Mozilla/5.0',
};

describe('redactParsedCurl', () => {
  const out = redactParsedCurl(parsed);

  it('redacts always-secret headers, keeping the auth scheme', () => {
    expect(out.headers!.Authorization).toBe(`Bearer ${R}`);
    expect(out.headers!['Proxy-Authorization']).toBe(`Basic ${R}`);
  });

  it('redacts cookie header values but keeps cookie names', () => {
    expect(out.headers!.Cookie).toBe(`sid=${R}; theme=${R}`);
  });

  it('redacts headers whose name matches the secret pattern, case-insensitively', () => {
    expect(out.headers!['X-Api-Key']).toBe(R);
    expect(redactParsedCurl({ ...parsed, headers: { 'x-AUTH-thing': 'v-v-v-v' } }).headers!['x-AUTH-thing']).toBe(R);
  });

  it('leaves harmless headers alone', () => {
    expect(out.headers!['Content-Type']).toBe('application/json');
    expect(out.headers!['X-Request-Id']).toBe('req-1');
  });

  it('redacts secret query params, in query_params and in url', () => {
    expect(out.query_params).toEqual({ page: '1', access_token: R, limit: '10' });
    expect(out.url).toBe(`https://api.example.com/users?api_key=${R}&page=1`);
  });

  it('redacts every cookie value', () => {
    expect(out.cookies).toEqual({ session_id: R, theme: R });
  });

  it('redacts secret keys in JSON bodies and form data, at any depth', () => {
    expect(out.data).toEqual({ name: 'John', password: R, nested: { client_secret: R, city: 'NYC' } });
    expect(out.form_data).toEqual({ username: 'john', password: R });
  });

  it('redacts string bodies (JSON and url-encoded)', () => {
    expect(JSON.parse(redactBodyString('{"user":"a","token":"abcdefgh"}') )).toEqual({ user: 'a', token: R });
    expect(redactBodyString('user=a&password=hunter22&x=1')).toBe(`user=a&password=${R}&x=1`);
    expect(redactBodyString('{"a":1}')).toBe('{"a":1}');
  });

  it('redacts basic-auth credentials but keeps how to authenticate', () => {
    expect(out.auth_config).toEqual({ type: 'basic', username: R, password: R });
  });

  it('redacts proxy credentials and leaves plain config alone', () => {
    expect(out.proxy_config).toEqual({ proxy: `http://${R}@proxy.local:8080`, proxy_user: R });
    expect(out.network_config).toEqual({ timeout: 5 });
    expect(out.ssl_config).toEqual({ insecure: true });
    expect(out.user_agent).toBe('Mozilla/5.0');
  });

  it('redacts URL userinfo', () => {
    expect(redactParsedCurl({ ...parsed, url: 'https://bob:pw@host.test/x' }).url).toBe(`https://${R}@host.test/x`);
  });

  it('does not mutate its input and is idempotent', () => {
    const snapshot = JSON.stringify(parsed);
    const once = redactParsedCurl(parsed);
    expect(JSON.stringify(parsed)).toBe(snapshot);
    expect(redactParsedCurl(once)).toEqual(once);
  });

  it('leaves no secret value anywhere in the serialized output', () => {
    const json = JSON.stringify(out);
    for (const secret of [TOKEN, 'abc123', 'KEY123456', 'key-987654', 'tok-555555', 'hunter2hunter2', 'shh-shh-shh', 'formpass1', 'adminpw', 'u:p@']) {
      expect(json).not.toContain(secret);
    }
  });

  it('supports a custom placeholder', () => {
    expect(redactParsedCurl(parsed, { placeholder: MASK }).headers!.Authorization).toBe(`Bearer ${MASK}`);
  });
});

describe('redactText / redactCurlString', () => {
  it('redacts -H headers in single and double quotes', () => {
    const curl = `curl https://x.test -H 'Authorization: Bearer ${TOKEN}' -H "X-Api-Key: abcdef123" -H 'Accept: */*'`;
    const out = redactCurlString(curl);
    expect(out).toContain(`'Authorization: Bearer ${R}'`);
    expect(out).toContain(`"X-Api-Key: ${R}"`);
    expect(out).toContain(`'Accept: */*'`);
    expect(out).not.toContain(TOKEN);
  });

  it('redacts cookies from -H Cookie and -b/--cookie, but not a cookie-jar file', () => {
    expect(redactCurlString(`curl x -H 'Cookie: a=1; b=2'`)).toContain(`'Cookie: a=${R}; b=${R}'`);
    expect(redactCurlString(`curl x -b 'sid=zzz; t=1'`)).toContain(`-b 'sid=${R}; t=${R}'`);
    expect(redactCurlString(`curl x --cookie sid=zzz`)).toContain(`--cookie sid=${R}`);
    expect(redactCurlString(`curl x -b cookies.txt`)).toBe('curl x -b cookies.txt');
  });

  it('redacts -u / --user / --proxy-user credentials, including a secret used as the username', () => {
    expect(redactCurlString(`curl -u admin:s3cret https://x.test`)).toBe(`curl -u ${R}:${R} https://x.test`);
    expect(redactCurlString(`curl --user "sk_live_abc:" https://x.test`)).toBe(`curl --user "${R}:" https://x.test`);
    expect(redactCurlString(`curl --proxy-user a:b https://x.test`)).toContain(`--proxy-user ${R}:${R}`);
  });

  it('redacts --oauth2-bearer', () => {
    expect(redactCurlString('curl --oauth2-bearer abc.def https://x.test')).toBe(`curl --oauth2-bearer ${R} https://x.test`);
  });

  it('redacts secret query params and userinfo in URLs', () => {
    expect(redactCurlString(`curl 'https://u:p@x.test/a?token=abc&q=1&session=zz'`)).toBe(
      `curl 'https://${R}@x.test/a?token=${R}&q=1&session=${R}'`,
    );
  });

  it('redacts secret keys in JSON bodies, plain and shell-escaped', () => {
    expect(redactCurlString(`curl x -d '{"user":"a","password":"pw12345"}'`)).toBe(`curl x -d '{"user":"a","password":"${R}"}'`);
    expect(redactCurlString(`curl x -d "{\\"password\\":\\"pw12345\\"}"`)).toBe(`curl x -d "{\\"password\\":\\"${R}\\"}"`);
  });

  it('redacts url-encoded and -F bodies', () => {
    expect(redactCurlString(`curl x -d 'a=1&client_secret=zzz'`)).toBe(`curl x -d 'a=1&client_secret=${R}'`);
    expect(redactCurlString(`curl x -F 'api_key=zzz' -F 'file=@/tmp/a'`)).toBe(`curl x -F 'api_key=${R}' -F 'file=@/tmp/a'`);
  });

  it('redacts REST Assured calls', () => {
    const code = `given()
  .header("Authorization", "Bearer ${TOKEN}")
  .header("Content-Type", "application/json")
  .queryParam("api_key", "k-k-k-k-k")
  .cookie("sid", "abc123")
  .auth().preemptive().basic("admin", "pw")
  .auth().oauth2("tok-tok-tok")
  .body("{\\"password\\": \\"hunter2\\", \\"name\\": \\"x\\"}")`;
    const out = redactText(code);
    expect(out).toContain(`.header("Authorization", "Bearer ${R}")`);
    expect(out).toContain('.header("Content-Type", "application/json")');
    expect(out).toContain(`.queryParam("api_key", "${R}")`);
    expect(out).toContain(`.cookie("sid", "${R}")`);
    expect(out).toContain(`.basic("${R}", "${R}")`);
    expect(out).toContain(`.oauth2("${R}")`);
    expect(out).toContain(`\\"password\\": \\"${R}\\"`);
    expect(out).toContain('\\"name\\": \\"x\\"');
    for (const secret of [TOKEN, 'k-k-k-k-k', 'abc123', 'admin', 'tok-tok-tok', 'hunter2']) expect(out).not.toContain(secret);
  });

  it('scrubs known secret values wherever they appear', () => {
    const out = redactText('String t = "Bearer zzzzzzzz1"; log(zzzzzzzz1);', { knownSecrets: ['zzzzzzzz1'] });
    expect(out).not.toContain('zzzzzzzz1');
  });

  it('ignores known secrets too short to scrub safely', () => {
    expect(redactText('int true1 = 1;', { knownSecrets: ['true'] })).toBe('int true1 = 1;');
  });

  it('is idempotent and leaves harmless text untouched', () => {
    const curl = `curl -X GET "https://api.example.com/users?page=1" -H "Accept: application/json"`;
    expect(redactText(curl)).toBe(curl);
    const secret = `curl -u a:b https://x.test -H 'Authorization: Bearer abc'`;
    expect(redactText(redactText(secret))).toBe(redactText(secret));
  });

  it('handles empty input', () => {
    expect(redactText('')).toBe('');
  });
});

describe('field helpers', () => {
  it('redactFieldValue works from editor paths', () => {
    expect(redactFieldValue('headers.Authorization', 'Bearer abc', { placeholder: MASK })).toBe(`Bearer ${MASK}`);
    expect(redactFieldValue('cookies.theme', 'dark')).toBe(R);
    expect(redactFieldValue('data.nested.client_secret', 'x-x-x-x')).toBe(R);
    expect(redactFieldValue('data.items[0].token', 'x-x-x-x')).toBe(R);
    expect(redactFieldValue('headers.Accept', 'json')).toBe('json');
    expect(redactFieldValue('url', 'https://x.test?token=abc')).toBe(`https://x.test?token=${R}`);
    expect(redactFieldValue('headers.X.Dotted-Token', 'abc')).toBe(R);
  });

  it('isSecretField flags secrets only', () => {
    expect(isSecretField('headers.Authorization', 'Bearer abc')).toBe(true);
    expect(isSecretField('headers.Accept', 'json')).toBe(false);
    expect(isSecretField('method', 'GET')).toBe(false);
    expect(isSecretField('url', 'https://x.test/a')).toBe(false);
    expect(isSecretField('headers.Authorization', null)).toBe(false);
  });

  it('listSecretFields and maskParsedCurl support per-field reveal', () => {
    const fields = listSecretFields(parsed);
    const auth = fields.find((f) => f.label === 'headers.Authorization')!;
    expect(auth).toBeTruthy();
    expect(fields.find((f) => f.label === 'headers.Content-Type')).toBeUndefined();

    const masked = maskParsedCurl(parsed);
    expect(masked.headers!.Authorization).toBe(`Bearer ${MASK}`);
    const revealed = maskParsedCurl(parsed, new Set([auth.id]));
    expect(revealed.headers!.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(revealed.headers!.Cookie).toBe(`sid=${MASK}; theme=${MASK}`);
  });

  it('collectSecretValues returns the substrings that were replaced, longest first', () => {
    const values = collectSecretValues(parsed);
    expect(values).toContain(TOKEN);
    expect(values).toContain('hunter2hunter2');
    expect(values).not.toContain(`Bearer ${TOKEN}`);
    expect(values.every((v, i) => i === 0 || values[i - 1]!.length >= v.length)).toBe(true);
  });

  it('counts redaction markers', () => {
    expect(countRedactions(redactParsedCurl(parsed))).toBeGreaterThan(5);
    expect(containsRedaction(parsed)).toBe(false);
    expect(containsRedaction({ a: [`x=${R}`] })).toBe(true);
  });
});
