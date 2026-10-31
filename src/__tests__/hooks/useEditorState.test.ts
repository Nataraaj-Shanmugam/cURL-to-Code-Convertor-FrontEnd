import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { parseBodyData, useEditorState } from '@/lib/hooks/useEditorState';
import { useParsedCurlEditor } from '@/lib/hooks/useParsedCurlEditor';
import { mockBodyObject, mockParsedCurl, mockParsedCurlStringBody } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

describe('parseBodyData (normalisation)', () => {
  it('parses a JSON-object string body into an object', () => {
    expect(parseBodyData(mockParsedCurlStringBody as unknown as ParsedCurl).data).toEqual(mockBodyObject);
  });

  it('keeps a non-JSON string body as a string', () => {
    const form = { ...mockParsedCurl, data: 'a=1&b=2' } as unknown as ParsedCurl;
    expect(parseBodyData(form).data).toBe('a=1&b=2');
  });

  it('keeps a JSON scalar string (not an object) as a string', () => {
    const scalar = { ...mockParsedCurl, data: '42' } as unknown as ParsedCurl;
    expect(parseBodyData(scalar).data).toBe('42');
  });

  it('is idempotent and does not mutate its input', () => {
    const input = structuredClone(mockParsedCurlStringBody) as unknown as ParsedCurl;
    const once = parseBodyData(input);
    expect(input.data).toBe(mockParsedCurlStringBody.data);
    expect(parseBodyData(once)).toEqual(once);
  });

  it('returns an empty object for undefined', () => {
    expect(parseBodyData(undefined)).toEqual({});
  });
});

describe('useEditorState original vs working copy', () => {
  it('normalises the original the same way as the working copy for a JSON-string body', () => {
    const { result } = renderHook(() => useEditorState(mockParsedCurlStringBody as unknown as ParsedCurl));
    expect(result.current.originalParsed.data).toEqual(mockBodyObject);
    expect(result.current.parsed).toEqual(result.current.originalParsed);
    expect(result.current.parsed).not.toBe(result.current.originalParsed);
    expect(result.current.isDirty).toBe(false);
  });

  it('is dirty after a change and clean again after undo', () => {
    const { result } = renderHook(() => useEditorState(mockParsedCurlStringBody as unknown as ParsedCurl));
    act(() => result.current.setParsed({ ...result.current.parsed, method: 'PUT' }));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.undo());
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useParsedCurlEditor change tracking with a JSON-string body', () => {
  const setup = () => renderHook(() => useParsedCurlEditor(mockParsedCurlStringBody as unknown as ParsedCurl));

  it('is not dirty when nothing was edited', () => {
    const { result } = setup();
    expect(result.current.isDirty).toBe(false);
  });

  it('becomes dirty when a body field is deleted, and clean when it is restored via undo', () => {
    const { result } = setup();
    act(() => result.current.deleteSingle('data.name'));
    expect(result.current.isDirty).toBe(true);
    expect((result.current.parsed.data as Record<string, unknown>).name).toBeUndefined();
    act(() => result.current.undo());
    expect(result.current.isDirty).toBe(false);
  });

  it('becomes dirty when a body field is edited to a different value, not when set to the same value', () => {
    const { result } = setup();
    act(() => { void result.current.toggleEdit('data.name', 'John Doe'); });
    act(() => { void result.current.toggleEdit('data.name', 'John Doe'); });
    expect(result.current.isDirty).toBe(false);

    act(() => { void result.current.toggleEdit('data.name', 'John Doe'); });
    act(() => result.current.handleEditChange('data.name', 'Jane'));
    act(() => { void result.current.toggleEdit('data.name', 'John Doe'); });
    expect(result.current.isDirty).toBe(true);
    expect((result.current.parsed.data as Record<string, unknown>).name).toBe('Jane');
  });

  it('Reset restores the normalised body object (not the raw string) and clears dirty', () => {
    const { result } = setup();
    act(() => result.current.deleteSingle('data.email'));
    act(() => result.current.deleteSingle('data.address'));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.handleReset());
    expect(result.current.parsed.data).toEqual(mockBodyObject);
    expect(typeof result.current.parsed.data).toBe('object');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('revertField restores a body field from the normalised original', () => {
    const { result } = setup();
    act(() => result.current.deleteSingle('data.name'));
    act(() => result.current.revertField('data.name'));
    expect(result.current.parsed.data).toEqual(mockBodyObject);
    expect(result.current.isDirty).toBe(false);
  });
});
