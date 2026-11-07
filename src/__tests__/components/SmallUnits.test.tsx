import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '@/components/ui/theme-provider';
import { DropdownMenuShortcut } from '@/components/ui/dropdown-menu';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import NavBar from '@/components/layout/NavBar';
import { useBackendStatus } from '@/contexts/BackendStatusContext';
import { renderWithProviders } from '../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.className = '';
  localStorage.clear();
});

describe('useBackendStatus without a provider', () => {
  it('assumes ready; retry is a no-op and waitUntilReady resolves immediately', async () => {
    const { result } = renderHook(() => useBackendStatus());
    expect(result.current.status).toBe('ready');
    expect(result.current.wakingSince).toBeNull();
    expect(result.current.retry()).toBeUndefined();
    await expect(result.current.waitUntilReady()).resolves.toBeUndefined();
    await expect(result.current.waitUntilReady(new AbortController().signal)).resolves.toBeUndefined();
  });
});

describe('ThemeProvider wrapper', () => {
  it('passes props through to next-themes and exposes useTheme', async () => {
    const Probe = () => {
      const { theme, setTheme } = useTheme();
      return <button onClick={() => setTheme('dark')}>theme:{theme}</button>;
    };
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('DropdownMenuShortcut', () => {
  it('renders its text with a merged className', () => {
    render(<DropdownMenuShortcut className="extra">⌘K</DropdownMenuShortcut>);
    const el = screen.getByText('⌘K');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('extra', 'ml-auto');
  });
});

describe('ErrorBoundary reload', () => {
  it('Reload page calls window.location.reload; a plain error shows its message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { value: { ...original, reload }, configurable: true });
    const Boom = () => {
      throw new Error('kaboom');
    };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'location', { value: original, configurable: true });
  });
});

describe('NavBar theme toggle', () => {
  it('switches between light and dark on each click', async () => {
    renderWithProviders(<NavBar />);
    const toggle = (await screen.findAllByRole('button', { name: 'Toggle theme' }))[0]!;
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await userEvent.click(toggle);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await userEvent.click(toggle);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
