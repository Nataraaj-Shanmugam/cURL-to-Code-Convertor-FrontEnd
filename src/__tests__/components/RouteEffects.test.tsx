import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, useLocation } from 'react-router-dom';
import RouteEffects from '@/components/layout/RouteEffects';
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
});
