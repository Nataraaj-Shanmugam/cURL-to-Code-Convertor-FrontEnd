import { describe, it, expect } from 'vitest';
import { javaIdentifierError, statusCodeError } from '@/lib/utils/codegenValidation';

describe('javaIdentifierError', () => {
  it('accepts identifiers', () => {
    for (const ok of ['testGet_users', '_x', '$y', 'Batch2', ' padded ']) expect(javaIdentifierError(ok)).toBeNull();
  });

  it('rejects empty and non-identifiers', () => {
    expect(javaIdentifierError('')).toBe('Required');
    expect(javaIdentifierError('   ')).toBe('Required');
    for (const bad of ['same name', 'My Test Class', '1abc', 'a-b', 'X { } // ', 'a()']) {
      expect(javaIdentifierError(bad)).toMatch(/valid Java identifier/);
    }
  });
});

describe('statusCodeError', () => {
  it('accepts 100 to 599', () => {
    for (const ok of ['100', '200', '204', '599', ' 201 ']) expect(statusCodeError(ok)).toBeNull();
  });

  it('rejects empty, out-of-range and non-integer values', () => {
    expect(statusCodeError('')).toBe('Required');
    for (const bad of ['99', '600', '999', '20.5', '2e2', '-200', 'abc']) {
      expect(statusCodeError(bad)).toMatch(/100 to 599/);
    }
  });
});
