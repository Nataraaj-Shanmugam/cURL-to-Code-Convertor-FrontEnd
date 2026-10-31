import { describe, it, expect } from 'vitest';
import { detectDataFormat } from '@/lib/utils/dataFormatDetector';
import type { ParsedCurl } from '@/types/curl';

const req = (patch: Partial<ParsedCurl>): ParsedCurl => ({ method: 'POST', url: '', base_url: '', endpoint: '', ...patch });

describe('detectDataFormat (ported from production)', () => {
  it('detects JSON from the content type, an object body or a JSON string', () => {
    expect(detectDataFormat(req({ headers: { 'Content-Type': 'application/json' } }))).toBe('json');
    expect(detectDataFormat(req({ data: { a: 1 } }))).toBe('json');
    expect(detectDataFormat(req({ data: '{"a": 1}' }))).toBe('json');
  });

  it('detects XML from the content type or the body', () => {
    expect(detectDataFormat(req({ headers: { 'content-type': 'application/xml' } }))).toBe('xml');
    expect(detectDataFormat(req({ data: '<?xml version="1.0"?><a/>' }))).toBe('xml');
    expect(detectDataFormat(req({ data: '<user><name>x</name></user>' }))).toBe('xml');
    expect(detectDataFormat(req({ headers: { SOAPAction: 'urn:x' } }))).toBe('xml');
  });

  it('says both when the request and the response differ', () => {
    expect(detectDataFormat(req({ headers: { 'Content-Type': 'application/xml', Accept: 'application/json' } }))).toBe('both');
  });

  it('does not take HTML for XML and defaults to JSON', () => {
    expect(detectDataFormat(req({ data: '<html><body></body></html>' }))).toBe('json');
    expect(detectDataFormat(req({}))).toBe('json');
    expect(detectDataFormat(req({ url: 'https://x.test/soap/service' }))).toBe('xml');
  });
});
