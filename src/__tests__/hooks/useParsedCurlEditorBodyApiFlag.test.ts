import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { useParsedCurlEditor } from '@/lib/hooks/useParsedCurlEditor';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

vi.mock('@/lib/env', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, ENV: { ...actual.ENV, BODY_API_ENABLED: true } };
});

const initial = () => mockParsedCurl as unknown as ParsedCurl;
const body = (r: { current: ReturnType<typeof useParsedCurlEditor> }) => r.current.parsed.data as Record<string, unknown>;

describe('body edits with VITE_CURL_CRAFT_BODY_API_ENABLED on', () => {
  it('mirrors an edit to /api/body/edit with the body-relative path', async () => {
    let received: { path?: string; value?: unknown } | undefined;
    server.use(
      http.post('*/api/body/edit', async ({ request }) => {
        received = (await request.json()) as typeof received;
        return HttpResponse.json({ success: true });
      }),
    );
    const { result } = renderHook(() => useParsedCurlEditor(initial()));

    await act(async () => { await result.current.toggleEdit('data.address.city', 'New York'); });
    act(() => result.current.handleEditChange('data.address.city', 'Paris'));
    await act(async () => { await result.current.toggleEdit('data.address.city', 'New York'); });

    await waitFor(() => expect(received).toEqual(expect.objectContaining({ path: 'address.city', value: 'Paris' })));
    expect((body(result).address as Record<string, unknown>).city).toBe('Paris');
  });

  it('keeps the local edit when /api/body/edit fails, and shows a notice', async () => {
    server.use(http.post('*/api/body/edit', () => HttpResponse.json({ success: false, error: { message: 'Node not found' } })));
    const { result } = renderHook(() => useParsedCurlEditor(initial()));

    await act(async () => { await result.current.toggleEdit('data.name', 'John Doe'); });
    act(() => result.current.handleEditChange('data.name', 'Jane'));
    await act(async () => { await result.current.toggleEdit('data.name', 'John Doe'); });

    expect(body(result).name).toBe('Jane');
    await waitFor(() => expect(result.current.bodyApiError).toBe('Node not found'));
    expect(body(result).name).toBe('Jane'); // not rolled back
  });

  it('keeps the local delete when /api/body/delete errors at the network level', async () => {
    server.use(http.post('*/api/body/delete', () => HttpResponse.error()));
    const { result } = renderHook(() => useParsedCurlEditor(initial()));

    act(() => result.current.deleteSingle('data.name'));

    await waitFor(() => expect(result.current.bodyApiError).not.toBeNull());
    expect(body(result).name).toBeUndefined();
  });

  it('applies the local delete immediately, before the request settles', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    server.use(http.post('*/api/body/delete', async () => { await gate; return HttpResponse.json({ success: true }); }));
    const { result } = renderHook(() => useParsedCurlEditor(initial()));

    act(() => result.current.deleteSingle('data.email'));
    expect(body(result).email).toBeUndefined();

    release();
    await waitFor(() => expect(result.current.bodyApiLoading).toBe(false));
  });
});
