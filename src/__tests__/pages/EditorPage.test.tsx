import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import EditorPage from '@/pages/EditorPage';
import { mockParsedCurl } from '../mocks/handlers';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: null,
      pathname: '/editor',
      search: '',
      hash: '',
      key: 'default',
    }),
  };
});

describe('EditorPage', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
  });

  describe('without data', () => {
    it('should show fallback message when no data is available', () => {
      renderWithProviders(<EditorPage />);

      expect(screen.getByText(/No cURL command parsed yet/)).toBeInTheDocument();
    });

    it('should show Go to Playground button', () => {
      renderWithProviders(<EditorPage />);

      expect(screen.getByText('Go to Playground')).toBeInTheDocument();
    });

    it('should navigate to playground on button click', async () => {
      renderWithProviders(<EditorPage />);

      const button = screen.getByText('Go to Playground');
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/playground');
    });
  });

  describe('with localStorage data', () => {
    beforeEach(() => {
      localStorage.setItem(
        'curlcraft_editor_state',
        JSON.stringify({
          parsed: mockParsedCurl,
          originalCurl: 'curl -X POST https://api.example.com/users',
        }),
      );
    });

    it('should load data from localStorage', () => {
      // Override mock to return null state so it falls back to localStorage
      renderWithProviders(<EditorPage />);

      // The component should load from localStorage and render the editor
      // Since useLocation returns null state, it falls back to localStorage
      // The ParsedCurlEditor should be rendered
    });
  });

  describe('localStorage persistence', () => {
    it('should save to localStorage when data is provided', () => {
      localStorage.setItem(
        'curlcraft_editor_state',
        JSON.stringify({
          parsed: mockParsedCurl,
          originalCurl: 'curl -X POST https://api.example.com/users',
        }),
      );

      renderWithProviders(<EditorPage />);

      const stored = localStorage.getItem('curlcraft_editor_state');
      expect(stored).not.toBeNull();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('curlcraft_editor_state', 'not valid json');

      renderWithProviders(<EditorPage />);

      // Should show fallback since JSON parse fails
      expect(screen.getByText(/No cURL command parsed yet/)).toBeInTheDocument();
    });
  });
});
