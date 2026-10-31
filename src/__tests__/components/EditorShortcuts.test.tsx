import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import CurlPlayground from '@/components/features/curl/CurlPlayground';
import { render, renderWithProviders } from '../test-utils';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const parsed = mockParsedCurl as unknown as ParsedCurl;

/** Delete the Content-Type header so there is one step to undo. */
async function makeUndoableEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete Content-Type' }));
  expect(screen.queryByRole('button', { name: 'Delete Content-Type' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
}

describe('editor keyboard shortcuts (QF-11, QR-8)', () => {
  it('Ctrl+Z outside text fields undoes the last edit', async () => {
    const user = userEvent.setup();
    render(<ParsedCurlEditor initialData={parsed} />);
    await makeUndoableEdit(user);
    await user.click(document.body);
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('button', { name: 'Delete Content-Type' })).toBeInTheDocument();
    await user.keyboard('{Control>}y{/Control}');
    expect(screen.queryByRole('button', { name: 'Delete Content-Type' })).toBeNull();
  });

  it('Ctrl+Z inside a field editor is left to the input', async () => {
    const user = userEvent.setup();
    render(<ParsedCurlEditor initialData={parsed} />);
    await makeUndoableEdit(user);
    await user.click(screen.getByRole('button', { name: 'Edit page' }));
    await user.click(screen.getByLabelText('Value of page'));
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.queryByRole('button', { name: 'Delete Content-Type' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('Ctrl+Z while a dialog is open does not touch the editor behind it', async () => {
    const user = userEvent.setup();
    render(<ParsedCurlEditor initialData={parsed} />);
    await makeUndoableEdit(user);
    await user.click(screen.getByRole('button', { name: /Export/ }));
    const dialog = await screen.findByRole('dialog');
    dialog.focus();
    await user.keyboard('{Control>}z{/Control}');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Delete Content-Type' })).toBeNull();
  });

  it('Ctrl+G opens Generate Code, but not over another dialog or in an inactive editor', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ParsedCurlEditor initialData={parsed} />);
    await user.click(screen.getByRole('button', { name: /Export/ }));
    const exportDialog = await screen.findByRole('dialog');
    await user.keyboard('{Control>}g{/Control}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(exportDialog).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.keyboard('{Control>}g{/Control}');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/Generate/).length).toBeGreaterThan(0);
    unmount();

    render(<ParsedCurlEditor initialData={parsed} isActive={false} />);
    await user.keyboard('{Control>}g{/Control}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Playground Ctrl+Enter (QF-19)', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('does not parse the Playground from inside the Import dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CurlPlayground />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('curl https://api.example.com/users');
    await user.click(screen.getByRole('button', { name: /Import/ }));
    const dialog = await screen.findByRole('dialog');
    const dialogInput = within(dialog).queryAllByRole('textbox')[0];
    if (dialogInput) await user.click(dialogInput);
    await user.keyboard('{Control>}{Enter}{/Control}');
    await new Promise(r => setTimeout(r, 300));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('still parses from the Playground textarea', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CurlPlayground />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('curl https://api.example.com/users');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled(), { timeout: 10_000 });
  });
});
