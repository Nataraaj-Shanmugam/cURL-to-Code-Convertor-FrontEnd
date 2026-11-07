/** Shared helpers for the perf scripts: preview server, browser, mocked backend, payloads, in-page probes. */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = Number(process.env.PERF_PORT ?? 4399);
export const ORIGIN = `http://127.0.0.1:${PORT}`;
export const API = 'http://127.0.0.1:8000'; // baked into the perf build; every call is intercepted

export const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const pctile = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : NaN; };
export const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

// ── preview server ──────────────────────────────────────────────────────────
export async function startPreview(dist = process.env.PERF_DIST ?? 'dist-perf') {
  const proc = spawn(join(ROOT, 'node_modules/.bin/vite'),
    ['preview', '--outDir', dist, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1', '--config', 'perf/vite.perf.config.ts'],
    { cwd: ROOT, env: { ...process.env, BROWSER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => (log += d));
  proc.stderr.on('data', (d) => (log += d));
  const t0 = Date.now();
  for (;;) {
    try { if ((await fetch(ORIGIN)).ok) break; } catch { /* not up yet */ }
    if (proc.exitCode !== null) throw new Error(`vite preview exited: ${log}`);
    if (Date.now() - t0 > 30_000) { proc.kill(); throw new Error(`vite preview did not start: ${log}`); }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { stop: () => proc.kill('SIGTERM') };
}

export const launch = () => chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc', '--disable-dev-shm-usage'] });

// ── payloads (what the backend returns for /api/parse) ──────────────────────
const baseParsed = (extra = {}) => ({
  method: 'POST', url: 'https://api.example.com/users', base_url: 'https://api.example.com', endpoint: '/users',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.token' },
  data: { name: 'John Doe', email: 'john@example.com', address: { city: 'New York', zip: '10001' } },
  query_params: { page: '1', limit: '10' }, ...extra,
});

/** 40 groups x 49 leaves + 40 containers = 2000 nodes. */
export function body2000() {
  const o = {};
  for (let g = 0; g < 40; g++) {
    const grp = {};
    for (let i = 0; i < 49; i++) grp[`field_${i}`] = i % 3 === 0 ? `value ${g}-${i}` : i % 3 === 1 ? g * 100 + i : i % 2 === 0;
    o[`group_${g}`] = grp;
  }
  return o;
}
/** JSON text of about `bytes` bytes: an array of small records, like a bulk-import payload. */
export function jsonText(bytes) {
  const parts = []; let n = 2;
  for (let i = 0; n < bytes; i++) {
    const s = JSON.stringify({ id: i, name: `item-${i}`, active: i % 2 === 0, score: i * 1.5, tags: ['alpha', 'beta'], owner: { first: 'A', last: `B${i}` } });
    parts.push(s); n += s.length + 1;
  }
  return `{"items":[${parts.join(',')}]}`;
}

export const SCENARIOS = {
  baseline: { curl: 'curl -X POST https://api.example.com/users -H "Content-Type: application/json" # perf-scenario:baseline', parsed: () => baseParsed() },
  headers500: {
    curl: 'curl https://api.example.com/users # perf-scenario:headers500',
    parsed: () => baseParsed({ headers: { 'Content-Type': 'application/json', ...Object.fromEntries(Array.from({ length: 499 }, (_, i) => [`X-Perf-Header-${String(i).padStart(3, '0')}`, `value-${i}-${'x'.repeat(40)}`])) } }),
  },
  body2000: { curl: 'curl https://api.example.com/users # perf-scenario:body2000', parsed: () => baseParsed({ data: body2000() }) },
  // The backend returns `-d '{...}'` as a JSON *string*; the editor parses it.
  body5mb: { curl: 'curl https://api.example.com/users # perf-scenario:body5mb', parsed: () => baseParsed({ data: jsonText(5 * 1024 * 1024) }) },
};
export const BATCH_SIZE = 25;
export const batchCurl = (i) => `curl -X POST "https://api.example.com/items/${i}" -H "Content-Type: application/json" -H "X-Item: ${i}" -d '{"id":${i},"name":"item ${i}"}'`;
const batchParsed = (i) => baseParsed({ url: `https://api.example.com/items/${i}`, endpoint: `/items/${i}`, headers: { 'Content-Type': 'application/json', 'X-Item': String(i) }, data: { id: i, name: `item ${i}` } });

// ── mocked backend ───────────────────────────────────────────────────────────
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const bodyCache = new Map();
export async function mockBackend(page) {
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const json = (status, obj) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: typeof obj === 'string' ? obj : JSON.stringify(obj) });
    if (/\/(api\/)?health$/.test(url.pathname)) return json(200, { status: 'healthy' });
    if (url.pathname === '/api/parse') {
      const { curl = '' } = JSON.parse(req.postData() ?? '{}');
      const sc = /perf-scenario:(\w+)/.exec(curl)?.[1];
      if (sc && SCENARIOS[sc]) {
        if (!bodyCache.has(sc)) bodyCache.set(sc, JSON.stringify({ success: true, data: SCENARIOS[sc].parsed() }));
        return json(200, bodyCache.get(sc));
      }
      const idx = Number(/items\/(\d+)/.exec(curl)?.[1] ?? 0);
      return json(200, { success: true, data: batchParsed(idx) });
    }
    if (url.pathname === '/api/generate-from-parsed') {
      return json(200, { success: true, generated_code: 'public class PerfTest {}', warnings: [] });
    }
    return json(404, { success: false, error: { message: 'not mocked' } });
  });
}

// ── in-page probes ──────────────────────────────────────────────────────────
export const INIT_SCRIPT = `(() => {
  const p = (window.__perf = { lcp: 0, cls: 0, fcp: null, longtasks: [], keyLat: [], eventDur: [] });
  const obs = (type, cb, extra = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra }); } catch (e) {} };
  obs('largest-contentful-paint', (e) => { p.lcp = e.startTime; });
  obs('layout-shift', (e) => { if (!e.hadRecentInput) p.cls += e.value; });
  obs('longtask', (e) => p.longtasks.push([e.startTime, e.duration]));
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') p.fcp = e.startTime; });
  obs('event', (e) => { if (/^key|^input|^beforeinput/.test(e.name)) p.eventDur.push(e.duration); }, { durationThreshold: 16 });
  // next frame has been produced: rAF runs before paint, the message after it
  window.__paint = () => new Promise((res) => requestAnimationFrame(() => { const mc = new MessageChannel(); mc.port1.onmessage = () => res(); mc.port2.postMessage(0); }));
  window.__until = (pred, timeout = 150000) => new Promise((res, rej) => {
    const t0 = performance.now();
    const tick = () => { let ok = false; try { ok = pred(); } catch (e) {} if (ok) res(); else if (performance.now() - t0 > timeout) rej(new Error('__until timeout')); else setTimeout(tick, 1); };
    tick();
  });
  // key -> frame latency
  addEventListener('keydown', () => { const t0 = performance.now(); requestAnimationFrame(() => { const mc = new MessageChannel(); mc.port1.onmessage = () => p.keyLat.push(performance.now() - t0); mc.port2.postMessage(0); }); }, true);
})();`;

export async function newPage(browser, { cpuThrottle = 1, viewport = { width: 1366, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
  const cdp = await context.newCDPSession(page);
  if (cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  await mockBackend(page);
  return { page, cdp, context };
}

/** Forced-GC heap in MB plus DOM node count and cumulative script/layout/style time (CDP Performance domain). */
export async function heap(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize, totalSize } = await cdp.send('Runtime.getHeapUsage');
  await cdp.send('Performance.enable');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { usedMB: round(usedSize / 1048576), totalMB: round(totalSize / 1048576), domNodes: m.Nodes, scriptS: round(m.ScriptDuration, 2), layoutS: round(m.LayoutDuration, 2), styleS: round(m.RecalcStyleDuration, 2) };
}

/** Lighthouse-style TTI: first window of `quietMs` after FCP without a long task; TTI is the end of the last long task before it. */
export function ttiFrom(longtasks, fcp, from, observeEnd, quietMs = 2000) {
  const start = Math.max(fcp ?? 0, from ?? 0);
  const tasks = longtasks.filter(([s, d]) => s + d > start).sort((a, b) => a[0] - b[0]);
  let tti = start;
  for (const [s, d] of tasks) { if (s - tti >= quietMs) break; tti = Math.max(tti, s + d); }
  return observeEnd - tti >= quietMs ? tti : null; // null: never settled inside the observation window
}
export const tbtFrom = (longtasks, fcp, until = Infinity) =>
  longtasks.filter(([s]) => s >= (fcp ?? 0) && s <= until).reduce((t, [, d]) => t + Math.max(0, d - 50), 0);
