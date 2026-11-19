/**
 * The 79-shape redaction matrix from the security review (findings/security/redaction-matrix.json).
 * Every secret is a harmless marker "SECRETMARKER<n>"; a shape fails when its marker survives.
 */
import { describe, it, expect } from 'vitest';
import {
  REDACTED_PLACEHOLDER as R,
  collectSecretValues,
  isSecretName,
  redactCurlString,
  redactParsedCurl,
  redactText,
} from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const base = { method: 'GET', base_url: 'https://api.example.test', endpoint: '/v1/x' } as ParsedCurl;
const p = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as ParsedCurl;

const parsedCases: [string, ParsedCurl][] = [
  ['hdr Authorization', p({ headers: { Authorization: 'Bearer SECRETMARKER1' } })],
  ['hdr authorization lower', p({ headers: { authorization: 'Bearer SECRETMARKER2' } })],
  ["hdr ' Authorization ' padded", p({ headers: { ' Authorization ': 'Bearer SECRETMARKER3' } })],
  ['hdr Proxy-Authorization', p({ headers: { 'Proxy-Authorization': 'Basic SECRETMARKER4' } })],
  ['hdr X-Api-Key', p({ headers: { 'X-Api-Key': 'SECRETMARKER5' } })],
  ['hdr X-Amz-Signature', p({ headers: { 'X-Amz-Signature': 'SECRETMARKER6' } })],
  ['hdr X-Hub-Signature-256', p({ headers: { 'X-Hub-Signature-256': 'sha256=SECRETMARKER7' } })],
  ['hdr X-CSRF (jwt-looking)', p({ headers: { 'X-Custom': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJTRUNSRVRNQVJLRVI4In0.SECRETMARKER8' } })],
  ['hdr Cookie', p({ headers: { Cookie: 'sid=SECRETMARKER9; theme=dark' } })],
  ['hdr X-Pass', p({ headers: { 'X-Pass': 'SECRETMARKER10' } })],
  ['q api_key', p({ query_params: { api_key: 'SECRETMARKER11' } })],
  ['q access_token', p({ query_params: { access_token: 'SECRETMARKER12' } })],
  ['q sig', p({ query_params: { sig: 'SECRETMARKER13' } })],
  ['q X-Amz-Signature', p({ query_params: { 'X-Amz-Signature': 'SECRETMARKER14' } })],
  ['q code (oauth)', p({ query_params: { code: 'SECRETMARKER15' } })],
  ['url field with ?token=', p({ url: 'https://api.example.test/x?token=SECRETMARKER16' })],
  ['endpoint with ?sig=', p({ endpoint: '/x?sig=SECRETMARKER17' })],
  ['url userinfo', p({ url: 'https://bob:SECRETMARKER18@api.example.test/x' })],
  ['base_url userinfo', p({ base_url: 'https://bob:SECRETMARKER19@api.example.test' })],
  ['json password', p({ data: { user: { password: 'SECRETMARKER20' } } })],
  ['json pass', p({ data: { pass: 'SECRETMARKER21' } })],
  ['json pin/otp', p({ data: { pin: 'SECRETMARKER22', otp: 'SECRETMARKER22b' } })],
  ["json jwt under 'value'", p({ data: { value: 'eyJhbGciOiJIUzI1NiJ9.e30.SECRETMARKER23' } })],
  ['json array of creds', p({ data: [{ name: 'Authorization', value: 'Bearer SECRETMARKER24' }] })],
  ['json string body', p({ data: '{"client_secret":"SECRETMARKER25"}' })],
  ['json string body nested string', p({ data: '{"payload":"{\\"token\\":\\"SECRETMARKER26\\"}"}' })],
  ['form string body', p({ data: 'grant_type=password&username=a&password=SECRETMARKER27' })],
  ['form string leading &', p({ data: '&password=SECRETMARKER28' })],
  ['form_data record', p({ form_data: { password: 'SECRETMARKER29' } })],
  ['graphql vars', p({ data: { query: 'mutation{login(password:"SECRETMARKER30")}' } })],
  ['__proto__ body key', p({ data: JSON.parse('{"__proto__":{"token":"SECRETMARKER31"},"ok":1}') })],
  ['auth_config basic', p({ auth_config: { type: 'basic', username: 'bob', password: 'SECRETMARKER32' } })],
  ['auth string', p({ auth: 'bob:SECRETMARKER33' })],
  ['cookies record', p({ cookies: { sid: 'SECRETMARKER34' } })],
  ['proxy_config url creds', p({ proxy_config: { proxy: 'http://u:SECRETMARKER35@proxy:3128' } })],
  ['proxy string', p({ proxy: 'http://u:SECRETMARKER36@proxy:3128' })],
  ['referer w/ token', p({ referer: 'https://a.test/cb#access_token=SECRETMARKER37' })],
  ['all_options raw args', p({ all_options: ['-H', 'Authorization: Bearer SECRETMARKER38', '-u', 'bob:SECRETMARKER38b'] })],
  ['meta raw', p({ meta: { original: "curl -H 'X-Api-Key: SECRETMARKER39' https://x" } })],
];

const curlCases: [string, string][] = [
  ['-H single quoted', `curl https://x -H 'Authorization: Bearer SECRETMARKER40'`],
  ['-H double quoted', `curl https://x -H "authorization: bearer SECRETMARKER41"`],
  ['--header=', `curl https://x --header="X-Api-Key: SECRETMARKER42"`],
  ['-H unquoted (escaped space)', `curl https://x -H Authorization:\\ Bearer\\ SECRETMARKER43`],
  ['-H no space after colon', `curl https://x -H 'X-Auth-Token:SECRETMARKER44'`],
  ['-HAuthorization attached', `curl https://x -H'Authorization: Bearer SECRETMARKER45'`],
  ["$'..' ANSI quoted (DevTools bash)", `curl 'https://x' -H $'authorization: Bearer SECRETMARKER46'`],
  ['-b', `curl https://x -b 'sid=SECRETMARKER47'`],
  ['--cookie=', `curl https://x --cookie="sid=SECRETMARKER48"`],
  ['-b bare', `curl https://x -b sid=SECRETMARKER49`],
  ['-u', `curl -u bob:SECRETMARKER50 https://x`],
  ['-ubob:pw attached', `curl -ubob:SECRETMARKER51 https://x`],
  ['--user=', `curl --user='bob:SECRETMARKER52' https://x`],
  ['url userinfo', `curl https://bob:SECRETMARKER53@x.test/a`],
  ['query api_key', `curl 'https://x.test/a?api_key=SECRETMARKER54'`],
  ['query sig', `curl 'https://x.test/a?sig=SECRETMARKER55'`],
  ['-d form', `curl https://x -d 'username=a&password=SECRETMARKER56'`],
  ['--data-raw json', `curl https://x --data-raw '{"password":"SECRETMARKER57"}'`],
  ['-d json spaced', `curl https://x -d '{ "access_token" : "SECRETMARKER58" }'`],
  ['-d json nested obj under secret key', `curl https://x -d '{"auth":{"u":"a","p":"SECRETMARKER59"}}'`],
  ['--data-urlencode', `curl https://x --data-urlencode 'password=SECRETMARKER60'`],
  ['-F', `curl https://x -F 'api_key=SECRETMARKER61'`],
  ['--oauth2-bearer', `curl https://x --oauth2-bearer SECRETMARKER62`],
  ['-x proxy creds', `curl -x http://u:SECRETMARKER63@proxy:3128 https://x`],
  ['-U proxy-user', `curl -U u:SECRETMARKER64 https://x`],
  ['Windows cmd ^" quoting', `curl "https://x" -H ^"Authorization: Bearer SECRETMARKER65^"`],
  ['PowerShell-ish header', `Invoke-WebRequest -Headers @{"Authorization"="Bearer SECRETMARKER66"}`],
  ['-H Cookie', `curl https://x -H 'cookie: a=SECRETMARKER67; b=2'`],
  ['--json', `curl https://x --json '{"password":"SECRETMARKER68"}'`],
  ['-d @file then header later', `curl https://x -d @body.json -H 'Authorization: Bearer SECRETMARKER69'`],
];

const codeParsed = p({ headers: { Authorization: 'Bearer SECRETMARKER70' }, data: { password: 'pw12' } });
const known = collectSecretValues(codeParsed);
const codeCases: [string, string, readonly string[] | undefined][] = [
  ['code .header pair', `.header("Authorization", "Bearer SECRETMARKER70")`, known],
  ['code builder .password() short secret', `RequestBody.builder().password("pw12").build()`, known],
  ['code builder .apiKey() unknown', `Body.builder().apiKey("SECRETMARKER71").build()`, undefined],
  ['code text block body', `String body = """\n{\n  "password": "SECRETMARKER72"\n}\n""";`, undefined],
  ['code headers Map.of', `Map.of("X-Api-Key", "SECRETMARKER73")`, undefined],
  ['code setter', `body.setPassword("SECRETMARKER74");`, undefined],
  ['code baseURI userinfo', `RestAssured.baseURI = "https://u:SECRETMARKER75@x.test";`, undefined],
  ['code .auth().oauth2', `.auth().oauth2("SECRETMARKER76")`, undefined],
  ['code .cookie()', `.cookie("sid", "SECRETMARKER77")`, undefined],
  ['code concatenated header', `.header("Authorization", "Bearer " + "SECRETMARKER78")`, undefined],
];

const leaks = (out: unknown) => /SECRETMARKER|pw12/.test(typeof out === 'string' ? out : JSON.stringify(out));

describe('redaction matrix', () => {
  it('covers all 79 shapes', () => {
    expect(parsedCases.length + curlCases.length + codeCases.length).toBe(79);
  });

  it.each(parsedCases)('parsed: %s', (_name, parsed) => {
    expect(leaks(redactParsedCurl(parsed))).toBe(false);
  });

  it.each(curlCases)('curl: %s', (_name, curl) => {
    expect(leaks(redactCurlString(curl))).toBe(false);
  });

  it.each(codeCases)('code: %s', (_name, code, knownSecrets) => {
    expect(leaks(redactText(code, { knownSecrets }))).toBe(false);
  });
});

describe('redaction matrix: shape of the output', () => {
  it('keeps the auth scheme and the structure around the redacted values', () => {
    expect(redactParsedCurl(p({ data: [{ name: 'Authorization', value: 'Bearer x-y-z' }] })).data).toEqual([
      { name: 'Authorization', value: `Bearer ${R}` },
    ]);
    expect(redactParsedCurl(p({ referer: 'https://a.test/cb#access_token=abc&state=xyz' })).referer).toBe(
      `https://a.test/cb#access_token=${R}&state=xyz`,
    );
    expect(redactParsedCurl(p({ data: '&password=hunter2&user=bob' })).data).toBe(`&password=${R}&user=bob`);
    expect(redactParsedCurl(p({ headers: { 'X-Custom': 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc' } })).headers).toEqual({
      'X-Custom': `Bearer ${R}`,
    });
    expect(redactParsedCurl(p({ all_options: ['-H', 'Accept: x', '-u', 'bob:pw'] })).all_options).toEqual([
      '-H',
      'Accept: x',
      '-u',
      `${R}:${R}`,
    ]);
  });

  it('redacts a nested stringified JSON leaf and keeps it a string', () => {
    const out = redactParsedCurl(p({ data: { payload: '{"token":"abcdef","page":2}' } }));
    expect(JSON.parse((out.data as { payload: string }).payload)).toEqual({ token: R, page: 2 });
  });

  it('redacts code shapes in place', () => {
    expect(redactText(`.header("Authorization", "Bearer " + "abcdefgh")`)).toBe(`.header("Authorization", "Bearer ${R}")`);
    expect(redactText(`body.setPassword("abcdefgh");`)).toBe(`body.setPassword("${R}");`);
    expect(redactText(`Body.builder().apiKey("abcdefgh").name("Bob").build()`)).toBe(
      `Body.builder().apiKey("${R}").name("Bob").build()`,
    );
    expect(redactText(`curl -ubob:pw https://x`)).toBe(`curl -u${R}:${R} https://x`);
    expect(redactText(`-d '{"auth":{"u":"a","n":1,"p":"b"},"page":"2"}'`)).toBe(
      `-d '{"auth":{"u":"${R}","n":1,"p":"${R}"},"page":"2"}'`,
    );
  });

  it('matches short secret words as whole words only', () => {
    for (const name of ['X-Pass', 'pass', 'user_pin', 'PIN', 'otp', 'otpCode', 'sig', 'code', 'X-Amz-Signature', 'hmac', 'code_verifier']) {
      expect(isSecretName(name)).toBe(true);
    }
    for (const name of ['shipping', 'design', 'compass', 'passenger', 'footprint', 'mapping', 'country_code', 'zipcode', 'signal']) {
      expect(isSecretName(name)).toBe(false);
    }
  });

  it('leaves harmless text and values alone', () => {
    const harmless = `given().header("Accept", "application/json").queryParam("page", "2").body("{\\"name\\":\\"John\\"}")`;
    expect(redactText(harmless)).toBe(harmless);
    const parsed = p({ headers: { Accept: 'application/json' }, data: { name: 'John', shipping: 'express', note: 'design v2' } });
    expect(redactParsedCurl(parsed)).toEqual(parsed);
  });
});
