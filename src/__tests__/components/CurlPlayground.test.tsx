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
