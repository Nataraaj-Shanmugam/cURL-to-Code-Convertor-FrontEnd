#!/usr/bin/env node
/**
 * Production bundle size per chunk (raw + gzip + brotli) and the initial-load JS (what index.html pulls in
 * before first paint). Reads dist-perf/, so run `npm run perf:build` first (perf:check does it for you).
 *
 *   node perf/bundle-size.mjs            # print table, write perf/results/bundle.json
 *   node perf/bundle-size.mjs --check    # also compare against perf/budgets.json, exit 1 on a breach
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, process.env.PERF_DIST ?? 'dist-perf');
const kb = (n) => Math.round((n / 1024) * 100) / 100;

export function measureBundle() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error(`${DIST}/index.html missing: run npm run perf:build`);
  const assets = join(DIST, 'assets');
  const files = readdirSync(assets).filter((f) => /\.(js|css)$/.test(f));
  const chunks = files.map((f) => {
    const buf = readFileSync(join(assets, f));
    return {
      file: f,
      // vite appends -<hash>; strip it so budgets survive rebuilds
      name: f.replace(/-[A-Za-z0-9_-]{8}\.(js|css)$/, '.$1'),
      type: f.endsWith('.css') ? 'css' : 'js',
      rawKB: kb(buf.length),
      gzipKB: kb(gzipSync(buf, { level: 9 }).length),
      brotliKB: kb(brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length),
    };
  }).sort((a, b) => b.gzipKB - a.gzipKB);

  // initial load = <script src>, <link rel=modulepreload>, <link rel=stylesheet> in index.html
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const initialFiles = new Set(
    [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]),
  );
  const initial = chunks.filter((c) => initialFiles.has(c.file));
  const sum = (arr, k) => Math.round(arr.reduce((s, c) => s + c[k], 0) * 100) / 100;
  const js = chunks.filter((c) => c.type === 'js');
  const css = chunks.filter((c) => c.type === 'css');
  return {
    chunks,
    totals: {
      jsGzipKB: sum(js, 'gzipKB'), jsRawKB: sum(js, 'rawKB'), cssGzipKB: sum(css, 'gzipKB'),
      initialJsGzipKB: sum(initial.filter((c) => c.type === 'js'), 'gzipKB'),
      initialJsRawKB: sum(initial.filter((c) => c.type === 'js'), 'rawKB'),
      largestJsChunkGzipKB: js[0]?.gzipKB ?? 0, chunkCount: js.length,
    },
    initialFiles: [...initialFiles],
  };
}

export function checkBundle(result, budgets) {
  const failures = [];
  const b = budgets.bundle ?? {};
  for (const [k, limit] of Object.entries(b.totals ?? {})) {
    const v = result.totals[k];
    if (v > limit) failures.push(`bundle.totals.${k}: ${v} KB > budget ${limit} KB`);
  }
  // per-chunk budgets are keyed by hash-less chunk name; "*" is the default for chunks without their own entry
  const per = b.perChunkGzipKB ?? {};
  for (const c of result.chunks.filter((c) => c.type === 'js')) {
    const limit = per[c.name] ?? per['*'];
    if (limit !== undefined && c.gzipKB > limit) {
      failures.push(`chunk ${c.name}: ${c.gzipKB} KB gzip > budget ${limit} KB`);
    }
  }
  return failures;
}

if (basename(process.argv[1] ?? '') === 'bundle-size.mjs') {
  const result = measureBundle();
  mkdirSync(join(ROOT, 'perf/results'), { recursive: true });
  writeFileSync(join(ROOT, 'perf/results/bundle.json'), JSON.stringify(result, null, 2));
  console.log('chunk'.padEnd(34), 'raw KB'.padStart(9), 'gzip KB'.padStart(9), 'brotli KB'.padStart(10));
  for (const c of result.chunks) {
    console.log(c.name.padEnd(34), String(c.rawKB).padStart(9), String(c.gzipKB).padStart(9), String(c.brotliKB).padStart(10));
  }
  console.log('\n' + JSON.stringify(result.totals));
  console.log('initial load:', result.initialFiles.join(', '));
  if (process.argv.includes('--check')) {
    const budgets = JSON.parse(readFileSync(join(ROOT, 'perf/budgets.json'), 'utf8'));
    const failures = checkBundle(result, budgets);
    if (failures.length) {
      console.error('\nBUNDLE BUDGET FAILURES:\n  ' + failures.join('\n  '));
      process.exit(1);
    }
    console.log('\nbundle budgets: OK');
  }
}
