# Frontend performance report

Branch `test/fe-perf` (base release/3.0 @16fb4f4). Chromium 1243 headless via Playwright 1.63, `vite preview` of a production-mode
build (`npm run perf:build`: `--mode perf`, minified, same chunking; the env guard only blocks loopback URLs in production/preprod modes),
backend mocked at the network layer (`page.route`, so every number is frontend-only). No CPU throttling, 1366x900.

Commands: `npm run perf:build`, `npm run perf:bundle` (size budgets, fast, deterministic), `npm run perf:web` (numbers),
`npm run perf:profile` (CPU profiles mapped to src/ through sourcemaps), **`npm run perf:check`** (build + bundle + browser runs,
exit 1 on any breach; `--bundle-only` for CI, `--rebaseline` after an intended change). Budgets: `perf/budgets.json` (baseline x
headroom, with floors); recorded baseline: `perf/baseline.json`; raw runs: `perf/results/` (untracked).

**Noise warning.** The machine is shared. The baseline below was taken on an idle box (load average ~0). An earlier run with load
average 8-12 was 2-4x slower (baseline editor parse-to-editor 404 ms vs 187 ms; headers500 typing p95 902 ms vs 107 ms; body2000 typing p50
1846 ms vs 541 ms). Budgets carry 1.6-2x headroom for that reason; a failing `perf:check` on a busy machine should be re-run before it is believed.
Medians of 5 (web) or 3 (stress) fresh-context runs.

## 1. Bundle (gzip, KiB; `perf/bundle-size.mjs`)

| chunk | raw | gzip | brotli |
|---|---|---|---|
| index.js (initial) | 347.7 | 110.9 | 96.0 |
| ParsedCurlEditor.js (lazy, /editor, /batch-editor) | 253.1 | 76.9 | 66.6 |
| index.css (initial) | 98.9 | 36.0 | 33.8 |
| js-yaml.js (lazy) | 43.2 | 14.5 | 13.0 |
| Playground.js | 39.7 | 13.6 | 12.3 |
| dialog.js | 30.9 | 10.9 | 9.8 |
| notify.js | 23.1 | 8.4 | 7.5 |
| BatchEditorPage.js | 20.6 | 7.2 | 6.5 |
| others (3 chunks) | 7.7 | 3.4 | |

Totals: JS 245.8 KiB gzip over 10 chunks; initial load 110.9 KiB JS + 36.0 KiB CSS. Budgets: total JS 266, initial JS 120, CSS 40, per chunk 8% over its current size, any new chunk over 10 KiB fails.
Largest modules by rendered size (`perf/results/modules.json`): in `index`: @remix-run/router 164 KB, react-dom 134 KB, tailwind-merge 72 KB,
sonner 68 KB, `src/lib/utils/redaction.ts` 22 KB; in `ParsedCurlEditor`: **prism-react-renderer 135 KB** (all grammars; 26% of the chunk),
@radix-ui/select 49 KB, `ParsedCurlEditor.tsx` 34 KB, `CodeGenerationDialog.tsx` 22 KB. js-yaml (104 KB) is already lazy.

## 2. Web vitals (`perf/measure.mjs web`)

| page | FCP | LCP | CLS | TBT | TTI (2 s quiet window) | long tasks |
|---|---|---|---|---|---|---|
| Home `/` | 232 ms | 232 ms | 0.0008 | 0 ms | 232 ms | 1 (63 ms) |
| Playground | 140 ms | 216 ms | 0.034 | 0 ms | 201 ms | 0 |
| Editor (playground -> parse -> editor flow) | 124 ms | 252 ms | **0.178** | 0 ms | 678 ms | 0 |

Editor = whole flow in one document (an SPA navigation has no LCP of its own); TTI is measured from the moment the editor is painted. The
editor flow's CLS of 0.178 is over the 0.1 "good" threshold: layout moves when the editor mounts (not yet attributed to an element; start with the page-enter animation wrapper in `App.tsx` and the accordion sections opening in a mount effect, `ParsedCurlEditor.tsx`).

## 3. Editor stress (`perf/measure.mjs stress`)

Parse-to-editor = click on Parse until the editor is painted (the mocked response arrives within ~10 ms, so it is essentially render time, including loading the lazy chunk).
Typing = keydown to next frame over 30 keystrokes in a header value (includes a ~16 ms frame floor). Save = commit an edit (click to painted).
Undo/redo = median of 4 button clicks after 5 edits. Review = click "Changes" until the Review Changes dialog is painted. Heap = forced-GC JS heap after all steps.

| scenario | parse->editor | typing p50 / p95 | save edit | undo / redo | Review Changes | heap | DOM nodes | long tasks (max) |
|---|---|---|---|---|---|---|---|---|
| baseline (small) | 187 ms | 9 / 19 ms | 21 ms | 11 / 15 ms | 48 ms | 6.9 MB | 718 | 0 |
| 500 headers | 553 ms | **76 / 107 ms** | 80 ms | 25 / 29 ms | 99 ms | 18.9 MB | 11,168 | 19 (303 ms) |
| 2000-node JSON body | **1449 ms** | **541 / 645 ms** (max 1019) | 177 ms | 114 / 94 ms | **2082 ms** | 30.5 MB | 36,745 | 104 (1019 ms) |
| 5 MB JSON body (~35k records) | **tab crashes** (`Target crashed`) while rendering | | | | | | | |
| batch of 25 requests (Parse All) | 252 ms | 9 / 19 ms | 27 ms | 17 / 15 ms | 51 ms | 12.2 MB | 1,919 | 0 |

Batch also: switching between requests 38 ms median (56 ms max). Batch editors stay mounted (hidden) once visited, so cost grows with visited requests.
Heap before parse was 3.5 MB in all cases. Heap after the body-2000 render 16 MB, +14 MB after 5 history entries (every undo step stores a `structuredClone` of the whole request, up to 50).

## 4. Top bottlenecks (CPU profiles, `perf/results/profile.json`)

The profiles are dominated by `(program)` (browser style/layout/paint, 50-88%) rather than app JS, which means the cost is the amount of DOM, not a slow function:

1. **Everything re-renders on every keystroke.** `ParsedCurlEditor.tsx` builds `editorCtx` (line ~281) with `editing`/`editedValues`/`selected`/`bodyCollapsed` inside it, so each
   `handleEditChange` produces a new context value and every `EditableField` / `BodyFieldNode` consumer (`editor/EditableField.tsx`, `editor/BodyFieldNode.tsx`) re-renders despite `memo`.
   Profile phase [typing]: 18.9 s busy for 30 keystrokes with a 2000-node body (86% `(program)`), 3.1 s with 500 headers. Fix: keep per-row state local (editing/edited value in the row, committed on Save) or split
   the context (stable callbacks vs changing state) / use a selector store.
2. **No windowing and bodies start fully expanded** (`bodyCollapsed` defaults to false in `lib/hooks/useEditorState.ts`): a 2000-node body is 36.7k DOM nodes and 1.4 s to show;
   `getBoundingClientRect` is 21-26% of the [parse] phase (forced layout, likely the Radix accordion content measurement for each section). The 5 MB body would be ~280k nodes and crashes the renderer. Collapse
   large bodies by default, render children lazily on expand, and show a size warning (the real backend rejects cURLs over 50,000 characters anyway, so this input only arises from pasted/imported JSON).
3. **Opening Review Changes scales with page DOM, not with the diff**: 2.1 s with the 2000-node body (9.4 s busy under profiling), 86% `(program)`, plus `removeChild` 540-710 ms and `focus` 510-610 ms.
   Radix Dialog (`components/ui/dialog.tsx`, `dialog.js` chunk: react-remove-scroll, aria-hidden, focus-scope) hides/inerts the whole page behind it. Fix: unmount or `content-visibility: hidden` the
   editor body while a modal is open, or virtualize it (also fixes 2).
4. **History = full deep copies**: `useEditorState.ts setParsed` does `structuredClone` of the whole request for each history entry (max 50), plus `structuredClone` in `toggleEdit`
   (`useParsedCurlEditor.ts`) and a `deepEqual(parsed, originalParsed)` for `isDirty` on every change; undo is 94-114 ms with the 2000-node body. For multi-MB bodies this multiplies memory by up to 52x;
   use structural sharing (immutable path updates) or patches.
5. **Undo re-redacts the world**: [undo] phase shows `redaction.ts:255 redactJsonValue`, `:640 redactSectionByName`, `:106 nameWords`, `:164 scrubJwts` as the top app functions (3-4% each; ParsedCurlEditor also calls `countRedactions(parsed)`
   on every render, `ParsedCurlEditor.tsx:141`). Memoize on `parsed` identity.
6. Bundle: prism-react-renderer 135 KB raw in the editor chunk (import only the languages used, or lazy-load it with the code dialog); sonner 68 KB in the initial bundle.

Harness caveat: profile phases include Playwright's own selector evaluation (`getTextAlternativeInternal`, `queryRole`), visible in small amounts in the batch25 profile.

## 5. Findings summary

| id | severity | finding |
|---|---|---|
| FE-PERF-1 | high | 5 MB JSON body crashes the tab on render (repro: `node perf/measure.mjs stress body5mb`) |
| FE-PERF-2 | high | typing in any field with a 2000-node body: 541 ms median per keystroke (unusable); 500 headers: 76 ms |
| FE-PERF-3 | medium | Review Changes takes 2.1 s with a 2000-node body |
| FE-PERF-4 | low | editor flow CLS 0.178 |
| FE-PERF-5 | low | undo history keeps up to 50 deep copies |

## 6. Scripts

`perf/bundle-size.mjs` (size per chunk, budget check), `perf/measure.mjs` (+ `scenarios.mjs`, `lib.mjs`: web vitals, stress, mocked backend, in-page probes), `perf/profile.mjs`, `perf/check.mjs`, `perf/vite.perf.config.ts`
(outDir `dist-perf`, per-module size plugin, `PERF_PROFILE=1` for sourcemapped unminified build). `body5mb` is measured and reported but has no budget (it crashes); add one after the fix.
