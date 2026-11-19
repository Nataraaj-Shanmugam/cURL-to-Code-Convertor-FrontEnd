import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import colors from 'tailwindcss/colors';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { MethodBadge } from '@/components/ui/method-badge';
import { CodeBlock } from '@/components/ui/code-block';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { StarRating } from '@/components/ui/star-rating';
import { METHOD_COLORS } from '@/constants/curl';
import { RATING_LABELS } from '@/constants/feedback';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));

describe('Alert', () => {
  it('announces destructive alerts assertively and everything else politely', () => {
    render(
      <>
        <Alert variant="destructive">bad</Alert>
        <Alert variant="warning">careful</Alert>
        <Alert variant="success">done</Alert>
        <Alert>fyi</Alert>
      </>,
    );
    expect(screen.getByText('bad').closest('[data-variant]')).toHaveAttribute('role', 'alert');
    for (const text of ['careful', 'done', 'fyi']) {
      expect(screen.getByText(text).closest('[data-variant]')).toHaveAttribute('role', 'status');
    }
  });

  it('uses theme tokens, not raw palette colours', () => {
    render(<Alert variant="warning">w</Alert>);
    const cls = screen.getByRole('status').className;
    expect(cls).toContain('text-warning-text');
    expect(cls).not.toMatch(/amber|yellow|orange/);
  });

  it('renders a dismiss button only when asked', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Alert>x</Alert>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<Alert onDismiss={onDismiss} dismissLabel="Dismiss notice">x</Alert>);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('MethodBadge', () => {
  it('gives a method one colour everywhere and falls back for unknown methods', () => {
    render(
      <>
        <MethodBadge method="get" />
        <MethodBadge method="GET" data-testid="second" />
        <MethodBadge method="BREW" data-testid="unknown" />
      </>,
    );
    const [first] = screen.getAllByText('GET');
    expect(first!.className).toContain('text-emerald-800');
    expect(screen.getByTestId('second').className).toEqual(first!.className);
    expect(screen.getByTestId('unknown').className).toContain('bg-slate-200');
  });

  // QU-11: the old badges were 2.8-4.3:1. Check every method in both themes against 4.5:1.
  const palette = colors as unknown as Record<string, Record<string, string>>;
  const hexToLuminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [hexToLuminance(a), hexToLuminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };
  const colour = (cls: string, kind: 'bg' | 'text', dark: boolean) => {
    const prefix = dark ? 'dark:' : '';
    const m = cls.split(' ').find((c) => c.startsWith(`${prefix}${kind}-`) && (dark || !c.startsWith('dark:')));
    const [, name, shade] = m!.replace(prefix, '').match(/^(?:bg|text)-(\w+)-(\d+)$/)!;
    return palette[name!]![shade!]!;
  };

  it.each(Object.entries(METHOD_COLORS))('%s badge text meets 4.5:1 in light and dark', (_method, cls) => {
    expect(contrast(colour(cls, 'text', false), colour(cls, 'bg', false))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour(cls, 'text', true), colour(cls, 'bg', true))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('CodeBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a named, focusable scroll region', () => {
    render(<CodeBlock code="line" label="Generated code" />);
    const region = screen.getByRole('region', { name: 'Generated code' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveTextContent('line');
  });

  it('copies and confirms with a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CodeBlock code="abc" label="Generated code" />);
    await userEvent.click(screen.getByRole('button', { name: /copy generated code/i }));
    expect(writeText).toHaveBeenCalledWith('abc');
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('says so when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    render(<CodeBlock code="abc" label="Generated code" />);
    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not copy to clipboard'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('can hide Copy', () => {
    render(<CodeBlock code="abc" label="Secret" copyable={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('RadioGroup', () => {
  function Group({ initial }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <>
        <button>before</button>
        <RadioGroup value={value} onValueChange={setValue} aria-label="Option">
          <RadioGroupItem value="a" aria-label="A" />
          <RadioGroupItem value="b" aria-label="B" />
          <RadioGroupItem value="c" aria-label="C" />
        </RadioGroup>
        <button>after</button>
      </>
    );
  }

  it('is one tab stop and arrows move the selection', async () => {
    const user = userEvent.setup();
    render(<Group />);
    await user.tab(); // "before"
    await user.tab(); // first radio (nothing is selected yet)
    expect(screen.getByRole('radio', { name: 'A' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'C' })).toBeChecked();
    await user.keyboard('{ArrowRight}'); // wraps
    expect(screen.getByRole('radio', { name: 'A' })).toBeChecked();
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('puts the tab stop on the checked radio', async () => {
    const user = userEvent.setup();
    render(<Group initial="b" />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'B' })).toHaveFocus();
  });
});

describe('StarRating', () => {
  function Stars() {
    const [value, setValue] = useState(0);
    return <StarRating value={value} onChange={setValue} labels={RATING_LABELS} />;
  }

  it('is a radio group with one tab stop and arrow-key selection', async () => {
    const user = userEvent.setup();
    render(<Stars />);
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    await user.tab();
    expect(radios[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: /Good.*3 out of 5/ })).toBeChecked();
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('draws empty stars with a solid outline, not a 30% tint', () => {
    render(<Stars />);
    const svg = screen.getAllByRole('radio')[0]!.querySelector('svg')!;
    expect(svg.getAttribute('class')).toContain('text-muted-foreground');
    expect(svg.getAttribute('class')).not.toContain('/30');
  });
});
