import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { useBatchEditor, uniqueName, isItemEdited } from '@/lib/hooks/useBatchEditor';
import { parseCurlBatch } from '@/lib/utils/parseCurlBatch';
import type { ParsedCurl } from '@/types/curl';
import type { ParsedCurlEntry } from '@/types/batch';

const entry = (method: string, endpoint: string, extra: Partial<ParsedCurl> = {}): ParsedCurlEntry => ({
  originalCurl: `curl -X ${method} https://api.example.com${endpoint}`,
  parsed: { method, base_url: 'https://api.example.com', endpoint, ...extra },
});

const GET_USERS = () => entry('GET', '/users');
const POST_ORDERS = () => entry('POST', '/orders');
const DELETE_ITEM = () => entry('DELETE', '/items/1');

describe('useBatchEditor', () => {
  describe('seeding', () => {
    it('creates one item per entry and selects the first', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS(), POST_ORDERS()]));

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.map((i) => i.name)).toEqual(['GET /users', 'POST /orders']);
      expect(result.current.selectedId).toBe(result.current.items[0]!.id);
      expect(result.current.selectedItem).toBe(result.current.items[0]);
      expect(result.current.selectedIndex).toBe(0);
    });

    it('keeps the original cURL and parsed data on each item', () => {
      const first = GET_USERS();
      const { result } = renderHook(() => useBatchEditor([first]));

      expect(result.current.items[0]!.originalCurl).toBe(first.originalCurl);
      expect(result.current.items[0]!.parsed).toBe(first.parsed);
    });

    it('handles an empty list without a selection', () => {
      const { result } = renderHook(() => useBatchEditor([]));

      expect(result.current.items).toEqual([]);
      expect(result.current.selectedId).toBeNull();
      expect(result.current.selectedItem).toBeUndefined();
    });

    it('is seeded from items that were parsed asynchronously, failures excluded', async () => {
      // Regression: items parsed after the page rendered used to be dropped by a lazy initialiser,
      // leaving "No Requests". Items now arrive already parsed, so the first render has them.
      server.use(
        http.post('*/api/parse', async ({ request }) => {
          const { curl } = (await request.json()) as { curl: string };
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (curl.includes('garbage')) {
            return HttpResponse.json(
              { success: false, error: { code: 'PARSE_ERROR', message: 'Invalid cURL command format' } },
              { status: 422 },
            );
          }
          const endpoint = '/' + curl.split('/').pop();
          return HttpResponse.json({ success: true, data: { method: 'GET', base_url: 'https://a.com', endpoint } });
        }),
      );

      const { items, failures } = await parseCurlBatch([
        'curl https://a.com/one',
        'curl invalid-curl-garbage',
        'curl https://a.com/two',
      ]);
      const { result } = renderHook(() => useBatchEditor(items));

      expect(failures).toHaveLength(1);
      expect(result.current.items.map((i) => i.name)).toEqual(['GET /one', 'GET /two']);
      expect(result.current.selectedItem?.name).toBe('GET /one');
    });
  });

  describe('default method names', () => {
    it('suffixes duplicates with _2, _3, ...', () => {
      const { result } = renderHook(() =>
        useBatchEditor([GET_USERS(), GET_USERS(), POST_ORDERS(), GET_USERS()]),
      );

      expect(result.current.items.map((i) => i.config.methodName)).toEqual([
        'testGet_users',
        'testGet_users_2',
        'testPost_orders',
        'testGet_users_3',
      ]);
    });

    it('never reuses a name that another endpoint already produced', () => {
      // GET /users_2 naturally derives "testGet_users_2", which the second GET /users would take.
      const { result } = renderHook(() =>
        useBatchEditor([GET_USERS(), entry('GET', '/users_2'), GET_USERS()]),
      );

      const names = result.current.items.map((i) => i.config.methodName);
      expect(new Set(names).size).toBe(3);
      expect(names[0]).toBe('testGet_users');
      expect(names[1]).toBe('testGet_users_2');
      expect(names[2]).toBe('testGet_users_3');
    });

    it('produces valid, distinct identifiers for requests without an endpoint', () => {
      const { result } = renderHook(() =>
        useBatchEditor([entry('GET', ''), entry('GET', ''), entry('POST', '/a/{id}/b')]),
      );

      const names = result.current.items.map((i) => i.config.methodName);
      expect(new Set(names).size).toBe(3);
      names.forEach((n) => expect(n).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/));
    });

    it('uniqueName returns the base when it is free', () => {
      expect(uniqueName('testGet', new Set())).toBe('testGet');
      expect(uniqueName('testGet', new Set(['testGet']))).toBe('testGet_2');
      expect(uniqueName('testGet', new Set(['testGet', 'testGet_2']))).toBe('testGet_3');
    });
  });

  describe('selection and editing', () => {
    it('switches the selected item by id', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS(), POST_ORDERS()]));
      const second = result.current.items[1]!;

      act(() => result.current.selectItem(second.id));

      expect(result.current.selectedId).toBe(second.id);
      expect(result.current.selectedIndex).toBe(1);
    });

    it('ignores selecting an id that does not exist', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS()]));
      const before = result.current.selectedId;

      act(() => result.current.selectItem('nope'));

      expect(result.current.selectedId).toBe(before);
    });

    it('updateParsed changes only the addressed item and refreshes its label', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS(), POST_ORDERS()]));
      const [a, b] = result.current.items;

      act(() =>
        result.current.updateParsed(b!.id, { ...b!.parsed, endpoint: '/orders/v2' }),
      );

      expect(result.current.items[0]).toBe(a); // untouched, same reference
      expect(result.current.items[1]!.parsed.endpoint).toBe('/orders/v2');
      expect(result.current.items[1]!.name).toBe('POST /orders/v2');
      // A method name the user may have customised is not regenerated.
      expect(result.current.items[1]!.config.methodName).toBe('testPost_orders');
    });

    it('edits made while another item is selected still land on the right item', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS(), POST_ORDERS()]));
      const [a, b] = result.current.items;
      act(() => result.current.selectItem(b!.id));

      // A hidden editor reporting a change for A (e.g. a late onChange) must not touch B.
      act(() => result.current.updateParsed(a!.id, { ...a!.parsed, endpoint: '/users/v2' }));

      expect(result.current.items[0]!.parsed.endpoint).toBe('/users/v2');
      expect(result.current.items[1]).toBe(b);
      expect(result.current.selectedId).toBe(b!.id);
    });

    it('updateItem merges config changes without touching other fields', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS()]));
      const item = result.current.items[0]!;

      act(() =>
        result.current.updateItem(item.id, { config: { ...item.config, statusCode: '201' } }),
      );

      expect(result.current.items[0]!.config.statusCode).toBe('201');
      expect(result.current.items[0]!.parsed).toBe(item.parsed);
    });
  });

  describe('removal', () => {
    const setup = () => {
      const hook = renderHook(() => useBatchEditor([GET_USERS(), POST_ORDERS(), DELETE_ITEM()]));
      return { ...hook, ids: hook.result.current.items.map((i) => i.id) as [string, string, string] };
    };

    it('removes only the addressed item', () => {
      const { result, ids } = setup();

      act(() => result.current.removeItem(ids[1]));

      expect(result.current.items.map((i) => i.id)).toEqual([ids[0], ids[2]]);
    });

    it('keeps the same item selected when an earlier item is removed', () => {
      const { result, ids } = setup();
      act(() => result.current.selectItem(ids[1]));

      act(() => result.current.removeItem(ids[0]));

      // Positions shifted, but the selection follows the item, not the index.
      expect(result.current.selectedId).toBe(ids[1]);
      expect(result.current.selectedItem?.name).toBe('POST /orders');
      expect(result.current.selectedIndex).toBe(0);
    });

    it('keeps the selection when a later item is removed', () => {
      const { result, ids } = setup();

      act(() => result.current.removeItem(ids[2]));

      expect(result.current.selectedId).toBe(ids[0]);
    });

    it('selects the next item when the selected one is removed', () => {
      const { result, ids } = setup();

      act(() => result.current.removeItem(ids[0]));

      expect(result.current.selectedId).toBe(ids[1]);
    });

    it('selects the previous item when the selected last item is removed', () => {
      const { result, ids } = setup();
      act(() => result.current.selectItem(ids[2]));

      act(() => result.current.removeItem(ids[2]));

      expect(result.current.selectedId).toBe(ids[1]);
    });

    it('clears the selection when the last item is removed', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS()]));
      const id = result.current.items[0]!.id;

      act(() => result.current.removeItem(id));

      expect(result.current.items).toEqual([]);
      expect(result.current.selectedId).toBeNull();
    });

    it('a stale edit for a removed item cannot overwrite another item', () => {
      // Regression: the editor used to be keyed by index and Save wrote to "the selected index",
      // so after removing an item the next Save overwrote the item that slid into its place.
      const { result, ids } = setup();
      const removed = result.current.items[0]!;
      const survivor = result.current.items[1]!;
      act(() => result.current.selectItem(ids[1]));
      act(() => result.current.removeItem(ids[0]));

      act(() => result.current.updateParsed(removed.id, { ...removed.parsed, endpoint: '/clobbered' }));
      act(() => result.current.updateItem(removed.id, { name: 'clobbered' }));

      expect(result.current.items.map((i) => i.name)).toEqual(['POST /orders', 'DELETE /items/1']);
      expect(result.current.items[0]).toBe(survivor);
    });

    it('does not hand a removed id to a later item', () => {
      const { result, ids } = setup();
      act(() => result.current.removeItem(ids[0]));

      const remaining = result.current.items.map((i) => i.id);
      expect(remaining).not.toContain(ids[0]);
      expect(new Set(remaining).size).toBe(remaining.length);
    });

    it('keeps unique method names after removals', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS(), GET_USERS(), GET_USERS()]));
      act(() => result.current.removeItem(result.current.items[0]!.id));

      const names = result.current.items.map((i) => i.config.methodName);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('edited state', () => {
    it('is false on load, true after a change, false again when the change is undone', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS()]));
      const item = () => result.current.items[0]!;
      expect(isItemEdited(item())).toBe(false);

      act(() => result.current.updateParsed(item().id, { ...item().parsed, endpoint: '/v2' }));
      expect(isItemEdited(item())).toBe(true);

      act(() => result.current.updateParsed(item().id, { ...item().baseline! }));
      expect(isItemEdited(item())).toBe(false);
    });
  });

  describe('addItem and restoreItem', () => {
    it('appends a new request with a unique method name and selects it', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS()]));

      act(() => result.current.addItem(GET_USERS()));

      expect(result.current.items.map((i) => i.config.methodName)).toEqual(['testGet_users', 'testGet_users_2']);
      expect(result.current.selectedId).toBe(result.current.items[1]!.id);
    });

    it('restores a removed item at its old position, keeping its edits', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS(), POST_ORDERS(), DELETE_ITEM()]));
      const second = result.current.items[1]!;
      act(() => result.current.updateParsed(second.id, { ...second.parsed, endpoint: '/orders-v2' }));
      const edited = result.current.items[1]!;

      act(() => result.current.removeItem(second.id));
      expect(result.current.items).toHaveLength(2);
      act(() => result.current.restoreItem(edited, 1));

      expect(result.current.items.map((i) => i.id)).toEqual([
        result.current.items[0]!.id,
        second.id,
        result.current.items[2]!.id,
      ]);
      expect(result.current.items[1]!.parsed.endpoint).toBe('/orders-v2');
      expect(isItemEdited(result.current.items[1]!)).toBe(true);
      expect(result.current.selectedId).toBe(second.id);
    });

    it('does not restore an item twice', () => {
      const { result } = renderHook(() => useBatchEditor([GET_USERS(), POST_ORDERS()]));
      const first = result.current.items[0]!;

      act(() => result.current.restoreItem(first, 0));

      expect(result.current.items).toHaveLength(2);
    });
  });
});
