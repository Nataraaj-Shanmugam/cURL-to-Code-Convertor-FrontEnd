import { describe, it, expect } from 'vitest';
import { buildFullUrl } from '@/lib/utils/urlBuilder';
import { MASK } from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const base: ParsedCurl = { method: 'GET', base_url: 'https://api.example.com', endpoint: '/users' };

describe('buildFullUrl', () => {
  it('encodes query keys and values (no raw spaces, ampersands or hashes)', () => {
    const url = buildFullUrl({ ...base, query_params: { q: 'a b&c=d#e', 'tag list': 'x/y' } });
    expect(url).toBe('https://api.example.com/users?q=a%20b%26c%3Dd%23e&tag%20list=x%2Fy');
  });

  it('does not double-encode a value that is already percent-encoded', () => {
    expect(buildFullUrl({ ...base, query_params: { q: 'a%20b' } })).toBe('https://api.example.com/users?q=a%20b');
  });

  it('repeats array parameters and keeps 0 / false values', () => {
    const url = buildFullUrl({ ...base, query_params: { id: [1, 0], flag: false, offset: 0 } });
    expect(url).toBe('https://api.example.com/users?id=1&id=0&flag=false&offset=0');
  });

  it('replaces every occurrence of a path parameter and keeps a value of 0', () => {
    const url = buildFullUrl({
      ...base,
      endpoint: '/users/{id}/friends/{id}/posts/{n}',
      path_parameters: [
        { name: 'id', value: 'a b' },
        { name: 'n', value: 0 },
      ],
    });
    expect(url).toBe('https://api.example.com/users/a%20b/friends/a%20b/posts/0');
  });

  it('accepts path_parameters as a map and leaves unset placeholders visible', () => {
    const url = buildFullUrl({
      ...base,
      endpoint: '/o/{org}/r/{repo}',
      path_parameters: { org: { value: 'acme' } } as unknown as unknown[],
    });
    expect(url).toBe('https://api.example.com/o/acme/r/{repo}');
  });

  it('appends to an existing query string with &', () => {
    expect(buildFullUrl({ ...base, endpoint: '/users?x=1', query_params: { y: '2' } })).toBe(
      'https://api.example.com/users?x=1&y=2',
    );
  });

  it('falls back to url when base_url and endpoint are empty', () => {
    expect(buildFullUrl({ method: 'GET', base_url: '', endpoint: '', url: 'https://h.test/a?z=1' })).toBe(
      'https://h.test/a?z=1',
    );
  });

  it('keeps the mask readable instead of percent-encoding it', () => {
    const url = buildFullUrl({ ...base, query_params: { api_key: MASK } });
    expect(url).toBe(`https://api.example.com/users?api_key=${MASK}`);
    expect(url).not.toContain('%E2');
  });
});
