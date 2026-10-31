import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, useLocation } from 'react-router-dom';
import RouteEffects, { titleForPath } from '@/components/layout/RouteEffects';
import { renderWithProviders as render } from '../test-utils';

function Shell() {
  const { pathname } = useLocation();
  return (
    <>
      <RouteEffects />
      <nav>
        <Link to="/playground">Playground link</Link>
        <Link to="/batch-editor">Batch link</Link>
        <Link to="/nope">Unknown link</Link>
      </nav>
      <main id="main-content">
        <h1>Heading for {pathname}</h1>
      </main>
    </>
  );
}

describe('RouteEffects', () => {
  beforeEach(() => {
    document.title = 'initial';
  });

  it('maps every route to its own title, including /batch-editor and unknown paths', () => {
    expect(titleForPath('/playground')).toMatch(/^Playground/);
    expect(titleForPath('/editor')).toMatch(/^Editor/);
    expect(titleForPath('/batch-editor')).toMatch(/^Batch Editor/);
    expect(titleForPath('/feedback')).toMatch(/^Feedback/);
    expect(titleForPath('/batch-editor/')).toMatch(/^Batch Editor/);
    expect(titleForPath('/nope')).toMatch(/^Page not found/);
    expect(titleForPath('/')).toMatch(/^cURLCraft Assured/);
  });

  it('leaves focus alone on first render but moves it to the <h1> after navigating', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    expect(document.body).toHaveFocus();

    await user.click(screen.getByRole('link', { name: 'Playground link' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('/playground');

    await user.click(screen.getByRole('link', { name: 'Batch link' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('/batch-editor'));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
  });

  it('retitles the document on every navigation, including /batch-editor and unknown paths', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    expect(document.title).toMatch(/^cURLCraft Assured/);
    await user.click(screen.getByRole('link', { name: 'Playground link' }));
    await waitFor(() => expect(document.title).toMatch(/^Playground/));
    await user.click(screen.getByRole('link', { name: 'Batch link' }));
    await waitFor(() => expect(document.title).toMatch(/^Batch Editor/));
    await user.click(screen.getByRole('link', { name: 'Unknown link' }));
    await waitFor(() => expect(document.title).toMatch(/^Page not found/));
  });

  it('scrolls to the top when navigating forward', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Shell />);
    expect(scrollTo).not.toHaveBeenCalled(); // not on first load
    await user.click(screen.getByRole('link', { name: 'Playground link' }));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
    scrollTo.mockRestore();
  });
});
