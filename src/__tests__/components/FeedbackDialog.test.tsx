import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import FeedbackDialog from '@/components/features/feedback/FeedbackDialog';
import { render } from '../test-utils';
import { server } from '../mocks/server';

const feedbackEndpoint = '*/api/feedback';

function renderDialog(props: Partial<React.ComponentProps<typeof FeedbackDialog>> = {}) {
  return render(
    <FeedbackDialog
      open={true}
      onOpenChange={vi.fn()}
      {...props}
    />
  );
}

describe('FeedbackDialog', () => {
  describe('rendering', () => {
    it('renders the dialog title', () => {
      renderDialog();
      expect(screen.getByText('How was your experience?')).toBeInTheDocument();
    });

    it('renders 5 star rating buttons', () => {
      renderDialog();
      const stars = screen.getAllByRole('radio');
      expect(stars).toHaveLength(5);
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

    it('renders comment and email fields', () => {
      renderDialog();
      expect(screen.getByLabelText(/Comments/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    });

    it('Submit button is disabled until a rating is selected', () => {
      renderDialog();
      expect(screen.getByRole('button', { name: /Submit Feedback/i })).toBeDisabled();
    });
  });

  describe('attaching the request (opt-in)', () => {
    const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.SECRET-PAYLOAD.sig';
    const curl = `curl https://api.test/x?api_key=KEY-123456 -H 'Authorization: Bearer ${TOKEN}' -u admin:hunter22`;
    const code = `given().header("Authorization", "Bearer ${TOKEN}").queryParam("api_key", "KEY-123456").get("/x")`;

    function capture() {
      const captured: { payload: Record<string, unknown> } = { payload: {} };
      server.use(
        http.post(feedbackEndpoint, async ({ request }) => {
          captured.payload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ success: true });
        }),
      );
      return captured;
    }

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
      await user.click(screen.getByRole('radio', { name: /Good.*3 out of 5/i }));
      await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
      await waitFor(() => expect(captured.payload.rating).toBe(3));
      expect(captured.payload).not.toHaveProperty('curl_command');
      expect(captured.payload).not.toHaveProperty('generated_code');
      expect(JSON.stringify(captured.payload)).not.toContain(TOKEN);
    });

    it('attaches redacted cURL and code once opted in', async () => {
      const captured = capture();
      const user = userEvent.setup();
      renderDialog({ curlCommand: curl, generatedCode: code, knownSecrets: [TOKEN] });
      await user.click(screen.getByRole('checkbox', { name: /Include my cURL command/i }));
      await user.click(screen.getByRole('radio', { name: /Good.*3 out of 5/i }));
      await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
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
      const preview = document.querySelector('details pre')!;
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
    it('enables submit button after selecting a rating', async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('radio', { name: /Great.*4 out of 5/i }));
      expect(screen.getByRole('button', { name: /Submit Feedback/i })).toBeEnabled();
    });

    it('shows rating label after clicking a star', async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('radio', { name: /Excellent.*5 out of 5/i }));
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Excellent');
    });
  });

  describe('submission', () => {
    it('shows success state after successful submission', async () => {
      server.use(
        http.post(feedbackEndpoint, () =>
          HttpResponse.json({ success: true, message: 'Thank you!' })
        )
      );
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('radio', { name: /Good.*3 out of 5/i }));
      await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
      await waitFor(() => {
        expect(screen.getByText('Thank you!')).toBeInTheDocument();
      });
    });

    it('shows error from server', async () => {
      server.use(
        http.post(feedbackEndpoint, () =>
          HttpResponse.json({ success: false, message: 'Rate limit exceeded' })
        )
      );
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('radio', { name: /Good.*3 out of 5/i }));
      await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
      await waitFor(() => {
        expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
      });
    });

    it('requires a rating selection — shows inline error', async () => {
      renderDialog();
      // Submit button should be disabled; clicking it does nothing
      expect(screen.getByRole('button', { name: /Submit Feedback/i })).toBeDisabled();
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
      const { rerender } = renderDialog();
      await user.click(screen.getByRole('radio', { name: /Excellent.*5 out of 5/i }));
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      rerender(<FeedbackDialog open={true} onOpenChange={vi.fn()} />);
      // Submit should be disabled again (rating reset)
      expect(screen.getByRole('button', { name: /Submit Feedback/i })).toBeDisabled();
    });
  });
});
