import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import colors from 'tailwindcss/colors';
import { CHIP_COLORS, METHOD_COLORS, METHOD_COLOR_FALLBACK } from '@/constants/curl';
import { CODE_COLORS } from '@/lib/codeTheme';

/** WCAG 2.x contrast between two sRGB colours. */
function luminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(a: [number, number, number], b: [number, number, number]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number];
}

/** `emerald-100` -> rgb, from Tailwind's own palette (the same values the build uses). */
function tw(token: string): [number, number, number] {
  const [name, shade] = token.split(/-(?=\d+$)/) as [string, string];
  const palette = (colors as unknown as Record<string, Record<string, string>>)[name];
  const hex = palette?.[shade];
  if (!hex) throw new Error(`unknown Tailwind colour ${token}`);
  return hexToRgb(hex);
}

/** Pulls the light and dark (bg, text) pairs out of a class string like "bg-x-100 text-x-800 dark:bg-x-950 dark:text-x-300". */
function pairs(classes: string) {
  const grab = (re: RegExp) => classes.match(re)?.[1];
  return {
    light: [grab(/(?:^|\s)bg-([a-z]+-\d+)(?:\s|$)/), grab(/(?:^|\s)text-([a-z]+-\d+)(?:\s|$)/)],
    dark: [grab(/dark:bg-([a-z]+-\d+)/), grab(/dark:text-([a-z]+-\d+)/)],
  } as const;
}

describe('status colours clear WCAG AA (4.5:1) in both themes', () => {
  const maps: [string, string][] = [
    ...Object.entries(METHOD_COLORS).map(([k, v]): [string, string] => [`method ${k}`, v]),
    ['method fallback', METHOD_COLOR_FALLBACK],
    ...Object.entries(CHIP_COLORS).map(([k, v]): [string, string] => [`chip ${k}`, v]),
  ];

  it.each(maps)('%s', (_name, classes) => {
    const p = pairs(classes);
    for (const theme of ['light', 'dark'] as const) {
      const [bg, fg] = p[theme];
      expect(bg, `${theme} background of "${classes}"`).toBeTruthy();
      expect(fg, `${theme} text of "${classes}"`).toBeTruthy();
      expect(ratio(tw(bg!), tw(fg!)), `${theme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every HTTP method has its own colour (no two methods look alike)', () => {
    const values = Object.values(METHOD_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('theme tokens (src/index.css)', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return css.slice(start, css.indexOf('}', start));
  };
  const tokens = (selector: string) => {
    const out: Record<string, [number, number, number]> = {};
    for (const m of block(selector).matchAll(/--([a-z-]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/g)) {
      out[m[1]!] = hslToRgb(Number(m[2]), Number(m[3]), Number(m[4]));
    }
    return out;
  };

  const text: [string, string][] = [
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'muted'],
    ['muted-foreground', 'card'],
    ['primary-foreground', 'primary'],
    ['accent-foreground', 'accent'],
    ['secondary-foreground', 'secondary'],
    ['destructive-foreground', 'destructive'],
    ['destructive', 'background'],
    ['success', 'background'],
    ['warning-text', 'background'],
    ['primary', 'background'],
    ['code-fg', 'code-bg'],
  ];

  for (const [theme, selector] of [['light', ':root'], ['dark', '.dark']] as const) {
    describe(theme, () => {
      const t = { ...tokens(':root'), ...tokens(selector) };
      it.each(text)('%s on %s', (fg, bg) => {
        expect(t[fg], `--${fg}`).toBeTruthy();
        expect(t[bg], `--${bg}`).toBeTruthy();
        expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
      });
    });
  }

  it('every syntax colour is legible on the code surface (the XML prolog included)', () => {
    const bg = tokens(':root')['code-bg']!;
    for (const [name, hex] of Object.entries(CODE_COLORS)) {
      expect(ratio(hexToRgb(hex), bg), `syntax colour ${name}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(CODE_COLORS.prolog).toBeTruthy();
  });
});

describe('one colour map per concept', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? (f === '__tests__' ? [] : walk(p)) : /\.tsx?$/.test(f) ? [p] : [];
    });
  const files = walk(join(process.cwd(), 'src')).filter((f) => !f.endsWith('constants/curl.ts'));

  it('no component keeps its own method-colour map', () => {
    const offenders = files.filter((f) => /METHOD_COLORS\s*[:=]|GET:\s*"bg-/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no translucent green/amber/red chip backgrounds (they fail contrast on tinted surfaces)', () => {
    const offenders = files.filter((f) => /<Badge[^>]*bg-(green|amber|yellow|orange|red|blue)-500\/\d+/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('there is a single code surface: no bg-slate-950 panes outside the shared CodeBlock', () => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('bg-slate-950'));
    expect(offenders).toEqual([]);
  });
});
