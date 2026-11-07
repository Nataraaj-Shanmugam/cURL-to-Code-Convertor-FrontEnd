import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { detectDataFormat, getDataFormatLabel, getDataFormatDescription } from '@/lib/utils/dataFormatDetector';
import { parseCurlBatch, parseCurlCommand } from '@/lib/utils/parseCurlBatch';
import type { ParsedCurl } from '@/types/curl';

const pc = (o: Record<string, unknown>) => o as unknown as ParsedCurl;

describe('detectDataFormat (table)', () => {
  it.each([
    ['json content type', { headers: { 'Content-Type': 'application/json; charset=utf-8' } }, 'json'],
    ['vendor +json', { headers: { 'content-type': 'application/vnd.api+json' } }, 'json'],
    ['ld+json', { headers: { 'content-type': 'application/ld+json' } }, 'json'],
    ['text/json', { headers: { 'CONTENT-TYPE': 'text/json' } }, 'json'],
    ['xml content type', { headers: { 'content-type': 'application/xml' } }, 'xml'],
    ['text/xml', { headers: { 'content-type': 'text/xml' } }, 'xml'],
    ['soap+xml', { headers: { 'content-type': 'application/soap+xml' } }, 'xml'],
    ['xhtml+xml', { headers: { 'content-type': 'application/xhtml+xml' } }, 'xml'],
    ['rss', { headers: { 'content-type': 'application/rss+xml' } }, 'xml'],
    ['atom', { headers: { 'content-type': 'application/atom+xml' } }, 'xml'],
    ['xml declaration body', { data: '<?xml version="1.0"?><a/>' }, 'xml'],
    ['tag body with closing tag', { data: '<a>x</a>' }, 'xml'],
    ['self-closing body', { data: '<a/>' }, 'xml'],
    ['bare tag is not xml', { data: '<a>' }, 'json'],
    ['html doctype is not xml', { data: '<!DOCTYPE html><html></html>' }, 'json'],
    ['html element is not xml', { data: '<html><body></body></html>' }, 'json'],
    ['json object body', { data: '  {"a":1}  ' }, 'json'],
    ['json array body', { data: '[1]' }, 'json'],
    ['templated json (does not parse)', { data: '{{body}}' }, 'json'],
    ['object body', { data: { a: 1 } }, 'json'],
    ['raw_data xml', { raw_data: '<a></a>' }, 'xml'],
    ['raw_data json', { raw_data: '{"a":1}' }, 'json'],
    ['object body with raw_data present does not count by itself', { data: { a: 1 }, raw_data: 'plain', url: 'https://x/soap' }, 'xml'],
    ['json header + xml body', { headers: { 'content-type': 'application/json' }, data: '<a/>' }, 'both'],
    ['xml header + json body', { headers: { 'content-type': 'text/xml' }, data: '{}' }, 'both'],
    ['accept json adds json', { headers: { accept: 'application/json' } }, 'json'],
    ['accept xml adds xml', { headers: { Accept: 'application/xml' } }, 'xml'],
    ['accept xml + json body', { headers: { accept: 'text/xml' }, data: '{"a":1}' }, 'both'],
    ['accept json + xml body', { headers: { accept: 'application/json' }, data: '<a/>' }, 'both'],
    ['url .xml', { url: 'https://x/feed.xml' }, 'xml'],
    ['url /xml', { url: 'https://x/xml/get' }, 'xml'],
    ['url .json', { url: 'https://x/a.json' }, 'json'],
    ['url /api/', { url: 'https://x/api/users' }, 'json'],
    ['url soap', { url: 'https://x/SOAPService' }, 'xml'],
    ['url wsdl', { url: 'https://x/svc?wsdl' }, 'xml'],
    ['url /rest/', { url: 'https://x/rest/users' }, 'json'],
    ['soapaction header', { url: 'https://x/z', headers: { SOAPAction: 'urn:x' } }, 'xml'],
    ['nothing at all', {}, 'json'],
    ['empty soapaction header does not count', { headers: { soapaction: '' } }, 'json'],
    ['empty body string', { data: '' }, 'json'],
    ['whitespace body', { data: '   ' }, 'json'],
  ])('%s -> %s', (_n, parsed, expected) => {
    expect(detectDataFormat(pc(parsed))).toBe(expected);
  });
  it('labels and descriptions exist for every format', () => {
    expect([getDataFormatLabel('json'), getDataFormatLabel('xml'), getDataFormatLabel('both')]).toEqual(['JSON', 'XML', 'JSON + XML']);
    expect(getDataFormatDescription('json')).toContain('Jackson');
    expect(getDataFormatDescription('xml')).toContain('JAXB');
    expect(getDataFormatDescription('both')).toContain('Jackson');
    expect(getDataFormatDescription('both')).toContain('JAXB');
  });
});

describe('parseCurlCommand / parseCurlBatch edges', () => {
  const answer = (body: unknown, status = 200) => server.use(http.post('*/api/parse', () => HttpResponse.json(body as never, { status })));
  it.each([
    ['error as string', { success: false, error: 'bad cmd' }, 'bad cmd'],
    ['error as object', { success: false, error: { message: 'obj' } }, 'obj'],
    ['error object without message', { success: false, error: { code: 'x' } }, 'Failed to parse cURL'],
    ['empty error string', { success: false, error: '' }, 'Failed to parse cURL'],
    ['no error', { success: false }, 'Failed to parse cURL'],
    ['success without data', { success: true }, 'The parser returned no data for this command'],
    ['data is a string', { success: true, data: 'x' }, 'The parser returned no data for this command'],
    ['data is null', { success: true, data: null }, 'The parser returned no data for this command'],
    ['empty array', { success: true, data: [] }, 'The parser returned no data for this command'],
  ])('%s', async (_n, body, message) => {
    answer(body);
    expect(await parseCurlCommand('curl x')).toEqual({ ok: false, message });
  });
  it('an array response yields its first element; an object response is used as is', async () => {
    answer({ success: true, data: [{ method: 'GET', n: 1 }, { n: 2 }] });
    expect(await parseCurlCommand('curl x')).toEqual({ ok: true, parsed: { method: 'GET', n: 1 } });
    answer({ success: true, data: { n: 3 } });
    expect(await parseCurlCommand('curl x')).toEqual({ ok: true, parsed: { n: 3 } });
  });
  it('marks retryable failures (gateway / network) but not plain rejections', async () => {
    server.use(http.post('*/api/parse', () => new HttpResponse('<html/>', { status: 502, headers: { 'content-type': 'text/html' } })));
    const gateway = await parseCurlCommand('curl x');
    expect(gateway).toMatchObject({ ok: false, retryable: true });
    answer({ error: { message: 'nope' } }, 400);
    expect(await parseCurlCommand('curl x')).toEqual({ ok: false, message: 'nope', retryable: false });
  });
  it('the request carries the command text verbatim, including unicode and very long input', async () => {
    const seen: string[] = [];
    server.use(http.post('*/api/parse', async ({ request }) => {
      seen.push(((await request.json()) as { curl: string }).curl);
      return HttpResponse.json({ success: true, data: { method: 'GET' } });
    }));
    const long = "curl 'https://a.test/?q=" + 'é🔑'.repeat(20_000) + "'";
    await parseCurlCommand(long);
    expect(seen[0]).toBe(long);
  });
  it('batch: failures carry retryable only when set, keep input order and use the fallback message', async () => {
    server.use(http.post('*/api/parse', async ({ request }) => {
      const { curl } = (await request.json()) as { curl: string };
      if (curl.includes('gateway')) return new HttpResponse('<html/>', { status: 503, headers: { 'content-type': 'text/html' } });
      if (curl.includes('reject')) return HttpResponse.json({ success: false }, { status: 200 });
      return HttpResponse.json({ success: true, data: { method: 'GET', url: curl } });
    }));
    const out = await parseCurlBatch(['curl ok1', 'curl gateway', 'curl reject', 'curl ok2']);
    expect(out.items.map((i) => i.originalCurl)).toEqual(['curl ok1', 'curl ok2']);
    expect(out.failures.map((f) => f.index)).toEqual([1, 2]);
    expect(out.failures[0]).toMatchObject({ retryable: true, curl: 'curl gateway' });
    expect(out.failures[1]).toEqual({ index: 2, curl: 'curl reject', message: 'Failed to parse cURL' });
  });
});
