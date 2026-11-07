import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { useBodyApi, toBodyPath } from '@/lib/hooks/useBodyApi';

const capture = (path: string, respond: () => Response) => {
  const seen: unknown[] = [];
  server.use(
    http.post(`*${path}`, async ({ request }) => {
      seen.push(await request.json());
      return respond();
    }),
  );
  return seen;
};

describe('toBodyPath', () => {
  it.each([
    ['data.user.name', 'user.name'], ['data.', ''], ['data', 'data'], ['database.x', 'database.x'], ['', ''], ['headers.data.x', 'headers.data.x'], ['data.data.x', 'data.x'],
  ])('%j -> %j', (input, expected) => {
    expect(toBodyPath(input)).toBe(expected);
  });
});

describe('useBodyApi', () => {
  it('disabled: no request is made and both calls resolve true without touching state', async () => {
    const seen = capture('/api/body/edit', () => HttpResponse.json({ success: true }));
    const { result } = renderHook(() => useBodyApi(() => ({}), false));
    await expect(result.current.editBodyNode('data.a', 1)).resolves.toBe(true);
    await expect(result.current.deleteBodyNode('data.a')).resolves.toBe(true);
    expect(seen).toEqual([]);
    expect(result.current.bodyApiLoading).toBe(false);
    expect(result.current.bodyApiError).toBeNull();
  });
  it('edit posts { body, path (without data.), value } and resolves true', async () => {
    const seen = capture('/api/body/edit', () => HttpResponse.json({ success: true }));
    const { result } = renderHook(() => useBodyApi(() => ({ a: 1 }), true));
    let ok = false;
    await act(async () => {
      ok = await result.current.editBodyNode('data.a', 2);
    });
    expect(ok).toBe(true);
    expect(seen).toEqual([{ body: { a: 1 }, path: 'a', value: 2 }]);
    expect(result.current.bodyApiLoading).toBe(false);
    expect(result.current.bodyApiError).toBeNull();
  });
  it('delete posts { body, path } to the delete endpoint', async () => {
    const seen = capture('/api/body/delete', () => HttpResponse.json({}));
    const { result } = renderHook(() => useBodyApi(() => [1, 2], true));
    await act(async () => {
      expect(await result.current.deleteBodyNode('data.items[0]')).toBe(true);
    });
    expect(seen).toEqual([{ body: [1, 2], path: 'items[0]' }]);
  });
  it('loading is true while the request is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    server.use(http.post('*/api/body/edit', async () => {
      await gate;
      return HttpResponse.json({ success: true });
    }));
    const { result } = renderHook(() => useBodyApi(() => ({}), true));
    let p!: Promise<boolean>;
    act(() => {
      p = result.current.editBodyNode('a', 1);
    });
    await waitFor(() => expect(result.current.bodyApiLoading).toBe(true));
    release();
    await act(async () => {
      await p;
    });
    expect(result.current.bodyApiLoading).toBe(false);
  });
  it.each([
    ['string error', { success: false, error: 'plain failure' }, 'plain failure'],
    ['object error', { success: false, error: { code: 'x', message: 'obj failure' } }, 'obj failure'],
    ['no error text', { success: false }, 'Edit failed'],
  ])('success:false with %s sets the message and resolves false', async (_n, payload, message) => {
    capture('/api/body/edit', () => HttpResponse.json(payload));
    const { result } = renderHook(() => useBodyApi(() => ({}), true));
    await act(async () => {
      expect(await result.current.editBodyNode('a', 1)).toBe(false);
    });
    expect(result.current.bodyApiError).toBe(message);
  });
  it('delete failure messages use their own default', async () => {
    capture('/api/body/delete', () => HttpResponse.json({ success: false }));
    const { result } = renderHook(() => useBodyApi(() => ({}), true));
    await act(async () => {
      expect(await result.current.deleteBodyNode('a')).toBe(false);
    });
    expect(result.current.bodyApiError).toBe('Delete failed');
  });
  it('HTTP and network failures become the ApiError message; a later success clears it', async () => {
    capture('/api/body/edit', () => HttpResponse.json({ error: { code: 'bad', message: 'rejected' } }, { status: 400 }));
    const { result } = renderHook(() => useBodyApi(() => ({}), true));
    await act(async () => {
      expect(await result.current.editBodyNode('a', 1)).toBe(false);
    });
    expect(result.current.bodyApiError).toBe('rejected');
    capture('/api/body/edit', () => HttpResponse.json({ success: true }));
    await act(async () => {
      expect(await result.current.editBodyNode('a', 1)).toBe(true);
    });
    expect(result.current.bodyApiError).toBeNull();
    server.use(http.post('*/api/body/delete', () => HttpResponse.error()));
    await act(async () => {
      expect(await result.current.deleteBodyNode('a')).toBe(false);
    });
    expect(result.current.bodyApiError).toMatch(/reach the generator/);
    expect(result.current.bodyApiLoading).toBe(false);
  });
  it('a non-Error throw falls back to the generic message', async () => {
    server.use(http.post('*/api/body/edit', () => HttpResponse.json({ success: true })));
    const { result } = renderHook(() => useBodyApi(() => { throw 'weird'; }, true));
    await act(async () => {
      expect(await result.current.editBodyNode('a', 1)).toBe(false);
    });
    expect(result.current.bodyApiError).toBe('Failed to edit body node');
    await act(async () => {
      expect(await result.current.deleteBodyNode('a')).toBe(false);
    });
    expect(result.current.bodyApiError).toBe('Failed to delete body node');
  });
  // BUG FE-UNIT-03 (low): `typeof null === "object"`, so `{ success: false, error: null }` reads
  // `null.message` and throws a TypeError, which the catch turns into "Cannot read properties of null"
  // shown to the user instead of "Edit failed".
  it.fails('BUG FE-UNIT-03: success:false with error:null reports "Edit failed"', async () => {
    capture('/api/body/edit', () => HttpResponse.json({ success: false, error: null }));
    const { result } = renderHook(() => useBodyApi(() => ({}), true));
    await act(async () => {
      await result.current.editBodyNode('a', 1);
    });
    expect(result.current.bodyApiError).toBe('Edit failed');
  });
});
