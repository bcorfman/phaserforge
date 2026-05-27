# Test Deploy: GitHub Pages (Frontend) + Railway (Backend) with Sessions

Goal: deploy a test/staging version ASAP where the frontend is hosted on GitHub Pages and the API/auth backend is hosted on Railway, with cookie-backed sessions working cross-origin.

Concrete URLs for this plan:
- Frontend (GitHub Pages): `https://bcorfman.github.io/phaserforge`
- Backend (Railway): `https://phaseractions-studio-production.up.railway.app`

## Summary
- Add a GitHub Actions workflow to deploy `dist/` to GitHub Pages on green `main`.
- Make the frontend configurable for a remote API base URL (Pages → Railway) so `/api/...` calls work outside local dev.
- Configure backend cookies for cross-site credentialed requests (Pages and Railway are different origins), and redirect GitHub OAuth back to the Pages frontend.
- Set required Railway env vars for CORS, cookies, proxying, database, and OAuth.
- Verify with unit tests + required Chromium smoke E2E (GUI touched).

## Implementation changes

### 1) Frontend: API base URL + OAuth start URL
Problem:
- `src/cloud/api.ts` currently calls `fetch('/api/...')`, which only works when the frontend and backend are same-origin or when dev proxying is in place (Vite `server.proxy`).
- `src/editor/CloudAccountPanel.tsx` hardcodes `href="/api/v1/auth/github/start?returnTo=/"`, which also only works same-origin.

Change:
- Introduce a build-time env var `VITE_API_BASE_URL` (example: `https://phaseractions-studio-production.up.railway.app`).
- Update `src/cloud/api.ts` to build absolute request URLs:
  - `const base = import.meta.env.VITE_API_BASE_URL ?? ''`
  - `const url = new URL(path, base).toString()`
  - `fetch(url, { credentials: 'include', ... })`
  - Keep headers behavior unchanged, but ensure the `content-type` header is only added when `init.body` exists (current behavior is fine).
- Update `src/editor/CloudAccountPanel.tsx` GitHub button:
  - Replace `href="/api/v1/auth/github/start?returnTo=/"` with:
    - `const apiBase = import.meta.env.VITE_API_BASE_URL`
    - `const returnTo = import.meta.env.BASE_URL` (Vite base path; for project pages this will be `/phaserforge/` at runtime)
    - `href=\`\${apiBase}/api/v1/auth/github/start?returnTo=\${encodeURIComponent(returnTo)}\``

Acceptance criteria:
- When opened from Pages, the browser requests go to `https://phaseractions-studio-production.up.railway.app/api/...`.
- Clicking “Login with GitHub” initiates OAuth via the Railway backend and returns to the Pages frontend.

### 2) Backend: cross-site cookies + OAuth redirect to frontend
Problem:
- Current cookies are set with `sameSite: 'lax'`. Cross-origin `fetch(..., { credentials: 'include' })` generally requires cookies to be `SameSite=None; Secure`.
- OAuth callback currently redirects to `returnTo` as a relative path on the backend origin; we need to redirect the browser back to the Pages frontend origin.

Change settings contract (server):
- Extend `server/src/settings.ts`:
  - Add `cookieSameSite: 'lax' | 'none'` from env `COOKIE_SAMESITE` (default `'lax'`).
  - Add `frontendBaseUrl?: string` from env `FRONTEND_BASE_URL` (required when GitHub OAuth is enabled; also required when `cookieSameSite='none'` for cross-site deploy).

Change cookie options:
- Update cookie writes in:
  - `server/src/server/services/authService.ts` (session cookie)
  - `server/src/server/routes/auth.ts` (csrf cookie, oauth state cookie, return-to cookie)
- Cookie policy:
  - If `cookieSameSite === 'none'`:
    - set `sameSite: 'none'`
    - set `secure: true` (ignore `COOKIE_SECURE` env and hard-require secure in this mode)
  - Else:
    - keep `sameSite: 'lax'`
    - set `secure: settings.cookieSecure` (existing behavior)
- Keep `httpOnly` unchanged per cookie type (csrf cookie must stay readable by JS; session and oauth state must remain `httpOnly`).

OAuth redirect policy (decision-complete):
- `GET /api/v1/auth/github/start?returnTo=<path>`
  - `returnTo` must be a string starting with `/`.
  - Store this path as today (cookie).
- `GET /api/v1/auth/github/callback`
  - After session creation, redirect to `new URL(returnToPath, settings.frontendBaseUrl).toString()`.
  - Validate `settings.frontendBaseUrl` is configured; if missing, return `400 { error: 'oauth_not_configured' }`.
  - Validate that the final redirect URL’s origin equals the configured `FRONTEND_BASE_URL` origin (prevents open redirect); if mismatch, redirect to the frontend base URL root path instead.

Acceptance criteria:
- From Pages origin, `fetch(..., { credentials: 'include' })` persists the session cookie on the Railway origin, and subsequent `/api/v1/auth/me` returns the logged-in user.
- OAuth completes and lands back on `https://bcorfman.github.io/phaserforge/` without manual navigation.

### 3) Backend: CORS allowlist + proxy correctness
Problem:
- Credentialed cross-origin requests require:
  - `Access-Control-Allow-Origin: <exact origin>` (not `*`)
  - `Access-Control-Allow-Credentials: true`
- Cookies marked `Secure` behind Railway require correct proxy settings.

Change:
- No code changes required if env is set correctly; confirm the policy is implemented by `corsAllowlistMiddleware` in `server/src/server/app.ts`.
- On Railway set:
  - `CORS_ALLOW_ORIGINS=https://bcorfman.github.io`
  - `TRUST_PROXY=true`

Acceptance criteria:
- Browser preflight/OPTIONS succeeds.
- Actual API requests include cookies and succeed without CORS errors.

### 4) GitHub Actions: deploy frontend to Pages on green main
Add a new workflow `.github/workflows/deploy-frontend-pages.yml`:
- Triggers:
  - `workflow_run` on “PhaserForge CI” `completed`, gated to:
    - conclusion `success`
    - event `push`
    - branch `main`
    - same repo
  - `workflow_dispatch`
- Permissions:
  - `contents: read`
  - `pages: write`
  - `id-token: write`
- Steps:
  - checkout `main`
  - setup node `24` with npm cache
  - `npm ci`
  - build:
    - `VITE_API_BASE_URL=https://phaseractions-studio-production.up.railway.app npm run build`
  - upload `dist/` as Pages artifact
  - deploy with `actions/deploy-pages`

GitHub repository settings:
- Settings → Pages → Source: **GitHub Actions**.
- Settings → Actions → Variables:
  - `VITE_API_BASE_URL=https://phaseractions-studio-production.up.railway.app`

Acceptance criteria:
- A push to `main` that passes CI produces a Pages deployment at `https://bcorfman.github.io/phaserforge`.

### 5) Railway: required env vars for this deployment
Set these Railway service variables (exact values):
- `PUBLIC_BASE_URL=https://phaseractions-studio-production.up.railway.app`
- `FRONTEND_BASE_URL=https://bcorfman.github.io/phaserforge`
- `CORS_ALLOW_ORIGINS=https://bcorfman.github.io`
- `COOKIE_SAMESITE=none`
- `TRUST_PROXY=true`
- `DATABASE_URL` (Railway Postgres plugin should provide this automatically)
- GitHub OAuth (if enabling GitHub login):
  - `GITHUB_CLIENT_ID=<from GitHub OAuth app>`
  - `GITHUB_CLIENT_SECRET=<from GitHub OAuth app>`

Notes:
- Do not set `COOKIE_DOMAIN` for this pairing; let the cookie be scoped to the Railway host only.
- With `COOKIE_SAMESITE=none`, the implementation hard-requires `secure: true` for cookies (HTTPS).

### 6) GitHub OAuth app: callback URL
Configure GitHub OAuth app:
- Callback URL: `https://phaseractions-studio-production.up.railway.app/api/v1/auth/github/callback`

## Test plan (must be non-flaky)
Because frontend UI files will be touched (`src/editor/**`), run:
- Unit tests: `npm run test:unit`
- Local E2E smoke (Chromium only): `npm run test:e2e -- --project=chromium --grep @smoke`

Manual deployed smoke:
1) Open `https://bcorfman.github.io/phaserforge`
2) In Cloud panel:
   - Click “Log in” with a known password account; confirm it stays logged in after refresh.
   - Create/save a cloud game; refresh; confirm it still lists.
   - Log out; refresh; confirm signed out.
3) GitHub OAuth:
   - Click “Login with GitHub”; approve; confirm you land back on Pages and are signed in.

## Definition of done
- GitHub Pages deploy workflow exists and successfully deploys on green `main`.
- Railway backend accepts credentialed cross-origin requests from `https://bcorfman.github.io`.
- Sessions persist and `me/games` APIs work from the Pages frontend.
- Unit + Chromium smoke E2E pass with zero flakes.

