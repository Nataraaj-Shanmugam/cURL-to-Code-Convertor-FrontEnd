import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import EditorPage from '@/pages/EditorPage';
import { mockParsedCurl } from '../mocks/handlers';
import { EDITOR_STATE_TTL_MS, EDITOR_STORAGE_KEY } from '@/lib/utils/editorStorage';
import { forgetAllLiveRequests } from '@/lib/utils/liveRequestStore';
import { REDACTED_PLACEHOLDER } from '@/lib/utils/redaction';

const mockNavigate = vi.fn();
let mockRouteState: unknown = null;
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: mockRouteState,
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
    mockRouteState = null;
    localStorage.clear();
    sessionStorage.clear();
    forgetAllLiveRequests();
    window.history.replaceState(null, '');
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

  describe('saved state', () => {
    const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.token';
    const CURL = `curl -X POST https://api.example.com/users -H 'Authorization: Bearer ${TOKEN}'`;

    it('saves a redacted copy to sessionStorage, never localStorage', async () => {
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      renderWithProviders(<EditorPage />);

      await waitFor(() => expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).not.toBeNull());
      const stored = sessionStorage.getItem(EDITOR_STORAGE_KEY)!;
      expect(stored).toContain(REDACTED_PLACEHOLDER);
      expect(stored).not.toContain(TOKEN);
      expect(stored).not.toContain('abc123'); // cookie value
      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    });

    it('also strips the secrets from the router state kept in history.state', async () => {
      window.history.replaceState({ usr: { parsed: mockParsedCurl, originalCurl: CURL }, key: 'k', idx: 0 }, '');
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      renderWithProviders(<EditorPage />);
      await waitFor(() => expect(JSON.stringify(window.history.state)).toContain(REDACTED_PLACEHOLDER));
      expect(JSON.stringify(window.history.state)).not.toContain(TOKEN);
      // the live editor still has the real values for this visit
      expect(mockRouteState).toEqual({ parsed: mockParsedCurl, originalCurl: CURL });
      window.history.replaceState(null, '');
    });

    it('restores a saved request on reload and flags the redacted fields', async () => {
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      const first = renderWithProviders(<EditorPage />);
      await waitFor(() => expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).not.toBeNull());
      first.unmount();

      mockRouteState = null; // a reload has no router state...
      forgetAllLiveRequests(); // ...and starts with empty memory
      renderWithProviders(<EditorPage />);
      expect(await screen.findByText(/were redacted when it was saved/i, {}, { timeout: 5000 })).toBeInTheDocument();
      expect(screen.getAllByText(/Redacted: re-enter value/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(new RegExp(TOKEN.replace('.', '\\.')))).not.toBeInTheDocument();
    });

    it('offers "Clear saved request", which empties storage and survives later re-renders', async () => {
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      renderWithProviders(<EditorPage />);
      await user.click(await screen.findByRole('button', { name: /Clear saved request/i }, { timeout: 5000 }));

      expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
      expect(screen.getByText(/Saved copy cleared/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Clear saved request/i })).not.toBeInTheDocument();
    });

    it('deletes the legacy localStorage entry on load and carries it over redacted', async () => {
      localStorage.setItem(
        EDITOR_STORAGE_KEY,
        JSON.stringify({ parsed: mockParsedCurl, originalCurl: CURL }),
      );
      renderWithProviders(<EditorPage />);

      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
      expect(await screen.findByText(/were redacted when it was saved/i, {}, { timeout: 5000 })).toBeInTheDocument();
      const stored = sessionStorage.getItem(EDITOR_STORAGE_KEY)!;
      expect(stored).not.toContain(TOKEN);
    });

    it('handles corrupted stored data gracefully', () => {
      sessionStorage.setItem(EDITOR_STORAGE_KEY, 'not valid json');
      renderWithProviders(<EditorPage />);
      expect(screen.getByText(/No cURL command parsed yet/)).toBeInTheDocument();
    });

    it('handles a corrupted legacy entry by deleting it', () => {
      localStorage.setItem(EDITOR_STORAGE_KEY, 'not valid json');
      renderWithProviders(<EditorPage />);
      expect(screen.getByText(/No cURL command parsed yet/)).toBeInTheDocument();
      expect(localStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
    });

    it('Back/Forward within the tab restores the live values from memory, so Generate Code stays usable', async () => {
      window.history.replaceState({ usr: { parsed: mockParsedCurl, originalCurl: CURL }, key: 'k', idx: 1 }, '');
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      const first = renderWithProviders(<EditorPage />);
      await waitFor(() => expect(JSON.stringify(window.history.state)).toContain(REDACTED_PLACEHOLDER));
      first.unmount();

      // Forward: the router hands back the (redacted) copy it keeps in history.state.
      mockRouteState = (window.history.state as { usr: unknown }).usr;
      renderWithProviders(<EditorPage />);
      expect(await screen.findByRole('button', { name: /Generate Code/ }, { timeout: 5000 })).toBeEnabled();
      expect(screen.queryByText(/were redacted when it was saved/i)).not.toBeInTheDocument();
    });

    it('a reload of a redacted copy blocks Generate Code until the values are re-entered', async () => {
      window.history.replaceState({ usr: { parsed: mockParsedCurl, originalCurl: CURL }, key: 'k', idx: 1 }, '');
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      const first = renderWithProviders(<EditorPage />);
      await waitFor(() => expect(JSON.stringify(window.history.state)).toContain(REDACTED_PLACEHOLDER));
      first.unmount();

      forgetAllLiveRequests(); // reload
      mockRouteState = (window.history.state as { usr: unknown }).usr;
      renderWithProviders(<EditorPage />);
      expect(await screen.findByRole('button', { name: /Generate Code/ }, { timeout: 5000 })).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent(/Re-enter \d+ redacted values? to generate code/i);
    });

    it('"Clear saved request" also clears the history.state copy and the in-memory copy', async () => {
      window.history.replaceState({ usr: { parsed: mockParsedCurl, originalCurl: CURL }, key: 'k', idx: 1 }, '');
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      const first = renderWithProviders(<EditorPage />);
      await user.click(await screen.findByRole('button', { name: /Clear saved request/i }, { timeout: 5000 }));
      expect(window.history.state).toEqual({ usr: {}, key: 'k', idx: 1 });
      first.unmount();

      // Reload or Forward to this entry: nothing to restore.
      mockRouteState = (window.history.state as { usr: unknown }).usr;
      renderWithProviders(<EditorPage />);
      expect(screen.getByText(/No cURL command parsed yet/)).toBeInTheDocument();
    });

    it('explains an expired saved copy instead of showing the generic empty state', () => {
      sessionStorage.setItem(
        EDITOR_STORAGE_KEY,
        JSON.stringify({ version: 2, savedAt: Date.now() - EDITOR_STATE_TTL_MS - 1000, parsed: mockParsedCurl }),
      );
      renderWithProviders(<EditorPage />);
      expect(screen.getByText(/Your saved request has expired/)).toBeInTheDocument();
      expect(screen.getByText(/8 hours after your last activity/)).toBeInTheDocument();
      expect(screen.queryByText(/No cURL command parsed yet/)).not.toBeInTheDocument();
    });

    it('Back clears the saved request', async () => {
      mockRouteState = { parsed: mockParsedCurl, originalCurl: CURL };
      renderWithProviders(<EditorPage />);
      await user.click(await screen.findByRole('button', { name: /Back/i }, { timeout: 5000 }));
      expect(sessionStorage.getItem(EDITOR_STORAGE_KEY)).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/playground');
    });
  });
});
