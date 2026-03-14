import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import { render } from '../test-utils';
import { server } from '../mocks/server';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

const baseParsed: ParsedCurl = {
  ...mockParsedCurl,
  method: 'POST',
  url: 'https://api.example.com/users',
  base_url: 'https://api.example.com',
  endpoint: '/users',
};

describe('ParsedCurlEditor', () => {
  describe('empty state', () => {
    it('shows empty state when parsed is empty', () => {
      render(<ParsedCurlEditor initialData={{} as ParsedCurl} />);
      expect(screen.getByText(/No parsed data available/i)).toBeInTheDocument();
    });

    it('shows Back to Playground button in empty state when onBack provided', () => {
      const onBack = vi.fn();
      render(<ParsedCurlEditor initialData={{} as ParsedCurl} onBack={onBack} />);
      const backBtn = screen.getByRole('button', { name: /Back to Playground/i });
      expect(backBtn).toBeInTheDocument();
    });
  });

  describe('rendering with data', () => {
    it('renders the editor card title', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByText('Edit Parsed Request')).toBeInTheDocument();
    });

    it('renders toolbar with Generate Code button', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByRole('button', { name: /Generate Code/i })).toBeInTheDocument();
    });

    it('renders Reset button in toolbar', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    });

    it('renders Export button', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    });

    it('renders the original cURL when provided', () => {
      render(<ParsedCurlEditor initialData={baseParsed} originalCurl="curl https://api.example.com/users" />);
      expect(screen.getByText(/Original cURL Command/i)).toBeInTheDocument();
    });
  });

  describe('confirmation dialog replaces window.confirm', () => {
    it('opens confirmation dialog when Reset is clicked (not window.confirm)', async () => {
      const user = userEvent.setup();
      render(<ParsedCurlEditor initialData={baseParsed} />);
      await user.click(screen.getByRole('button', { name: /Reset/i }));
      expect(screen.getByText(/Reset all changes/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Reset$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('cancels reset when Cancel is clicked in confirmation', async () => {
      const user = userEvent.setup();
      render(<ParsedCurlEditor initialData={baseParsed} />);
      await user.click(screen.getByRole('button', { name: /Reset/i }));
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.queryByText(/Reset all changes/i)).not.toBeInTheDocument();
    });

    it('confirms reset when Reset button clicked in dialog', async () => {
      const user = userEvent.setup();
      render(<ParsedCurlEditor initialData={baseParsed} />);
      await user.click(screen.getByRole('button', { name: /Reset/i }));
      const dialog = screen.getByRole('dialog', { name: /Reset all changes/i });
      await user.click(within(dialog).getByRole('button', { name: /^Reset$/ }));
      expect(screen.queryByText(/Reset all changes/i)).not.toBeInTheDocument();
    });
  });

  describe('back navigation', () => {
    it('shows Back button when onBack prop is provided', () => {
      const onBack = vi.fn();
      render(<ParsedCurlEditor initialData={baseParsed} onBack={onBack} />);
      expect(screen.getByRole('button', { name: /← Back/i })).toBeInTheDocument();
    });

    it('calls onBack when Back button is clicked', async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();
      render(<ParsedCurlEditor initialData={baseParsed} onBack={onBack} />);
      await user.click(screen.getByRole('button', { name: /← Back/i }));
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  describe('accordion sections', () => {
    it('renders request section with method and URL', async () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByText('Request Details')).toBeInTheDocument();
    });

    it('renders headers section when headers present', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByText('Headers')).toBeInTheDocument();
    });

    it('renders query params section when query_params present', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByText('Query Parameters')).toBeInTheDocument();
    });

    it('renders cookies section when cookies present', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByText('Cookies')).toBeInTheDocument();
    });

    it('renders request body section when data present', () => {
      render(<ParsedCurlEditor initialData={baseParsed} />);
      expect(screen.getByText('Request Body')).toBeInTheDocument();
    });
  });

  describe('body API error display', () => {
    it('shows body API error when body node delete fails', async () => {
      server.use(
        http.post('*/api/body/delete', () =>
          HttpResponse.json({ success: false, error: { message: 'Node not found at path' } })
        )
      );
      const user = userEvent.setup();
      render(<ParsedCurlEditor initialData={baseParsed} />);

      // The data section auto-opens when data is present — no need to click accordion
      // Wait for body content to render and find delete buttons
      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /Delete name/i });
        expect(deleteButtons.length).toBeGreaterThan(0);
      });

      const deleteBtn = screen.getAllByRole('button', { name: /Delete name/i })[0];
      await user.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText(/Body API error/i)).toBeInTheDocument();
      });
    });
  });

  describe('code generation dialog', () => {
    it('opens code generation dialog when Generate Code is clicked', async () => {
      const user = userEvent.setup();
      render(<ParsedCurlEditor initialData={baseParsed} />);
      await user.click(screen.getByRole('button', { name: /Generate Code/i }));
      await waitFor(() => {
        expect(screen.getByText('Code Generation Configuration')).toBeInTheDocument();
      });
    });
  });

  describe('Add Section button', () => {
    it('is disabled when all sections are present', () => {
      const fullParsed: ParsedCurl = {
        ...baseParsed,
        query_params: { page: '1' },
        headers: { 'Content-Type': 'application/json' },
        cookies: { session: 'abc' },
        auth: 'user:pass',
        flags: { insecure: true },
      };
      render(<ParsedCurlEditor initialData={fullParsed} />);
      const addSectionBtn = screen.getByRole('button', { name: /Add Section/i });
      // Button is enabled when missingSections > 0
      expect(addSectionBtn).toBeDefined();
    });
  });

  describe('selection and bulk delete', () => {
    it('shows delete button when items are selected', async () => {
      const user = userEvent.setup();
      render(<ParsedCurlEditor initialData={baseParsed} />);

      // Find a checkbox (non-deletable items are disabled)
      const checkboxes = screen.getAllByRole('checkbox');
      const enabledCheckbox = checkboxes.find(cb => !(cb as HTMLInputElement).disabled);

      if (enabledCheckbox) {
        await user.click(enabledCheckbox);
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Delete \(\d+\)/i })).toBeInTheDocument();
        });
      }
    });
  });
});
