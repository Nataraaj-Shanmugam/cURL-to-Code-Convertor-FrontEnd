# CurlCraft Assured — Frontend TODO

---

## SEO & META

- [ ] **No favicon or app icons configured** — No mention of PWA manifest or app icons beyond the default Vite favicon.

---

## TESTING GAPS

- [ ] **No E2E tests** — Full user workflows (paste cURL -> parse -> edit -> generate code -> download) not validated end-to-end.
- [ ] **No visual regression tests** — Theme switching (light/dark), responsive breakpoints, dialog rendering untested visually.

---

## NEW FEATURE SUGGESTIONS

- [ ] **Import from Postman/OpenAPI** — Accept Postman collection JSON or OpenAPI/Swagger spec and convert to cURL, then to code.
- [ ] **Diff view for edits** — Show a side-by-side or inline diff of original vs. edited parsed data before generating code.
- [ ] **Batch cURL processing** — Parse multiple cURL commands at once (one per line or from a file) and generate a test suite with multiple `@Test` methods.
- [ ] **Request preview / dry-run** — Before generating code, show a visual preview of what the HTTP request will look like (method, URL, headers table, body formatted).
- [ ] **Keyboard shortcuts panel** — Add a `?` shortcut that shows all available keyboard shortcuts in a modal.
- [ ] **cURL command builder (reverse direction)** — Let users visually build an HTTP request and generate the equivalent cURL command.
