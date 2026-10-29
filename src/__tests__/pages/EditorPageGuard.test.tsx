import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import EditorPage from '@/pages/EditorPage';
import { mockParsedCurlStringBody } from '../mocks/handlers';

// Real router, no mocked navigation: this exercises useBlocker end to end.
function renderEditor() {
  const router = createMemoryRouter(
    [
      {
        path: '/editor',
        element: (
          <>
            <EditorPage />
            <Link to="/other">Other link</Link>
          </>
        ),
      },
      { path: '/playground', element: <div>Playground page</div> },
      { path: '/other', element: <div>Other page</div> },
    ],
    {
      initialEntries: [
        { pathname: '/editor', state: { parsed: mockParsedCurlStringBody, originalCurl: 'curl x' } },
      ],
    },
  );
  const utils = render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return { router, ...utils };
}

/** Fires beforeunload the way the browser does and reports whether the page asked to block it. */
function unloadIsBlocked(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

// The editor is lazy-loaded; the first render in a file waits for its chunk.
const findDeleteNameButtons = () =>
  screen.findAllByRole('button', { name: /Delete name/i }, { timeout: 5000 });

async function makeEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click((await findDeleteNameButtons())[0]!);
}

describe('EditorPage unsaved-edits guard', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    localStorage.clear();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => confirmSpy.mockRestore());

  it('does not warn on unload while the body is untouched', async () => {
    renderEditor();
    await findDeleteNameButtons();
    expect(unloadIsBlocked()).toBe(false);
  });

  it('warns on unload only after an edit, and stops once the edit is undone', async () => {
    const user = userEvent.setup();
    renderEditor();
    await makeEdit(user);
    await waitFor(() => expect(unloadIsBlocked()).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(unloadIsBlocked()).toBe(false));
  });

  it('does not intercept navigation when nothing was edited', async () => {
    const user = userEvent.setup();
    const { router } = renderEditor();
    await findDeleteNameButtons();

    await user.click(screen.getByRole('button', { name: /← Back/i }));

    expect(await screen.findByText('Playground page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/playground');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Back with edits asks once (a dialog, not window.confirm); Keep editing stays, Discard leaves', async () => {
    const user = userEvent.setup();
    const { router } = renderEditor();
    await makeEdit(user);
    await waitFor(() => expect(unloadIsBlocked()).toBe(true));

    await user.click(screen.getByRole('button', { name: /← Back/i }));
    let dialog = await screen.findByRole('dialog', { name: /Discard unsaved edits/i });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(router.state.location.pathname).toBe('/editor');

    await user.click(within(dialog).getByRole('button', { name: /Keep editing/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/editor');
    expect(unloadIsBlocked()).toBe(true); // still dirty, edit still there

    await user.click(screen.getByRole('button', { name: /← Back/i }));
    dialog = await screen.findByRole('dialog', { name: /Discard unsaved edits/i });
    await user.click(within(dialog).getByRole('button', { name: /Discard and leave/i }));

    expect(await screen.findByText('Playground page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/playground');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(unloadIsBlocked()).toBe(false); // guard is gone with the editor
  });

  it('guards other in-app navigation (links, history) and Esc means stay', async () => {
    const user = userEvent.setup();
    const { router } = renderEditor();
    await makeEdit(user);
    await waitFor(() => expect(unloadIsBlocked()).toBe(true));

    await user.click(screen.getByRole('link', { name: 'Other link' }));
    await screen.findByRole('dialog', { name: /Discard unsaved edits/i });
    expect(router.state.location.pathname).toBe('/editor');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/editor');

    await act(async () => { void router.navigate('/other'); });
    const dialog = await screen.findByRole('dialog', { name: /Discard unsaved edits/i });
    await user.click(within(dialog).getByRole('button', { name: /Discard and leave/i }));
    expect(await screen.findByText('Other page')).toBeInTheDocument();
  });

  it('Back clears the saved editor state only when the user actually leaves', async () => {
    const user = userEvent.setup();
    renderEditor();
    await makeEdit(user);
    await waitFor(() => expect(localStorage.getItem('curlcraft_editor_state')).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /← Back/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Keep editing/i }));
    expect(localStorage.getItem('curlcraft_editor_state')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /← Back/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Discard and leave/i }));
    await screen.findByText('Playground page');
    expect(localStorage.getItem('curlcraft_editor_state')).toBeNull();
  });
});
