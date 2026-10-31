import { describe, it, expect } from 'vitest';
import { reconstructCurl } from '@/lib/utils/curlReconstructor';
import { MASK, redactParsedCurl } from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const base: ParsedCurl = { method: 'GET', base_url: 'https://api.example.com', endpoint: '/users' };
const flat = (curl: string) => curl.replace(/ \\\n\s*/g, ' ');

describe('reconstructCurl', () => {
  it('a GET with a body stays a GET (-X GET is explicit, never an implicit POST)', () => {
    const curl = flat(reconstructCurl({ ...base, data: '{"a":1}' }));
    expect(curl).toContain('-X GET');
    expect(curl).toContain("-d '{\"a\":1}'");
  });

  it('a plain GET has no -X', () => {
    expect(flat(reconstructCurl(base))).toBe("curl 'https://api.example.com/users'");
  });

  it('reconstructs -u from auth_config, including digest', () => {
    const basic = flat(reconstructCurl({ ...base, auth_config: { type: 'basic', username: 'ann', password: 'pw' } }));
    expect(basic).toContain("-u 'ann:pw'");
    const digest = flat(reconstructCurl({ ...base, auth_config: { type: 'digest', username: 'ann', password: 'pw' } }));
    expect(digest).toContain("--digest");
    expect(digest).toContain("-u 'ann:pw'");
  });

  it('reconstructs -k, --compressed, -L and the proxy', () => {
    const curl = flat(
      reconstructCurl({
        ...base,
        ssl_config: { insecure: true },
        transfer_config: { compressed: true, location: true, max_redirs: 3 },
        proxy_config: { proxy: 'http://proxy.local:8080', proxy_user: 'pu:pp' },
      }),
    );
    expect(curl).toContain('-k');
    expect(curl).toContain('--compressed');
    expect(curl).toContain('-L');
    expect(curl).toContain('--max-redirs 3');
    expect(curl).toContain("-x 'http://proxy.local:8080'");
    expect(curl).toContain("-U 'pu:pp'");
  });

  it('does not mistake the request url for a proxy and ignores false flags', () => {
    const curl = flat(reconstructCurl({ ...base, url: 'https://api.example.com/users', flags: { compressed: false } }));
    expect(curl).toBe("curl 'https://api.example.com/users'");
  });

  it('keeps a body of 0 and still sends -X for non-GET methods', () => {
    expect(flat(reconstructCurl({ ...base, method: 'PUT', data: '0' }))).toContain("-X PUT 'https://api.example.com/users' -d '0'");
  });

  it('masked reconstruction keeps the mask readable in URL, -u and proxy (QU-16)', () => {
    const masked = reconstructCurl(
      redactParsedCurl(
        {
          ...base,
          query_params: { api_key: 'sk_live_123456' },
          auth_config: { type: 'basic', username: 'ann', password: 'hunter2hunter2' },
          proxy_config: { proxy: 'http://u:p@proxy.local:8080' },
        },
        { placeholder: MASK },
      ),
    );
    expect(masked).toContain(`api_key=${MASK}`);
    expect(masked).not.toContain('%E2');
    expect(masked).toContain(`-u '${MASK}:${MASK}'`);
    expect(masked).not.toContain('sk_live_123456');
    expect(masked).not.toContain('hunter2');
  });
});
