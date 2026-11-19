#!/usr/bin/env node
/**
 * Browser measurements on `vite preview` of the perf build, backend mocked at the network layer.
 *
 *   node perf/measure.mjs web                      # LCP / CLS / TBT / TTI for Home, Playground, Editor
 *   node perf/measure.mjs stress [names...]        # editor stress scenarios
 *   node perf/measure.mjs all --runs 5 --cpu-throttle 4 --observe-ms 4000
 * Writes perf/results/latest.json (medians + every run).
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SCENARIOS, startPreview, launch, median, round } from './lib.mjs';
import { webRun, stressSingle, stressBatch } from './scenarios.mjs';

const args = process.argv.slice(2);
const mode = args[0] ?? 'all';
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : def; };
const RUNS = opt('runs', 5);
const STRESS_RUNS = opt('stress-runs', 3);
const THROTTLE = opt('cpu-throttle', 1);
const OBSERVE_MS = opt('observe-ms', 4000);
const QUIET_MS = opt('quiet-ms', 2000);
const names = args.slice(1).filter((a, i, arr) => !a.startsWith('--') && !(arr[i - 1] ?? '').startsWith('--'));

const CFG = { cpuThrottle: THROTTLE, observeMs: OBSERVE_MS, quietMs: QUIET_MS };

// ── aggregate ────────────────────────────────────────────────────────────────
function aggregate(runs) {
  const keys = new Set(runs.flatMap((r) => Object.keys(r)));
  const out = { runs: runs.length };
  for (const k of keys) {
    const vals = runs.map((r) => r[k]);
    if (vals.every((v) => typeof v === 'number')) out[k] = round(median(vals), k === 'cls' ? 4 : 1);
    else if (vals.some((v) => v && typeof v === 'object')) out[k] = vals.find((v) => v && typeof v === 'object');
    else out[k] = vals.find((v) => v !== null && v !== undefined) ?? null;
  }
  return { median: out, all: runs };
}

const results = { meta: { cpuThrottle: THROTTLE, runs: RUNS, stressRuns: STRESS_RUNS, observeMs: OBSERVE_MS, quietMs: QUIET_MS, date: new Date().toISOString(), node: process.version }, web: {}, stress: {} };
if (!existsSync(join(ROOT, process.env.PERF_DIST ?? 'dist-perf'))) { console.error('dist-perf missing: run `npm run perf:build` first'); process.exit(2); }
const server = await startPreview();
const browser = await launch();
results.meta.chromium = browser.version();
try {
  if (mode === 'web' || mode === 'all') {
    for (const which of ['home', 'playground', 'editor']) {
      if (names.length && !names.includes(which)) continue;
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await webRun(browser, which, CFG));
      results.web[which] = aggregate(runs);
      console.log(`web ${which.padEnd(10)}`, JSON.stringify(results.web[which].median));
    }
  }
  if (mode === 'stress' || mode === 'all') {
    for (const name of [...Object.keys(SCENARIOS), 'batch25']) {
      if (names.length && !names.includes(name)) continue;
      const runs = [];
      for (let i = 0; i < STRESS_RUNS; i++) {
        runs.push(name === 'batch25' ? await stressBatch(browser, CFG) : await stressSingle(browser, name, CFG));
        if (runs.at(-1).fatal) break;
      }
      results.stress[name] = aggregate(runs);
      const { heapBefore, heapAfterRender, heapAfterEdits, heapFinal, ...flat } = results.stress[name].median;
      console.log(`stress ${name.padEnd(10)}`, JSON.stringify(flat), '\n   heap(MB) before/render/edits/final:', [heapBefore, heapAfterRender, heapAfterEdits, heapFinal].map((h) => h?.usedMB).join(' / '), 'dom:', heapAfterRender?.domNodes);
    }
  }
} finally {
  await browser.close();
  server.stop();
}
mkdirSync(join(ROOT, 'perf/results'), { recursive: true });
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'perf/results/latest.json';
writeFileSync(join(ROOT, outFile), JSON.stringify(results, null, 2));
console.log('wrote', outFile);
