import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import FeedbackDialog from '@/components/features/feedback/FeedbackDialog';
import { render } from '../test-utils';
import { server } from '../mocks/server';

const feedbackEndpoint = '*/api/feedback';
const DETAILS = 'The export button does nothing when I click it.';

function renderDialog(props: Partial<React.ComponentProps<typeof FeedbackDialog>> = {}) {
  return render(
    <FeedbackDialog
      open={true}
      onOpenChange={vi.fn()}
      {...props}
    />
  );
}

function capture(response: Record<string, unknown> = { success: true }) {
  const captured: { payload: Record<string, unknown> } = { payload: {} };
  server.use(
    http.post(feedbackEndpoint, async ({ request }) => {
      captured.payload = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(response);
    }),
  );
  return captured;
}

/** Fills the two required fields the way a user would. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>, details = DETAILS) {
  await user.click(screen.getByRole('radio', { name: 'Functionality bug' }));
  await user.type(screen.getByLabelText(/Details/), details);
}

const submit = () => screen.getByRole('button', { name: /Submit Feedback/i });

describe('FeedbackDialog', () => {
  describe('rendering', () => {
    it('renders the dialog title', () => {
      renderDialog();
      expect(screen.getByText('How was your experience?')).toBeInTheDocument();
    });

    it('renders 5 star rating buttons in a radio group', () => {
      renderDialog();
      const group = screen.getByRole('radiogroup', { name: /Rating/ });
      expect(within(group).getAllByRole('radio')).toHaveLength(5);
    });

    it('star buttons have descriptive aria-labels', () => {
      renderDialog();
      expect(screen.getByRole('radio', { name: /Poor.*1 out of 5/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Excellent.*5 out of 5/i })).toBeInTheDocument();
    });

    it('has aria-live region for rating label', () => {
      renderDialog();
      expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    });

    it("offers production's category, details and email fields", () => {
      renderDialog();
      const categories = within(screen.getByRole('radiogroup', { name: /Category/ }));
      for (const label of ['UI/UX issue', 'Functionality bug', 'Performance issue', 'Feature request', 'Documentation', 'Other']) {
        expect(categories.getByRole('radio', { name: label })).toBeInTheDocument();
      }
      expect(screen.getByLabelText(/Details/)).toBeRequired();
      expect(screen.getByLabelText(/Email/i)).toHaveAttribute('type', 'email');
    });

    it('does not lock Submit behind the rating: only category and details are required', () => {
      renderDialog();
      expect(submit()).toBeEnabled();
    });
  });

  describe('validation (as on production)', () => {
    it('asks for a category first, and sends nothing', async () => {
      let requests = 0;
      server.use(http.post(feedbackEndpoint, () => { requests++; return HttpResponse.json({ success: true }); }));
      const user = userEvent.setup();
      renderDialog();
      await user.click(submit());
      expect(await screen.findByRole('alert')).toHaveTextContent('Please select a feedback category');
      expect(requests).toBe(0);
    });

    it('asks for details, then for at least 10 characters', async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('radio', { name: 'Feature request' }));
      await user.click(submit());
      expect(await screen.findByRole('alert')).toHaveTextContent('Please provide feedback details');
      await user.type(screen.getByLabelText(/Details/), 'too short');
      await user.click(submit());
      expect(await screen.findByRole('alert')).toHaveTextContent('Please provide at least 10 characters of feedback');
    });
  });

  describe('payload', () => {
    it("matches production's contract: { email, category, details, metadata }", async () => {
      const captured = capture();
      const user = userEvent.setup();
      renderDialog();
      await fillRequired(user);
      await user.click(submit());
      await waitFor(() => expect(captured.payload.category).toBe('bug'));
      expect(captured.payload).toMatchObject({ email: '', category: 'bug', details: DETAILS });
      expect(captured.payload.metadata).toEqual({
        userAgent: expect.any(String),
        pageUrl: expect.stringContaining('http'),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        screenResolution: expect.stringMatching(/^\d+x\d+$/),
      });
      // Optional extras are absent unless the user chose them.
      expect(captured.payload).not.toHaveProperty('rating');
      expect(captured.payload).not.toHaveProperty('comment');
      expect(captured.payload).not.toHaveProperty('curl_command');
    });

    it('includes the email and the rating when given', async () => {
      const captured = capture();
      const user = userEvent.setup();
      renderDialog();
      await fillRequired(user);
      await user.type(screen.getByLabelText(/Email/i), ' me@example.com ');
      await user.click(screen.getByRole('radio', { name: /Great.*4 out of 5/i }));
      await user.click(submit());
      await waitFor(() => expect(captured.payload.rating).toBe(4));
      expect(captured.payload.email).toBe('me@example.com');
    });
  });

  describe('attaching the request (opt-in)', () => {
    const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.SECRET-PAYLOAD.sig';
    const curl = `curl https://api.test/x?api_key=KEY-123456 -H 'Authorization: Bearer ${TOKEN}' -u admin:hunter22`;
    const code = `given().header("Authorization", "Bearer ${TOKEN}").queryParam("api_key", "KEY-123456").get("/x")`;

    it('offers an unchecked checkbox when a cURL or code is available', () => {
      renderDialog({ curlCommand: curl, generatedCode: code });
      const box = screen.getByRole('checkbox', { name: /Include my cURL command and generated code/i });
      expect(box).not.toBeChecked();
      expect(screen.getByText(/redacted before anything is sent/i)).toBeInTheDocument();
    });

    it('does not show the checkbox when there is nothing to attach', () => {
      renderDialog();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('sends only the form fields by default', async () => {
      const captured = capture();
      const user = userEvent.setup();
      renderDialog({ curlCommand: curl, generatedCode: code });
      await fillRequired(user);
      await user.click(submit());
      await waitFor(() => expect(captured.payload.category).toBe('bug'));
      expect(captured.payload).not.toHaveProperty('curl_command');
      expect(captured.payload).not.toHaveProperty('generated_code');
      expect(JSON.stringify(captured.payload)).not.toContain(TOKEN);
    });

    it('attaches redacted cURL and code once opted in', async () => {
      const captured = capture();
      const user = userEvent.setup();
      renderDialog({ curlCommand: curl, generatedCode: code, knownSecrets: [TOKEN] });
      await user.click(screen.getByRole('checkbox', { name: /Include my cURL command/i }));
      await fillRequired(user);
      await user.click(submit());
      await waitFor(() => expect(captured.payload.curl_command).toBeTruthy());

      const sent = JSON.stringify(captured.payload);
      for (const secret of [TOKEN, 'KEY-123456', 'hunter22', 'admin:']) expect(sent).not.toContain(secret);
      expect(captured.payload.curl_command).toContain('Authorization: Bearer [REDACTED]');
      expect(captured.payload.generated_code).toContain('.queryParam("api_key", "[REDACTED]")');
      expect(captured.payload.generated_code).toContain('.get("/x")');
    });

    it('previews exactly the redacted text that will be attached', async () => {
      const user = userEvent.setup();
      renderDialog({ curlCommand: curl });
      expect(screen.queryByText(/Preview what will be attached/i)).not.toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: /Include my cURL command/i }));
      await user.click(screen.getByText(/Preview what will be attached/i));
      const preview = screen.getByRole('region', { name: /Attached request preview/i });
      expect(preview.textContent).toContain('[REDACTED]');
      expect(preview.textContent).not.toContain(TOKEN);
    });

    it('resets the opt-in when the dialog is closed', async () => {
      const user = userEvent.setup();
      const props = { curlCommand: curl, onOpenChange: vi.fn() };
      const { rerender } = render(<FeedbackDialog open={true} {...props} />);
      await user.click(screen.getByRole('checkbox', { name: /Include my cURL command/i }));
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      rerender(<FeedbackDialog open={false} {...props} />);
      rerender(<FeedbackDialog open={true} {...props} />);
      expect(screen.getByRole('checkbox', { name: /Include my cURL command/i })).not.toBeChecked();
    });
  });

  describe('star rating interaction', () => {
    it('shows rating label after clicking a star', async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('radio', { name: /Excellent.*5 out of 5/i }));
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Excellent');
    });
  });

  describe('submission', () => {
    it('shows success state after successful submission', async () => {
      capture({ success: true, message: 'Thank you!' });
      const user = userEvent.setup();
      renderDialog();
      await fillRequired(user);
      await user.click(submit());
      expect(await screen.findByText('Thank you!')).toBeInTheDocument();
    });

    it('shows error from server', async () => {
      capture({ success: false, message: 'Rate limit exceeded' });
      const user = userEvent.setup();
      renderDialog();
      await fillRequired(user);
      await user.click(submit());
      expect(await screen.findByText('Rate limit exceeded')).toBeInTheDocument();
    });

    it("shows the backend's error.message like production does", async () => {
      capture({ success: false, error: { message: 'Details too long' } });
      const user = userEvent.setup();
      renderDialog();
      await fillRequired(user);
      await user.click(submit());
      expect(await screen.findByText('Details too long')).toBeInTheDocument();
    });
  });

  describe('dialog close', () => {
    it('calls onOpenChange(false) when Cancel is clicked', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(<FeedbackDialog open={true} onOpenChange={onOpenChange} />);
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('resets form state on close', async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('radio', { name: /Excellent.*5 out of 5/i }));
      await user.type(screen.getByLabelText(/Details/), 'something I typed');
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.getByRole('radio', { name: /Excellent.*5 out of 5/i })).not.toBeChecked();
      expect(screen.getByLabelText(/Details/)).toHaveValue('');
    });
  });
});
