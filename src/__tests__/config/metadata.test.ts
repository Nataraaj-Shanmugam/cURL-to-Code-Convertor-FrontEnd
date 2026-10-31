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
