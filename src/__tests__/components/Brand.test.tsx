import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import Footer from '@/components/layout/Footer';
import NavBar from '@/components/layout/NavBar';

describe('brand name in UI chrome', () => {
  it('NavBar logo reads cURLCraft Assured', () => {
    renderWithProviders(<NavBar />);
    expect(screen.getByRole('banner')).toHaveTextContent('cURLCraft Assured');
  });

  it('Footer copyright reads cURLCraft Assured', () => {
    renderWithProviders(<Footer />);
    expect(screen.getByText(/cURLCraft Assured$/)).toBeInTheDocument();
  });
});
