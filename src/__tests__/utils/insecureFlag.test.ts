import { describe, it, expect } from 'vitest';
import { isInsecureCurl, withRelaxedHttps } from '@/lib/utils/insecureFlag';
import type { ParsedCurl } from '@/types/curl';

const base: ParsedCurl = { method: 'GET', base_url: 'https://a.com', endpoint: '/x' };

describe('isInsecureCurl', () => {
  it('is false for a plain request', () => {
    expect(isInsecureCurl(base)).toBe(false);
    expect(isInsecureCurl(undefined)).toBe(false);
    expect(isInsecureCurl(null)).toBe(false);
  });

  it.each([
    ['ssl_config', { insecure: true }],
    ['flags', { insecure: true }],
    ['misc_flags', { insecure: true }],
    ['network_config', { insecure: true }],
    ['ssl_config', { k: true }],
    ['flags', { '--insecure': true }],
    ['flags', { '-k': true }],
    ['ssl_config', { skip_ssl_verification: true }],
    ['ssl_config', { verify: false }],
    ['ssl_config', { verify_ssl: false }],
  ])('detects -k in %s %j', (section, value) => {
    expect(isInsecureCurl({ ...base, [section]: value } as ParsedCurl)).toBe(true);
  });

  it('ignores flags that are present but false or empty', () => {
    expect(isInsecureCurl({ ...base, ssl_config: { insecure: false } })).toBe(false);
    expect(isInsecureCurl({ ...base, flags: { insecure: false, verbose: true } })).toBe(false);
    expect(isInsecureCurl({ ...base, ssl_config: {} })).toBe(false);
    expect(isInsecureCurl({ ...base, ssl_config: { verify: true } })).toBe(false);
  });

  it('ignores unrelated truthy flags and non-boolean values', () => {
    expect(isInsecureCurl({ ...base, flags: { verbose: true, compressed: true } })).toBe(false);
    expect(isInsecureCurl({ ...base, ssl_config: { insecure: 'true' } })).toBe(false);
    expect(isInsecureCurl({ ...base, ssl_config: { cacert: '/etc/ca.pem' } })).toBe(false);
  });
});

describe('withRelaxedHttps', () => {
  const method = `@Test
public void testGet_x() {
    Response response = given()
        .header("Accept", "application/json")
    .when()
        .get("https://a.com/x")
    .then()
        .statusCode(200)
        .extract().response();
}`;

  it('scopes relaxed validation to the request instead of mutating global state', () => {
    const out = withRelaxedHttps(method);

    expect(out).toContain('given().relaxedHTTPSValidation()');
    expect(out).not.toContain('useRelaxedHTTPSValidation');
    expect(out.match(/relaxedHTTPSValidation/g)).toHaveLength(1);
  });

  it('does not add it twice when the backend already did', () => {
    const already = method.replace('given()', 'given().relaxedHTTPSValidation()');
    expect(withRelaxedHttps(already)).toBe(already);
  });

  it('leaves a note rather than silently dropping -k when there is no given() chain', () => {
    const out = withRelaxedHttps('@Test\npublic void t() {}');
    expect(out).toContain('-k/--insecure');
    expect(out).toContain('@Test');
  });
});
