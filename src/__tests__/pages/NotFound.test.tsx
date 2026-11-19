import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import NotFound from '@/pages/NotFound';
import { renderWithProviders } from '../test-utils';

describe('NotFound', () => {
  it('explains the miss with a single h1 and links to the Playground', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to the Playground/i })).toHaveAttribute('href', '/playground');
  });

  it('is what an unknown path renders in a route table with a catch-all', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="*" element={<NotFound />} />
      </Routes>,
      { routerProps: { initialEntries: ['/definitely-not-a-page'] } },
    );
    expect(screen.queryByText('home')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
