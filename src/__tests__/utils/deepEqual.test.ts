import { describe, it, expect } from 'vitest';
import { deepEqual } from '@/lib/utils/deepEqual';

describe('deepEqual', () => {
  it('compares primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  it('compares nested objects structurally and ignores key order', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [2, 1] } })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('treats undefined-valued keys as absent', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(deepEqual({ a: 1, b: undefined }, { a: 1, c: 2 })).toBe(false);
  });

  it('does not confuse arrays with objects or null with objects', () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('does not equate a JSON string with its parsed object', () => {
    expect(deepEqual('{"a":1}', { a: 1 })).toBe(false);
  });
});
