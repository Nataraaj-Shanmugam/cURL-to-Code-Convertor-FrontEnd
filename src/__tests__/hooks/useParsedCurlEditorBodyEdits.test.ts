import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { useParsedCurlEditor } from '@/lib/hooks/useParsedCurlEditor';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

// Default build: VITE_CURL_CRAFT_BODY_API_ENABLED is unset, so body edits are local-only.
describe('body edits are local (feature flag off, the default)', () => {
  const trackRequests = () => {
    const calls: string[] = [];
    server.use(
      http.post('*/api/body/edit', () => { calls.push('edit'); return HttpResponse.json({ success: true }); }),
      http.post('*/api/body/delete', () => { calls.push('delete'); return HttpResponse.json({ success: true }); }),
    );
    return calls;
  };

  it('applies a body edit locally without calling /api/body/edit', async () => {
    const calls = trackRequests();
    const { result } = renderHook(() => useParsedCurlEditor(mockParsedCurl as unknown as ParsedCurl));

    await act(async () => { await result.current.toggleEdit('data.name', 'John Doe'); });
    act(() => result.current.handleEditChange('data.name', 'Jane'));
    await act(async () => { await result.current.toggleEdit('data.name', 'John Doe'); });

    expect((result.current.parsed.data as Record<string, unknown>).name).toBe('Jane');
    expect(result.current.bodyApiError).toBeNull();
    expect(calls).toEqual([]);
  });

  it('applies a body delete locally without calling /api/body/delete', async () => {
    const calls = trackRequests();
    const { result } = renderHook(() => useParsedCurlEditor(mockParsedCurl as unknown as ParsedCurl));

    act(() => result.current.deleteSingle('data.address.zip'));

    expect((result.current.parsed.data as { address: Record<string, unknown> }).address.zip).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('still edits locally when the backend would fail', async () => {
    server.use(
      http.post('*/api/body/edit', () => HttpResponse.error()),
      http.post('*/api/body/delete', () => HttpResponse.json({ success: false, error: { message: 'nope' } }, { status: 500 })),
    );
    const { result } = renderHook(() => useParsedCurlEditor(mockParsedCurl as unknown as ParsedCurl));

    act(() => result.current.deleteSingle('data.email'));
    expect((result.current.parsed.data as Record<string, unknown>).email).toBeUndefined();
  });
});
