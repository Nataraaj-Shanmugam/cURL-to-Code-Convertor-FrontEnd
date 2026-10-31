import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import { render } from '../test-utils';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

const parsed = mockParsedCurl as unknown as ParsedCurl;

describe('editor section headers (QU-3, QR-23, QU-26, QU-2)', () => {
  it('renders no button inside another button and keeps trigger names clean', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<ParsedCurlEditor initialData={parsed} />);
    expect(container.querySelectorAll('button button')).toHaveLength(0);
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/validateDOMNesting/);
    errors.mockRestore();

    expect(screen.getByRole('button', { name: 'Headers' })).toHaveAttribute('aria-expanded');
    expect(screen.getByRole('button', { name: 'Request Body' })).toHaveAttribute('aria-expanded');
    expect(screen.getByRole('button', { name: 'Add Entry to Headers' })).not.toHaveAttribute('aria-expanded');
    expect(screen.getByRole('button', { name: 'Delete Section Headers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand all body nodes/ })).toBeInTheDocument();
  });

  it('header actions work without toggling the section', async () => {
    const user = userEvent.setup();
    render(<ParsedCurlEditor initialData={parsed} />);
    const trigger = screen.getByRole('button', { name: 'Headers' });
    const before = trigger.getAttribute('data-state');
    await user.click(screen.getByRole('button', { name: 'Add Entry to Headers' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(trigger.getAttribute('data-state')).toBe(before);
  });

  it('accordion triggers carry the brand focus-visible ring', () => {
    render(<ParsedCurlEditor initialData={parsed} />);
    expect(screen.getByRole('button', { name: 'Headers' }).className).toMatch(/focus-visible:ring-2.*focus-visible:ring-ring/);
  });

  it('row actions are revealed on focus-within and on touch, not only on hover', () => {
    render(<ParsedCurlEditor initialData={parsed} />);
    const actions = screen.getByRole('button', { name: 'Edit Content-Type' }).parentElement!;
    expect(actions.className).toContain('group-focus-within:opacity-100');
    expect(actions.className).toContain('[@media(hover:none)]:opacity-100');
  });
});
