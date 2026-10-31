import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import RequestPreviewDialog from '@/components/features/curl/RequestPreviewDialog';
import ExportJsonDialog from '@/components/features/curl/ExportJsonDialog';
import DiffViewDialog from '@/components/features/curl/DiffViewDialog';
import CodeGenerationDialog from '@/components/features/curl/CodeGenerationDialog';
import { render } from '../test-utils';
import { MASK, REDACTED_PLACEHOLDER } from '@/lib/utils/redaction';
import type { ParsedCurl } from '@/types/curl';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.SECRET-PAYLOAD.sig';
const COOKIE = 'cookie-secret-value';
const PASSWORD = 'hunter2-hunter2';
const API_KEY = 'qk-123456-abc';

const parsed: ParsedCurl = {
  method: 'POST',
  url: `https://api.example.com/users?api_key=${API_KEY}`,
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  query_params: { api_key: API_KEY, page: '1' },
  cookies: { session_id: COOKIE },
  data: { name: 'John', password: PASSWORD },
};
const originalCurl = `curl -X POST 'https://api.example.com/users?api_key=${API_KEY}' -H 'Authorization: Bearer ${TOKEN}' -b 'session_id=${COOKIE}'`;

const everySecret = [TOKEN, COOKIE, PASSWORD, API_KEY];
const REDACTED_FILE_NAME = /^parsed-curl-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.redacted\.json$/;
const pageText = () => document.body.textContent ?? '';
const expectNoSecrets = () => {
  for (const secret of everySecret) expect(pageText()).not.toContain(secret);
};

describe('ParsedCurlEditor: secret masking', () => {
  const user = userEvent.setup();

  it('shows no secret value anywhere in the editor by default', () => {
    render(<ParsedCurlEditor initialData={parsed} originalCurl={originalCurl} />);
    expectNoSecrets();
    expect(pageText()).toContain(`Bearer ${MASK}`);
    // non-secret values stay readable
    expect(pageText()).toContain('application/json');
    expect(pageText()).toContain('John');
  });

  it('reveals and re-hides one field without touching the others', async () => {
    render(<ParsedCurlEditor initialData={parsed} />);
    const toggle = screen.getByRole('button', { name: 'Reveal value of Authorization' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(pageText()).toContain(`Bearer ${TOKEN}`);
    expect(pageText()).not.toContain(COOKIE);
    expect(pageText()).not.toContain(PASSWORD);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(pageText()).not.toContain(TOKEN);
  });

  it('masks secret leaves of the request body and reveals them on demand', async () => {
    render(<ParsedCurlEditor initialData={parsed} />);
    const toggle = await screen.findByRole('button', { name: 'Reveal value of password' });
    expect(pageText()).not.toContain(PASSWORD);
    await user.click(toggle);
    expect(pageText()).toContain(PASSWORD);
  });

  it('masks the original cURL command behind a single toggle', async () => {
    render(<ParsedCurlEditor initialData={parsed} originalCurl={originalCurl} />);
    const toggle = screen.getByRole('button', { name: 'Reveal value of original cURL command' });
    await user.click(toggle);
    expect(pageText()).toContain(`Authorization: Bearer ${TOKEN}`);
  });

  it('keeps a secret masked in the edit box until revealed', async () => {
    render(<ParsedCurlEditor initialData={parsed} />);
    await user.click(screen.getByRole('button', { name: 'Edit Authorization' }));
    const input = screen.getByLabelText('Value of Authorization') as HTMLInputElement;
    expect(input.type).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Reveal value of Authorization' }));
    expect(input.type).toBe('text');
  });

  it('has no toggle for values that are not secret', () => {
    render(<ParsedCurlEditor initialData={parsed} />);
    expect(screen.queryByRole('button', { name: 'Reveal value of Content-Type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal value of method' })).not.toBeInTheDocument();
  });

  describe('redacted request restored from a saved session', () => {
    const redacted: ParsedCurl = {
      ...parsed,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${REDACTED_PLACEHOLDER}` },
      cookies: { session_id: REDACTED_PLACEHOLDER },
      data: { name: 'John', password: REDACTED_PLACEHOLDER },
    };

    it('warns, and marks each redacted field for re-entry', () => {
      render(<ParsedCurlEditor initialData={redacted} />);
      expect(screen.getByRole('alert')).toHaveTextContent(/Re-enter 3 redacted values to generate code/i);
      expect(screen.getAllByText(/Redacted: re-enter value/i).length).toBeGreaterThanOrEqual(3);
      // nothing left to reveal on a placeholder
      expect(screen.queryByRole('button', { name: 'Reveal value of Authorization' })).not.toBeInTheDocument();
    });

    it('blocks Generate Code until every placeholder is re-entered', () => {
      render(<ParsedCurlEditor initialData={redacted} />);
      const generate = screen.getByRole('button', { name: /Generate Code/ });
      expect(generate).toBeDisabled();
      expect(generate).toHaveAccessibleDescription(/Re-enter 3 redacted values to generate code/i);
    });

    it('drops the warning and unblocks Generate Code once every placeholder has been replaced, even though the original cURL still shows one', async () => {
      const originalCurl = `curl https://api.example.com -H 'Authorization: Bearer ${REDACTED_PLACEHOLDER}'`;
      render(
        <ParsedCurlEditor
          initialData={{ ...redacted, cookies: {}, data: undefined, headers: { Authorization: `Bearer ${REDACTED_PLACEHOLDER}` } }}
          originalCurl={originalCurl}
        />,
      );
      expect(screen.getByRole('alert')).toHaveTextContent(/Re-enter 1 redacted value to generate code/i);
      expect(screen.getByText(/secrets redacted when saved/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Edit Authorization' }));
      const input = screen.getByLabelText('Value of Authorization');
      await user.clear(input);
      await user.type(input, 'Bearer new-token');
      await user.click(screen.getByRole('button', { name: 'Save Authorization' }));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Generate Code/ })).toBeEnabled();
    });

    it('shows no warning for a fresh, unredacted request', () => {
      render(<ParsedCurlEditor initialData={parsed} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('RequestPreviewDialog: secret masking', () => {
  const user = userEvent.setup();
  const renderPreview = () => render(<RequestPreviewDialog open onOpenChange={vi.fn()} parsedData={parsed} />);

  it('masks headers, cookies, URL, body and reconstructed cURL', async () => {
    renderPreview();
    await user.click(screen.getByRole('button', { name: /Cookies/ }));
    await user.click(screen.getByRole('button', { name: /Request Body/ }));
    await user.click(screen.getByRole('button', { name: /Reconstructed cURL/ }));
    expectNoSecrets();
    expect(pageText()).toContain('Content-Type');
  });

  it('reveals a header on its own toggle with aria-pressed', async () => {
    renderPreview();
    const toggle = screen.getByRole('button', { name: 'Reveal value of Authorization' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(pageText()).toContain(TOKEN);
    expect(pageText()).not.toContain(API_KEY);
  });

  it('reveals the URL separately', async () => {
    renderPreview();
    await user.click(screen.getByRole('button', { name: 'Reveal value of request URL' }));
    expect(pageText()).toContain(`api_key=${API_KEY}`);
  });

  describe('Copy cURL', () => {
    let writeText: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });
    afterEach(() => vi.restoreAllMocks());

    it('copies the real command by default', async () => {
      renderPreview();
      await user.click(screen.getByRole('button', { name: /Reconstructed cURL/ }));
      await user.click(screen.getByRole('button', { name: /Copy cURL/ }));
      expect(writeText.mock.calls[0]![0]).toContain(TOKEN);
    });

    it('copies a redacted command when the user opts in', async () => {
      renderPreview();
      await user.click(screen.getByRole('button', { name: /Reconstructed cURL/ }));
      await user.click(screen.getByRole('checkbox', { name: 'Redact secrets when copying' }));
      await user.click(screen.getByRole('button', { name: /Copy cURL/ }));
      const copied = writeText.mock.calls[0]![0] as string;
      for (const secret of everySecret) expect(copied).not.toContain(secret);
      expect(copied).toContain(REDACTED_PLACEHOLDER);
    });
  });
});

describe('ExportJsonDialog', () => {
  const user = userEvent.setup();
  let createdBlob: Blob | null;

  beforeEach(() => {
    createdBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const renderExport = () => render(<ExportJsonDialog open onOpenChange={vi.fn()} parsedData={parsed} />);

  it('previews the JSON with secrets masked and lists each secret with a toggle', () => {
    renderExport();
    expectNoSecrets();
    expect(screen.getByText(/secret values are hidden below/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reveal value of headers.Authorization' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Reveal value of cookies.session_id' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reveal value of data.password' })).toBeInTheDocument();
  });

  it('reveals one field at a time', async () => {
    renderExport();
    const toggle = screen.getByRole('button', { name: 'Reveal value of data.password' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(pageText()).toContain(PASSWORD);
    expect(pageText()).not.toContain(TOKEN);
  });

  it('downloads a redacted file by default, named as such', async () => {
    renderExport();
    const toggle = screen.getByRole('checkbox', { name: 'Redact secrets in the downloaded file' });
    expect(toggle).toBeChecked();
    expect(screen.getByText(REDACTED_FILE_NAME)).toBeInTheDocument();
    const clicked = vi.mocked(HTMLAnchorElement.prototype.click);
    await user.click(screen.getByRole('button', { name: /Download JSON/ }));
    const text = await createdBlob!.text();
    for (const secret of everySecret) expect(text).not.toContain(secret);
    expect(text).toContain(REDACTED_PLACEHOLDER);
    expect(JSON.parse(text).headers['Content-Type']).toBe('application/json');
    expect((clicked.mock.contexts[0] as HTMLAnchorElement).download).toMatch(REDACTED_FILE_NAME);
  });

  it('downloads the real values only when redaction is turned off (masking is display only)', async () => {
    renderExport();
    await user.click(screen.getByRole('checkbox', { name: 'Redact secrets in the downloaded file' }));
    expect(screen.getByText(/will contain the real secret values/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Download JSON/ }));
    const text = await createdBlob!.text();
    expect(text).toContain(TOKEN);
    expect(text).not.toContain(MASK);
  });

  it('opens with focus on the redact choice, not on an eye button', async () => {
    renderExport();
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Redact secrets in the downloaded file' })).toHaveFocus(),
    );
  });

  it('announces masks as "hidden value" instead of bullets', () => {
    renderExport();
    const preview = document.querySelector('pre')!;
    expect(within(preview).getAllByText('hidden value').length).toBeGreaterThanOrEqual(3);
    for (const bullets of within(preview).getAllByText(MASK)) expect(bullets).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('CodeGenerationDialog: redacted request and output redaction', () => {
  const user = userEvent.setup();

  it('warns before generating from a request with placeholders', () => {
    const redacted: ParsedCurl = { ...parsed, headers: { Authorization: `Bearer ${REDACTED_PLACEHOLDER}` } };
    render(<CodeGenerationDialog open onOpenChange={vi.fn()} parsedData={redacted} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/will contain \[REDACTED\]/);
  });

  it('shows no warning for a complete request', () => {
    render(<CodeGenerationDialog open onOpenChange={vi.fn()} parsedData={parsed} />);
    expect(within(document.body).queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('generated code view', () => {
    const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.token';
    const writeText = vi.fn();
    afterEach(() => vi.restoreAllMocks());
    const openResult = async () => {
      writeText.mockReset().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      render(<CodeGenerationDialog open onOpenChange={vi.fn()} parsedData={{ ...parsed, headers: { Authorization: `Bearer ${TOKEN}` } }} />);
      await user.click(screen.getByLabelText(/Full Test Class/i));
      await user.click(screen.getByRole('button', { name: /^Generate Code$/i }));
      await screen.findByText('Generated Code', { exact: true }, { timeout: 5000 });
    };

    it('masks secrets on screen until revealed', async () => {
      await openResult();
      expect(document.body.textContent).not.toContain(TOKEN);
      expect(document.body.textContent).toContain(MASK);
      const toggle = screen.getByRole('button', { name: 'Reveal value of generated code' });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(document.body.textContent).toContain(TOKEN);
    });

    it('copies redacted code by default and the real code only through Copy with secrets', async () => {
      await openResult();
      await user.click(screen.getByRole('button', { name: 'Copy redacted' }));
      const redacted = writeText.mock.calls[0]![0] as string;
      expect(redacted).not.toContain(TOKEN);
      expect(redacted).toContain(REDACTED_PLACEHOLDER);

      await user.click(screen.getByRole('button', { name: 'Copy with secrets' }));
      expect(writeText.mock.calls[1]![0]).toContain(TOKEN);
    });

    it('downloads real values unless redaction is chosen', async () => {
      let createdBlob: Blob | undefined;
      URL.createObjectURL = vi.fn((b: Blob) => { createdBlob = b; return 'blob:x'; });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      await openResult();
      await user.click(screen.getByRole('button', { name: 'Download' }));
      expect(await createdBlob!.text()).toContain(TOKEN);

      await user.click(screen.getByRole('checkbox', { name: 'Redact secrets in downloaded files' }));
      await user.click(screen.getByRole('button', { name: 'Download' }));
      const text = await createdBlob!.text();
      expect(text).not.toContain(TOKEN);
      expect(text).toContain(REDACTED_PLACEHOLDER);
    });
  });
});

describe('DiffViewDialog: secret masking', () => {
  const user = userEvent.setup();
  const NEW_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.NEW-PAYLOAD.sig2';
  const current: ParsedCurl = {
    ...parsed,
    headers: { ...parsed.headers, Authorization: `Bearer ${NEW_TOKEN}` },
    data: { name: 'Jane', password: PASSWORD },
  };
  const renderDiff = () =>
    render(<DiffViewDialog open onOpenChange={vi.fn()} originalParsed={parsed} currentParsed={current} onRevert={vi.fn()} />);

  it('masks old and new secret values in the change table, with one reveal toggle per row', async () => {
    renderDiff();
    expectNoSecrets();
    expect(pageText()).not.toContain(NEW_TOKEN);
    // non-secret changes stay readable and get no toggle
    expect(pageText()).toContain('Jane');
    expect(screen.queryByRole('button', { name: 'Reveal value of data.name' })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Reveal value of headers.Authorization' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(pageText()).toContain(TOKEN);
    expect(pageText()).toContain(NEW_TOKEN);
    expect(pageText()).not.toContain(PASSWORD);
    const reverts = screen.getAllByRole('button', { name: 'Revert change' });
    expect(reverts.some((b) => b.getAttribute('aria-describedby') && /headers\.Authorization/.test(
      document.getElementById(b.getAttribute('aria-describedby')!)?.textContent ?? '',
    ))).toBe(true);
  });

  it('masks both Raw JSON panes, each with its own toggle', async () => {
    renderDiff();
    await user.click(screen.getByRole('tab', { name: 'Raw JSON' }));
    expectNoSecrets();
    expect(pageText()).not.toContain(NEW_TOKEN);
    await user.click(screen.getByRole('button', { name: 'Reveal value of current request JSON' }));
    expect(pageText()).toContain(NEW_TOKEN);
    expect(pageText()).not.toContain(TOKEN); // the original pane stays masked
    expect(screen.getByRole('button', { name: 'Reveal value of original request JSON' })).toHaveAttribute('aria-pressed', 'false');
  });
});
