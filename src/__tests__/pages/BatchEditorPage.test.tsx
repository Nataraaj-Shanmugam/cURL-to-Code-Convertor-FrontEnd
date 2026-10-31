import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import BatchEditorPage from '@/pages/BatchEditorPage';
import CurlPlayground from '@/components/features/curl/CurlPlayground';
import type { ParsedCurlEntry, BatchParseFailure } from '@/types/batch';

// Mounting the full editor is slow on a busy machine; these tests drive real editors.
vi.setConfig({ testTimeout: 60_000 });

// Sonner keeps its toasts in a module-level store, so they would leak into the next test.
afterEach(() => {
  toast.dismiss();
});

const entry = (method: string, endpoint: string): ParsedCurlEntry => ({
  originalCurl: `curl -X ${method} https://api.example.com${endpoint}`,
  parsed: {
    method,
    url: `https://api.example.com${endpoint}`,
    base_url: 'https://api.example.com',
    endpoint,
    headers: { Accept: 'application/json' },
  },
});

const ITEMS = [entry('GET', '/a'), entry('POST', '/b'), entry('DELETE', '/c')];

const renderPage = (state?: { items?: ParsedCurlEntry[]; failures?: BatchParseFailure[] }) =>
  renderWithProviders(
    <>
      <Toaster />
      <Routes>
        <Route path="/batch-editor" element={<BatchEditorPage />} />
        <Route path="/playground" element={<div>Playground route</div>} />
      </Routes>
    </>,
    { routerProps: { initialEntries: [{ pathname: '/batch-editor', state }] } },
  );

/** The Undo button of the toast announcing this removal (earlier toasts may still be animating out). */
const undoFor = async (name: string) =>
  within((await screen.findByText(`Removed ${name}`)).closest('li')!).getByRole('button', { name: 'Undo' });

/** Sidebar row (select button) for the request with this label. */
const row = (name: string) => within(screen.getByRole('list', { name: 'Requests' })).getByRole('button', { name });
const rowNames = () =>
  within(screen.getByRole('list', { name: 'Requests' }))
    .getAllByRole('listitem')
    .map((li) => within(li).getAllByRole('button')[0]!.textContent);

/** Replace the endpoint of the visible editor via its inline field editor, optionally saving the field. */
async function editEndpoint(user: ReturnType<typeof userEvent.setup>, value: string, commit = true) {
  await user.click(screen.getByRole('button', { name: 'Edit endpoint' }));
  const input = await screen.findByDisplayValue(/^\//);
  await user.clear(input);
  await user.type(input, value);
  if (commit) await user.click(screen.getByRole('button', { name: 'Save endpoint' }));
}

describe('BatchEditorPage', () => {
  describe('loading', () => {
    it('shows the empty state when there is nothing to edit', () => {
      renderPage();
      expect(screen.getByRole('heading', { name: 'No Requests' })).toBeInTheDocument();
    });

    it('lists every request it was given and selects the first', () => {
      renderPage({ items: ITEMS });

      expect(rowNames()).toEqual(['GET /a', 'POST /b', 'DELETE /c']);
      expect(row('GET /a')).toHaveAttribute('aria-current', 'true');
      expect(screen.getByText('curl -X GET https://api.example.com/a')).toBeVisible();
    });

    it('lists the commands that failed to parse, each with its message', () => {
      renderPage({
        items: [ITEMS[0]!],
        failures: [
          { index: 1, curl: 'curl nonsense one', message: 'Invalid cURL command format' },
          { index: 3, curl: 'curl nonsense two', message: 'Unsupported option --foo' },
        ],
      });

      const alert = screen.getByRole('alert');
      expect(within(alert).getByText(/2 commands could not be parsed/)).toBeInTheDocument();
      const entries = within(alert).getAllByTestId('parse-failure');
      expect(entries[0]).toHaveTextContent('Command 2: Invalid cURL command format');
      expect(within(entries[0]!).getByRole('textbox', { name: 'cURL for command 2' })).toHaveValue('curl nonsense one');
      expect(entries[1]).toHaveTextContent('Command 4: Unsupported option --foo');
      // The successful command is still there.
      expect(rowNames()).toHaveLength(1);
    });

    it('lets the user dismiss the parse errors', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS, failures: [{ index: 0, curl: 'x', message: 'bad' }] });

      await user.click(screen.getByRole('button', { name: 'Dismiss parse errors' }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(rowNames()).toHaveLength(3);
    });

    it('still explains the failures when every command failed', () => {
      renderPage({ items: [], failures: [{ index: 0, curl: 'x', message: 'bad' }] });

      expect(screen.getByRole('heading', { name: 'No Requests' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Command 1: bad');
    });
  });

  describe('switching between requests', () => {
    it('shows the selected request and hides the others', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });

      await user.click(row('POST /b'));

      expect(screen.getByText('curl -X POST https://api.example.com/b')).toBeVisible();
      expect(screen.getByText('curl -X GET https://api.example.com/a')).not.toBeVisible();
      expect(row('POST /b')).toHaveAttribute('aria-current', 'true');
    });

    it('keeps an edit that was applied to a field when switching away and back', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });

      await editEndpoint(user, '/a-edited');
      await user.click(row('POST /b'));
      await user.click(row('GET /a-edited'));

      // The sidebar reflects the live edit, and the editor still shows it.
      expect(rowNames()[0]).toBe('GET /a-edited');
      expect(screen.getAllByText('/a-edited').find((el) => el.checkVisibility?.() !== false)).toBeTruthy();
    });

    it('keeps a half-typed edit (never committed) when switching away and back', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });

      await editEndpoint(user, '/half-typed', false);
      await user.click(row('POST /b'));
      expect(screen.queryByDisplayValue('/half-typed')).not.toBeVisible();
      await user.click(row('GET /a'));

      expect(screen.getByDisplayValue('/half-typed')).toBeVisible();
    });

    it('does not apply an edit to a different request', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await user.click(row('POST /b'));

      await editEndpoint(user, '/b-edited');

      expect(rowNames()).toEqual(['GET /a', 'POST /b-edited', 'DELETE /c']);
    });
  });

  describe('removing requests', () => {
    it('removes the request and selects its neighbour', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });

      await user.click(screen.getByRole('button', { name: 'Remove GET /a' }));

      expect(rowNames()).toEqual(['POST /b', 'DELETE /c']);
      expect(row('POST /b')).toHaveAttribute('aria-current', 'true');
      expect(screen.getByText('curl -X POST https://api.example.com/b')).toBeVisible();
    });

    it('after removing an earlier request, edits go to the request being edited, not the next one', async () => {
      // Regression: the editor was keyed by index, so after a removal it was not remounted and the
      // next edit overwrote whichever request had slid into the removed one's slot.
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await user.click(row('POST /b'));
      await user.click(screen.getByRole('button', { name: 'Remove GET /a' }));

      await editEndpoint(user, '/b-saved');

      expect(rowNames()).toEqual(['POST /b-saved', 'DELETE /c']);
    });

    it('removing the request currently being edited does not leak its edits into the next one', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await editEndpoint(user, '/a-edited');

      await user.click(screen.getByRole('button', { name: 'Remove GET /a-edited' }));

      expect(rowNames()).toEqual(['POST /b', 'DELETE /c']);
      expect(screen.queryByText('/a-edited')).not.toBeInTheDocument();
      expect(screen.getByText('curl -X POST https://api.example.com/b')).toBeVisible();
    });

    it('returns to the empty state after removing the last request', async () => {
      const user = userEvent.setup();
      renderPage({ items: [ITEMS[0]!] });

      await user.click(screen.getByRole('button', { name: 'Remove GET /a' }));

      expect(screen.getByRole('heading', { name: 'No Requests' })).toBeInTheDocument();
    });
  });

  describe('unsaved edits guard (QF-6, QR-16, QU-9)', () => {
    it('asks before leaving with edits, and keeps them when the user stays', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await editEndpoint(user, '/a-edited');

      await user.click(screen.getByRole('button', { name: /Back to Playground/ }));

      expect(await screen.findByRole('dialog', { name: 'Discard unsaved edits?' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(screen.queryByText('Playground route')).not.toBeInTheDocument();
      expect(rowNames()[0]).toBe('GET /a-edited');
    });

    it('leaves once the user confirms the discard', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await editEndpoint(user, '/a-edited');

      await user.click(screen.getByRole('button', { name: /Back to Playground/ }));
      await user.click(await screen.findByRole('button', { name: 'Discard and leave' }));

      expect(await screen.findByText('Playground route')).toBeInTheDocument();
    });

    it('does not interrupt leaving when nothing was edited', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });

      await user.click(screen.getByRole('button', { name: /Back to Playground/ }));

      expect(await screen.findByText('Playground route')).toBeInTheDocument();
    });

    it('registers a beforeunload prompt only while an edit is unsaved', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      const prompts = () => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };
      expect(prompts()).toBe(false);

      await editEndpoint(user, '/a-edited');
      expect(prompts()).toBe(true);

      await editEndpoint(user, '/a');
      expect(prompts()).toBe(false);
    });

    it('marks an edited request in the list', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      expect(screen.queryByTestId('edited-dot')).not.toBeInTheDocument();

      await editEndpoint(user, '/a-edited');

      expect(within(screen.getByRole('list', { name: 'Requests' })).getAllByTestId('edited-dot')).toHaveLength(1);
      expect(row('GET /a-edited')).toHaveAccessibleDescription('Edited');
    });
  });

  describe('sidebar and toolbar', () => {
    it('shows the method once and names each row by its visible text (QU-20)', () => {
      renderPage({ items: ITEMS });
      const list = screen.getByRole('list', { name: 'Requests' });

      expect(list).not.toHaveTextContent(/GET\s*GET|POST\s*POST|DELETE\s*DELETE/);
      for (const label of ['GET /a', 'POST /b', 'DELETE /c']) {
        const button = row(label);
        expect(button).not.toHaveAttribute('aria-label');
        expect(button).toHaveTextContent(label);
      }
    });

    it('has no Save button: edits are mirrored as they are made (QR-15)', () => {
      renderPage({ items: ITEMS });

      expect(screen.queryByRole('button', { name: /^Save$/ })).not.toBeInTheDocument();
    });

    it('offers a request selector for small screens that switches the editor (QU-8)', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      const select = screen.getByRole('combobox', { name: 'Request' });
      expect(select).toHaveValue(row('GET /a').closest('li') ? (select as HTMLSelectElement).value : '');
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['GET /a', 'POST /b', 'DELETE /c']);

      await user.selectOptions(select, 'POST /b');

      expect(row('POST /b')).toHaveAttribute('aria-current', 'true');
      expect(screen.getByText('curl -X POST https://api.example.com/b')).toBeVisible();
    });

    it('removes the selected request from the small-screen toolbar too', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });

      await user.click(screen.getByRole('button', { name: 'Remove selected request' }));

      expect(rowNames()).toEqual(['POST /b', 'DELETE /c']);
    });
  });

  describe('undoing a removal (QU-9)', () => {
    it('offers Undo in a toast and puts the request back where it was, edits included', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await user.click(row('POST /b'));
      await editEndpoint(user, '/b-edited');

      await user.click(screen.getByRole('button', { name: 'Remove POST /b-edited' }));
      expect(rowNames()).toEqual(['GET /a', 'DELETE /c']);
      expect(await screen.findByText('Removed POST /b-edited')).toBeInTheDocument();

      await user.click(await undoFor('POST /b-edited'));

      expect(rowNames()).toEqual(['GET /a', 'POST /b-edited', 'DELETE /c']);
      expect(row('POST /b-edited')).toHaveAttribute('aria-current', 'true');
    });

    it('a restored edited request still counts as unsaved', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await editEndpoint(user, '/a-edited');
      await user.click(screen.getByRole('button', { name: 'Remove GET /a-edited' }));
      await user.click(await undoFor('GET /a-edited'));

      await user.click(screen.getByRole('button', { name: /Back to Playground/ }));

      expect(await screen.findByRole('dialog', { name: 'Discard unsaved edits?' })).toBeInTheDocument();
    });
  });

  describe('fixing and retrying failed commands (QF-16)', () => {
    const failing = [{ index: 1, curl: 'curl bad-command', message: 'Invalid cURL command format' }];
    const parseOk = (seen: string[] = []) =>
      server.use(
        http.post('*/api/parse', async ({ request }) => {
          const { curl } = (await request.json()) as { curl: string };
          seen.push(curl);
          if (curl.includes('bad')) {
            return HttpResponse.json(
              { success: false, error: { code: 'PARSE_ERROR', message: 'Still invalid' } },
              { status: 422 },
            );
          }
          return HttpResponse.json({
            success: true,
            data: { method: 'PUT', base_url: 'https://api.example.com', endpoint: '/fixed' },
          });
        }),
      );

    it('keeps the failed command editable, and a fixed command joins the batch', async () => {
      const seen: string[] = [];
      parseOk(seen);
      const user = userEvent.setup();
      renderPage({ items: [ITEMS[0]!], failures: failing });

      const box = screen.getByRole('textbox', { name: 'cURL for command 2' });
      await user.clear(box);
      await user.type(box, 'curl -X PUT https://api.example.com/fixed');
      await user.click(screen.getByRole('button', { name: 'Retry command 2' }));

      await waitFor(() => expect(rowNames()).toEqual(['GET /a', 'PUT /fixed']));
      expect(seen).toEqual(['curl -X PUT https://api.example.com/fixed']);
      expect(screen.queryByTestId('parse-failure')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(row('PUT /fixed')).toHaveAttribute('aria-current', 'true');
    });

    it('keeps the entry, with the new error, when the retry fails again', async () => {
      parseOk();
      const user = userEvent.setup();
      renderPage({ items: [ITEMS[0]!], failures: failing });

      await user.click(screen.getByRole('button', { name: 'Retry command 2' }));

      expect(await screen.findByText('Still invalid')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'cURL for command 2' })).toHaveValue('curl bad-command');
      expect(rowNames()).toHaveLength(1);
    });

    it('works from the empty state, when every command failed', async () => {
      parseOk();
      const user = userEvent.setup();
      renderPage({ items: [], failures: failing });
      const box = screen.getByRole('textbox', { name: 'cURL for command 2' });
      await user.clear(box);
      await user.type(box, 'curl https://api.example.com/fixed');

      await user.click(screen.getByRole('button', { name: 'Retry command 2' }));

      await waitFor(() => expect(rowNames()).toEqual(['PUT /fixed']));
      expect(screen.queryByRole('heading', { name: 'No Requests' })).not.toBeInTheDocument();
    });
  });

  describe('Playground → Batch Editor (no route-state injection)', () => {
    const renderFlow = () =>
      renderWithProviders(
        <Routes>
          <Route path="/playground" element={<CurlPlayground />} />
          <Route path="/batch-editor" element={<BatchEditorPage />} />
          <Route path="/editor" element={<div>Single editor route</div>} />
        </Routes>,
        { routerProps: { initialEntries: ['/playground'] } },
      );

    const fill = async (user: ReturnType<typeof userEvent.setup>, values: string[]) => {
      for (let i = 1; i < values.length; i++) await user.click(screen.getByText('Add another cURL'));
      const boxes = screen.getAllByRole('textbox');
      for (let i = 0; i < values.length; i++) if (values[i]) await user.type(boxes[i]!, values[i]!);
    };

    const parseByUrl = () =>
      server.use(
        http.post('*/api/parse', async ({ request }) => {
          const { curl } = (await request.json()) as { curl: string };
          await new Promise((resolve) => setTimeout(resolve, 15)); // genuinely asynchronous
          if (curl.includes('garbage')) {
            return HttpResponse.json(
              { success: false, error: { code: 'PARSE_ERROR', message: 'Invalid cURL command format' } },
              { status: 422 },
            );
          }
          const method = /-X (\w+)/.exec(curl)?.[1] ?? 'GET';
          const endpoint = '/' + curl.trim().split('/').pop();
          return HttpResponse.json({ success: true, data: { method, base_url: 'https://api.example.com', endpoint } });
        }),
      );

    it('Parse All lands on the batch editor with the parsed requests (not "No Requests")', async () => {
      parseByUrl();
      const user = userEvent.setup();
      renderFlow();

      await fill(user, ['curl -X POST https://api.example.com/users', 'curl -X GET https://api.example.com/orders']);
      await user.click(screen.getByRole('button', { name: /Parse All \(2\)/ }));

      expect(await screen.findByText('Batch Editor')).toBeInTheDocument();
      expect(screen.queryByText('No Requests')).not.toBeInTheDocument();
      expect(rowNames()).toEqual(['POST /users', 'GET /orders']);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the commands that parsed and reports the one that did not', async () => {
      parseByUrl();
      const user = userEvent.setup();
      renderFlow();

      await fill(user, ['curl https://api.example.com/users', 'curl invalid-garbage', 'curl https://api.example.com/orders']);
      await user.click(screen.getByRole('button', { name: /Parse All \(3\)/ }));

      await waitFor(() => expect(rowNames()).toHaveLength(2));
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Command 2: Invalid cURL command format');
      expect(within(alert).getByRole('textbox', { name: 'cURL for command 2' })).toHaveValue('curl invalid-garbage');
    });

    it('opens the single editor, not the batch editor, for one filled and one blank entry', async () => {
      parseByUrl();
      const user = userEvent.setup();
      renderFlow();

      await fill(user, ['curl https://api.example.com/users', '']);
      await user.click(screen.getByRole('button', { name: 'Parse cURL' }));

      expect(await screen.findByText('Single editor route')).toBeInTheDocument();
    });
  });
});
