# CurlCraft Assured — New Feature Implementation Plan

> Detailed plan for 4 new features. Recommended implementation order: Preview → Diff → Import → Batch.

---

## Feature 1: Import from Postman / OpenAPI

**Complexity:** L (Large) · **Backend:** None (frontend-only)

### User Flow

User clicks **Import** in the Playground → dialog opens → paste JSON/YAML or upload a file → app auto-detects format (Postman Collection v2.1 or OpenAPI 3.x / Swagger 2.0) → shows a selectable list of extracted requests → user picks one or more → selected requests are converted to cURL strings → single request populates the Playground textarea; multiple requests route to batch mode (Feature 2).

### New Files

| File | Purpose |
|------|---------|
| `src/components/features/import/ImportDialog.tsx` | Modal: paste area, file upload, format badge, request list picker, "Import Selected" button |
| `src/lib/parsers/postmanParser.ts` | Converts Postman Collection v2.1 items → cURL strings (handles method, url, headers, body modes, auth) |
| `src/lib/parsers/openApiParser.ts` | Converts OpenAPI 3.x / Swagger 2.0 paths+operations → cURL strings (path params, example body from schema, security, server base URLs) |
| `src/lib/parsers/importUtils.ts` | Format auto-detection (`info._postman_id` vs `openapi`/`swagger`), YAML→JSON wrapper, shared cURL string builder |
| `src/types/import.ts` | `PostmanCollection`, `PostmanItem`, `PostmanRequest`, `OpenApiSpec`, `ImportedRequest`, `ImportFormat` |

### Existing Files Modified

| File | Change |
|------|--------|
| `src/components/features/curl/CurlPlayground.tsx` | Add "Import" button, wire `ImportDialog`, populate textarea on completion |
| `src/constants/curl.ts` | Import-related constants (supported formats, max file size 5 MB) |

### New Dependencies

- `js-yaml` — parse YAML OpenAPI specs (~30 KB gzip). Lazy-loaded via dynamic `import()`.

### Subtasks

- [x] Define TypeScript interfaces for Postman v2.1 and OpenAPI 3.x in `src/types/import.ts`
- [x] Implement `postmanParser.ts` — recursive folder traversal, cURL string builder with proper escaping
- [x] Implement `openApiParser.ts` — path/operation extraction, single-level `$ref` resolution, example body generation from JSON Schema
- [x] Implement `importUtils.ts` — format detection, YAML parsing, shared helpers
- [x] Build `ImportDialog.tsx` — file drop zone, paste area, format badge, request list with checkboxes
- [x] Integrate into `CurlPlayground.tsx` — Import button, dialog callbacks
- [x] Unit tests for parsers + component test for ImportDialog

### Risks & Edge Cases

- OpenAPI `$ref` resolution: limit to single-file specs initially; warn on unresolvable external refs
- Postman variables (`{{base_url}}`): render as literal strings with a warning badge
- OpenAPI `allOf`/`oneOf` schema composition: start with simple schemas, show raw schema on complex ones
- Cap file upload at **5 MB** to prevent browser freeze
- Lazy-load `js-yaml` to keep main bundle small

---

## Feature 2: Batch cURL Processing

**Complexity:** L (Large) · **Backend:** Optional (frontend-first approach)

### User Flow

**Entry A:** In Playground, toggle "Batch Mode" → textarea accepts multiple cURL commands separated by blank lines or `---` → "Parse All" sends each through `/api/parse` → navigate to `/batch-editor`.

**Entry B:** From Import dialog (Feature 1) when multiple requests are selected.

**Batch Editor:** Left sidebar lists parsed requests (method badge + endpoint). Clicking one loads it in the right-panel editor (`ParsedCurlEditor`). "Generate All" produces a single Java test class with multiple `@Test` methods, shared imports, and optional `@BeforeClass` setup.

### New Files

| File | Purpose |
|------|---------|
| `src/pages/BatchEditorPage.tsx` | Route page: sidebar list + editor panel + "Generate All" toolbar |
| `src/components/features/curl/BatchCurlInput.tsx` | Multi-cURL textarea with command count, per-command validation |
| `src/components/features/curl/BatchCodeGenerationDialog.tsx` | Extended `CodeGenerationDialog` for array of `ParsedCurl`, stitches methods into one class |
| `src/lib/hooks/useBatchEditor.ts` | Manages `{parsed, originalCurl, config}[]`, selected index, add/remove/reorder |
| `src/lib/parsers/curlSplitter.ts` | Splits multi-cURL text into individual commands (handles `\` line continuations, quoted strings) |
| `src/types/batch.ts` | `BatchItem`, `BatchEditorState`, `BatchGenerationRequest/Response` |

### Existing Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Add route `<Route path="/batch-editor" element={<BatchEditorPage />} />` |
| `src/components/features/curl/CurlPlayground.tsx` | "Batch Mode" toggle, "Parse All" button, navigation to `/batch-editor` |
| `src/lib/env.ts` | Add `BATCH_GENERATE_ENDPOINT` (for future backend support) |
| `src/types/curl.ts` | Add `BatchCodeGenerationResponse` |

### Backend Strategy

| Approach | Description |
|----------|-------------|
| **Option A (start here)** | No new endpoint. Frontend calls `/api/parse` per command, `/api/generate-from-parsed` per item, stitches methods client-side. |
| **Option B (later)** | New `POST /api/batch-generate` accepting `{items: [{parsed_data, config}], class_config}`, returns cohesive class with shared setup. |

### Subtasks

- [x] Implement `curlSplitter.ts` — handle `\` continuations, blank-line/`---` delimiters, quoted strings
- [x] Define batch types in `src/types/batch.ts`
- [x] Build `BatchCurlInput.tsx` — textarea with command count, validation per command
- [x] Build `useBatchEditor.ts` — array state, selection, per-item update callbacks
- [x] Build `BatchEditorPage.tsx` — sidebar/editor layout, "Generate All" button
- [x] Build `BatchCodeGenerationDialog.tsx` — parallel generation, method name deduplication, stitching
- [x] Update `CurlPlayground.tsx` — batch mode toggle and routing
- [x] Update `App.tsx` — register `/batch-editor` route
- [x] Tests: `curlSplitter` unit tests, `BatchEditorPage` component test

### Risks & Edge Cases

- **cURL splitting** is tricky — multi-line commands, escaped quotes, `--data` with newlines
- **Method name deduplication** — auto-suffix (`testGetUsers`, `testGetUsers_2`) or derive from endpoint path
- **Performance** — 20+ sequential parse calls can feel slow; use `Promise.allSettled` with progress bar
- **Memory** — 20 items × undo history per item adds up; consider shared history or no undo in batch mode
- **Editor remount** — switching items remounts `ParsedCurlEditor`; use `key={selectedIndex}` for clean state

---

## Feature 3: Diff View for Edits

**Complexity:** M (Medium) · **Backend:** None (frontend-only)

### User Flow

When the user has made edits (`canUndo === true`), a **"Review Changes"** button appears in the editor toolbar. Clicking it opens a dialog with a structured diff: added fields (green), removed fields (red), modified values (amber with old → new). Each change row has a "Revert" button to restore the original value for that field. A summary header shows counts ("3 additions, 2 modifications, 1 deletion"). Optional "Raw JSON" tab shows side-by-side JSON text diff.

### New Files

| File | Purpose |
|------|---------|
| `src/components/features/curl/DiffViewDialog.tsx` | Dialog with structured diff table + optional raw JSON diff tab, per-row revert buttons |
| `src/lib/utils/diffEngine.ts` | `computeDiff(original, current): DiffEntry[]` — recursive object comparison, path tracking |
| `src/types/diff.ts` | `DiffEntry`, `DiffType` (`added` / `removed` / `modified`) |

### Existing Files Modified

| File | Change |
|------|--------|
| `src/components/features/curl/ParsedCurlEditor.tsx` | Add "Review Changes" button (disabled when `!canUndo`), wire `DiffViewDialog`, implement `handleRevertSingle(path)` |
| `src/lib/hooks/useParsedCurlEditor.ts` | Expose `originalParsed` in return value (currently internal only) |

### New Dependencies

- None for structured diff. Optionally `diff` npm package (~8 KB) for raw JSON text diff — but can start without it.

### Subtasks

- [x] Define diff types in `src/types/diff.ts`
- [x] Implement `diffEngine.ts` — recursive comparison, handle nested objects, arrays (index-based), primitives
- [x] Build `DiffViewDialog.tsx`:
  - Summary header: "X additions, Y modifications, Z deletions"
  - Table: Path | Original Value | Current Value | Revert button
  - Color coding: green (added), red (removed), amber (modified)
  - Per-row "Revert" button
  - Optional: "Raw JSON" tab with side-by-side view
- [x] Expose `originalParsed` from `useParsedCurlEditor.ts`
- [x] Add "Review Changes" button to `ParsedCurlEditor.tsx` toolbar
- [x] Implement `handleRevertSingle(path)` — restore original value at path using structuredClone + path walk
- [x] Tests: `diffEngine` unit tests (nested, arrays, additions, deletions, no-change), `DiffViewDialog` component test

### Risks & Edge Cases

- **Body normalization**: `originalParsed` stores body as raw string, `parsed` has it parsed into an object via `parseBodyData()`. Must normalize both sides before comparing to avoid false-positive "changes"
- **Array diffs** are ambiguous (reorder vs add+delete); use index-based comparison since the editor does not support reordering
- **Deep paths** like `data.user.address.street` — render as indented or breadcrumb-style
- **Large diffs** (50+ changes) — use scrollable container with `max-height`, consider lazy rendering
- **Revert** reuses the same `structuredClone` + path-walk pattern from `toggleEdit`

---

## Feature 4: Request Preview / Dry-Run

**Complexity:** S-M (Small–Medium) · **Backend:** None (frontend-only)

### User Flow

User clicks **"Preview"** in the editor toolbar → dialog opens showing a read-only, styled HTTP request visualization:

1. **Method badge** (colored) + **Full URL** (base_url + endpoint + query params highlighted)
2. **Headers table** (name–value, auth headers get a lock icon)
3. **Cookies** (rendered as `key=value; ...`)
4. **Request body** (syntax-highlighted JSON or form-data table)
5. **Reconstructed cURL** (terminal-style block with copy button)

No actual HTTP request is made — purely a visualization of the current `parsed` state.

### New Files

| File | Purpose |
|------|---------|
| `src/components/features/curl/RequestPreviewDialog.tsx` | Full-width dialog: URL bar, headers table, body viewer, cURL block |
| `src/lib/utils/curlReconstructor.ts` | `reconstructCurl(parsed: ParsedCurl): string` — builds valid cURL from parsed data with proper escaping |
| `src/lib/utils/urlBuilder.ts` | `buildFullUrl(parsed: ParsedCurl): string` — combines base_url, endpoint, path params, query params |

### Existing Files Modified

| File | Change |
|------|--------|
| `src/components/features/curl/ParsedCurlEditor.tsx` | Add "Preview" button in toolbar, wire `RequestPreviewDialog` |

### New Dependencies

None. Reuses existing `prism-react-renderer` for cURL syntax highlighting.

### Subtasks

- [x] Implement `urlBuilder.ts` — combine URL parts, substitute path parameters, append query params with proper encoding
- [x] Implement `curlReconstructor.ts` — build cURL string with proper flag ordering, shell quoting, body serialization
- [x] Build `RequestPreviewDialog.tsx`:
  - URL bar: method badge (reuse `METHOD_COLORS`) + full URL with query params highlighted
  - Headers section: two-column table, auth headers get lock icon
  - Cookies section: key=value pairs
  - Body section: syntax-highlighted JSON (reuse `CodeBlock` from `CodeGenerationDialog`) or form-data table
  - cURL section: terminal-style block with copy button
  - Each section collapsible (Accordion)
- [x] Add "Preview" button to `ParsedCurlEditor.tsx` toolbar
- [x] Tests: `urlBuilder` unit tests, `curlReconstructor` unit tests, `RequestPreviewDialog` component test

### Risks & Edge Cases

- **Shell escaping** in cURL reconstruction: single quotes inside body data, special chars in header values
- **Path parameter substitution**: if `path_template` is `/users/{id}` and `path_parameters` has `id=123`, preview shows `/users/123` with template indicator
- **Array query params** (`?ids=1&ids=2`): handle in URL builder
- **Large bodies** (>100 KB): truncate with "Show full body" toggle
- **cURL reconstructor** is reusable by Feature 1 (Import) — design as a pure, standalone utility

---

## Recommended Implementation Order

| Order | Feature | Why |
|-------|---------|-----|
| **1** | Request Preview (F4) | Smallest scope, zero deps, immediate user value, `curlReconstructor` reusable by F1 |
| **2** | Diff View (F3) | Medium scope, frontend-only, builds on existing `originalParsed` state |
| **3** | Import Postman/OpenAPI (F1) | Large but self-contained; parsers are isolated, testable pure functions |
| **4** | Batch Processing (F2) | Largest scope, most architectural impact; benefits from F1 being done |

---

## Cross-Feature Dependencies

```
Feature 1 (Import) ──── multi-select ────→ Feature 2 (Batch)
Feature 4 (Preview) ── curlReconstructor ─→ Feature 1 (Import, cURL builder)
Feature 3 (Diff) ───── diffEngine ────────→ Feature 2 (Batch, per-item diff)
```

## Key Files Touched by Multiple Features

| File | F1 | F2 | F3 | F4 |
|------|----|----|----|----|
| `ParsedCurlEditor.tsx` (toolbar) | | | ✓ | ✓ |
| `CurlPlayground.tsx` | ✓ | ✓ | | |
| `App.tsx` (routes) | | ✓ | | |
| `useParsedCurlEditor.ts` | | | ✓ | |
| `src/types/curl.ts` | | ✓ | | |
