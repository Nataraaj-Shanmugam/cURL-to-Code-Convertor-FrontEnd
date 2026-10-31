import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import Footer from '@/components/layout/Footer';
import { renderWithProviders } from '../test-utils';

describe('Footer', () => {
  it('links to Playground and Feedback inside the app, and to GitHub and nataraaj.dev outside it', () => {
    renderWithProviders(<Footer />);
    const nav = within(screen.getByRole('navigation', { name: 'Footer' }));
    expect(nav.getByRole('link', { name: 'Playground' })).toHaveAttribute('href', '/playground');
    expect(nav.getByRole('link', { name: 'Feedback' })).toHaveAttribute('href', '/feedback');

    const github = nav.getByRole('link', { name: /GitHub/ });
    expect(github).toHaveAttribute('href', expect.stringMatching(/^https:\/\/github\.com\/Nataraaj-Shanmugam\//));
    const site = nav.getByRole('link', { name: /nataraaj\.dev/ });
    expect(site).toHaveAttribute('href', 'https://nataraaj.dev');
    for (const external of [github, site]) {
      expect(external).toHaveAttribute('target', '_blank');
      expect(external.getAttribute('rel')).toContain('noopener');
      expect(external).toHaveAccessibleName(expect.stringContaining('opens in a new tab'));
    }
  });
});
