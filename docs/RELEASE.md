# Release runbook

CurlCraft is two deployments that must be released in order: the **backend** (Render) and the
**frontend** (Vercel). The backend is always released first, because the frontend calls it and the
backend must keep working with the frontend that is already live.

Compatibility rule: the backend must work with the **previous** frontend as well as the new one, and the
new frontend must work with the **previous** backend. If a change breaks either direction, split it.

## 0. Before you start

- CI is green on the release commit of both repositories (`verify`, `e2e`, `perf-bundle` jobs). The
  `live-e2e` job is optional; if it ran, check its result too.
- The release has been tested on PreProd (backend) and on the frontend's preprod deployment.
- The frontend `check:docs` gate passes (`npm run check:docs`), which means the README and env
  variables agree with the code.

## 1. Backend (`cURL-to-Code-Convertor-BackEnd`)

1. **PR into PreProd.** Open a pull request from the feature branch into `PreProd` and merge it after
   review. Pytest with the 90% coverage gate must pass.
2. **PreProd.** Check that the PreProd service on Render is running the merged commit. Verify:
   - `GET /api/health` answers 200.
   - `POST /api/parse` with a sample cURL returns `success: true`.
   - A request from the preprod frontend origin is accepted by CORS.
3. **Production / V0.1 (manual deploy on Render).** Deploy the release commit to the Production service
   from the `Production/V0.1` branch. Auto-deploy must be **off**. Confirm the service settings:
   - Runtime: Python **3.11** (`.python-version` in the backend repo is `3.11.9`).
   - `ENVIRONMENT=production`. In production, the app refuses to start without `ALLOWED_ORIGINS`.
   - `ALLOWED_ORIGINS`: a comma-separated list of the production frontend origin and the preprod origin
     (the origins are matched exactly, without a trailing slash). `ALLOWED_ORIGIN_REGEX` can match
     Vercel preview URLs.
   - Feedback storage (optional but expected in production): `GOOGLE_SHEETS_ID`,
     `GOOGLE_SHEETS_TAB_NAME` (default `Feedback`), and either `GOOGLE_CREDENTIALS_JSON` or
     `GOOGLE_CREDENTIALS_PATH`. Without them, feedback is not stored.
   - Start command and health check as in the backend repository.
   - Known gap: the backend's `render.yaml` still names `Test/V0.1` with `autoDeploy: true`. The Render
     dashboard is the source of truth for this service until `render.yaml` is corrected. Check the
     dashboard, not the file.
4. **Verify production.** `GET /api/health`, one `POST /api/parse`, one `POST /api/generate-from-parsed`,
   and a request from the production frontend origin. Confirm a request from an unlisted origin is rejected.

## 2. Frontend (`curl-to-code-convertor-frontend`)

Vercel builds the **`preprod`** branch as the production deployment. The build runs in production mode
and refuses to run without a valid backend URL.

1. **Vercel environment variables.** Set `VITE_CURL_CRAFT_API_URL` to the public `https://` URL of the
   production backend, in **both** the **Production** and **Preview** scopes. Without it in Preview, preview
   builds fail. `VITE_CURL_CRAFT_API_HEALTH_ENDPOINT` should be set to the backend's health path
   (`/health`, or `/api/health`) in Production so the status chip polls the right route.
   Never put a secret in a `VITE_*` variable.
2. **Merge into preprod.** Merge `release/3.0` into `preprod` with a merge commit titled
   `take release/3.0`. Vercel builds it as the production deployment.
3. **Verify.** On the new deployment: the status chip reaches "Generator ready", a cURL parses in the
   Playground, batch parsing works, and code generation works end to end.
4. **Merge into master.** Once verified, merge the same release into `master` with a merge commit titled
   `take release/3.0`.

## 3. Rollback

Roll back in the **reverse** order: frontend first, then backend. The new backend was compatible with the
old frontend, so reverting the frontend first is always safe. Reverting the backend while the new frontend
is live is not.

1. **Frontend.** In Vercel, open the previous production deployment and promote it to Production. This
   is instant and needs no rebuild. Confirm the old app loads and parses a cURL.
2. **Backend.** In Render, redeploy the previous commit of the Production service (Manual Deploy, choose
   the earlier commit). Then repeat the checks from step 1.4.
3. **Record.** Note the rolled-back commits and the reason, and open a fix PR against the release branch.

Do not roll the backend back past a change that the frontend still depends on. Check the release notes for
the API contract before a backend-only rollback.
