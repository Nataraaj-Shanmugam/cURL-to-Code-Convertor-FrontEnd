import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import BatchEditorPage from '@/pages/BatchEditorPage';
import CurlPlayground from '@/components/features/curl/CurlPlayground';
import type { ParsedCurlEntry, BatchParseFailure } from '@/types/batch';

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
    <Routes>
      <Route path="/batch-editor" element={<BatchEditorPage />} />
      <Route path="/playground" element={<div>Playground route</div>} />
    </Routes>,
    { routerProps: { initialEntries: [{ pathname: '/batch-editor', state }] } },
  );

/** Sidebar row (select button) for the request with this label. */
const row = (name: string) => within(screen.getByRole('list', { name: 'Requests' })).getByRole('button', { name });
const rowNames = () =>
  within(screen.getByRole('list', { name: 'Requests' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

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

      expect(rowNames()).toEqual(['GETGET /a', 'POSTPOST /b', 'DELETEDELETE /c']);
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
      expect(entries[0]).toHaveTextContent('curl nonsense one');
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
      expect(rowNames()[0]).toBe('GETGET /a-edited');
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

      expect(rowNames()).toEqual(['GETGET /a', 'POSTPOST /b-edited', 'DELETEDELETE /c']);
    });
  });

  describe('removing requests', () => {
    it('removes the request and selects its neighbour', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });

      await user.click(screen.getByRole('button', { name: 'Remove GET /a' }));

      expect(rowNames()).toEqual(['POSTPOST /b', 'DELETEDELETE /c']);
      expect(row('POST /b')).toHaveAttribute('aria-current', 'true');
      expect(screen.getByText('curl -X POST https://api.example.com/b')).toBeVisible();
    });

    it('after removing an earlier request, Save writes to the request being edited, not the next one', async () => {
      // Regression: the editor was keyed by index, so after a removal it was not remounted and the
      // next Save overwrote whichever request had slid into the removed one's slot.
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await user.click(row('POST /b'));
      await user.click(screen.getByRole('button', { name: 'Remove GET /a' }));

      await editEndpoint(user, '/b-saved');
      await user.click(screen.getByRole('button', { name: /^Save$/ }));

      expect(rowNames()).toEqual(['POSTPOST /b-saved', 'DELETEDELETE /c']);
    });

    it('removing the request currently being edited does not leak its edits into the next one', async () => {
      const user = userEvent.setup();
      renderPage({ items: ITEMS });
      await editEndpoint(user, '/a-edited');

      await user.click(screen.getByRole('button', { name: 'Remove GET /a-edited' }));

      expect(rowNames()).toEqual(['POSTPOST /b', 'DELETEDELETE /c']);
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
      expect(rowNames()).toEqual(['POSTPOST /users', 'GETGET /orders']);
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
      expect(alert).toHaveTextContent('curl invalid-garbage');
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
