import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import DiffViewDialog from '@/components/features/curl/DiffViewDialog';
import { useParsedCurlEditor } from '@/lib/hooks/useParsedCurlEditor';
import * as redaction from '@/lib/utils/redaction';
import { render } from '../test-utils';
import type { ParsedCurl } from '@/types/curl';

// Every editor row calls isSecretField while rendering, so its call count is a render count.
vi.mock('@/lib/utils/redaction', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/utils/redaction')>();
  return { ...mod, isSecretField: vi.fn(mod.isSecretField) };
});
const isSecretFieldMock = vi.mocked(redaction.isSecretField);

const request = (data: unknown, extra: Partial<ParsedCurl> = {}): ParsedCurl =>
  ({
    method: 'POST',
    url: 'https://api.example.com/users',
    base_url: 'https://api.example.com',
    endpoint: '/users',
    headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' },
    data,
    ...extra,
  }) as ParsedCurl;

/** `groups` objects of `fields` leaves: groups * (fields + 1) nodes. */
const groupedBody = (groups: number, fields: number) =>
  Object.fromEntries(
    Array.from({ length: groups }, (_, g) => [
      `group_${g}`,
      Object.fromEntries(Array.from({ length: fields }, (_, i) => [`field_${i}`, `v${g}-${i}`])),
    ]),
  );

beforeEach(() => isSecretFieldMock.mockClear());

describe('editor rendering performance (FE-PERF-1..5)', () => {
  it('FE-PERF-2: a keystroke in one field re-renders that field, not every row', async () => {
    const user = userEvent.setup();
    // 60 body leaves, below the collapse threshold: every row is mounted.
    render(<ParsedCurlEditor initialData={request(groupedBody(3, 20))} />);
    expect(screen.getAllByText(/^field_\d+:$/)).toHaveLength(60);

    await user.click(screen.getByRole('button', { name: 'Edit X-Trace' }));
    const input = screen.getByRole('textbox', { name: 'Value of X-Trace' });
    isSecretFieldMock.mockClear();
    await user.type(input, 'xyz');
    expect(input).toHaveValue('abcxyz');
    // Before the fix each keystroke re-rendered all ~70 rows (200+ calls for 3 keys).
    expect(isSecretFieldMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('FE-PERF-1: a large body starts collapsed; Expand All opens it', async () => {
    const user = userEvent.setup();
    render(<ParsedCurlEditor initialData={request(groupedBody(40, 10))} />);
    expect(screen.getByRole('button', { name: 'Expand group_0' })).toBeInTheDocument();
    expect(screen.queryByText('field_0:')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand group_3' }));
    expect(screen.getAllByText('field_0:')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Expand all body nodes' }));
    expect(screen.getAllByText('field_0:')).toHaveLength(40);
    await user.click(screen.getByRole('button', { name: 'Collapse all body nodes' }));
    expect(screen.queryByText('field_0:')).not.toBeInTheDocument();
  });

  it('a small body still starts expanded', () => {
    render(<ParsedCurlEditor initialData={request({ name: 'John', address: { city: 'NY' } })} />);
    expect(screen.getByRole('button', { name: 'Collapse address' })).toBeInTheDocument();
    expect(screen.getByText('city:')).toBeInTheDocument();
  });

  it('FE-PERF-1: a long array shows a page of items and a Show more button', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 250 }, (_, i) => i);
    render(<ParsedCurlEditor initialData={request({ items })} />);
    await user.click(screen.getByRole('button', { name: 'Expand items' }));
    expect(screen.getByText('[99]:')).toBeInTheDocument();
    expect(screen.queryByText('[100]:')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show 100 more \(150 not shown\)/ }));
    expect(screen.getByText('[199]:')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show 50 more/ }));
    expect(screen.getByText('[249]:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });

  it('FE-PERF-1: a very large body opens as masked raw JSON, editable and switchable to the tree', async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `n${i}`, tags: ['a', 'b'] }));
    render(<ParsedCurlEditor initialData={request({ password: 'hunter2-secret', records })} />);

    const preview = screen.getByLabelText('Request body preview');
    expect(preview.textContent).not.toContain('hunter2-secret');
    expect(preview.textContent).toContain('4,980 more items');
    expect(screen.queryByRole('button', { name: 'Expand records' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Edit raw JSON/ }));
    const textarea = screen.getByRole('textbox', { name: 'Raw request body JSON' });
    fireEvent.change(textarea, { target: { value: '{"password":"x","records":[]}' } });
    await user.click(screen.getByRole('button', { name: /Apply JSON/ }));
    // The new body is small: the tree replaces the raw view.
    expect(screen.getByText('password:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('raw view rejects invalid JSON and can switch to the tree', async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `n${i}`, tags: ['a', 'b'] }));
    render(<ParsedCurlEditor initialData={request({ records })} />);
    await user.click(screen.getByRole('button', { name: /Edit raw JSON/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Raw request body JSON' }), { target: { value: '{oops' } });
    await user.click(screen.getByRole('button', { name: /Apply JSON/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Not valid JSON/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: /Show as tree/ }));
    expect(screen.getByRole('button', { name: 'Expand records' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show as raw JSON/ }));
    expect(screen.getByLabelText('Request body preview')).toBeInTheDocument();
  });

  it('FE-PERF-3: Review Changes renders a page of rows for a large diff', async () => {
    const user = userEvent.setup();
    const original = request({ items: Array.from({ length: 450 }, (_, i) => i) });
    const current = request({ items: Array.from({ length: 450 }, (_, i) => i + 1) });
    render(<DiffViewDialog open onOpenChange={() => {}} originalParsed={original} currentParsed={current} onRevert={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('button', { name: 'Revert change' })).toHaveLength(200);
    expect(dialog).toHaveTextContent('Showing 200 of 450 changes.');
    await user.click(within(dialog).getByRole('button', { name: 'Show 200 more' }));
    await user.click(within(dialog).getByRole('button', { name: 'Show 50 more' }));
    expect(within(dialog).getAllByRole('button', { name: 'Revert change' })).toHaveLength(450);
  });
});

describe('FE-PERF-5: undo history uses structural sharing', () => {
  const initial = request({ a: { x: 1 }, b: { y: 2 } }, { query_params: { page: '1' } });

  it('an edit copies only the containers on its path', () => {
    const { result } = renderHook(() => useParsedCurlEditor(initial));
    const before = result.current.parsed;
    act(() => { void result.current.toggleEdit('data.a.x', 1); });
    act(() => result.current.handleEditChange('data.a.x', '5'));
    act(() => { void result.current.toggleEdit('data.a.x', 1); });
    const after = result.current.parsed;
    expect((after.data as Record<string, Record<string, unknown>>).a!.x).toBe(5);
    expect(after).not.toBe(before);
    expect(after.data).not.toBe(before.data);
    // Untouched subtrees are shared, not copied.
    expect(after.headers).toBe(before.headers);
    expect((after.data as Record<string, unknown>).b).toBe((before.data as Record<string, unknown>).b);
    // The previous state and the original are left as they were.
    expect((before.data as Record<string, Record<string, unknown>>).a!.x).toBe(1);
    expect((result.current.originalParsed.data as Record<string, Record<string, unknown>>).a!.x).toBe(1);

    act(() => result.current.undo());
    expect(result.current.parsed).toBe(before);
    act(() => result.current.redo());
    expect(result.current.parsed).toBe(after);
  });

  it('deleting several selected fields leaves earlier states intact', () => {
    const { result } = renderHook(() => useParsedCurlEditor(initial));
    const before = result.current.parsed;
    act(() => result.current.toggleSelect('data.a.x'));
    act(() => result.current.toggleSelect('data.b.y'));
    act(() => result.current.deleteSelected());
    expect(result.current.parsed.data).toEqual({ a: {}, b: {} });
    expect(before.data).toEqual({ a: { x: 1 }, b: { y: 2 } });
    expect(result.current.parsed.headers).toBe(before.headers);
    act(() => result.current.revertField('data.b.y'));
    expect(result.current.parsed.data).toEqual({ a: {}, b: { y: 2 } });
    act(() => result.current.handleReset());
    expect(result.current.parsed).toEqual(result.current.originalParsed);
    expect(result.current.isDirty).toBe(false);
  });

  it('replaceBody is an undoable edit and ignores an unchanged body', () => {
    const { result } = renderHook(() => useParsedCurlEditor(initial));
    act(() => result.current.replaceBody({ a: { x: 1 }, b: { y: 2 } }));
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.replaceBody({ z: 1 }));
    expect(result.current.parsed.data).toEqual({ z: 1 });
    act(() => result.current.undo());
    expect(result.current.parsed.data).toEqual({ a: { x: 1 }, b: { y: 2 } });
  });
});
