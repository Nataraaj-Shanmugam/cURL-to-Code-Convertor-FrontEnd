import { describe, it, expect, afterEach } from 'vitest';
import {
  compareForDeletion,
  decodePath,
  deleteAtPath,
  encodePath,
  getAtPath,
  setAtPath,
  toBracketPath,
  toPathId,
} from '@/lib/utils/fieldPath';

describe('fieldPath', () => {
  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it('round-trips segments that contain dots and backslashes', () => {
    const segs = ['query_params', 'filter.name'];
    expect(encodePath(segs)).toBe('query_params.filter\\.name');
    expect(decodePath(encodePath(segs))).toEqual(segs);
    expect(decodePath(encodePath(['a\\b.c', 'd']))).toEqual(['a\\b.c', 'd']);
    expect(toPathId('headers.Accept')).toBe('headers.Accept');
    expect(toPathId(['data', 'tags', '0'])).toBe('data.tags.0');
  });

  it('reads, writes and splices array items by index', () => {
    const doc = { data: { tags: ['a', 'b', 'c'], items: [{ sku: 'X1' }] } };
    expect(getAtPath(doc, ['data', 'items', '0', 'sku'])).toBe('X1');
    expect(setAtPath(doc, ['data', 'tags', '0'], 'ZZZ')).toBe(true);
    expect(setAtPath(doc, ['data', 'items', '0', 'sku'], 'NEW')).toBe(true);
    expect(deleteAtPath(doc, ['data', 'tags', '1'])).toBe(true);
    expect(doc.data).toEqual({ tags: ['ZZZ', 'c'], items: [{ sku: 'NEW' }] });
    // No stray keys, no writes past the end, no non-numeric index on an array.
    expect(setAtPath(doc, ['data', 'tags', '5'], 'x')).toBe(false);
    expect(setAtPath(doc, ['data', 'tags', 'x'], 'x')).toBe(false);
    expect(doc.data.tags).toEqual(['ZZZ', 'c']);
  });

  it('never walks into __proto__, prototype or constructor', () => {
    const doc = JSON.parse('{"data":{"__proto__":{"polluted":"x"},"ok":1}}') as Record<string, unknown>;
    expect(setAtPath(doc, ['data', '__proto__', 'polluted'], 'MARKER', {})).toBe(false);
    expect(setAtPath(doc, ['data', 'constructor', 'prototype', 'polluted'], 'MARKER', {})).toBe(false);
    expect(deleteAtPath(doc, ['data', '__proto__'])).toBe(false);
    expect(getAtPath(doc, ['data', 'constructor'])).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('only follows own properties', () => {
    expect(getAtPath({ a: {} }, ['a', 'toString'])).toBeUndefined();
    expect(setAtPath({ a: {} }, ['a', 'hasOwnProperty', 'x'], 1)).toBe(false);
  });

  it('orders deletions so higher array indices go first', () => {
    const paths = [['p', '1'], ['p', '10'], ['p', '2']];
    expect(paths.sort(compareForDeletion)).toEqual([['p', '10'], ['p', '2'], ['p', '1']]);
  });

  it('renders the body API notation with brackets for array items', () => {
    const body = { items: [{ sku: 'X1' }], 'a.b': 1 };
    expect(toBracketPath(body, ['items', '0', 'sku'])).toBe('items[0].sku');
    expect(toBracketPath(body, ['a.b'])).toBe('a.b');
  });
});
