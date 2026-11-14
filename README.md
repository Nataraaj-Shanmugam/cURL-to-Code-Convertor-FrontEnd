# CurlCraft: cURL-to-Code Convertor (frontend)

CurlCraft turns a cURL command into an editable request and then into REST Assured / TestNG test code.
Paste or import a request, correct it in a visual editor, preview it, and generate a Java test class,
a single test method, POJOs and the `pom.xml` dependencies.

**Live site:** https://curlcraftassured.vercel.app

The frontend is a React single-page app. All parsing and code generation happen in a separate Python
backend (FastAPI), so this repository contains no parser or generator logic.

## Contents

- [Features](#features)
- [Routes](#routes)
- [Limits](#limits)
- [Secrets handling](#secrets-handling)
- [Backend status](#backend-status)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Performance budgets](#performance-budgets)
- [Deployment](#deployment)
- [Project layout](#project-layout)

## Features

**Playground (`/playground`)**
- Paste one cURL command and press Parse (or Ctrl/Cmd + Enter). One filled command opens the editor.
- Add more command boxes and parse them together. Several commands open the Batch Editor; a command
  that fails does not discard the others, and each failure is shown against its command number.
- Example commands to start from.
- On a parse error, "Report this cURL" opens the feedback form with the redacted command attached.
  The form shows what will be attached before it is sent.

**Import (Playground > Import)**
- Paste or upload (up to 5 MB) a **Postman Collection v2.1**, an **OpenAPI 3 / Swagger** spec, or a
  cURL command. JSON and YAML are both accepted; the format is detected from the content.
- A Postman environment file can be uploaded with a collection to resolve `{{variables}}`.
- Choose which requests to import. One request opens the editor; several open the Batch Editor.

**Parsed request editor (`/editor`)**
- The parsed request is shown as accordion sections: request details, headers, query parameters, cookies,
  authentication, body, form data, network, SSL/TLS, flags, path parameters and client context. Sections
  with data open by default; missing sections can be added, and sections or entries can be deleted.
- Click a value to edit it inline. The body is a tree (objects, arrays, primitives) with expand and
  collapse controls. Large bodies are previewed and rendered on demand.
- **Undo / redo**: Ctrl/Cmd + Z and Ctrl/Cmd + Y (or Ctrl/Cmd + Shift + Z), outside text fields.
- **Preview request** shows the request as it will be sent.
- **Review Changes** lists every edit made since the original parse, as added, removed and modified rows.
- **Reset** restores the original parse (asks first).
- **Export JSON** downloads the edited request. You can choose to redact secrets in the file; otherwise
  the file contains the real secret values.
- Ctrl/Cmd + G opens code generation.

**Code generation**
- Output: a full TestNG / REST Assured test class, or the test method only.
- Options: class and method names, assertions, expected status code, request/response logging, and
  optional POJO generation (Lombok `@Data` and `@Builder`) for request bodies.
- Tabs: test code, POJO classes (when enabled), and the `pom.xml` (or dependencies only).
- Copy any tab or download it; batch generation can download every file.
- Generation is blocked while the request still contains redacted values (see below).

**Batch Editor (`/batch-editor`)**
- Edits several parsed requests at once: the list of requests, a per-request editor, an "edited" marker,
  and removal of requests.
- "Generate All" generates code for the batch.

**Other**
- Light, dark and system theme.
- Feedback form (`/feedback`) for bug reports, feature requests and questions.
- Unknown routes show a 404 page.

## Routes

| Path | Page |
|------|------|
| `/` | Landing page |
| `/playground` | cURL input, import and parse |
| `/editor` | Parsed request editor and code generation |
| `/batch-editor` | Batch Editor |
| `/feedback` | Feedback form |
| anything else | 404 |

The editor and batch editor receive their data through React Router location state. A reload restores
the last request from this tab's session storage (see below). Opening `/editor` directly with nothing to
restore sends you back to the Playground.

## Limits

- **cURL command length: 50,000 characters.** The frontend does not check this itself. The backend
  enforces it (`MAX_CURL_COMMAND_LENGTH`, default 50000) and answers HTTP 413, which the app shows as an
  error. Batch parsing applies the limit to each command separately.
- Import files: 5 MB per file (checked in the browser).
- Up to 5 commands are parsed in parallel in a batch; the rest wait their turn.
- The editor keeps up to 50 undo steps.

## Secrets handling

Credentials are masked everywhere they are shown, and are not kept in browser storage.

- **What counts as a secret:** `Authorization`, `Proxy-Authorization`, `Cookie` and `Set-Cookie` header
  values; `-u user:password`; proxy and URL credentials; every cookie value; any header, query, form or
  body key whose name looks secret (token, key, secret, password, session, auth and similar); JWT-shaped
  values anywhere. Name matching is deliberately broad: a harmless value gets masked rather than a
  credential leaking. The rules live in `src/lib/utils/redaction.ts`.
- **On screen:** secret values show as `••••••••` with a per-value eye toggle to reveal them.
- **Code generation** is disabled until every redacted value is re-entered, so generated code never
  contains a placeholder in place of a real credential.
- **Storage:** the editor and batch state are saved to `sessionStorage` only (gone when the tab closes),
  with secrets already redacted. The live values stay in memory. Entries expire 8 hours after the last
  activity. Older builds kept the editor state, secrets included, in `localStorage`; that entry is
  removed (or migrated in redacted form) on load.
- **Feedback:** the "Report this cURL" text is redacted before it is put into the route state.
- **Build:** never put a secret in a `VITE_*` variable. Every such value is written into the shipped
  JavaScript.

## Backend status

The hosted backend sleeps when idle. On every app load (any route) the frontend polls the health endpoint
and shows the state in the navigation bar and on the Playground:

| Chip | Meaning |
|------|---------|
| Checking generator | First probe in progress |
| Waking generator | Backend is starting; the app waits up to 90 seconds |
| Generator ready | Backend answered |
| Generator unavailable | No answer in 90 seconds; **Retry** starts the check again |

A parse started while the backend is waking is held and sent once it is ready, so it is not lost to a
timeout. Requests use longer timeouts (20 s) until the backend has answered recently, and retry network
errors and 502/503/504 responses with backoff.

## Getting started

Requirements: Node.js 20.19 or later (CI uses 22) and npm.

```bash
npm ci           # install exactly what package-lock.json records
npm run dev      # http://localhost:5173
```

`npm run dev` needs no configuration. It calls a backend at `http://127.0.0.1:8000` and loads the
committed `.env.development`. Run the backend locally, or set `VITE_CURL_CRAFT_API_URL` to another one.

To build for deployment:

```bash
VITE_CURL_CRAFT_API_URL=https://api.example.com npm run build     # mode: production
VITE_CURL_CRAFT_API_URL=https://api.example.com npm run preprod   # mode: preprod
npm run preview                                                   # serve dist/ locally
```

`build` and `preprod` refuse to run if `VITE_CURL_CRAFT_API_URL` is missing, empty, not an absolute
http(s) URL, or a loopback address (`localhost`, `127.0.0.0/8`, `::1`, `0.0.0.0`). That stops a deployed
bundle from calling the visitor's own machine. The check is in `scripts/envGuard.ts`.

## Environment variables

All variables are read in one place, `src/lib/env.ts`. Vite inlines `VITE_*` values at **build time**, so
set them in the environment that runs the build (on Vercel: Project Settings > Environment Variables,
for each environment being built), not at runtime.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_CURL_CRAFT_API_URL` | `http://127.0.0.1:8000` in dev only | Backend base URL. Required for `production` and `preprod` builds (see above). |
| `VITE_CURL_CRAFT_API_PARSE_ENDPOINT` | `/api/parse` | Parse a cURL command. |
| `VITE_CURL_CRAFT_API_GENERATE_ENDPOINT` | `/api/generate-from-parsed` | Generate code from parsed data (also used per item by batch generation). Falls back to `VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT` when this one is unset; if both are set, this one wins. |
| `VITE_CURL_CRAFT_API_HEALTH_ENDPOINT` | `/health` | Health check (GET) used by the backend status logic. `.env.development` uses `/api/health`, which the backend also serves. Any 2xx or 4xx answer counts as awake; network errors, timeouts and 5xx do not. |
| `VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT` | `/api/feedback` | Submit feedback. |
| `VITE_CURL_CRAFT_API_BODY_EDIT_ENDPOINT` | `/api/body/edit` | Mirror a body edit to the backend. Used only when the flag below is on. |
| `VITE_CURL_CRAFT_API_BODY_DELETE_ENDPOINT` | `/api/body/delete` | Mirror a body delete to the backend. Used only when the flag below is on. |
| `VITE_CURL_CRAFT_BODY_API_ENABLED` | off | Set to `true` to turn on body mirroring. Body edits always apply locally first. A failed mirror call shows a notice and never undoes the edit. The backend in `release/v3.1-backend` does not define the two `/api/body/*` routes, so leave this off unless the backend has them. |

Only `VITE_CURL_CRAFT_API_URL` normally needs setting; the paths default to the backend's routes.

**Master-branch variables that V3 does not read:** `VITE_CURL_CRAFT_API_PARSE_AND_GENERATE_ENDPOINT`,
`VITE_BE_WARMUP_WAIT_MINS` and `VITE_BE_WARMUP_MAX_RETRIES`. A leftover value has no effect. The warm-up
now polls the health endpoint for up to 90 seconds, and requests retry on their own.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Type-check, then production build (`--mode production`) |
| `npm run preprod` | Type-check, then build with `--mode preprod` |
| `npm run preview` | Serve the built `dist/` |
| `npm run type-check` | TypeScript, no emit |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier on `src/**/*.{ts,tsx,css}` |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with v8 coverage; fails below 90% statements, branches, functions or lines |
| `npm run test:e2e` | Playwright, mocked backend (starts the dev server itself) |
| `npm run test:e2e:ui` / `:headed` / `:report` | Playwright UI mode, headed browser, last HTML report |
| `npm run test:e2e:live` | Playwright against the real backend (see [Testing](#testing)) |
| `npm run perf:build` | Build the perf bundle into `dist-perf/` |
| `npm run perf:bundle` | Bundle-size budgets only |
| `npm run perf:web` | Web vitals and stress measurements in Chromium |
| `npm run perf:profile` | CPU profile of the stress scenarios |
| `npm run perf:check` | Build, measure and compare against `perf/budgets.json`; exits 1 on a breach |

## Testing

**Unit and component tests (Vitest, `src/__tests__/`).** React Testing Library for components, and MSW v2
for the HTTP layer. Run `npm test`, or `npm run test:coverage` for the coverage gate.

**Mocked end-to-end (Playwright, `e2e/`).** Runs in Chromium on desktop. Every backend call is mocked in
`e2e/fixtures.ts`, so no backend is needed. Install the browser once with
`npx playwright install chromium`, then run `npm run test:e2e`.

**Live end-to-end (Playwright, `e2e-live/`).** Runs the real frontend against the real backend, through a
small gateway (`e2e-live/support/gateway.mjs`) that can also simulate a sleeping host. It needs a backend
checkout with its Python dependencies installed:

```bash
CURLCRAFT_BACKEND_DIR=/path/to/backend \
CURLCRAFT_BACKEND_PYTHON=/path/to/backend/.venv/bin/python \
npm run test:e2e:live
```

Both variables are optional. `CURLCRAFT_BACKEND_DIR` defaults to `../be-unit` or
`../cURL-to-Code-Convertor-BackEnd`; `CURLCRAFT_BACKEND_PYTHON` defaults to that checkout's `.venv`, then
`python3`. The backend runs with `ENVIRONMENT=development`, so the production-only settings (rate limiting,
the production CORS origin rules) are not exercised by this suite.

## Performance budgets

`perf/budgets.json` holds bundle-size and interaction budgets. `perf/baseline.json` holds the measurements
they were derived from, and `docs/testing/performance-report.md` explains the method and the history.

- `npm run perf:check -- --bundle-only` checks sizes only. It is deterministic and runs in CI.
- `npm run perf:check` also measures timings in Chromium. Timings on a shared machine vary a lot; run it on
  an idle machine, and re-run before believing a failure.
- After an intentional change, `npm run perf:check -- --rebaseline` rewrites both files. Re-apply any
  hand-set budget afterwards.

## Deployment

The app is deployed to Vercel. The production branch is `preprod`, and the backend is on Render. The order
of a release, and how to roll back, are in [`docs/RELEASE.md`](docs/RELEASE.md).

Vercel needs `VITE_CURL_CRAFT_API_URL` set in both the **Production** and **Preview** scopes, because the
build refuses to run without it.

## Project layout

```
src/
  App.tsx, main.tsx          Router setup and entry point
  pages/                     Home, Playground, EditorPage, BatchEditorPage, Feedback, NotFound
  components/
    features/curl/           Playground, parsed editor (editor/), code generation (codegen/), dialogs
    features/import/         Import dialog (cURL, Postman, OpenAPI)
    features/backend/        Backend status chip and wait notice
    features/feedback/       Feedback form and dialog
    layout/                  App layout, navigation bar, footer, route effects
    ui/                      shadcn/ui primitives and the error boundary
  contexts/                  Backend status (BackendStatusContext)
  lib/
    api/                     apiClient.ts (fetch wrapper, ApiError, retries, timeouts) and curl.ts
    env.ts                   Every VITE_* variable, read in one place
    hooks/                   Editor, batch editor, body API and section hooks
    parsers/                 cURL text, Postman, OpenAPI, import detection
    utils/                   Redaction, storage, code generation, diff, shortcuts, notifications
  constants/                 Example commands, method colours, feedback categories, links
  types/                     Shared TypeScript types
  __tests__/                 Vitest suites, MSW handlers and fixtures
e2e/                         Mocked Playwright suites
e2e-live/                    Live Playwright suites and backend support
perf/                        Budgets, baseline and measurement scripts
scripts/                     Build-time env guard and repo checks
docs/                        Test matrices, performance report, release runbook
```

## License

No license file has been added yet.
