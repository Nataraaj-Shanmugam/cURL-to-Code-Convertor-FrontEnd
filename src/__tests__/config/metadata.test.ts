import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (rel: string) => resolve(__dirname, '../../..', rel);
const indexHtml = readFileSync(root('index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(root('public/manifest.json'), 'utf8')) as {
  name: string;
  short_name: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string }[];
};

describe('app metadata', () => {
  it('uses the cURLCraft Assured brand in the document title', () => {
    expect(indexHtml).toMatch(/<title>cURLCraft Assured<\/title>/);
  });

  it('links the manifest, apple-touch-icon and theme-color', () => {
    expect(indexHtml).toMatch(/<link rel="manifest" href="\/manifest\.json"/);
    expect(indexHtml).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
    expect(indexHtml).toMatch(/<meta name="theme-color" content="#047b57"/);
  });

  it('manifest carries the brand name and the --primary theme colour', () => {
    expect(manifest.name).toBe('cURLCraft Assured');
    expect(manifest.short_name).toBe('cURLCraft');
    expect(manifest.theme_color).toBe('#047b57');
  });

  it('every manifest icon exists in public/ with the declared size', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(root(`public${icon.src}`)), icon.src).toBe(true);
    }
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });

  it('removes the Vite starter and CRA leftovers from public/', () => {
    expect(existsSync(root('public/vite.svg'))).toBe(false);
    expect(existsSync(root('public/index.html'))).toBe(false);
    expect(existsSync(root('public/logo192.png'))).toBe(false);
  });
});

describe('social sharing metadata', () => {
  const content = (name: string) => indexHtml.match(new RegExp(`${name}" content="([^"]*)"`))?.[1];

  it('sets a canonical URL on the production origin', () => {
    expect(indexHtml).toMatch(/<link rel="canonical" href="https:\/\/curlcraftassured\.vercel\.app\/" \/>/);
  });

  it('uses a large summary Twitter card and a 1200x630 og:image that exists', () => {
    expect(content('twitter:card')).toBe('summary_large_image');
    const image = content('og:image');
    expect(image).toBe('https://curlcraftassured.vercel.app/og-image.png');
    expect(content('og:image:width')).toBe('1200');
    expect(content('og:image:height')).toBe('630');
    expect(existsSync(root('public/og-image.png'))).toBe(true);
    expect(content('twitter:image')).toBe(image);
  });
});

describe('deploy security headers (vercel.json)', () => {
  const config = JSON.parse(readFileSync(root('vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
    rewrites: { source: string; destination: string }[];
  };
  const headers = Object.fromEntries(
    (config.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]),
  );
  const csp = Object.fromEntries(
    (headers['Content-Security-Policy'] ?? '')
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((p) => p[0])
      .map(([name, ...sources]) => [name, sources]),
  );

  it('keeps the SPA rewrite', () => {
    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('restricts scripts to self and the Vercel preview toolbar, and frames to none', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'", 'https://vercel.live']);
    expect(csp['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp['img-src']).toEqual(["'self'", 'data:']);
    // Vite inlines small @fontsource woff2 files as data: URIs, so fonts must allow data:
    expect(csp['font-src']).toEqual(["'self'", 'data:']);
    expect(csp['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https:']));
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
  });

  it('sets nosniff and strict-origin-when-cross-origin referrer policy', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});
