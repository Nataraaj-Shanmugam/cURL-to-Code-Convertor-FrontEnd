# cURLCraft Assured: functional feature matrix

Every user-facing feature, flow and edge case of the frontend, with a priority and the live
full-stack E2E test that covers it. "Live" means the real frontend (Vite dev server) against the
real FastAPI backend with no API mocks: `npm run test:e2e:live` (config `playwright.live.config.ts`,
specs in `e2e-live/`, setup in `e2e-live/support/`). Tests carry the row id in their title, e.g.
`[ED-09]`, so `npx playwright test -c playwright.live.config.ts -g "ED-09"` runs one row.

**Priority**: P0 core journey, a failure blocks the product. P1 important feature or edge case.
P2 polish / secondary.

**Status**: **covered** a passing live test asserts the outcome. **xfail** a live test asserts the
correct behaviour and is marked `test.fail(...)` because of a product bug (see Bugs); the row is
exercised but the feature does not work. **uncovered** no live test.

## Summary

| | Rows | covered | xfail only | uncovered |
|---|---|---|---|---|
| P0 | 34 | 34 | 0 | 0 |
| P1 | 79 | 73 | 6 | 0 |
| P2 | 23 | 16 | 1 | 6 |
| **All** | **136** | **123 (90.4%)** | **7 (5.1%)** | **6 (4.4%)** |

Rows with a live test (covered + xfail): 130 / 136 = **95.6%**; every P0 and P1 row has one.

## How the suite runs

`playwright.live.config.ts` starts three servers on free ports:

1. the backend (`e2e-live/support/run_backend.py`: uvicorn, `ENVIRONMENT=development`,
   `ALLOWED_ORIGINS` = the frontend origin, the backend's own `.env` loading disabled so a
   developer `.env` cannot change the run, Google Sheets credentials blank);
2. a pass-through gateway (`e2e-live/support/gateway.mjs`) that forwards everything to the backend
   and, only when the backend-status tests ask, answers like a sleeping Render service (HTML 503);
3. the Vite dev server with `VITE_CURL_CRAFT_API_URL` = the gateway and the endpoint paths of
   `.env.development`.

The `live-backend-status` project depends on `live`, so it runs alone after everything else (it
puts the gateway to sleep). `retries: 0`, `workers: 2`. Backend location:
`CURLCRAFT_BACKEND_DIR` (default `../be-unit`, then `../cURL-to-Code-Convertor-BackEnd`); Python:
`CURLCRAFT_BACKEND_PYTHON` (default `<backend>/.venv/bin/python`, then `../../be-venv`, then
`python3`). The `api` fixture records every request to the backend and its JSON response; uncaught
page errors fail a test. Feedback tests send a per-test `X-Forwarded-For` so the backend's
5-per-hour feedback limit is per test, not per suite.

## Home and shell

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| HM-01 | P0 | Home hero renders; Get Started opens the Playground | covered | shell.spec.ts |
| HM-02 | P2 | Open Playground CTA | covered | shell.spec.ts |
| HM-03 | P2 | Feature cards and How It Works sections | covered | shell.spec.ts |
| HM-04 | P2 | Documentation link to GitHub | covered | shell.spec.ts |
| HM-05 | P1 | Health check on load; real `/api/health` response turns the nav chip "Generator ready" | covered | shell.spec.ts |
| SH-01 | P1 | Theme toggle switches dark/light, persists in `ui-theme` across reload | covered | shell.spec.ts |
| SH-02 | P1 | Unknown path shows the 404 page with a link back to the Playground | covered | shell.spec.ts |
| SH-03 | P2 | Document title per route (/, /playground, /feedback, /editor, /batch-editor, 404) | covered | shell.spec.ts |
| SH-04 | P2 | Footer links (Feedback, GitHub, nataraaj.dev) on every page | covered | shell.spec.ts |
| SH-05 | P1 | Mobile 390 px: menu toggle, no horizontal overflow, editor "More actions" (Export, Add Section), row actions by tap, code dialog fits | covered | shell.spec.ts |
| SH-06 | P1 | A11y basics: one h1 per page, labelled inputs, live region, focus on h1 after parse, dialogs return focus, every editor control named | covered | shell.spec.ts |
| SH-07 | P1 | Shortcuts do not act behind a dialog (Ctrl+Enter in Import) | covered | import.spec.ts |
| SH-08 | P2 | prefers-reduced-motion disables animations | uncovered | (mocked suite `e2e/shell.spec.ts`) |

## Playground

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| PG-01 | P0 | Paste a cURL, Parse, editor shows method/URL/headers/body from the real parser; parse payload is `{curl}` | covered | playground.spec.ts |
| PG-02 | P0 | Chrome "Copy as cURL (bash)": continuations, `-b` cookies, query, nested `--data-raw` body all arrive; secrets masked | covered | playground.spec.ts |
| PG-03 | P1 | Chrome "Copy as cURL (cmd)" (`^` escaping) parses | xfail BUG-E2E-01 (backend BUG-P7) | playground.spec.ts |
| PG-04 | P1 | PowerShell `curl.exe` with backtick continuations parses | covered | playground.spec.ts |
| PG-05 | P1 | Chrome "Copy as PowerShell" (Invoke-WebRequest) is parsed faithfully or refused | xfail BUG-E2E-02 | playground.spec.ts |
| PG-06 | P0 | Backend parse error (no URL, invalid URL) shown in plain words; stays on Playground; no Retry for a validation error | covered | playground.spec.ts |
| PG-07 | P1 | Editing clears the error; a fixed cURL parses | covered | playground.spec.ts |
| PG-08 | P1 | Parse/Reset disabled while empty or blank; Reset clears input and error, examples return | covered | playground.spec.ts |
| PG-09 | P1 | Each of the 10 examples fills the input and is accepted by the real parser with the right method/endpoint | covered | playground.spec.ts |
| PG-10 | P1 | Ctrl+Enter parses | covered | playground.spec.ts |
| PG-11 | P2 | Line count; Copy puts the exact command on the clipboard with a toast | covered | playground.spec.ts |
| PG-12 | P2 | Data-handling notice | covered | playground.spec.ts |
| PG-13 | P1 | "Report this cURL" on a parse error opens a bug report | covered | shell.spec.ts |
| PG-14 | P1 | Form-data (`-F`) example lands in a Form Data section | covered | playground.spec.ts |
| PG-15 | P1 | `-k` lands in an SSL/TLS section | covered | playground.spec.ts |
| PG-16 | P1 | XML body kept as raw text | covered | playground.spec.ts |
| PG-17 | P1 | `-e <referer>` before the URL is not taken as the request URL | xfail BUG-E2E-06 | editor.spec.ts |
| PG-18 | P1 | Parser edge cases: `-X GET -d`, `-XPOST`/`-sSL`, `$'...'`, `'\''` | xfail backend BUG-P1, P6, P8, P14 | playground.spec.ts |
| PM-01 | P0 | Add another cURL: counter, numbered labels, Parse All (n) only when 2+ are filled | covered | playground.spec.ts |
| PM-02 | P0 | Parse All sends one parse per command and opens the batch editor with each request | covered | playground.spec.ts |
| PM-03 | P1 | Parse All with a failing command still opens the batch editor, failure reported | covered | batch.spec.ts |
| PM-04 | P1 | All commands fail: stay, summary plus per-command errors, aria-invalid; fixing one clears its error | covered | playground.spec.ts |
| PM-05 | P1 | Blank commands ignored; one filled + blanks is a single parse | covered | playground.spec.ts |
| PM-06 | P1 | Removing a command returns to single mode, keeping the other's text | covered | playground.spec.ts |
| PM-07 | P2 | In multi mode an example fills the empty command | covered | playground.spec.ts |

## Import (Postman / OpenAPI)

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| IM-01 | P0 | Postman v2.1 paste: detected, N requests, folders, collection variables resolved | covered | import.spec.ts |
| IM-02 | P0 | Import several: each parsed by the real backend into the batch editor; raw JSON body and headers survive | covered | import.spec.ts |
| IM-03 | P1 | Import one: fills the Playground (no navigation); it then parses | covered | import.spec.ts |
| IM-04 | P1 | Select All / Deselect All / single toggle; Import disabled at 0 | covered | import.spec.ts |
| IM-05 | P1 | Unresolved `{{vars}}` flagged; a broken environment is reported; a Postman environment resolves them | covered | import.spec.ts |
| IM-06 | P0 | OpenAPI 3 YAML with `$ref` parameters/requestBodies/schemas, `allOf`, server variables, apiKey security | covered | import.spec.ts |
| IM-07 | P1 | Swagger 2.0 JSON (host/basePath) | covered | import.spec.ts |
| IM-08 | P1 | Unknown / invalid input: Unknown Format, nothing importable | covered | import.spec.ts |
| IM-09 | P1 | Upload File tab (.json) | covered | import.spec.ts |
| IM-10 | P2 | Cancel closes and clears the dialog | covered | import.spec.ts |
| IM-11 | P1 | Collection-level bearer auth inherited; token masked in the editor | covered | import.spec.ts |
| IM-12 | P2 | OpenAPI basic/digest/oauth2 security, form bodies, Postman GraphQL bodies | uncovered | (unit tests) |

## Backend status (cold start)

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| BS-01 | P0 | checking → ready against the real backend, nav and Playground chips | covered | backend-status.spec.ts |
| BS-02 | P1 | Asleep → waking; a parse is held (no request), sent exactly once on wake, editor opens | covered | backend-status.spec.ts |
| BS-03 | P1 | Still asleep after 90 s → unavailable; parse explains and offers Retry; chip Retry → ready; Retry parse works | covered | backend-status.spec.ts |
| BS-04 | P2 | Cancel while waiting: nothing sent | covered | backend-status.spec.ts |
| BS-05 | P2 | Compact mobile chip | covered | shell.spec.ts (SH-05) |

## Editor

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| ED-01 | P0 | Sections and counts from the real parse; method/url/base_url/endpoint editable, not deletable or selectable | covered | editor.spec.ts |
| ED-02 | P0 | Edit a header value; the new value is sent to and generated by the backend | covered | editor.spec.ts |
| ED-03 | P0 | Delete a header; gone from what is generated | covered | editor.spec.ts |
| ED-04 | P0 | Add Entry; an existing header name (any case) asks to Replace | covered | editor.spec.ts |
| ED-05 | P1 | Add Entry refuses `__proto__`; disabled without a key; Cancel | covered | editor.spec.ts |
| ED-06 | P1 | Delete Section with confirmation (Cancel keeps, Delete removes from the request) | covered | editor.spec.ts |
| ED-07 | P1 | Add Section offers only missing sections; new section takes entries that reach the code | covered | editor.spec.ts |
| ED-08 | P1 | Edit endpoint and method; generated call follows | covered | editor.spec.ts |
| ED-09 | P0 | Body tree: number stays number, numeric-looking string stays string, delete leaf and array item | covered | editor.spec.ts |
| ED-10 | P1 | Expand All / Collapse All / per-node collapse | covered (+ xfail BUG-E2E-04 for the initial label) | editor.spec.ts |
| ED-11 | P1 | Dotted keys (`filter.name`, `user.name`, `a.b`) edited/deleted as one key | covered | editor.spec.ts |
| ED-12 | P1 | Raw (XML) body edited as text | covered | editor.spec.ts |
| ED-13 | P0 | Multi-select: Delete (n), Clear (n) | covered | editor.spec.ts |
| ED-14 | P0 | Undo / Redo buttons and their disabled states | covered | editor.spec.ts |
| ED-15 | P1 | Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z / Ctrl+G; text fields keep their own undo | covered | editor.spec.ts |
| ED-16 | P0 | Review Changes: added/modified/removed rows with paths, Revert one, Raw JSON (masked) | covered | editor-state.spec.ts |
| ED-17 | P0 | Reset with confirmation | covered | editor-state.spec.ts |
| ED-18 | P1 | Request Preview: method, full URL, masked; Copy cURL raw by default, redacted when ticked; the copy re-parses to the same request | covered | editor-state.spec.ts |
| ED-19 | P0 | Export: masked preview, redacted download by default (`parsed-curl-<ts>.redacted.json`), raw file only when unticked; resets on close | covered | editor-state.spec.ts |
| ED-20 | P1 | Export: reveal a single secret | covered | editor-state.spec.ts |
| ED-21 | P0 | Secrets masked in the editor until revealed (aria-pressed), per field | covered | editor-state.spec.ts, editor.spec.ts |
| ED-22 | P0 | Saved copy: no secret in local/sessionStorage or history; reload restores, flags fields, blocks Generate and Ctrl+G; re-entered values are sent | covered (+ xfail BUG-E2E-07) | editor-state.spec.ts |
| ED-23 | P1 | Clear saved request; a later reload restores nothing | covered | editor-state.spec.ts |
| ED-24 | P0 | Unsaved-edits guard: Back, nav link, browser Back; Keep editing / Escape / Discard; undo disarms; beforeunload only when dirty | covered | editor-state.spec.ts |
| ED-25 | P1 | `/editor` with nothing parsed: empty state | covered | editor.spec.ts |
| ED-26 | P1 | Original cURL card masked; Copy gives the redacted command | covered | editor-state.spec.ts |
| ED-27 | P2 | `-A` / `-e` shown (Transfer Configuration) | covered | editor.spec.ts |
| ED-28 | P1 | `-k` reaches generation (relaxed HTTPS); deleting the SSL section removes it | covered | editor.spec.ts |
| ED-29 | P2 | Backend bookkeeping fields (`data_raw`, `data_type`) are not shown as sections | xfail BUG-E2E-03 | editor.spec.ts |
| ED-30 | P1 | Body API mirror off: no `/api/body/*` calls | covered | editor.spec.ts |
| ED-31 | P2 | Add Flag to a Flags section | uncovered | |
| ED-32 | P2 | Saved request expiry (TTL) page | uncovered | (unit tests) |

## Code generation

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| CG-01 | P0 | Full Test Class: class, @BeforeClass baseURI, @Test groups, method, every header, query param, cookie, body, `.post(endpoint)`, status assertion, logging | covered | codegen.spec.ts |
| CG-02 | P0 | Method Only: bare method, file named after it | covered | codegen.spec.ts |
| CG-03 | P0 | Custom class/method names in code and file name | covered | codegen.spec.ts |
| CG-04 | P1 | Validation: identifiers, required, status 100–599, summary, focus, aria-describedby, no request sent | covered (+ xfail BUG-E2E-09) | codegen.spec.ts |
| CG-05 | P0 | POJO: Lombok, custom name, nested static class, used by the test, download name | covered | codegen.spec.ts |
| CG-06 | P1 | POJO not offered for GET | covered | codegen.spec.ts |
| CG-07 | P1 | Assertions off / custom status (201) | covered | codegen.spec.ts |
| CG-08 | P1 | Logging off | covered | codegen.spec.ts |
| CG-09 | P1 | Response-time check (validation, assertion in code) | covered | codegen.spec.ts |
| CG-10 | P1 | TestNG groups (trimmed, blanks dropped) | covered | codegen.spec.ts |
| CG-11 | P0 | Full pom.xml: coordinates, Java version, deps, surefire suite; testng.xml with the class; Download All names and contents | covered | codegen.spec.ts |
| CG-12 | P1 | Dependencies-only POM: tab, `pom-dependencies.xml`, excluded from Download All; Method Only forces it | covered | codegen.spec.ts |
| CG-13 | P1 | POM coordinates required; collapsed section reopened with focus on the field | covered | codegen.spec.ts |
| CG-14 | P1 | Data format auto-detected (XML), override and "Use detected"; JAXB in POM for XML | covered (+ xfail BUG-E2E-08) | codegen.spec.ts |
| CG-15 | P0 | Code masked on screen with reveal; Copy redacted / Copy with secrets | covered | codegen.spec.ts, editor-state.spec.ts |
| CG-16 | P0 | Downloads hold real values by default; "Redact secrets in downloaded files" redacts | covered | codegen.spec.ts |
| CG-17 | P1 | Back to Config keeps choices; Esc keeps the result; an edit drops the result, keeps the config | covered | codegen.spec.ts |
| CG-18 | P1 | Config payload sent matches the form | covered | codegen.spec.ts |
| CG-19 | P2 | Cancel on the config step sends nothing | covered | codegen.spec.ts |
| CG-20 | P1 | Feedback from the result step | covered | shell.spec.ts |
| CG-21 | P1 | Edits flow into generated code | covered | editor.spec.ts |
| CG-22 | P1 | Chrome bash journey end to end | covered | codegen.spec.ts |
| CG-23 | P1 | `-k` → relaxed HTTPS in single-request code | covered | editor.spec.ts |
| CG-24 | P1 | `-A` / `-e` reach the Java as User-Agent / Referer | xfail BUG-E2E-05 | editor.spec.ts |
| CG-25 | P2 | "Stop waiting" during a slow generate | uncovered | (needs a slow backend) |

## Batch editor and Generate All

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| BE-01 | P0 | Requests listed as "METHOD /path", first selected, h1 focused, no alert | covered | batch.spec.ts |
| BE-02 | P0 | Switching shows each request; edits kept and marked Edited | covered | batch.spec.ts |
| BE-03 | P1 | Failure banner (masked snippet), Edit and retry: still bad → message; fixed → added with toast | covered | batch.spec.ts |
| BE-04 | P1 | Dismiss failures | covered | batch.spec.ts |
| BE-05 | P1 | Remove + Undo toast; removing the last shows the empty state | covered | batch.spec.ts |
| BE-06 | P0 | Generate All: one class, a method per request, unique names, de-duplicated imports | covered | batch.spec.ts |
| BE-07 | P1 | Class/method name and status validation blocks Generate All | covered | batch.spec.ts |
| BE-08 | P1 | Per-request status: defaults (POST 201, DELETE 204), override sent and asserted | covered | batch.spec.ts |
| BE-09 | P1 | `-k` relaxes HTTPS only in its own method | xfail BUG-E2E-10 | batch.spec.ts |
| BE-10 | P1 | Copy redacts every request's secrets unless unticked; Back to Config | covered | batch.spec.ts |
| BE-11 | P1 | A request the backend rejects is reported, others generated; all rejected → error, no result | covered | batch.spec.ts |
| BE-12 | P1 | Unsaved-edits guard | covered | batch.spec.ts |
| BE-13 | P1 | History holds a redacted batch; reload blocks Generate All until re-entered | covered | batch.spec.ts |
| BE-14 | P1 | 390 px: selector, full-width editor, remove button | covered | batch.spec.ts |
| BE-15 | P2 | Empty `/batch-editor` state | covered | batch.spec.ts |
| BE-16 | P2 | Back to Playground | covered | batch.spec.ts |
| BE-17 | P2 | Batch POM tab | uncovered | (batch dialog has no POM option to request one) |

## Feedback

| ID | P | Feature / flow / edge case | Status | Test |
|----|---|----------------------------|--------|------|
| FB-01 | P0 | /feedback from nav; production payload; backend result handled (local backend has no Sheets credentials → 500 SUBMISSION_FAILED shown, input kept) | covered | shell.spec.ts |
| FB-02 | P1 | Category and 10-character minimum, counter; nothing sent until valid | covered | shell.spec.ts |
| FB-03 | P1 | Rating sent | covered | shell.spec.ts |
| FB-04 | P1 | Report this cURL: bug category, opt-in attach, preview, only redacted text sent or stored | covered | shell.spec.ts |
| FB-05 | P1 | Feedback dialog in Code Generation: Cancel, attach redacted generated code | covered (+ xfail BUG-E2E-11) | shell.spec.ts |
| FB-06 | P1 | Invalid email rejected by backend validation (422) and shown | covered | shell.spec.ts |
| FB-07 | P2 | Backend rate limit (6th post per hour → 429) shown | covered | shell.spec.ts |

The successful-submission path ("Thank you for your feedback!") needs Google Sheets credentials and
is not reachable locally; the mocked suite (`e2e/shell.spec.ts`) covers it.

## Bugs found

| ID | Sev | Where | Summary | Repro |
|----|-----|-------|---------|-------|
| BUG-E2E-03 | Medium | FE editor | Backend fields `data_raw` / `data_type` render as "Data Raw" (one row per character) and "Data Type" sections, with Add Entry / Delete Section | Parse any cURL with `-d`; see "Data Raw 65" |
| BUG-E2E-07 | High | FE editor | After a reload, a redacted `data_raw` keeps Generate Code disabled although every field marked "re-enter" was re-entered; only deleting the bogus Data Raw section unblocks it | Parse a cURL with `"password"` in the body, reload, re-enter all marked fields: "Re-enter 1 redacted value" stays |
| BUG-E2E-09 | Medium | FE codegen | Method Only still sends the hidden class name; an invalid one makes the backend reject the request | Full Test Class, class `123 Bad`, switch to Method Only, Generate → "config.serviceName: Class name must be a valid Java identifier" |
| BUG-E2E-10 | Medium | FE batch | `-k` request loses relaxed HTTPS in Generate All: backend reports `ssl_config.basic.insecure`, `isInsecureCurl` reads only top-level keys | Parse All a normal GET + `curl -k https://...`; Generate All: no `relaxedHTTPSValidation` |
| BUG-E2E-08 | Medium | BE / FE copy | Dialog says JAXB "is included automatically" for Java 11/17/21 with XML; generated POM has no JAXB | XML PUT example, Generate pom.xml, Java 11 |
| BUG-E2E-06 | High | BE parser | `-e <referer>` before the URL: the referer becomes the request URL | `curl -e "https://ref.example.com/p" "https://api.example.com/ping"` → url = ref |
| BUG-E2E-05 | Medium | BE generator | `-A` / `-e` (transfer_config) are not emitted as User-Agent / Referer in REST Assured code | `curl URL -A "X/1.0"`, generate: no `X/1.0` |
| BUG-E2E-02 | Medium | BE parser | Chrome "Copy as PowerShell" (Invoke-WebRequest) "parses" as a bare GET; method, headers, body dropped (only a Warnings section) | Paste the PowerShell copy of a POST |
| BUG-E2E-01 | Medium | BE parser | Chrome "Copy as cURL (cmd)" rejected (INVALID_URL); same as backend BUG-P7 | Paste a cmd copy |
| BUG-E2E-04 | Low | FE editor | Body toggle starts as "Expand All" while all nodes are expanded; first press does nothing visible | Parse a nested body, press Expand All |
| BUG-E2E-11 | Low | FE feedback | Code-generation Feedback opt-in says "Include my cURL command" but attaches only the generated code | Generate, Feedback, tick the box, submit: `generated_code` only |
| BUG-E2E-12 | Low | FE validation | Java keywords (`switch`, `class`) pass the frontend's method-name check and fail only at the backend (422) | Generate All with method name `switch` |
| (backend) | | BE parser | BUG-P1, P6, P8, P14 seen through the UI (PG-18); found by the backend unit suite | |

Also noticed, not filed: every cookie (including `theme=dark`) and a body field named `pin` (an
Indian postal PIN) are masked as secrets; the Warnings section masks text after `-U` in
"-UseBasicParsing".
