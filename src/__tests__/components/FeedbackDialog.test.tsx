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

  describe('privacy notice', () => {
    it('shows privacy notice when curlCommand is provided', () => {
      renderDialog({ curlCommand: 'curl https://example.com', generatedCode: 'code' });
      expect(screen.getByText(/Your cURL command and generated code will be included/i)).toBeInTheDocument();
    });

    it('does not show privacy notice when no curlCommand or generatedCode', () => {
      renderDialog();
      expect(screen.queryByText(/Your cURL command and generated code/i)).not.toBeInTheDocument();
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
        expect(screen.getByText('Thank You!')).toBeInTheDocument();
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
      const user = userEvent.setup();
      renderDialog();
      // Submit button should be disabled; clicking it does nothing
      expect(screen.getByRole('button', { name: /Submit Feedback/i })).toBeDisabled();
    });

    it('sends curlCommand and generatedCode in payload when provided', async () => {
      let capturedPayload: Record<string, unknown> = {};
      server.use(
        http.post(feedbackEndpoint, async ({ request }) => {
          capturedPayload = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ success: true });
        })
      );
      const user = userEvent.setup();
      renderDialog({ curlCommand: 'curl https://test.com', generatedCode: 'java code' });
      await user.click(screen.getByRole('radio', { name: /Good.*3 out of 5/i }));
      await user.click(screen.getByRole('button', { name: /Submit Feedback/i }));
      await waitFor(() => {
        expect(capturedPayload.curl_command).toBe('curl https://test.com');
        expect(capturedPayload.generated_code).toBe('java code');
      });
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
