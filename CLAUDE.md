# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cURL-to-Code Convertor (CurlCraft) — a React frontend that parses cURL commands and generates equivalent code in various programming languages. Connects to a Python backend (default `http://127.0.0.1:8000`).

## Commands

```bash
npm run dev          # Start dev server (Vite, port 5173)
npm run build        # Type-check + production build (tsc && vite build)
npm run type-check   # TypeScript type checking only
npm run lint         # ESLint (zero warnings enforced)
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier formatting
npm run preview      # Preview production build
npm test             # Run tests (Vitest)
```

**Test framework:** Vitest + `@testing-library/react` + MSW v2 (mocked API layer). Tests live in `src/__tests__/`.

## Architecture

**Tech stack:** React 18 + TypeScript (strict) + Vite + Tailwind CSS + shadcn/ui + Framer Motion

**Routing** (React Router v6 in `src/App.tsx`):
- `/` → `Home` — Landing page with backend health check
- `/playground` → `Playground` — cURL input via `CurlPlayground`
- `/editor` → `EditorPage` — Parsed cURL editor with code generation

Data flows between routes via React Router location state: `navigate('/editor', { state: { parsed, originalCurl } })`.

**State management:** No global store. Uses `useState` for UI state, `useReducer` in `useCodeGenerator` hook for code generation flow, and custom hooks (`useCurlParser`, `useParsedCurlEditor`) for business logic.

**API layer** (`src/lib/api/`):
- `apiClient.ts` — Axios instance with interceptors; exports `DEFAULT_TIMEOUT_MS` (10s) and `GENERATE_TIMEOUT_MS` (30s)
- Endpoints configured via env vars: `VITE_CURL_CRAFT_API_URL`, `VITE_CURL_CRAFT_API_PARSE_ENDPOINT`, `VITE_CURL_CRAFT_API_GENERATE_ENDPOINT`, `VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT`
- POST `/api/parse` — Parse a cURL string
- POST `/api/generate-from-parsed` — Generate code from parsed data + config
- POST `/api/body/edit` — Edit a node in parsed body
- POST `/api/body/delete` — Delete a node from parsed body
- POST `/api/feedback` — Submit user feedback

**Key directories:**
- `src/components/features/curl/` — Core feature components (playground, editor, code generation dialog)
- `src/components/features/feedback/` — FeedbackDialog component
- `src/components/ui/` — shadcn/ui primitives + `error-boundary.tsx`
- `src/lib/hooks/` — Business logic hooks (`useParsedCurlEditor`, `useCurlParser`)
- `src/types/curl.ts` — Central type definitions (`ParsedCurl`, `ParsedCurlResponse`, `ApiResponse<T>`)
- `src/__tests__/` — Vitest tests: `hooks/`, `components/`, `mocks/` (MSW handlers + server)

## Conventions

- Path alias: `@` maps to `src/` (configured in vite.config.ts and tsconfig)
- Styling: Tailwind utility classes with CSS variables for theming (light/dark via `next-themes`)
- Components: shadcn/ui pattern — primitives in `src/components/ui/`, composed in feature directories
- shadcn/ui config in `components.json` (base color: neutral, CSS variables enabled)
