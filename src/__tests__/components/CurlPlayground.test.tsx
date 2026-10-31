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

  describe('data notice', () => {
    it('states where the cURL goes and that this page does not keep it past the session', () => {
      renderWithProviders(<CurlPlayground />);
      const notice = screen.getByTestId('curl-data-notice');
      expect(notice).toHaveTextContent(/sent to the cURLCraft backend to be parsed/i);
      expect(notice).toHaveTextContent(/doesn.t store it beyond your browser session/i);
      expect(notice).not.toHaveTextContent(/retain|delete|never stored/i); // no claims about the backend's retention
    });

    it('does not write the pasted cURL to either storage', async () => {
      localStorage.clear();
      sessionStorage.clear();
      renderWithProviders(<CurlPlayground />);
      await user.click(screen.getByRole('textbox'));
      await user.paste("curl https://api.example.com -H 'Authorization: Bearer playground-secret-1'");
      expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('playground-secret-1');
    });
  });

  describe('labels (QU-10)', () => {
    it('names the textarea with a visible <label>, and numbers the inputs in batch mode', async () => {
      renderWithProviders(<CurlPlayground />);
      const textarea = screen.getByRole('textbox', { name: 'cURL command' });
      const label = document.querySelector(`label[for="${textarea.id}"]`);
      expect(label).toHaveTextContent('cURL command');
      // The placeholder is an example, not the name, and no longer the faint /50 tint.
      expect(textarea.className).not.toMatch(/placeholder:text-muted-foreground\/\d+/);

      await user.click(screen.getByText('Add another cURL'));
      expect(screen.getByRole('textbox', { name: 'cURL command 1' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'cURL command 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove cURL command 2' })).toBeInTheDocument();
    });
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

      expect(screen.getByText('cURL command')).toBeInTheDocument();
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

    it('should parse every entry and navigate to batch-editor with the parsed items', async () => {
      renderWithProviders(<CurlPlayground />);

      await clickAddEntry();

      const textareas = screen.getAllByRole('textbox');
      await user.type(textareas[0], 'curl https://first.com');
      await user.type(textareas[1], 'curl https://second.com');

      // In multi mode, button should say "Parse All"
      const parseButton = screen.getByText(/Parse All/).closest('button')!;
      await user.click(parseButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/batch-editor', {
          state: {
            items: [
              { parsed: expect.objectContaining({ method: 'POST', endpoint: '/users' }), originalCurl: 'curl https://first.com' },
              { parsed: expect.objectContaining({ method: 'POST', endpoint: '/users' }), originalCurl: 'curl https://second.com' },
            ],
            failures: [],
          },
        });
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

  describe('batch parsing (Parse All)', () => {
    const fillEntries = async (values: string[]) => {
      for (let i = 1; i < values.length; i++) {
        await user.click(screen.getByText('Add another cURL'));
      }
      const textareas = screen.getAllByRole('textbox');
      for (let i = 0; i < values.length; i++) {
        if (values[i]) await user.type(textareas[i], values[i]);
      }
    };

    const parseByCurl = (failing: string[]) =>
      server.use(
        http.post('*/api/parse', async ({ request }) => {
          const { curl } = (await request.json()) as { curl: string };
          const bad = failing.find((f) => curl.includes(f));
          if (bad) {
            return HttpResponse.json(
              { success: false, error: { code: 'PARSE_ERROR', message: `Cannot parse ${bad}` } },
              { status: 422 },
            );
          }
          return HttpResponse.json({
            success: true,
            data: { method: 'GET', base_url: 'https://a.com', endpoint: `/${curl.split('/').pop()}` },
          });
        }),
      );

    it('routes one filled entry plus one blank entry to the single editor', async () => {
      renderWithProviders(<CurlPlayground />);
      await fillEntries(['curl https://api.com/solo', '']);

      // Only one command is filled, so this is a single parse, not "Parse All".
      expect(screen.queryByText(/Parse All/)).not.toBeInTheDocument();
      await user.click(screen.getByText('Parse cURL').closest('button')!);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/editor', {
          state: expect.objectContaining({ originalCurl: 'curl https://api.com/solo' }),
        });
      });
      expect(mockNavigate).not.toHaveBeenCalledWith('/batch-editor', expect.anything());
    });

    it('parses the filled entry even when it is not the first one', async () => {
      renderWithProviders(<CurlPlayground />);
      await fillEntries(['', 'curl https://api.com/second']);

      await user.click(screen.getByText('Parse cURL').closest('button')!);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/editor', {
          state: expect.objectContaining({ originalCurl: 'curl https://api.com/second' }),
        });
      });
    });

    it('ignores blank entries between filled ones and reports positions as the user sees them', async () => {
      parseByCurl(['bad']);
      renderWithProviders(<CurlPlayground />);
      await fillEntries(['curl https://api.com/a', '', 'curl https://api.com/bad']);

      await user.click(screen.getByText('Parse All (2)').closest('button')!);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/batch-editor', {
          state: {
            items: [expect.objectContaining({ originalCurl: 'curl https://api.com/a' })],
            // The failing command is the third input box, i.e. index 2.
            failures: [
              { index: 2, curl: 'curl https://api.com/bad', message: 'Cannot parse bad' },
            ],
          },
        });
      });
    });

    it('keeps the commands that parsed when another one fails', async () => {
      parseByCurl(['broken']);
      renderWithProviders(<CurlPlayground />);
      await fillEntries(['curl https://api.com/a', 'curl https://api.com/broken', 'curl https://api.com/c']);

      await user.click(screen.getByText('Parse All (3)').closest('button')!);

      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      const [path, options] = mockNavigate.mock.calls[0];
      expect(path).toBe('/batch-editor');
      expect(options.state.items.map((i: { originalCurl: string }) => i.originalCurl)).toEqual([
        'curl https://api.com/a',
        'curl https://api.com/c',
      ]);
      expect(options.state.failures).toHaveLength(1);
      expect(options.state.failures[0]).toMatchObject({ index: 1, message: 'Cannot parse broken' });
    });

    it('stays on the playground and flags each command when none parse', async () => {
      parseByCurl(['bad']);
      renderWithProviders(<CurlPlayground />);
      await fillEntries(['curl https://api.com/bad1', 'curl https://api.com/bad2']);

      await user.click(screen.getByText('Parse All (2)').closest('button')!);

      expect(await screen.findByText('None of the 2 cURL commands could be parsed.')).toBeInTheDocument();
      expect(screen.getByText(/cURL command 1: Cannot parse bad/)).toBeInTheDocument();
      expect(screen.getByText(/cURL command 2: Cannot parse bad/)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();

      // Editing a command clears only that command's error.
      await user.type(screen.getAllByRole('textbox')[0], ' ');
      expect(screen.queryByText(/cURL command 1: Cannot parse bad/)).not.toBeInTheDocument();
      expect(screen.getByText(/cURL command 2: Cannot parse bad/)).toBeInTheDocument();
    });

    it('shows a parsing state while the batch is in flight', async () => {
      server.use(
        http.post('*/api/parse', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, data: { method: 'GET', base_url: 'https://a.com', endpoint: '/' } });
        }),
      );
      renderWithProviders(<CurlPlayground />);
      await fillEntries(['curl https://a.com/1', 'curl https://a.com/2']);

      await user.click(screen.getByText('Parse All (2)').closest('button')!);

      expect(screen.getByText('Parsing...')).toBeInTheDocument();
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/batch-editor', expect.anything()));
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
