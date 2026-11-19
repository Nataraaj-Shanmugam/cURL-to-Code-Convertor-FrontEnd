import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { render, renderWithProviders } from '../test-utils';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';
import type { BackendStatus } from '@/contexts/BackendStatusContext';

// Regression tests for the design / accessibility audit (D-1 .. D-16). jsdom has no layout, so
// geometry (390 px rows, contrast of rendered pixels, 40 px targets) is measured in the Playwright
// suite (e2e/design.spec.ts); these cover structure, names, roles, focus and copy.

const status = vi.hoisted(() => ({ value: 'ready' as BackendStatus, retry: vi.fn() }));
vi.mock('@/contexts/BackendStatusContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/BackendStatusContext')>();
  return {
    ...actual,
    useBackendStatus: () => ({
      status: status.value,
      wakingSince: status.value === 'waking' ? Date.now() : null,
      retry: status.retry,
      waitUntilReady: () => Promise.resolve(),
    }),
  };
});

import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import { PageHeadingLevelProvider } from '@/components/layout/PageHeading';
import BackendStatusChip from '@/components/features/backend/BackendStatusChip';
import Playground from '@/pages/Playground';
import CurlPlayground from '@/components/features/curl/CurlPlayground';
import CodeGenerationDialog from '@/components/features/curl/CodeGenerationDialog';
import RequestPreviewDialog from '@/components/features/curl/RequestPreviewDialog';
import DiffViewDialog from '@/components/features/curl/DiffViewDialog';
import BatchCodeGenerationDialog from '@/components/features/curl/BatchCodeGenerationDialog';
import ResultPanel from '@/components/features/curl/codegen/ResultPanel';
import { CodeBlock } from '@/components/ui/code-block';
import { MethodBadge } from '@/components/ui/method-badge';
import EditorPage from '@/pages/EditorPage';
import { listSecretFields } from '@/lib/utils/redaction';
import { CODE_COLORS } from '@/lib/codeTheme';
import type { BatchItem } from '@/types/batch';

const parsed = mockParsedCurl as unknown as ParsedCurl;
const user = userEvent.setup();

beforeEach(() => {
  status.value = 'ready';
  status.retry.mockClear();
});

describe('D-4 heading order', () => {
  const levels = (root: ParentNode) =>
    Array.from(root.querySelectorAll('h1,h2,h3,h4')).map((h) => Number(h.tagName[1]));

  /** No heading may skip a level going down (axe heading-order). */
  const expectNoSkips = (list: number[]) => {
    list.forEach((level, i) => {
      if (i > 0) expect(level - list[i - 1]!, `h${list[i - 1]} -> h${level}`).toBeLessThanOrEqual(1);
    });
  };

  it('the editor puts its section headings one level under the h1 title', () => {
    const { container } = render(<ParsedCurlEditor initialData={parsed} originalCurl="curl x" />);
    const list = levels(container);
    expect(list[0]).toBe(1);
    expect(list.filter((l) => l === 1)).toHaveLength(1);
    expect(list).toContain(2);
    expect(list).not.toContain(3);
    expectNoSkips(list);
  });

  it('under the batch route (title demoted to h2) the sections are h3', () => {
    const { container } = render(
      <PageHeadingLevelProvider value="h2">
        <h1 className="sr-only">Batch editor</h1>
        <ParsedCurlEditor initialData={parsed} />
      </PageHeadingLevelProvider>,
    );
    const list = levels(container);
    expect(list.filter((l) => l === 1)).toHaveLength(1);
    expectNoSkips(list);
    expect(list).toContain(3);
  });
});

describe('D-5 status chip', () => {
  it('names the unavailable chip by its visible text (no overriding aria-label)', () => {
    status.value = 'unavailable';
    render(<BackendStatusChip data-testid="chip" />);
    const chip = screen.getByRole('button');
    expect(chip).not.toHaveAttribute('aria-label');
    expect(chip).toHaveTextContent('Generator unavailable');
    expect(chip).toHaveTextContent('Retry');
    expect(chip).toHaveAccessibleName(/Generator unavailable\s*Retry/);
    expect(chip.getAttribute('title')).toMatch(/Retry connecting/);
  });

  it('the compact chip still has a name (it draws no text)', () => {
    status.value = 'unavailable';
    render(<BackendStatusChip compact />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/Generator unavailable\s*Retry/);
  });

  it('the Playground page does not draw a second chip (the NavBar owns it)', () => {
    status.value = 'waking';
    renderWithProviders(<Playground />);
    expect(screen.queryByTestId('backend-status-playground')).toBeNull();
    expect(document.querySelectorAll('[data-status]')).toHaveLength(0);
  });
});

describe('D-6 explanatory banner', () => {
  it('explains Waking and offers no Retry', () => {
    status.value = 'waking';
    renderWithProviders(<CurlPlayground />);
    const banner = screen.getByTestId('backend-status-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent(/waking up/i);
    expect(banner).toHaveTextContent(/under a minute/i);
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(screen.getByRole('button', { name: /Parse cURL/ })).toHaveAccessibleDescription(/waking up/i);
  });

  it('says what failed and what still works for Unavailable, and Retry re-checks', async () => {
    status.value = 'unavailable';
    renderWithProviders(<CurlPlayground />);
    const banner = screen.getByTestId('backend-status-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent(/Generator unavailable/);
    expect(banner).toHaveTextContent(/cURL stays on this page/);
    await user.click(within(banner).getByRole('button', { name: 'Retry connection' }));
    expect(status.retry).toHaveBeenCalledTimes(1);
  });

  it.each<BackendStatus>(['ready', 'checking'])('shows nothing while %s', (s) => {
    status.value = s;
    renderWithProviders(<CurlPlayground />);
    expect(screen.queryByTestId('backend-status-banner')).toBeNull();
  });
});

describe('D-7 / D-10 code panes', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<suite name="s"/>';

  it('highlights the XML prolog in the legible prolog colour, not the stock navy', () => {
    render(<CodeBlock code={xml} label="testng.xml" language="xml" />);
    const prolog = screen.getByText(/<\?xml/, { selector: 'span' });
    expect(prolog).toHaveStyle({ color: CODE_COLORS.prolog });
    expect(document.body.innerHTML).not.toMatch(/rgb\(0,\s*0,\s*128\)|#000080/i);
  });

  it('uses the one code surface token', () => {
    render(<CodeBlock code="x" label="Sample" />);
    const pre = screen.getByRole('region', { name: 'Sample' });
    expect(pre.className).toMatch(/\bbg-code\b/);
    expect(pre.className).not.toMatch(/slate-950|1e1e1e/);
  });

  it('the generated-code pane is a named, focusable region', () => {
    render(
      <ResultPanel
        result={{
          testCode: 'class A {}',
          pojoCode: '',
          pomXml: '',
          testngXml: '',
          pomIsFull: false,
          testngHint: '',
          warnings: [],
          config: {},
        } as never}
        secretValues={[]}
      />,
    );
    const pane = screen.getByRole('region', { name: /Generated Test Code/ });
    expect(pane).toHaveAttribute('tabindex', '0');
    // the tab panel itself no longer scrolls, so there is exactly one scroll stop
    expect(screen.getByRole('tabpanel').className).not.toMatch(/overflow-auto/);
  });

  it('the Request Preview cURL pane is a focusable region', async () => {
    render(<RequestPreviewDialog open onOpenChange={() => {}} parsedData={parsed} />);
    await user.click(screen.getByRole('button', { name: /Reconstructed cURL/ }));
    expect(screen.getByRole('region', { name: 'reconstructed cURL text' })).toHaveAttribute('tabindex', '0');
  });

  it('the Review Changes raw JSON panes are focusable regions', async () => {
    const changed = { ...parsed, endpoint: '/other' } as ParsedCurl;
    render(<DiffViewDialog open onOpenChange={() => {}} originalParsed={parsed} currentParsed={changed} onRevert={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Raw JSON' }));
    expect(screen.getByRole('region', { name: 'original request JSON' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('region', { name: 'current request JSON' })).toHaveAttribute('tabindex', '0');
  });
});

describe('D-9 themed radios in Code Generation', () => {
  it('uses the RadioGroup primitive: no native radio inputs, arrow keys move the choice', async () => {
    render(<CodeGenerationDialog open onOpenChange={() => {}} parsedData={parsed} />);
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    const group = screen.getByRole('radiogroup', { name: /Generation Type/ });
    const full = within(group).getByRole('radio', { name: 'Full Test Class' });
    expect(full).toHaveAccessibleDescription(/Complete Java class/);
    await user.click(full);
    expect(full).toBeChecked();
    await user.keyboard('{ArrowDown}');
    expect(within(group).getByRole('radio', { name: 'Test Method Only' })).toBeChecked();
  });

  it('Data format is a themed radio group too', async () => {
    render(<CodeGenerationDialog open onOpenChange={() => {}} parsedData={parsed} />);
    await user.click(screen.getByRole('radio', { name: 'Full Test Class' }));
    await user.click(screen.getByRole('button', { name: /Maven/ }));
    const group = screen.getByRole('radiogroup', { name: 'Data format' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: 'JSON' })).toBeChecked();
  });
});

describe('D-11 batch rows', () => {
  const item = (id: string, method: string, endpoint: string): BatchItem => ({
    id,
    originalCurl: 'curl x',
    parsed: { method, base_url: 'https://api.example.com', endpoint },
    config: { option: 'method', className: 'C', methodName: 'm', assertionRequired: true, statusCode: '200', loggingRequired: true, needPojo: false },
    name: `${method} ${endpoint}`,
  });

  it('shows badge + path (not "GET GET /users/1") and labels both input columns', () => {
    renderWithProviders(<BatchCodeGenerationDialog open onOpenChange={() => {}} items={[item('a', 'GET', '/users/1')]} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/GET\s*GET/)).toBeNull();
    expect(within(dialog).getAllByText('GET')).toHaveLength(1);
    expect(within(dialog).getByText('/users/1')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Test method').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Expected status').length).toBeGreaterThan(0);
    expect(within(dialog).getByLabelText('Test method', { selector: 'input' })).toBeInTheDocument();
  });
});

describe('D-12 compact editor header', () => {
  it('keeps the original cURL collapsed by default and opens it on request', async () => {
    render(<ParsedCurlEditor initialData={parsed} originalCurl="curl https://api.example.com/users" />);
    const toggle = screen.getByRole('button', { name: /Original cURL Command/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('curl https://api.example.com/users')).toBeNull();
    await user.click(toggle);
    expect(screen.getByText('curl https://api.example.com/users')).toBeInTheDocument();
  });

  it('puts the saved-copy note and its Clear action in the same header', async () => {
    const onClear = vi.fn();
    render(
      <ParsedCurlEditor
        initialData={parsed}
        originalCurl="curl x"
        persistence={{ state: 'saved', onClear }}
      />,
    );
    const header = screen.getByRole('region', { name: 'Original request' });
    expect(within(header).getByText(/A copy of this request, with secrets redacted/)).toBeInTheDocument();
    await user.click(within(header).getByRole('button', { name: 'Clear saved request' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('on the page there is one region (no separate banner above the editor)', async () => {
    sessionStorage.clear();
    renderWithProviders(
      <Routes>
        <Route path="*" element={<EditorPage />} />
      </Routes>,
      { routerProps: { initialEntries: [{ pathname: '/editor', state: { parsed, originalCurl: 'curl x' } }] } },
    );
    const header = await screen.findByRole('region', { name: 'Original request' }, { timeout: 5000 });
    expect(within(header).getByRole('button', { name: 'Clear saved request' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').filter((el) => /A copy of this request/.test(el.textContent ?? ''))).toHaveLength(1);
  });

  it('the amber redaction banner is one sentence (the pills already mark the fields)', () => {
    const redacted = { ...parsed, headers: { Authorization: '[REDACTED]' } } as ParsedCurl;
    render(<ParsedCurlEditor initialData={redacted} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/Re-enter 1 redacted value to generate code/);
    expect(alert.textContent).not.toMatch(/They are the fields marked/);
  });
});

describe('D-13 initial focus', () => {
  it('Request Preview opens on its heading, not an eye button', async () => {
    render(<RequestPreviewDialog open onOpenChange={() => {}} parsedData={parsed} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Request Preview' })).toHaveFocus());
  });
});

describe('D-14 Playground autofocus', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });
  const desktop = (matches: boolean) => {
    window.matchMedia = ((query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as never;
  };

  it('focuses the cURL box on desktop', () => {
    desktop(true);
    renderWithProviders(<CurlPlayground />);
    expect(screen.getByRole('textbox', { name: 'cURL command' })).toHaveFocus();
  });

  it('leaves focus alone on a phone (no keyboard popping up over the page)', () => {
    desktop(false);
    renderWithProviders(<CurlPlayground />);
    expect(screen.getByRole('textbox', { name: 'cURL command' })).not.toHaveFocus();
  });
});

describe('D-15 touch targets', () => {
  it('small buttons are 40px tall below 640px, and checkbox hit areas grow', async () => {
    const { Button } = await import('@/components/ui/button');
    const { Checkbox } = await import('@/components/ui/checkbox');
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="icon" aria-label="Icon" />
        <Checkbox aria-label="Box" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Small' }).className).toContain('max-sm:h-10');
    expect(screen.getByRole('button', { name: 'Icon' }).className).toContain('max-sm:h-10');
    expect(screen.getByRole('checkbox', { name: 'Box' }).className).toContain('max-sm:after:-inset-3');
  });
});

describe('D-16 copy nits', () => {
  it('Review Changes drops zero-count chips and says "modified", not "~2 modifications"', () => {
    const changed = { ...parsed, endpoint: '/other', method: 'PUT' } as ParsedCurl;
    render(<DiffViewDialog open onOpenChange={() => {}} originalParsed={parsed} currentParsed={changed} onRevert={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/2 modified/)).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/\+0|-0 |~\d/);
    expect(within(dialog).queryByText(/added|removed/, { selector: 'span.inline-flex' })).toBeNull();
  });

  it('revert buttons say which field they revert', () => {
    const changed = { ...parsed, endpoint: '/other' } as ParsedCurl;
    render(<DiffViewDialog open onOpenChange={() => {}} originalParsed={parsed} currentParsed={changed} onRevert={() => {}} />);
    expect(screen.getByRole('button', { name: 'Revert endpoint' })).toBeInTheDocument();
  });

  it('Export labels the body copy "Raw body", not data_raw', () => {
    const withRaw = { ...parsed, data_raw: '{"password":"hunter2-hunter2"}' } as unknown as ParsedCurl;
    expect(listSecretFields(withRaw).map((f) => f.label)).toContain('Raw body');
    expect(listSecretFields(withRaw).map((f) => f.label)).not.toContain('data_raw');
  });

  it('MethodBadge is the one badge: same method, same classes anywhere', () => {
    render(
      <>
        <MethodBadge method="post" data-testid="a" />
        <MethodBadge method="POST" data-testid="b" />
      </>,
    );
    expect(screen.getByTestId('a').className).toBe(screen.getByTestId('b').className);
  });
});
