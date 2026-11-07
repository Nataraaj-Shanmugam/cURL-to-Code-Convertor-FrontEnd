/** Scenario drivers shared by measure.mjs (numbers) and profile.mjs (CPU profiles, via the `phase` hook). */
import { ORIGIN, SCENARIOS, BATCH_SIZE, batchCurl, newPage, heap, median, pctile, round, ttiFrom, tbtFrom } from './lib.mjs';

// ── web vitals ───────────────────────────────────────────────────────────────
async function collect(page, readyAt, observeEnd, cfg) {
  const p = await page.evaluate(() => window.__perf);
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
  return {
    fcpMs: round(p.fcp), lcpMs: round(p.lcp), cls: round(p.cls, 4), tbtMs: round(tbtFrom(p.longtasks, p.fcp)),
    longTasks: p.longtasks.length, longestTaskMs: round(Math.max(0, ...p.longtasks.map((t) => t[1]))),
    ttiMs: round(ttiFrom(p.longtasks, p.fcp, readyAt, observeEnd, cfg.quietMs)), loadMs: round(nav.load),
  };
}

export async function webRun(browser, which, cfg) {
  const { page, context } = await newPage(browser, { cpuThrottle: cfg.cpuThrottle });
  try {
    if (which === 'home' || which === 'playground') {
      await page.goto(`${ORIGIN}${which === 'home' ? '/' : '/playground'}`, { waitUntil: 'load' });
      if (which === 'playground') await page.locator('textarea').first().waitFor();
      else await page.getByRole('heading').first().waitFor();
      const readyAt = await page.evaluate(() => performance.now());
      await page.waitForTimeout(cfg.observeMs);
      return await collect(page, readyAt, await page.evaluate(() => performance.now()), cfg);
    }
    // editor: load the playground, parse a request, land in the editor; metrics cover the whole flow
    await page.goto(`${ORIGIN}/playground`, { waitUntil: 'load' });
    await page.locator('textarea').first().fill(SCENARIOS.baseline.curl);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await page.waitForURL(/\/editor/);
    await page.locator('button[title^="Generate Code"]').waitFor();
    await page.evaluate(() => window.__paint());
    const readyAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(cfg.observeMs);
    return await collect(page, readyAt, await page.evaluate(() => performance.now()), cfg);
  } finally { await context.close(); }
}

// ── editor stress ────────────────────────────────────────────────────────────
const timed = (page, fnSrc, arg) => page.evaluate(`(async (arg) => { const t0 = performance.now(); await (${fnSrc})(arg); await window.__paint(); return performance.now() - t0; })(${JSON.stringify(arg ?? null)})`);

/** Everything after the editor is on screen: typing, committing edits, undo/redo, Review Changes, heap. */
async function editorInteractions(page, cdp, m, ph) {
  const step = async (name, fn) => { try { await phase(name, fn); } catch (e) { (m.errors ??= {})[name] = String(e.message).split('\n')[0]; } };
  const EDIT = 'Content-Type';

  await step('typing', async () => {
    await page.evaluate(() => { window.__perf.keyLat.length = 0; window.__perf.eventDur.length = 0; });
    await page.getByRole('button', { name: `Edit ${EDIT}`, exact: true }).first().click();
    const input = page.getByRole('textbox', { name: `Value of ${EDIT}`, exact: true });
    await input.focus();
    await page.keyboard.press('End');
    await page.evaluate(() => window.__perf.keyLat.length = 0);
    for (let i = 0; i < 30; i++) { await page.keyboard.press('x'); await page.waitForTimeout(40); }
    await page.waitForTimeout(200);
    const p = await page.evaluate(() => ({ lat: window.__perf.keyLat.slice(), ev: window.__perf.eventDur.slice() }));
    m.typingP50Ms = round(median(p.lat)); m.typingP95Ms = round(pctile(p.lat, 95)); m.typingMaxMs = round(Math.max(...p.lat));
    m.slowKeyEvents = p.ev.length; m.worstKeyEventMs = round(Math.max(0, ...p.ev));
  });

  // five commits (each is an undoable history entry), timed click -> painted
  await step('save', async () => {
    const saves = [];
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        await page.getByRole('button', { name: `Edit ${EDIT}`, exact: true }).first().click();
        await page.getByRole('textbox', { name: `Value of ${EDIT}`, exact: true }).fill(`application/json; v=${i}`);
      }
      saves.push(await timed(page, `(async () => { [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Save ${EDIT}').click(); await window.__until(() => !document.querySelector('input[aria-label="Value of ${EDIT}"]')); })`));
    }
    m.saveEditMs = round(median(saves)); m.saveEditMaxMs = round(Math.max(...saves));
  });
  m.heapAfterEdits = await heap(cdp);

  await step('undo', async () => {
    const sel = (label) => `(async () => { const b = document.querySelector('button[aria-label="${label}"]'); if (!b || b.disabled) throw new Error('${label} disabled'); b.click(); })`;
    const undo = []; const redo = [];
    for (let i = 0; i < 4; i++) undo.push(await timed(page, sel('Undo')));
    for (let i = 0; i < 4; i++) redo.push(await timed(page, sel('Redo')));
    m.undoMs = round(median(undo)); m.undoMaxMs = round(Math.max(...undo));
    m.redoMs = round(median(redo)); m.redoMaxMs = round(Math.max(...redo));
  });

  await step('review', async () => {
    const times = [];
    for (let i = 0; i < 3; i++) {
      times.push(await timed(page, `(async () => { const b = document.querySelector('button[title="Review changes"]'); if (!b || b.disabled) throw new Error('Changes button disabled'); b.click(); await window.__until(() => [...document.querySelectorAll('[role=dialog]')].some(d => d.textContent.includes('Review Changes'))); })`));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    }
    m.reviewOpenMs = round(median(times)); m.reviewOpenMaxMs = round(Math.max(...times));
  });
  m.heapFinal = await heap(cdp);
  m.heapMB = m.heapFinal.usedMB;
}

export async function stressSingle(browser, name, cfg, phase) {
  const sc = SCENARIOS[name];
  const { page, cdp, context } = await newPage(browser, { cpuThrottle: cfg.cpuThrottle });
  const m = {};
  const userPhase = phase ?? ((_n, f) => f());
  const ph = (n, f) => userPhase(n, f, { cdp, page });
  try {
    await page.goto(`${ORIGIN}/playground`, { waitUntil: 'load' });
    await page.locator('textarea').first().fill(sc.curl);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Parse cURL/i.test(b.textContent) && !b.disabled));
    m.heapBefore = await heap(cdp);
    const r = await ph('parse', () => page.evaluate(async () => {
      const t0 = performance.now();
      [...document.querySelectorAll('button')].find((b) => /Parse cURL/i.test(b.textContent)).click();
      await window.__until(() => location.pathname === '/editor' && document.querySelector('button[title^="Generate Code"]'));
      const tReady = performance.now();
      await window.__paint();
      const res = performance.getEntriesByType('resource').filter((e) => e.name.endsWith('/api/parse')).pop();
      return { total: performance.now() - t0, tReady: tReady - t0, respEndAbs: res?.responseEnd, t0 };
    }));
    m.parseToEditorMs = round(r.total);
    // render-only part: from the parse response arriving to the editor being painted
    m.responseToEditorMs = r.respEndAbs ? round(r.total - (r.respEndAbs - r.t0)) : null;
    await page.waitForTimeout(500);
    m.heapAfterRender = await heap(cdp);
    await editorInteractions(page, cdp, m, ph);
    const lt = await page.evaluate(() => window.__perf.longtasks);
    m.longTasks = lt.length; m.longestTaskMs = round(Math.max(0, ...lt.map((t) => t[1])));
  } catch (e) { m.fatal = String(e.message).split('\n')[0]; }
  finally { await context.close(); }
  return m;
}

export async function stressBatch(browser, cfg, phase) {
  const { page, cdp, context } = await newPage(browser, { cpuThrottle: cfg.cpuThrottle });
  const m = {};
  const userPhase = phase ?? ((_n, f) => f());
  const ph = (n, f) => userPhase(n, f, { cdp, page });
  try {
    await page.goto(`${ORIGIN}/playground`, { waitUntil: 'load' });
    for (let i = 1; i < BATCH_SIZE; i++) await page.getByText('Add another cURL').click();
    const boxes = page.locator('textarea');
    await boxes.nth(BATCH_SIZE - 1).waitFor();
    for (let i = 0; i < BATCH_SIZE; i++) await boxes.nth(i).fill(batchCurl(i));
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Parse All \(25\)/.test(b.textContent) && !b.disabled));
    m.heapBefore = await heap(cdp);
    m.parseToEditorMs = round(await ph('parse', () => page.evaluate(async () => {
      const t0 = performance.now();
      [...document.querySelectorAll('button')].find((b) => /Parse All/.test(b.textContent)).click();
      await window.__until(() => location.pathname === '/batch-editor' && document.querySelectorAll('ul[aria-label="Requests"] li').length === 25 && document.querySelector('button[title^="Generate Code"]'));
      await window.__paint();
      return performance.now() - t0;
    })));
    await page.waitForTimeout(500);
    m.heapAfterRender = await heap(cdp);
    try {
      const sw = [];
      for (let i = 1; i < 11; i++) {
        sw.push(await timed(page, `(async (i) => { document.querySelectorAll('ul[aria-label="Requests"] li')[i].querySelector('button').click(); await window.__until(() => document.body.textContent.includes('/items/' + i)); })`, i));
      }
      m.switchRequestMs = round(median(sw)); m.switchRequestMaxMs = round(Math.max(...sw));
    } catch (e) { (m.errors ??= {}).switch = String(e.message).split('\n')[0]; }
    await editorInteractions(page, cdp, m, ph);
    const lt = await page.evaluate(() => window.__perf.longtasks);
    m.longTasks = lt.length; m.longestTaskMs = round(Math.max(0, ...lt.map((t) => t[1])));
  } catch (e) { m.fatal = String(e.message).split('\n')[0]; }
  finally { await context.close(); }
  return m;
}

