import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import CurlPlayground from '@/components/features/curl/CurlPlayground';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CurlPlayground', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('rendering', () => {
    it('should render the playground header', () => {
      renderWithProviders(<CurlPlayground />);

      expect(screen.getByText('cURL Playground')).toBeInTheDocument();
      expect(screen.getByText(/Paste a cURL command/)).toBeInTheDocument();
    });

    it('should render the textarea with placeholder', () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('spellcheck', 'false');
    });

    it('should render Parse and Reset buttons', () => {
      renderWithProviders(<CurlPlayground />);

      expect(screen.getByText('Parse cURL')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('should render example cURL commands when textarea is empty', () => {
      renderWithProviders(<CurlPlayground />);

      expect(screen.getByText('Try an example:')).toBeInTheDocument();
      expect(screen.getByText('GET Request')).toBeInTheDocument();
      expect(screen.getByText('POST with JSON Body')).toBeInTheDocument();
      expect(screen.getByText('With Auth Header')).toBeInTheDocument();
      expect(screen.getByText('PUT Update Resource')).toBeInTheDocument();
      expect(screen.getByText('DELETE Request')).toBeInTheDocument();
      expect(screen.getByText('PATCH Partial Update')).toBeInTheDocument();
    });

    it('should render terminal-style header with colored dots', () => {
      renderWithProviders(<CurlPlayground />);

      expect(screen.getByText('curl-input')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should update textarea value when user types', async () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl https://api.com');

      expect(textarea).toHaveValue('curl https://api.com');
    });

    it('should hide examples when textarea has content', async () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl https://api.com');

      expect(screen.queryByText('Try an example:')).not.toBeInTheDocument();
    });

    it('should populate textarea when clicking an example', async () => {
      renderWithProviders(<CurlPlayground />);

      const getExample = screen.getByText('GET Request');
      await user.click(getExample);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toContain('GET');
    });

    it('should disable Parse button when textarea is empty', () => {
      renderWithProviders(<CurlPlayground />);

      const parseButton = screen.getByText('Parse cURL').closest('button');
      expect(parseButton).toBeDisabled();
    });

    it('should enable Parse button when textarea has content', async () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl https://api.com');

      const parseButton = screen.getByText('Parse cURL').closest('button');
      expect(parseButton).not.toBeDisabled();
    });

    it('should disable Reset button when textarea is empty', () => {
      renderWithProviders(<CurlPlayground />);

      const resetButton = screen.getByText('Reset').closest('button');
      expect(resetButton).toBeDisabled();
    });

    it('should clear textarea on reset', async () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl https://api.com');
      expect(textarea).toHaveValue('curl https://api.com');

      const resetButton = screen.getByText('Reset').closest('button')!;
      await user.click(resetButton);

      expect(textarea).toHaveValue('');
    });
  });

  describe('multi-entry and example templates', () => {
    const addEntryButtonText = 'Add another cURL';

    const clickAddEntry = async () => {
      await user.click(screen.getByText(addEntryButtonText));
    };

    it('should keep templates visible after selecting one example in multi-mode (bug fix)', async () => {
      renderWithProviders(<CurlPlayground />);

      // Add a second entry
      await clickAddEntry();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);

      // Templates should be visible (all empty)
      expect(screen.getByText('Try an example:')).toBeInTheDocument();

      // Click an example
      await user.click(screen.getByText('GET Request'));

      // First textarea should be filled
      const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
      expect(textareas[0].value).toContain('GET');

      // Templates should STILL be visible (second entry is empty)
      expect(screen.getByText('Try an example:')).toBeInTheDocument();

      // Second textarea should still be empty
      expect(textareas[1].value).toBe('');
    });

    it('should fill the first empty entry, not always the first entry (smart fill)', async () => {
      renderWithProviders(<CurlPlayground />);

      // Add a second entry
      await clickAddEntry();

      // Manually type into the first textarea
      const textareas = screen.getAllByRole('textbox');
      await user.type(textareas[0], 'curl https://manual.com');

      // Click an example — should fill the second (first empty) entry
      await user.click(screen.getByText('POST with JSON Body'));

      const updatedTextareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
      expect(updatedTextareas[0].value).toBe('curl https://manual.com');
      expect(updatedTextareas[1].value).toContain('POST');
    });

    it('should hide templates when all entries are filled in multi-mode', async () => {
      renderWithProviders(<CurlPlayground />);

      // Add a second entry
      await clickAddEntry();

      // Fill first via example
      await user.click(screen.getByText('GET Request'));
      expect(screen.getByText('Try an example:')).toBeInTheDocument();

      // Fill second via example
      await user.click(screen.getByText('POST with JSON Body'));

      // Now all entries are filled — templates should be hidden
      expect(screen.queryByText('Try an example:')).not.toBeInTheDocument();
    });

    it('should show templates again when a filled entry is cleared in multi-mode', async () => {
      renderWithProviders(<CurlPlayground />);

      await clickAddEntry();

      // Fill both entries
      await user.click(screen.getByText('GET Request'));
      await user.click(screen.getByText('POST with JSON Body'));
      expect(screen.queryByText('Try an example:')).not.toBeInTheDocument();

      // Clear first textarea
      const textareas = screen.getAllByRole('textbox');
      await user.clear(textareas[0]);

      // Templates should reappear
      expect(screen.getByText('Try an example:')).toBeInTheDocument();
    });

    it('should show templates when a new empty entry is added after all are filled', async () => {
      renderWithProviders(<CurlPlayground />);

      await clickAddEntry();

      // Fill both entries
      await user.click(screen.getByText('GET Request'));
      await user.click(screen.getByText('DELETE Request'));
      expect(screen.queryByText('Try an example:')).not.toBeInTheDocument();

      // Add a new empty entry
      await clickAddEntry();

      // Templates should reappear (new entry is empty)
      expect(screen.getByText('Try an example:')).toBeInTheDocument();
    });

    it('should hide templates in single-mode after selecting an example (regression)', async () => {
      renderWithProviders(<CurlPlayground />);

      // Single mode: one entry
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
      expect(screen.getByText('Try an example:')).toBeInTheDocument();

      // Click example
      await user.click(screen.getByText('GET Request'));

      // In single mode, templates should disappear (only 1 entry, it's filled)
      expect(screen.queryByText('Try an example:')).not.toBeInTheDocument();
    });

    it('should skip filled entries in the middle when smart-filling', async () => {
      renderWithProviders(<CurlPlayground />);

      // Create 3 entries
      await clickAddEntry();
      await clickAddEntry();
      expect(screen.getAllByRole('textbox')).toHaveLength(3);

      // Fill the second (middle) entry manually
      const textareas = screen.getAllByRole('textbox');
      await user.type(textareas[1], 'curl https://middle.com');

      // Click example — should fill the first entry (first empty one)
      await user.click(screen.getByText('GET Request'));

      let updated = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
      expect(updated[0].value).toContain('GET');
      expect(updated[1].value).toBe('curl https://middle.com');
      expect(updated[2].value).toBe('');

      // Click another example — should fill the third entry (next empty one)
      await user.click(screen.getByText('DELETE Request'));

      updated = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
      expect(updated[0].value).toContain('GET');
      expect(updated[1].value).toBe('curl https://middle.com');
      expect(updated[2].value).toContain('DELETE');
    });

    it('should collapse to single empty entry with templates visible on reset', async () => {
      renderWithProviders(<CurlPlayground />);

      // Create 3 entries and fill some
      await clickAddEntry();
      await clickAddEntry();
      await user.click(screen.getByText('GET Request'));
      await user.click(screen.getByText('POST with JSON Body'));

      // Reset
      const resetButton = screen.getByText('Reset').closest('button')!;
      await user.click(resetButton);

      // Should have 1 empty textarea
      const textareas = screen.getAllByRole('textbox');
      expect(textareas).toHaveLength(1);
      expect(textareas[0]).toHaveValue('');

      // Templates should be visible
      expect(screen.getByText('Try an example:')).toBeInTheDocument();
    });

    it('should navigate to batch-editor when parsing multiple entries', async () => {
      renderWithProviders(<CurlPlayground />);

      await clickAddEntry();

      const textareas = screen.getAllByRole('textbox');
      await user.type(textareas[0], 'curl https://first.com');
      await user.type(textareas[1], 'curl https://second.com');

      // In multi mode, button should say "Parse All"
      const parseButton = screen.getByText(/Parse All/).closest('button')!;
      await user.click(parseButton);

      expect(mockNavigate).toHaveBeenCalledWith('/batch-editor', {
        state: {
          curls: ['curl https://first.com', 'curl https://second.com'],
        },
      });
    });

    it('should show correct filled count in Parse All button', async () => {
      renderWithProviders(<CurlPlayground />);

      await clickAddEntry();
      await clickAddEntry();

      // Fill only 2 of 3 entries
      const textareas = screen.getAllByRole('textbox');
      await user.type(textareas[0], 'curl https://a.com');
      await user.type(textareas[2], 'curl https://c.com');

      expect(screen.getByText('Parse All (2)')).toBeInTheDocument();
    });

    it('should show correct entry count in multi-mode header', async () => {
      renderWithProviders(<CurlPlayground />);

      await clickAddEntry();
      await clickAddEntry();
      expect(screen.getByText('3 commands')).toBeInTheDocument();

      // Remove one entry using the X button
      const removeButtons = screen.getAllByTitle('Remove this cURL');
      await user.click(removeButtons[0]);

      expect(screen.getByText('2 commands')).toBeInTheDocument();
    });

    it('should not show remove button when only one entry exists', () => {
      renderWithProviders(<CurlPlayground />);

      expect(screen.queryByTitle('Remove this cURL')).not.toBeInTheDocument();
    });

    it('should keep templates visible when adding entries while all are empty', async () => {
      renderWithProviders(<CurlPlayground />);

      expect(screen.getByText('Try an example:')).toBeInTheDocument();

      await clickAddEntry();
      expect(screen.getByText('Try an example:')).toBeInTheDocument();

      await clickAddEntry();
      expect(screen.getByText('Try an example:')).toBeInTheDocument();

      expect(screen.getAllByRole('textbox')).toHaveLength(3);
    });
  });

  describe('parse flow (BE integration)', () => {
    it('should call parse API and navigate to editor on success', async () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl -X POST "https://api.example.com/users" -H "Content-Type: application/json"');

      const parseButton = screen.getByText('Parse cURL').closest('button')!;
      await user.click(parseButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/editor', {
          state: expect.objectContaining({
            parsed: expect.objectContaining({
              method: 'POST',
              base_url: 'https://api.example.com',
            }),
          }),
        });
      });
    });

    it('should show loading state during parsing', async () => {
      // Delay the response to see loading state
      server.use(
        http.post('*/api/parse', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, data: { method: 'GET', base_url: 'https://a.com', endpoint: '/' } });
        }),
      );

      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl https://api.com');

      const parseButton = screen.getByText('Parse cURL').closest('button')!;
      await user.click(parseButton);

      expect(screen.getByText('Parsing...')).toBeInTheDocument();
    });

    it('should display error when parse fails', async () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'invalid-curl-garbage');

      const parseButton = screen.getByText('Parse cURL').closest('button')!;
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid cURL command format')).toBeInTheDocument();
      });
    });

    it('should display error when API returns success=false', async () => {
      server.use(
        http.post('*/api/parse', () => {
          return HttpResponse.json({
            success: false,
            error: { code: 'ERR', message: 'Could not parse the command' },
          });
        }),
      );

      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'some curl command');

      const parseButton = screen.getByText('Parse cURL').closest('button')!;
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Could not parse the command')).toBeInTheDocument();
      });
    });

    it('should clear error when user types after an error', async () => {
      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'invalid-curl-garbage');

      const parseButton = screen.getByText('Parse cURL').closest('button')!;
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid cURL command format')).toBeInTheDocument();
      });

      await user.clear(textarea);
      await user.type(textarea, 'curl https://api.com');

      expect(screen.queryByText('Invalid cURL command format')).not.toBeInTheDocument();
    });

    it('should handle network errors', async () => {
      server.use(
        http.post('*/api/parse', () => {
          return HttpResponse.error();
        }),
      );

      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl https://api.com');

      const parseButton = screen.getByText('Parse cURL').closest('button')!;
      await user.click(parseButton);

      // After network error, should show some error message
      await waitFor(() => {
        // Error message could vary — just check error container is visible
        const errorContainer = document.querySelector('.text-destructive, [class*="destructive"]');
        expect(errorContainer).not.toBeNull();
      });
    });

    it('should handle array response by taking first element', async () => {
      server.use(
        http.post('*/api/parse', () => {
          return HttpResponse.json({
            success: true,
            data: [
              { method: 'GET', base_url: 'https://first.com', endpoint: '/first' },
              { method: 'POST', base_url: 'https://second.com', endpoint: '/second' },
            ],
          });
        }),
      );

      renderWithProviders(<CurlPlayground />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'curl https://first.com');

      const parseButton = screen.getByText('Parse cURL').closest('button')!;
      await user.click(parseButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/editor', {
          state: expect.objectContaining({
            parsed: expect.objectContaining({
              method: 'GET',
              base_url: 'https://first.com',
            }),
          }),
        });
      });
    });
  });
});
