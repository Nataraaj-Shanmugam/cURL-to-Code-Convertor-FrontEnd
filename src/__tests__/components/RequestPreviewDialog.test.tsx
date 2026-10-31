import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestPreviewDialog from '@/components/features/curl/RequestPreviewDialog';
import { render } from '../test-utils';
import { MASK } from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const user = userEvent.setup();
const pageText = () => document.body.textContent ?? '';

async function openCurl(parsed: ParsedCurl) {
  render(<RequestPreviewDialog open onOpenChange={vi.fn()} parsedData={parsed} />);
  await user.click(screen.getByRole('button', { name: /Reconstructed cURL/ }));
}

describe('RequestPreviewDialog: request matches the real request', () => {
  it('shows the mask, not its percent-encoding, in the reconstructed cURL (QU-16)', async () => {
    await openCurl({
      method: 'GET',
      base_url: 'https://api.example.com',
      endpoint: '/v2/users',
      query_params: { api_key: 'qk-123456-abc', page: '1' },
    });
    expect(pageText()).toContain(`/v2/users?api_key=${MASK}&page=1`);
    expect(pageText()).not.toContain('%E2%80%A2');
    expect(pageText()).not.toContain('qk-123456-abc');
  });

  it('reconstructs -u, -k, --compressed, -L and the proxy, and keeps a GET body a GET', async () => {
    await openCurl({
      method: 'GET',
      base_url: 'https://api.example.com',
      endpoint: '/items/{id}',
      path_parameters: [{ name: 'id', value: 0 }],
      data: '{"a":1}',
      ssl_config: { insecure: true },
      transfer_config: { compressed: true, location: true },
      proxy_config: { proxy: 'http://proxy.local:8080' },
      auth_config: { type: 'basic', username: 'ann', password: 'pw' },
    });
    const text = pageText();
    expect(text).toContain('-X GET');
    expect(text).toContain('-k');
    expect(text).toContain('--compressed');
    expect(text).toContain('-L');
    expect(text).toContain("-x 'http://proxy.local:8080'");
    expect(text).toContain("-u '••••••••:••••••••'");
    expect(text).toContain('/items/0');
  });
});
