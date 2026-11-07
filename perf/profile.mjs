#!/usr/bin/env node
/**
 * CPU profiling of the stress scenarios: builds an unminified + sourcemapped copy (dist-perf-profile), runs each
 * interaction phase under the CDP Profiler and maps the hottest functions back to src/ with the sourcemaps.
 *
 *   node perf/profile.mjs [scenario ...] [--top 8] [--no-build]
 * Writes perf/results/profile.json
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, SCENARIOS, startPreview, launch, round } from './lib.mjs';
import { stressSingle, stressBatch } from './scenarios.mjs';

const require = createRequire(import.meta.url);
const { SourceMapConsumer } = require('source-map-js');
const args = process.argv.slice(2);
const TOP = Number(args[args.indexOf('--top') + 1]) || 8;
const wanted = args.filter((a, i) => !a.startsWith('--') && !/^\d+$/.test(a) && args[i - 1] !== '--top');
const DIST = 'dist-perf-profile';

if (!args.includes('--no-build') || !existsSync(join(ROOT, DIST))) {
  const r = spawnSync(join(ROOT, 'node_modules/.bin/vite'), ['build', '--config', 'perf/vite.perf.config.ts', '--mode', 'perf'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PERF_PROFILE: '1', VITE_CURL_CRAFT_API_URL: 'http://127.0.0.1:8000' } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const maps = new Map();
function consumerFor(url) {
  const file = join(ROOT, DIST, new URL(url).pathname);
  if (!maps.has(file)) maps.set(file, existsSync(`${file}.map`) ? new SourceMapConsumer(JSON.parse(readFileSync(`${file}.map`, 'utf8'))) : null);
  return maps.get(file);
}
const shortSrc = (s) => s.replace(/^.*\/(node_modules|src)\//, (_m, d) => `${d}/`);

/** Self time (ms) per source location from a .cpuprofile. */
function summarize(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const agg = new Map();
  let total = 0, idle = 0;
  for (const [id, us] of self) {
    const { callFrame: cf } = byId.get(id);
    total += us;
    if (['(idle)', '(program)', '(garbage collector)'].includes(cf.functionName)) {
      if (cf.functionName === '(idle)') idle += us;
      const key = cf.functionName;
      const a = agg.get(key) ?? { fn: key, where: '', us: 0 };
      a.us += us; agg.set(key, a);
      continue;
    }
    let where = cf.url ? `${cf.url.split('/').pop()}:${cf.lineNumber + 1}` : '(native)';
    let fn = cf.functionName || '(anonymous)';
    if (cf.url?.startsWith('http')) {
      const c = consumerFor(cf.url);
      const pos = c?.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber });
      if (pos?.source) { where = `${shortSrc(pos.source)}:${pos.line}`; if (pos.name && !cf.functionName) fn = pos.name; }
    }
    const key = `${fn}@${where}`;
    const a = agg.get(key) ?? { fn, where, us: 0 };
    a.us += us; agg.set(key, a);
  }
  const busy = total - idle;
  return {
    busyMs: round(busy / 1000),
    top: [...agg.values()].filter((a) => a.fn !== '(idle)').sort((x, y) => y.us - x.us).slice(0, TOP)
      .map((a) => ({ fn: a.fn, where: a.where, selfMs: round(a.us / 1000), pct: round((100 * a.us) / busy) })),
  };
}

const server = await startPreview(DIST);
const browser = await launch();
const out = {};
try {
  for (const name of [...Object.keys(SCENARIOS).filter((n) => n !== 'baseline' && (n !== 'body5mb' || wanted.includes('body5mb'))) /* body5mb crashes the tab: name it explicitly */, 'batch25']) {
    if (wanted.length && !wanted.includes(name)) continue;
    out[name] = {};
    const phase = async (pname, fn, { cdp }) => {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
      await cdp.send('Profiler.start');
      try { return await fn(); } finally {
        const { profile } = await cdp.send('Profiler.stop');
        out[name][pname] = summarize(profile);
      }
    };
    const m = name === 'batch25' ? await stressBatch(browser, { cpuThrottle: 1, observeMs: 0, quietMs: 0 }, phase)
      : await stressSingle(browser, name, { cpuThrottle: 1, observeMs: 0, quietMs: 0 }, phase);
    console.log(`\n=== ${name}${m.fatal ? ` (fatal: ${m.fatal})` : ''}`);
    for (const [p, s] of Object.entries(out[name])) {
      console.log(`  [${p}] busy ${s.busyMs} ms`);
      for (const t of s.top.slice(0, 5)) console.log(`     ${String(t.selfMs).padStart(8)} ms ${String(t.pct).padStart(5)}%  ${t.fn}  ${t.where}`);
    }
  }
} finally { await browser.close(); server.stop(); }
writeFileSync(join(ROOT, 'perf/results/profile.json'), JSON.stringify(out, null, 2));
console.log('\nwrote perf/results/profile.json');
