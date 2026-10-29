import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { parseCurlBatch } from '@/lib/utils/parseCurlBatch';

const parsedFor = (curl: string) => ({
  method: 'GET',
  base_url: 'https://a.com',
  endpoint: '/' + curl.split('/').pop(),
});

describe('parseCurlBatch', () => {
  it('returns every command in input order', async () => {
    server.use(
      http.post('*/api/parse', async ({ request }) => {
        const { curl } = (await request.json()) as { curl: string };
        // Finish out of order: earlier commands are slower.
        await new Promise((resolve) => setTimeout(resolve, curl.endsWith('/a') ? 40 : 5));
        return HttpResponse.json({ success: true, data: parsedFor(curl) });
      }),
    );

    const { items, failures } = await parseCurlBatch(['curl https://a.com/a', 'curl https://a.com/b']);

    expect(failures).toEqual([]);
    expect(items.map((i) => i.parsed.endpoint)).toEqual(['/a', '/b']);
    expect(items.map((i) => i.originalCurl)).toEqual(['curl https://a.com/a', 'curl https://a.com/b']);
  });

  it('keeps successes and reports each failure with its index, command and message', async () => {
    const { items, failures } = await parseCurlBatch([
      'curl https://api.example.com/ok',
      'curl invalid-curl-garbage',
      'curl https://api.example.com/ok2',
      'curl invalid-curl-garbage again',
    ]);

    expect(items).toHaveLength(2);
    expect(failures).toEqual([
      { index: 1, curl: 'curl invalid-curl-garbage', message: 'Invalid cURL command format' },
      { index: 3, curl: 'curl invalid-curl-garbage again', message: 'Invalid cURL command format' },
    ]);
  });

  it('treats success:false with HTTP 200 as a failure', async () => {
    server.use(
      http.post('*/api/parse', () =>
        HttpResponse.json({ success: false, error: { code: 'X', message: 'Unsupported option' } }),
      ),
    );

    const { items, failures } = await parseCurlBatch(['curl https://a.com/x']);

    expect(items).toEqual([]);
    expect(failures[0]).toMatchObject({ index: 0, message: 'Unsupported option' });
  });

  it('reports network errors as failures instead of throwing', async () => {
    server.use(http.post('*/api/parse', () => HttpResponse.error()));

    const { items, failures } = await parseCurlBatch(['curl https://a.com/x', 'curl https://a.com/y']);

    expect(items).toEqual([]);
    expect(failures).toHaveLength(2);
    failures.forEach((f) => expect(f.message).toBeTruthy());
  });

  it('uses the first element when the parser returns an array, and flags an empty one', async () => {
    server.use(
      http.post('*/api/parse', async ({ request }) => {
        const { curl } = (await request.json()) as { curl: string };
        return HttpResponse.json({
          success: true,
          data: curl.includes('empty') ? [] : [parsedFor(curl), { method: 'POST', base_url: 'x', endpoint: '/ignored' }],
        });
      }),
    );

    const { items, failures } = await parseCurlBatch(['curl https://a.com/one', 'curl https://a.com/empty']);

    expect(items.map((i) => i.parsed.endpoint)).toEqual(['/one']);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ index: 1 });
  });

  it('never has more than a handful of parses in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    server.use(
      http.post('*/api/parse', async ({ request }) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        const { curl } = (await request.json()) as { curl: string };
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight--;
        return HttpResponse.json({ success: true, data: parsedFor(curl) });
      }),
    );

    const curls = Array.from({ length: 20 }, (_, i) => `curl https://a.com/${i}`);
    const { items } = await parseCurlBatch(curls);

    expect(items).toHaveLength(20);
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('returns empty results for no input', async () => {
    expect(await parseCurlBatch([])).toEqual({ items: [], failures: [] });
  });
});
