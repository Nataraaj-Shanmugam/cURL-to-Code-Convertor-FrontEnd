# Unit feature matrix

Each unit-level feature or rule and the test file(s) that assert it. Paths are under `src/__tests__/`.
Run everything with `npm run test:coverage` (thresholds: 90% statements, branches, functions, lines).
Tests marked **BUG** use `it.fails` and document a defect (see the bottom of this file).

## Parsers (`lib/parsers`)
| Feature / rule | Tests |
|---|---|
| Format detection (Postman by id, schema URL, info+item; OpenAPI/Swagger; unknown) | `parsers/importers.test.ts`, `parsers/postmanParserEdges.test.ts` |
| Invalid JSON / YAML errors, empty and scalar input | `parsers/postmanParserEdges.test.ts` |
| Postman environment parsing (values, variable, disabled, invalid) | `parsers/importers.test.ts`, `parsers/postmanParserEdges.test.ts` |
| Postman variables: scope precedence, nesting, runaway self-reference, unresolved list | `parsers/importers.test.ts`, `parsers/postmanParserEdges.test.ts` |
| Postman auth (bearer, basic, digest, apikey, oauth2, inherit, unsupported warning) | `parsers/postmanParserEdges.test.ts` |
| Postman URLs (structured, raw, :path vars, encoding, unicode, placeholders kept) | `parsers/postmanParserEdges.test.ts` |
| Postman bodies (raw, urlencoded, formdata, file, graphql) and header formats | `parsers/postmanParserEdges.test.ts` |
| OpenAPI 3 / Swagger 2: naming, servers and variables, base URL fallbacks | `parsers/openApiParserEdges.test.ts`, `parsers/importers.test.ts` |
| OpenAPI parameters (merge/override, $ref, examples, array styles, path/header/cookie) | `parsers/openApiParserEdges.test.ts` |
| OpenAPI schema examples (allOf, oneOf, enum, formats, readOnly, cycles, depth limit) | `parsers/openApiParserEdges.test.ts` |
| OpenAPI security schemes to credentials; no duplicates of declared params | `parsers/openApiParserEdges.test.ts` |
| OpenAPI bodies (json, multipart, urlencoded, other media) and Swagger 2 body/formData | `parsers/openApiParserEdges.test.ts` |

## Utilities (`lib/utils`)
| Feature / rule | Tests |
|---|---|
| Secret redaction: names, headers, cookies, URLs, bodies, curl strings, free text, parsed sections, JWTs, idempotence | `utils/redaction.test.ts`, `utils/redactionMatrix.test.ts`, `utils/redactionEdges.test.ts` |
| Field discovery, masking, reveal, counting redactions | `utils/redactionEdges.test.ts` |
| Editor persistence: redacted session copy, TTL, versioning, legacy migration, blocked storage | `utils/editorStorage.test.ts`, `utils/editorStorageEdges.test.ts` |
| History-state redaction and restore source (live / redacted / expired / none) | `utils/editorStorageEdges.test.ts` |
| In-memory live request store and expiry boundary | `utils/liveRequestStore.test.ts` |
| Batch route-state redaction and restore | `utils/batchDiffShortcutsNotify.test.ts` |
| Field paths: encode/decode, prototype-pollution guard, get/set/delete, revert shape, deletion order, bracket paths | `utils/fieldPath.test.ts`, `utils/urlAndPathEdges.test.ts` |
| URL building (path params, query, mask tokens, encoding) | `utils/urlBuilder.test.ts`, `utils/urlAndPathEdges.test.ts` |
| URL/part sync, normalisation, splitting | `utils/requestUrl.test.ts`, `utils/urlAndPathEdges.test.ts` |
| cURL reconstruction (methods, -k, -L, proxy, credentials, headers, cookies, body, form) | `utils/curlReconstructor.test.ts`, `utils/curlReconstructorEdges.test.ts` |
| Diff engine (added/removed/modified, key escaping, JSON-string data) | `hooks/useParsedCurlEditorPaths.test.ts`, `utils/batchDiffShortcutsNotify.test.ts` (**BUG FE-UNIT-01**) |
| Code generation requests, validation, chunk-load recovery, env guard | `utils/codeGeneration.test.ts`, `utils/codegenValidation.test.ts`, `utils/chunkLoadRecovery.test.ts`, `scripts/envGuard.test.ts` |
| Data format detection (JSON/XML/both, URL guess, labels) | `utils/dataFormatDetector.test.ts`, `utils/formatAndBatchEdges.test.ts` |
| Batch parsing (concurrency, order, failures, retryable) | `utils/parseCurlBatch.test.ts`, `utils/formatAndBatchEdges.test.ts` |
| Keyboard shortcut guards; toast and clipboard helpers | `utils/batchDiffShortcutsNotify.test.ts` |
| Deep equality, insecure flag, env aliases | `utils/deepEqual.test.ts`, `utils/insecureFlag.test.ts`, `utils/envAliases.test.ts` |

## API client (`lib/api`)
| Feature / rule | Tests |
|---|---|
| Error mapping (structured, HTML, empty, non-JSON), status text | `api/apiClient.test.ts`, `api/apiClientEdges.test.ts` |
| Retry, backoff, Retry-After, timeouts, cold-start floor, abort, liveness signals | `api/apiClient.test.ts`, `api/apiClientEdges.test.ts` |
| `curlApi.generateFromParsed`, error message extraction | `api/apiClientEdges.test.ts`, `api/backendIntegration.test.ts` |

## Hooks, context and components
| Feature / rule | Tests |
|---|---|
| Section manager (open sections, add entry, duplicates, forbidden keys, new section) | `hooks/useSectionManager.test.ts` (**BUG FE-UNIT-02**) |
| Body API mirror (paths, loading, errors, disabled) | `hooks/useBodyApi.test.ts` (**BUG FE-UNIT-03**) |
| Editor state, batch editor, parsed-curl editor hooks | `hooks/useEditorState.test.ts`, `hooks/useBatchEditor.test.ts`, `hooks/useParsedCurlEditor*.test.ts` |
| Backend status reducer, provider, no-provider default | `contexts/BackendStatusContext.test.tsx`, `components/SmallUnits.test.tsx` |
| Import dialog (select, deselect, env file, size limit, close/reset, single vs multiple) | `components/ImportDialog.test.tsx`, `components/ImportDialogFlows.test.tsx` |
| Theme provider, nav theme toggle, error boundary reload, dropdown shortcut | `components/SmallUnits.test.tsx`, `components/ErrorBoundary.test.tsx` |
| Editor, playground, code-generation dialogs, feedback, pages | the remaining files under `components/` and `pages/` |

## Known defects found (tests are `it.fails`)
- **FE-UNIT-01 (low)** `computeDiff` never normalises a JSON-string `data` field when called from the key loop, so a whitespace-only reformat shows as a change.
- **FE-UNIT-02 (low)** "Add section" accepts `__proto__` (no forbidden-name check unlike "Add entry"); the request prototype is swapped and nothing is created.
- **FE-UNIT-03 (low)** `useBodyApi`: `{ success: false, error: null }` throws on `null.message`; the user sees "Cannot read properties of null".

## Coverage exclusions (vite.config.ts)
`src/main.tsx` (bootstrap only, covered by e2e), `src/types/**` and `*.d.ts` (types only), `src/__tests__/**` (test code).
