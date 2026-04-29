# Railway Postgres Backend (Accounts + Cloud Game Saves)

## Summary
Add an authenticated backend (Railway + Postgres) so each user can create an account (password and optional social login) and save their own games online under that account. This is the “server features” layer referenced by `game-only-web-player.md`; user demos remain static/user-hosted.

This plan is modeled after the zorkdemo backend architecture:
- Central **Settings** object from environment
- **App factory** that wires middleware + routes
- Service/Repository layering to keep business logic out of routing
- Migration-first DB lifecycle suitable for Railway deploys

---

## Scope / Non-goals
- In scope: accounts, sessions, private per-user game storage (YAML blobs + metadata).
- Not in scope (v1): public sharing/publishing from the backend, asset hosting/uploads, collaboration, payments.
- Demos/hosting: handled via the export flow in `game-only-web-player.md` (GitHub Pages), not by this backend.

---

## UI/UX Contract (Studio “Cloud” Tab)
The backend must support the studio UI mockup direction:
- Auth identity is **email address** (not username). All auth endpoints and DB fields should treat the primary login identifier as `email`.
- The login UI lives in a **right-side tab** alongside the Inspector:
  - Tab strip: `Inspector` / `Cloud`
  - Cloud tab contains: `Email`, `Password` (masked by default, with an eye/eye-off toggle), buttons `Sign up`, `Log in`, and a full-width `Login with GitHub` button with a GitHub icon.
- Auth-related UI must not live in the top toolbar; the top toolbar should remain compact and focused on editor actions.

---

## Platform: Railway + Postgres

### Railway resources
- **Service:** `phaseractions-api` (Node runtime)
- **Database:** Railway Postgres plugin attached to `phaseractions-api`

### Deployment method (match ZorkDemo)
ZorkDemo deploys its backend from **GitHub Actions** using the **Railway CLI** (`railway up`) with a `RAILWAY_TOKEN` secret and a `RAILWAY_SERVICE` variable. This project should use the same approach:
- Add `.github/workflows/deploy-backend-railway.yml`:
  - Trigger: pushes to `main` when `server/**`, `package.json`, `package-lock.json`, `prisma/**`, or `railway.toml` change, plus `workflow_dispatch`.
  - Steps:
    - Checkout
    - Setup Node (pin Node 24, enable npm cache)
    - Install Railway CLI (`npm install -g @railway/cli`) with retries (as in ZorkDemo)
    - Deploy: `railway up --service \"$RAILWAY_SERVICE\"`
    - Health check: `curl -fsS \"$BACKEND_HEALTHCHECK_URL\"` (optional)
- Add a repo-level GitHub secret:
  - `RAILWAY_TOKEN`
- Add repo-level GitHub variables:
  - `RAILWAY_SERVICE` (Railway service name)
  - `BACKEND_HEALTHCHECK_URL` (optional; e.g. `https://<domain>/api/v1/health`)

#### CI gating requirement (deploy only after CI passes)
To ensure deploys only happen after CI passes:
- Keep your existing CI workflow (or add one) that runs `npm ci` + `npm run test:all`.
- Configure the deploy workflow to gate on CI using one of these patterns:
  1) **`workflow_run` pattern (recommended):**
     - Deploy workflow triggers on `workflow_run` of the CI workflow when the conclusion is `success`.
  2) **`needs:` pattern:**
     - Combine CI + deploy in a single workflow, with deploy job using `needs: [ci]`.

The implementation should use the `workflow_run` approach to mirror “deploy on green main” behavior while keeping workflows separate.

### railway.toml (recommended)
Add a `railway.toml` at the repo root (or service root) to define:
- Builder (`NIXPACKS` is fine on Railway)
- `startCommand` that runs migrations then starts the server
- `healthcheckPath` `/api/v1/health`

### Required environment variables
- `DATABASE_URL` (Railway provides; used by Prisma)
- `CORS_ALLOW_ORIGINS` (comma-separated allowlist; must include studio origin(s) and any hosted studio URL)
- `PUBLIC_BASE_URL` (canonical external https URL of this API service; used for OAuth callbacks)
- `COOKIE_SECURE=true` (production)

### Optional environment variables
- `TRUST_PROXY=true` (recommended on Railway so secure cookies and IP-based rate limiting behave correctly)
- `SESSION_TTL_MS` (default 30 days)
- `COOKIE_NAME` (default `pa_session`)
- `CSRF_COOKIE_NAME` (default `pa_csrf`)
- GitHub OAuth:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`

---

## API: v1 endpoints (browser-focused, cookie sessions)

### Health
- `GET /api/v1/health` → `{ status: "ok" }`

### Auth (password + optional GitHub OAuth)
- `GET /api/v1/auth/csrf`
  - Sets a CSRF cookie (not HttpOnly) and returns `{ csrfToken }` for SPA use.
- `POST /api/v1/auth/signup` `{ email, password }`
- `POST /api/v1/auth/login` `{ email, password }`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me` → `{ user: { id, username } }`
- Optional GitHub OAuth:
  - `GET /api/v1/auth/github/start?returnTo=/...`
  - `GET /api/v1/auth/github/callback`

### Games (all require auth; strictly user-scoped)
- `GET /api/v1/games` → list metadata
- `POST /api/v1/games` `{ title, yaml }` → create
- `GET /api/v1/games/:id` → fetch `{ yaml, ...meta }`
- `PUT /api/v1/games/:id` `{ title?, yaml? }` → update
- `DELETE /api/v1/games/:id` → delete

Request/response validation must be schema-driven (e.g. Zod) with clear error codes.

---

## Database: Prisma schema (Postgres)

### Models
- `User`
  - `id` (string, cuid/uuid)
  - `email` (unique; normalized to lowercase)
  - `passwordHash` (nullable; null for OAuth-only users)
  - `createdAt`
- `OAuthAccount`
  - `id`
  - `userId` (FK → User)
  - `provider` (e.g. `"github"`)
  - `providerAccountId` (e.g. GitHub numeric id)
  - Unique constraint: `(provider, providerAccountId)`
  - `createdAt`
- `Session`
  - `id`
  - `userId` (FK → User)
  - `tokenHash` (unique; SHA-256 hash of random session token)
  - `createdAt`, `expiresAt`, `lastSeenAt`
  - Index: `expiresAt` for cleanup
- `Game`
  - `id`
  - `userId` (FK → User)
  - `title`
  - `yaml` (text)
  - `createdAt`, `updatedAt`
  - Index: `userId`

### Migrations
- Local dev: `prisma migrate dev`
- Railway deploy: `prisma migrate deploy` must run before app start.

---

## Security Requirements (“server features” must be secure)

### Sessions (cookie-based)
- Cookies:
  - Session cookie: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`
  - CSRF cookie: not `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`
- Never store raw session tokens in DB; store only `tokenHash = sha256(token)`.
- Enforce TTL on every request; delete expired sessions when detected.
- Rotate/issue a new session token on login (and optionally on sensitive operations).

### CSRF
- Double-submit token:
  - Require `X-CSRF-Token` header on all non-GET/HEAD/OPTIONS.
  - Compare to CSRF cookie value using constant-time comparison.

### CORS
- Strict allowlist from `CORS_ALLOW_ORIGINS` (no `*` when `credentials: true`).
- `Access-Control-Allow-Credentials: true`.

### Passwords
- Hash with Argon2id (safe parameters).
- Enforce minimum length and reasonable max length.
- Normalize and validate emails (lowercase + trim; require basic email format; enforce max length).

### Rate limiting + abuse controls
- Rate limit auth routes per IP (and optionally per username).
- Rate limit write endpoints (create/update/delete games).
- Add request body size limits (YAML size cap; default 1MB).

### OAuth (GitHub)
- Use `state` anti-CSRF value stored in an HttpOnly cookie.
- Only allow `returnTo` redirects to relative paths (must start with `/`).
- Fetch GitHub profile server-side; map `providerAccountId` to a user.

### Proxy correctness
- Enable `trust proxy` behind Railway (`TRUST_PROXY=true`) so HTTPS scheme and client IP are interpreted correctly.

---

## Architecture (modeled after zorkdemo)

### Settings
- `settings.ts` reads env vars, parses `CORS_ALLOW_ORIGINS`, validates OAuth vars when enabled.

### App factory
- `createApp({ settings, repositories, services })`:
  - Wires: JSON parser limit, cookies, Helmet, CORS, CSRF, rate limiting.
  - Mounts routers under `/api/v1`.
  - Central error handler (no stack traces to clients in prod).

### Repositories
- `UserRepository`, `SessionRepository`, `GameRepository`, `OAuthRepository`
- Repos only talk to Prisma.

### Services
- `AuthService`:
  - signup/login/logout/me, session creation, password hashing/verification, OAuth user linking.
  - Email normalization and duplicate prevention (case-insensitive uniqueness enforced at DB level).
- `GameService`:
  - create/list/get/update/delete; enforces `userId` ownership on every operation.

---

## Test Plan (TDD)

### Unit tests
- Password hashing/verification utilities.
- Token hashing + constant-time compare.
- CSRF middleware behavior (missing/mismatch → 403).
- Auth service:
  - signup success, username taken, invalid inputs
  - login invalid credentials
  - OAuth-only user cannot password-login unless password set (if supported)
- Game service:
  - user isolation (user A cannot access user B’s games)
  - YAML size limit enforced

### Integration tests (recommended)
- Run Prisma migrations against a test Postgres (testcontainers) and hit the API with `supertest`:
  - signup → create game → list → get → update → delete
  - logout invalidates session

---

## Acceptance Criteria
- A user can sign up / log in and remains signed in via session cookie.
- A user can create, list, load, update, and delete games; games are private to that user.
- CSRF is required for all state-changing routes.
- CORS is allowlist-based and supports credentialed requests from the studio origin.
- Railway deployment runs migrations automatically and boots reliably with Postgres.
