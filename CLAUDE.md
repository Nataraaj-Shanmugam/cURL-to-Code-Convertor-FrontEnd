# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cURL-to-Code Convertor (CurlCraft) — a React frontend that parses cURL commands (and Postman / OpenAPI imports) into an editable request and generates REST Assured / TestNG test code. Connects to a Python backend (default `http://127.0.0.1:8000`). The live site is https://curlcraftassured.vercel.app. See `README.md` for features, env vars and scripts.

## Commands

```bash
npm run dev            # Start dev server (Vite, port 5173)
npm run build          # Type-check + production build (tsc && vite build); needs VITE_CURL_CRAFT_API_URL
npm run preprod        # Same, with --mode preprod (also env-guarded)
npm run type-check     # TypeScript type checking only
npm run lint           # ESLint (zero warnings enforced)
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier on src/**/*.{ts,tsx,css}
npm run preview        # Preview production build
npm test               # Vitest, once
npm run test:coverage  # Vitest + v8 coverage; 90% gate on statements/branches/functions/lines
npm run test:e2e       # Playwright, mocked API (starts the dev server itself)
npm run test:e2e:live  # Playwright against the real backend (needs CURLCRAFT_BACKEND_DIR)
npm run perf:check     # Build + measure + compare with perf/budgets.json (--bundle-only for size only)
```

**Test framework:** Vitest + `@testing-library/react` + MSW v2 (mocked API layer). Unit tests live in `src/__tests__/` (`api/`, `components/`, `contexts/`, `hooks/`, `pages/`, `parsers/`, `utils/`, `mocks/`). Vitest only includes `src/**`. Mocked e2e is in `e2e/`, live e2e in `e2e-live/`.

## Architecture

**Tech stack:** React 18 + TypeScript (strict) + Vite 5 + Tailwind CSS 3 + shadcn/ui (Radix primitives). Framer Motion is not a dependency; the test setup still mocks `IntersectionObserver`.

**Routing** (React Router v6; `src/main.tsx` mounts a data router via `createBrowserRouter` + `RouterProvider` with one catch-all route rendering `<App/>`, which owns the `<Routes>` in `src/App.tsx`; the data router is required by `useBlocker`, used for the editor's unsaved-edits guard. Tests render through a memory data router, see `src/__tests__/test-utils.tsx`):
- `/` → `Home` — Landing page
- `/playground` → `Playground` — cURL input, import dialog, batch parse via `CurlPlayground`
- `/editor` → `EditorPage` — Parsed cURL editor with code generation (`ParsedCurlEditor`)
- `/batch-editor` → `BatchEditorPage` — Edits several parsed requests and generates batch code
- `/feedback` → `Feedback` — Feedback form
- `*` → `NotFound`

**Backend status** (`src/contexts/BackendStatusContext.tsx`, provider in `App.tsx`): the hosted backend sleeps when idle. On every app load the provider polls the health endpoint (`VITE_CURL_CRAFT_API_HEALTH_ENDPOINT`, default `/health`): `checking` → `waking` → `ready`, or `unavailable` after 90 s (Retry restarts). It is a `useReducer`. `BackendStatusChip` shows it in the NavBar and Playground; `CurlPlayground` holds a parse until `waitUntilReady()` resolves. Without a provider (isolated unit tests) the status is assumed `ready`.

**Data flow between routes:** React Router location state. `CurlPlayground` navigates with `navigate('/editor', { state: { parsed, originalCurl } })` for one command and `navigate('/batch-editor', { state: { items, failures } })` for several (parsing happens before navigating). On reload, the editor and batch state come back from `sessionStorage` (`src/lib/utils/editorStorage.ts`, `batchStorage.ts`), which holds only redacted copies; live values sit in memory in `src/lib/utils/liveRequestStore.ts`, with an 8 h TTL.

**Secrets:** `src/lib/utils/redaction.ts` is the single source of the secret rules. Secret values render masked (`MASK`) with a per-value reveal (`components/features/curl/editor/SecretValue.tsx`). Code generation is disabled while redacted values remain. Feedback and "Report this cURL" send redacted text only. Never store raw secrets in `localStorage`; the legacy key is migrated/removed by `migrateLegacyEditorState` in `main.tsx`.

**State management:** No global store. `useState` for UI state, `useReducer` in `BackendStatusContext`, and custom hooks in `src/lib/hooks/` for business logic: `useParsedCurlEditor`, `useEditorState` (undo/redo history), `useBatchEditor`, `useBodyApi`, `useSectionManager`, `useUnsavedChangesGuard`. Code generation has no hook: `CodeGenerationDialog` and `components/features/curl/codegen/` call `curlApi` directly.

**API layer** (`src/lib/api/`):
- `apiClient.ts` — `fetch` wrapper. Checks status and content type before parsing, throws `ApiError` (`kind`, `status`, `code`, `retryable`, `retryAfterMs`) with plain-language messages, retries network errors/timeouts/502/503/504 with jittered backoff when the call passes `retries` (GET defaults to 2, POST to 0; parse and generate use `SAFE_RETRIES`, feedback 1). Timeouts: `DEFAULT_TIMEOUT_MS` (10s), `GENERATE_TIMEOUT_MS` (30s), raised to `COLD_START_TIMEOUT_MS` (20s) until a response shows the backend is awake (`AWAKE_WINDOW_MS`, 10 min).
- `curl.ts` — `curlApi.generateFromParsed` for `ENV.GENERATE_ENDPOINT`.
- `src/lib/utils/parseCurlBatch.ts` — parses several commands through `ENV.PARSE_ENDPOINT`, at most 5 in parallel.
- Endpoints are read in `src/lib/env.ts` (the only place `VITE_*` is read). Build-time env guard: `scripts/envGuard.ts` refuses `production`/`preprod` builds without a public `VITE_CURL_CRAFT_API_URL`.
- Backend routes the frontend calls: POST `/api/parse`; POST `/api/generate-from-parsed`; POST `/api/feedback`; GET health (`/health`, or `/api/health`). POST `/api/body/edit` and `/api/body/delete` are mirrored only when `VITE_CURL_CRAFT_BODY_API_ENABLED=true` (off by default); the backend in `release/v3.1-backend` does not define those two routes.

**Key directories:**
- `src/components/features/curl/` — Playground (`CurlPlayground`), parsed editor (`ParsedCurlEditor`, `editor/`), code generation (`CodeGenerationDialog`, `BatchCodeGenerationDialog`, `codegen/`), request preview, diff ("Review Changes"), JSON export
- `src/components/features/import/` — `ImportDialog` (cURL, Postman v2.1, OpenAPI/Swagger; parsers in `src/lib/parsers/`)
- `src/components/features/feedback/` — `FeedbackForm` and `FeedbackDialog`
- `src/components/features/backend/` — `BackendStatusChip`, `BackendWaitNotice`
- `src/components/layout/` — `AppLayout`, `NavBar`, `Footer`, `RouteEffects`, `PageHeading`
- `src/components/ui/` — shadcn/ui primitives + `error-boundary.tsx`
- `src/lib/hooks/` — Business logic hooks (see State management)
- `src/lib/utils/` — redaction, storage, code generation, diffing, shortcuts, notifications
- `src/constants/` — `curl.ts` (examples, method colours), `feedback.ts` (categories and limits), `links.ts`
- `src/types/` — Central type definitions (`curl.ts`: `ParsedCurl`, `ParsedCurlResponse`, `ApiResponse<T>`, `CodeGenerationConfig`; `batch.ts`, `import.ts`, `diff.ts`)

## Conventions

- Path alias: `@` maps to `src/` (configured in vite.config.ts and tsconfig)
- Styling: Tailwind utility classes with CSS variables for theming (light/dark via `next-themes`)
- Components: shadcn/ui pattern — primitives in `src/components/ui/`, composed in feature directories
- shadcn/ui config in `components.json` (base color: neutral, CSS variables enabled)
- Repo hygiene: `scripts/check-docs-ci.mjs` (run by CI) checks that every `VITE_*` variable read in `src/lib/env.ts` is documented in `README.md`, that the removed stale docs stay removed, and that CI runs the gates listed in `docs/RELEASE.md`
