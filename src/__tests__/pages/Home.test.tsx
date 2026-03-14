import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import Home from '@/pages/Home';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Home Page', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('rendering', () => {
    it('should render the hero section with app name', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('cURLCraft')).toBeInTheDocument();
      expect(screen.getByText('Assured')).toBeInTheDocument();
    });

    it('should render the tagline', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText(/Transform cURL commands into production-ready/)).toBeInTheDocument();
    });

    it('should render Get Started button', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('should render all 6 feature cards', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('Smart cURL Parsing')).toBeInTheDocument();
      expect(screen.getByText('Visual Editor')).toBeInTheDocument();
      expect(screen.getByText('Code Generation')).toBeInTheDocument();
      expect(screen.getByText('Advanced Body Editor')).toBeInTheDocument();
      expect(screen.getByText('POJO Generation')).toBeInTheDocument();
      expect(screen.getByText('Maven Dependencies')).toBeInTheDocument();
    });

    it('should render How It Works section with 4 steps', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText('Paste your cURL command')).toBeInTheDocument();
      expect(screen.getByText('Review & Edit')).toBeInTheDocument();
      expect(screen.getByText('Configure Generation')).toBeInTheDocument();
      expect(screen.getByText('Export Code')).toBeInTheDocument();
    });

    it('should render capabilities checklist', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('What You Can Do')).toBeInTheDocument();
      expect(screen.getByText(/All HTTP methods/)).toBeInTheDocument();
      expect(screen.getByText(/Automatic POJO creation/)).toBeInTheDocument();
    });

    it('should render CTA section', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('Ready to Transform Your Testing Workflow?')).toBeInTheDocument();
      expect(screen.getByText('Open Playground')).toBeInTheDocument();
    });

    it('should render terminal preview in hero', () => {
      renderWithProviders(<Home />);

      expect(screen.getByText('terminal')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate to playground on Get Started click', async () => {
      renderWithProviders(<Home />);

      const getStartedButton = screen.getByText('Get Started');
      await user.click(getStartedButton);

      expect(mockNavigate).toHaveBeenCalledWith('/playground');
    });

    it('should navigate to playground on Open Playground click', async () => {
      renderWithProviders(<Home />);

      const openPlaygroundButton = screen.getByText('Open Playground');
      await user.click(openPlaygroundButton);

      expect(mockNavigate).toHaveBeenCalledWith('/playground');
    });
  });

  describe('health check (BE integration)', () => {
    it('should call health endpoint on mount', async () => {
      let healthCalled = false;
      server.use(
        http.get('*/api/health', () => {
          healthCalled = true;
          return HttpResponse.json({ status: 'ok' });
        }),
      );

      renderWithProviders(<Home />);

      await waitFor(() => {
        expect(healthCalled).toBe(true);
      });
    });

    it('should handle health check failure gracefully', async () => {
      server.use(
        http.get('*/api/health', () => {
          return HttpResponse.error();
        }),
      );

      // Should not crash
      renderWithProviders(<Home />);

      expect(screen.getByText('cURLCraft')).toBeInTheDocument();
    });
  });
});
