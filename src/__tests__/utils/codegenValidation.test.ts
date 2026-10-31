import { describe, it, expect } from 'vitest';
import { javaIdentifierError } from '@/lib/utils/codegenValidation';

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
