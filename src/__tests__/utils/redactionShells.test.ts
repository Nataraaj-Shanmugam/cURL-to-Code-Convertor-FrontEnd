/**
 * SEC-2 / SEC-11: Chrome's Windows copy formats ("Copy as cURL (cmd)" and "Copy as PowerShell"),
 * the curl flags the first matrix missed, payment data and XML bodies. Every secret is a marker
 * "MK<n>..."; a shape fails when its marker survives anywhere.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MASK,
  REDACTED_PLACEHOLDER as R,
  collectSecretValues,
  isSecretName,
  redactCurlForRequest,
  redactCurlString,
  redactParsedCurl,
} from '@/lib/utils/redaction';
import {
  EDITOR_STORAGE_KEY,
  redactHistoryState,
  rememberEditorRequest,
  resolveEditorRestore,
  saveEditorState,
} from '@/lib/utils/editorStorage';
import { redactBatchSnapshot } from '@/lib/utils/batchStorage';
import { forgetAllLiveRequests } from '@/lib/utils/liveRequestStore';
import type { ParsedCurl } from '@/types/curl';

/** Chrome DevTools "Copy as PowerShell". */
const CHROME_POWERSHELL = `$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0"
$session.Cookies.Add((New-Object System.Net.Cookie("sid", "MKPSCOOKIE1", "/", "api.example.test")))
Invoke-WebRequest -UseBasicParsing -Uri "https://api.example.test/v1/login" \`
-Method "POST" \`
-WebSession $session \`
-Headers @{
"authority"="api.example.test"
  "accept"="*/*"
  "authorization"="Bearer MKPSBEARER2"
} \`
-ContentType "application/json" \`
-Body "{\`"username\`":\`"bob\`",\`"password\`":\`"MKPSPASSWORD3\`"}"`;

/** Chrome DevTools "Copy as cURL (cmd)". */
const CHROME_CMD = `curl ^"https://api.example.test/v1/me?access_token=MKCMDQUERY1^&page=2^" ^
  -H ^"accept: */*^" ^
  -H ^"authorization: Bearer MKCMDBEARER2^" ^
  -H ^"x-api-key: MKCMDAPIKEY3^" ^
  -b ^"sid=MKCMDCOOKIE4; theme=dark^" ^
  --data-raw ^"^{^\\^"user^\\^":^\\^"bob^\\^",^\\^"password^\\^":^\\^"MKCMDPASSWORD5^\\^"^}^"`;

const leaks = (out: unknown) => /MK[A-Z0-9]*\d/.test(typeof out === 'string' ? out : JSON.stringify(out));

const base = { method: 'POST', base_url: 'https://api.example.test', endpoint: '/v1/login' } as ParsedCurl;
const p = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as ParsedCurl;

/** What the backend parses the two pastes into (the secrets it hands back). */
const psParsed = p({
  headers: { authority: 'api.example.test', accept: '*/*', authorization: 'Bearer MKPSBEARER2' },
  cookies: { sid: 'MKPSCOOKIE1' },
  data: { username: 'bob', password: 'MKPSPASSWORD3' },
});
const cmdParsed = p({
  method: 'GET',
  endpoint: '/v1/me',
  query_params: { access_token: 'MKCMDQUERY1', page: '2' },
  headers: { accept: '*/*', authorization: 'Bearer MKCMDBEARER2', 'x-api-key': 'MKCMDAPIKEY3' },
  cookies: { sid: 'MKCMDCOOKIE4', theme: 'dark' },
  data: { user: 'bob', password: 'MKCMDPASSWORD5' },
});

const curlCases: [string, string][] = [
  ['Chrome PowerShell', CHROME_POWERSHELL],
  ['Chrome cmd', CHROME_CMD],
  ['PS cookie object, single quotes', `$s.Cookies.Add((New-Object System.Net.Cookie('sid', 'MKPS4value', '/', 'a.test')))`],
  ['cmd -b only', `curl ^"https://a.test/x^" -b ^"other=MKCMD6value^"`],
  ['cmd -u', `curl ^"https://a.test/x^" -u ^"bob:MKCMD7value^"`],
  ['-E cert:password', `curl -E client.pem:MKE1value https://a.test/x`],
  ['--cert= cert:password', `curl --cert=client.p12:MKE2value https://a.test/x`],
  ['--proxy-cert quoted', `curl --proxy-cert 'p.pem:MKE3value' -x http://p:3128 https://a.test/x`],
  ['--variable secret', `curl --variable "token=MKV1value" --expand-url "https://a.test/{{token}}"`],
  ['--url-query', `curl https://a.test/x --url-query "api_key=MKU1value"`],
  ['--url-query encoded', `curl https://a.test/x --url-query "+access_token=MKU2value"`],
  ['card number / cvv', `curl https://a.test/pay -d '{"card_number":"4111111111111111","cvv":"MKC1"}'`],
  ['cardNumber / cvc / pan', `curl https://a.test/pay -d '{"cardNumber":"MKC2value","cvc":"MKC3","pan":"MKC4value"}'`],
  ['form card_no / cvv2', `curl https://a.test/pay -d 'card_no=MKC5value&cvv2=MKC6&amount=10'`],
  ['account number / iban / ssn', `curl https://a.test/pay -d '{"accountNumber":"MKC7value","iban":"MKC8value","ssn":"MKC9value"}'`],
  ['XML <password>', `curl https://a.test/x -H 'Content-Type: application/xml' -d '<login><user>bob</user><password>MKX1value</password></login>'`],
  ['XML <token> / <secret>, namespaced', `curl https://a.test/x -d '<a><ns:Token>MKX2value</ns:Token><secret> MKX3value </secret></a>'`],
];

const parsedCases: [string, ParsedCurl][] = [
  ['ssl_config cert password', p({ ssl_config: { basic: { cert: 'client.pem:MKE4value' } } })],
  ['all_options -E / --variable / --url-query', p({ all_options: ['-E', 'c.pem:MKE5value', '--variable', 'secret=MKV2value', '--url-query', 'token=MKU3value'] })],
  ['json card data', p({ data: { card: { card_number: 'MKC10value', cvv: 'MKC11', expiry: '12/30' } } })],
  ['form_data cvc', p({ form_data: { cvc: 'MKC12', name: 'Bob' } })],
  ['xml string body', p({ headers: { 'Content-Type': 'application/xml' }, data: '<login><password>MKX4value</password></login>' })],
  ['xml inside json string', p({ data: { envelope: '<auth><token>MKX5value</token></auth>' } })],
];

describe('redaction matrix: Windows shells, curl flags, payment data, XML (SEC-2, SEC-11)', () => {
  it.each(curlCases)('curl: %s', (_name, curl) => {
    expect(leaks(redactCurlString(curl))).toBe(false);
  });

  it.each(parsedCases)('parsed: %s', (_name, parsed) => {
    expect(leaks(redactParsedCurl(parsed))).toBe(false);
  });

  it('collects card data as known secrets for scrubbing generated code', () => {
    expect(collectSecretValues(p({ data: { card_number: '4111111111111111' } }))).toContain('4111111111111111');
  });
});

describe('redaction of Windows shells keeps the command readable', () => {
  it('does not mangle PowerShell -Uri / -UseBasicParsing or the :authority header', () => {
    const out = redactCurlString(CHROME_POWERSHELL);
    expect(out).toContain('-UseBasicParsing -Uri "https://api.example.test/v1/login"');
    expect(out).not.toContain('-U[REDACTED]');
    expect(out).toContain('"authority"="api.example.test"');
    expect(out).toContain(`System.Net.Cookie("sid", "${R}", "/", "api.example.test")`);
    expect(out).toContain(`"authorization"="Bearer ${R}"`);
    expect(out).toContain(`-Body "{\`"username\`":\`"bob\`",\`"password\`":\`"${R}\`"}"`);
  });

  it('keeps cmd ^" quoting (and the URL) intact', () => {
    const out = redactCurlString(CHROME_CMD);
    expect(out).toContain(`curl ^"https://api.example.test/v1/me?access_token=${R}^&page=2^" ^`);
    expect(out).toContain(`-H ^"authorization: Bearer ${R}^" ^`);
    expect(out).toContain(`-H ^"x-api-key: ${R}^" ^`);
    expect(out).toContain(`-b ^"sid=${R}; theme=${R}^" ^`);
    expect(out).toContain(`^\\^"password^\\^":^\\^"${R}^\\^"`);
    expect(out).toContain('-H ^"accept: */*^"');
  });

  it('keeps the curl -u / -E attached forms and non-password certificates', () => {
    expect(redactCurlString('curl -ubob:pw https://x')).toBe(`curl -u${R}:${R} https://x`);
    expect(redactCurlString('curl -u sergey https://x')).toBe(`curl -u ${R} https://x`);
    expect(redactCurlString(`curl -E 'C:\\certs\\a.pem' https://x`)).toBe(`curl -E 'C:\\certs\\a.pem' https://x`);
    expect(redactCurlString('curl -E client.pem https://x')).toBe('curl -E client.pem https://x');
    expect(redactCurlString('Invoke-WebRequest -Uri "https://x" -ErrorAction Stop')).toBe(
      'Invoke-WebRequest -Uri "https://x" -ErrorAction Stop',
    );
  });

  it('treats payment names by word, not by substring', () => {
    for (const name of ['card_number', 'cardNumber', 'card-no', 'cvv', 'CVV2', 'cvc', 'pan', 'card_pan', 'account_number', 'acctNo', 'iban', 'ssn']) {
      expect(isSecretName(name)).toBe(true);
    }
    for (const name of ['company', 'expand', 'span', 'panel', 'cardNotes', 'discount', 'businessName', 'authority', ':authority']) {
      expect(isSecretName(name)).toBe(false);
    }
  });

  it('leaves non-secret XML alone', () => {
    const xml = `curl -d '<order><id>42</id><item sku="A1">pen</item></order>' https://x`;
    expect(redactCurlString(xml)).toBe(xml);
  });
});

describe('originalCurl is scrubbed by the parsed secrets wherever it is kept (SEC-2)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    forgetAllLiveRequests();
    window.history.replaceState(null, '');
  });

  /** A shape no text pattern understands: only the parsed values can catch it. */
  const pythonPaste = `requests.get("https://api.example.test/v1/me", cookies={'sid': 'MKPYCOOKIE1'})`;
  const pythonParsed = p({ method: 'GET', cookies: { sid: 'MKPYCOOKIE1' } });

  it.each([
    ['PowerShell', CHROME_POWERSHELL, psParsed],
    ['cmd', CHROME_CMD, cmdParsed],
    ['unknown shell', pythonPaste, pythonParsed],
  ] as const)('%s paste: sessionStorage', (_name, curl, parsed) => {
    expect(saveEditorState(parsed, curl)).toBe(true);
    const stored = sessionStorage.getItem(EDITOR_STORAGE_KEY) ?? '';
    expect(stored).toContain(R);
    expect(leaks(stored)).toBe(false);
  });

  it.each([
    ['PowerShell', CHROME_POWERSHELL, psParsed],
    ['cmd', CHROME_CMD, cmdParsed],
    ['unknown shell', pythonPaste, pythonParsed],
  ] as const)('%s paste: history.state, and a Back/Forward still gets the live values', (_name, curl, parsed) => {
    window.history.replaceState({ usr: { parsed, originalCurl: curl }, key: 'k', idx: 0 }, '');
    rememberEditorRequest({ parsed, originalCurl: curl });
    redactHistoryState();
    const state = (window.history.state as { usr: unknown }).usr;
    expect(leaks(state)).toBe(false);

    const restore = resolveEditorRestore(state);
    expect(restore.source).toBe('live');
    expect(restore.snapshot?.originalCurl).toBe(curl);
  });

  it.each([
    ['PowerShell', CHROME_POWERSHELL, psParsed],
    ['cmd', CHROME_CMD, cmdParsed],
    ['unknown shell', pythonPaste, pythonParsed],
  ] as const)('%s paste: batch route state', (_name, curl, parsed) => {
    const out = redactBatchSnapshot({ items: [{ id: 'a', parsed, originalCurl: curl }] as never, failures: [] });
    expect(leaks(out)).toBe(false);
  });

  it('the Original cURL box masks by the parsed values too', () => {
    expect(leaks(redactCurlForRequest(pythonPaste, pythonParsed, { placeholder: MASK }))).toBe(false);
    expect(redactCurlForRequest(pythonPaste, pythonParsed, { placeholder: MASK })).toContain(MASK);
  });
});
