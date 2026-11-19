import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import Feedback from '@/pages/Feedback';
import { renderWithProviders } from '../test-utils';
import { server } from '../mocks/server';

const DETAILS = 'Please add a way to import HAR files too.';

describe('Feedback page (/feedback)', () => {
  it('is reachable on its own, with one h1 and the production fields', () => {
    renderWithProviders(<Feedback />, { routerProps: { initialEntries: ['/feedback'] } });
    expect(screen.getByRole('heading', { level: 1, name: 'Feedback' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /Category/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Details/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    // Nothing to attach when it is not opened from a parse error.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('submits { email, category, details, metadata } and thanks the user', async () => {
    let payload: Record<string, unknown> = {};
    server.use(
      http.post('*/api/feedback', async ({ request }) => {
        payload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Feedback />, { routerProps: { initialEntries: ['/feedback'] } });
    await user.click(screen.getByRole('radio', { name: 'Feature request' }));
    await user.type(screen.getByLabelText(/Details/), DETAILS);
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));

    expect(await screen.findByText('Thank you for your feedback!')).toBeInTheDocument();
    expect(payload).toMatchObject({ email: '', category: 'feature', details: DETAILS });
    expect(payload.metadata).toHaveProperty('screenResolution');

    await user.click(screen.getByRole('button', { name: /Send more feedback/i }));
    expect(screen.getByLabelText(/Details/)).toHaveValue('');
  });

  it('opened from "Report this cURL": a bug is preselected and the command can be attached, redacted', async () => {
    let payload: Record<string, unknown> = {};
    server.use(
      http.post('*/api/feedback', async ({ request }) => {
        payload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Feedback />, {
      routerProps: {
        initialEntries: [
          { pathname: '/feedback', state: { category: 'bug', curlCommand: "curl https://x.test -H 'Authorization: Bearer tok-12345678'" } },
        ],
      },
    });
    expect(screen.getByRole('radio', { name: 'Functionality bug' })).toBeChecked();
    const attach = screen.getByRole('checkbox', { name: /Include my cURL command/i });
    expect(attach).not.toBeChecked();

    await user.click(attach);
    await user.type(screen.getByLabelText(/Details/), 'Parsing this command fails for me.');
    await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    await waitFor(() => expect(payload.curl_command).toBeTruthy());
    expect(payload.category).toBe('bug');
    expect(JSON.stringify(payload)).not.toContain('tok-12345678');
  });

  it('ignores an unknown category in the route state', () => {
    renderWithProviders(<Feedback />, {
      routerProps: { initialEntries: [{ pathname: '/feedback', state: { category: 'nonsense' } }] },
    });
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0);
  });
});
