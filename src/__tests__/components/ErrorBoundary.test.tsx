import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { renderWithProviders } from '../test-utils';

function Boom({ error }: { error: Error }): never {
  throw error;
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('hides the raw asset URL for a stale chunk and offers a reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(
      <ErrorBoundary>
        <Boom error={new TypeError('Failed to fetch dynamically imported module: http://localhost/assets/Playground-CYupVgVj.js')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This page could not be loaded')).toBeInTheDocument();
    expect(screen.getByText(/app was updated while this tab was open/)).toBeInTheDocument();
    expect(screen.queryByText(/assets\//)).toBeNull();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  });

  it('still shows the message for other errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(
      <ErrorBoundary>
        <Boom error={new Error('Kaboom')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Kaboom')).toBeInTheDocument();
  });
});
