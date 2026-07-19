# Stable and Development Railway Deployment Plan

Status: proposed phased plan

Date: 2026-07-18

## Outcome

PhaserForge will have two independently deployable release channels:

- Stable Pages frontend → stable Railway API → stable database
- Development Pages frontend → development Railway API → development database

The stable channel will not be exposed to development API changes, test data, migrations, or configuration. Development work may deploy frequently and may use disposable or resettable data without risking production users.

The root Pages URL remains a redirect/landing surface; it must not become a third editor deployment.

## Current gap

- `.github/workflows/deploy-frontend-pages.yml` builds `/dev/` on normal successful `main` deployments and promotes `/stable/` manually.
- Both frontend builds currently receive the same `VITE_API_BASE_URL` repository variable.
- `railway.toml` defines one Railway service and health check, but the repository has no Railway deployment workflow.
- Development cloud persistence is disabled by default, which limits accidental development writes but does not provide API or database isolation.
- The archived Railway plan describes a deployment workflow but is historical context, not an active implementation contract.

## Guiding decisions

1. Separate environments at the Railway service/database boundary, not only through frontend labels.
2. Stable deploys are explicit promotions; development deploys can follow successful development-channel CI.
3. Database migrations are forward-compatible and are applied before application code that requires them.
4. Stable and development credentials, OAuth callbacks, CORS origins, cookies, secrets, and API URLs are separate.
5. No production data is copied into development unless an explicit sanitized fixture process is later approved.
6. Every deployment has a health check and a post-deploy smoke check.

7. Use a hybrid configuration boundary:
   - Repository code owns shared deployment behavior: `railway.toml`, build/start commands, migration ordering, health checks, the Railway CLI workflow, and stable/development promotion rules.
   - Railway and GitHub dashboard configuration owns environment-specific infrastructure: services, databases, domains, secrets, URLs, OAuth credentials, cookie/proxy values, deployment identifiers, and approval protections.
   - Do not store Railway tokens, database URLs, OAuth secrets, or environment-specific public URLs in the repository.
8. Use GitHub Actions as the single deployment trigger for these services. Disable Railway dashboard auto-deploys after the CI workflow is connected so dashboard and CI deployments cannot race or deploy different refs unexpectedly.
9. A separate `development` environment inside the existing Railway project is the practical default. It must contain a separate API service and separate Postgres service. A separate Railway project is an optional stronger-isolation choice when access controls or billing make that worthwhile. Either setup may safely connect to the same `bcorfman/phaserforge` GitHub repository because Railway services have independent deployment and variable state. Do not leave auto-deploy enabled on either service; the collision to avoid is two services independently auto-deploying the same branch, not sharing the repository itself.

## Phase 0 — Inventory and environment contract

Goal: establish the external resources and names before changing deployment automation.

- [ ] Confirm the current Railway project, service name, public domain, deployment source, branch, variables, database attachment, and custom domain configuration.
- [ ] Create a separate `development` environment under the existing Railway project, then create a separate API service and Postgres database inside it. A separate Railway project is optional for stronger access/billing isolation; connecting either setup to the same GitHub repository is safe when auto-deploy is disabled.
- [ ] Reserve canonical URLs, for example:
  - `https://phaserforge-api-production.up.railway.app`
  - `https://phaserforge-api-dev.up.railway.app`
- [ ] Define the frontend URLs:
  - `https://bcorfman.github.io/phaserforge/stable/`
  - `https://bcorfman.github.io/phaserforge/dev/`
- [ ] Define an environment-variable matrix for API URLs, CORS, OAuth, cookie policy, database URLs, and deployment secrets.
- [ ] Record which existing Railway service/database is production and preserve it as the stable environment.
- [ ] Confirm Railway dashboard auto-deploy is disabled for both services once the GitHub Actions deploy workflow is enabled.

Exit criteria:

- Stable resources are identified and no production resource will be repurposed destructively.
- The dev environment can be created without sharing its database or secrets with stable.

## Phase 1 — Create and prove the Railway development environment

Goal: create a working dev backend without changing stable behavior.

- [ ] Create the development Railway service from the same repository and configure it to deploy the intended development branch or deployment ref.
- [ ] Attach a separate development Postgres database.
- [ ] Configure development-only values for `PUBLIC_BASE_URL`, `FRONTEND_BASE_URL`, `CORS_ALLOW_ORIGINS`, `COOKIE_SAMESITE`, `COOKIE_SECURE`, `TRUST_PROXY`, session settings, and OAuth callback URLs.
- [ ] Use separate GitHub OAuth credentials/app callback configuration if GitHub login is enabled in development.
- [ ] Run migrations against the empty development database.
- [ ] Verify `/api/v1/health`, auth, session persistence, CSRF, CORS, and basic cloud-game CRUD against the dev service.
- [ ] Confirm no development request can resolve to the stable database or stable OAuth callback.
- [ ] Configure the development Railway service's source/ref and environment-specific variables in the dashboard; keep shared build/start/health behavior in `railway.toml`.

Exit criteria:

- Dev Railway health is green.
- A test account and test game can be created and deleted in dev.
- Stable API health and an existing stable account/game remain unaffected.

## Phase 2 — Make the frontend environment-aware

Goal: ensure each Pages channel targets the correct Railway environment.

- [x] Add explicit build variables for stable and development API bases rather than relying on one shared `VITE_API_BASE_URL` value.
- [x] Update the Pages workflow so `/dev/` receives the development API URL and `/stable/` receives the stable API URL.
- [x] Preserve channel-scoped browser storage and the existing default that disables development cloud persistence until the dev backend is verified.
- [x] Ensure OAuth start links and callback return paths are correct for `/dev/` and `/stable/` (existing callback-path tests remain green; the build keeps each channel's `BASE_URL`).
- [x] Add tests for build-channel-to-API configuration and reject missing/ambiguous production configuration where practical.
- [x] Update deployment/troubleshooting documentation with the two environment URLs and the data-isolation rule.

Exit criteria:

- The built dev bundle contains only the dev API base.
- The built stable bundle contains only the stable API base.
- Browser requests, OAuth redirects, cookies, and cloud persistence are isolated by environment.

## Phase 3 — Add CI-gated Railway deployments

Goal: make Railway deployment reproducible, auditable, and aligned with the Pages release model.

- [x] Add `.github/workflows/deploy-backend-railway.yml` or an equivalent environment-aware workflow.
- [x] Gate automatic dev deployment on successful CI for the development deployment ref.
- [x] Make stable deployment an explicit promotion from a known commit or release tag after the corresponding frontend promotion.
- [ ] Use GitHub environment protections for stable deployment approval and stable secrets.
- [ ] Store the Railway project/environment/service identifiers and token in the corresponding GitHub environment, not in repository files.
- [ ] Disable Railway dashboard auto-deploys so GitHub Actions remains the only deployment trigger.
- [x] Deploy with the Railway CLI or the configured Railway integration; do not depend on undocumented dashboard-only behavior.
- [x] Run the Railway health check after deployment and fail the workflow if it does not become healthy.
- [x] Capture the deployed commit/environment in workflow logs or a small version endpoint/response.
- [x] Ensure migrations run in a controlled step before starting the server, with a single migration runner per environment.

Exit criteria:

- A dev deployment can be reproduced from CI and reports its commit/environment.
- Stable deployment requires an explicit promotion and cannot be triggered accidentally by a dev change.
- Failed health checks fail the deployment and leave the previous healthy service available where Railway supports rollback.

## Phase 4 — Migration and compatibility hardening

Goal: prevent backend changes from breaking the stable channel during normal development.

- [x] Audit the current migration/start command behavior in `package.json`, Prisma configuration, and server startup.
- [ ] Adopt expand/ migrate/ contract sequencing for schema changes:
  - add nullable or additive schema first;
  - deploy code that supports old and new shapes;
  - backfill or migrate data;
  - remove old fields only after stable has moved past the compatibility window.
- [x] Add API contract tests for health, auth, sessions, CORS, cloud games, and publish-related endpoints used by both channels (covered by the existing server suites, with channel-origin isolation tightened in `tests/server/auth.test.ts`).
- [x] Add a smoke test that verifies stable and dev API origins are not interchangeable (server CORS isolation test added; deployed cross-channel smoke remains in Phase 5).
- [x] Document rollback requirements for application-only deploys and for migrations that cannot be reversed.

Exit criteria:

- A development API migration can be tested without touching stable data.
- Stable promotion has a documented compatibility and rollback path.

## Phase 5 — End-to-end channel verification and cutover

Goal: prove the complete user-visible topology before treating the split as operational.

- [x] Run unit/server tests for settings, CORS, cookies, OAuth return paths, migrations, and deployment helpers.
- [x] Run the required local Chromium smoke suite for frontend/editor changes (not applicable: this implementation did not change `src/editor/**`, `src/App.tsx`, or `src/phaser/EditorScene.ts`).
  `npm run test:e2e -- --project=chromium --grep @smoke`
- [ ] Run deployed smoke checks against both channels:
  - load the correct frontend bundle;
  - verify `/api/v1/health` through the intended API;
  - sign up/log in with environment-specific test accounts;
  - create, reload, update, and delete a cloud project;
  - verify OAuth callback and return path if enabled;
  - confirm stable data is absent from dev and dev data is absent from stable.
- [ ] Verify a dev backend deploy changes `/dev/` behavior without changing `/stable/`.
- [ ] Verify a stable promotion changes both stable frontend/backend only when explicitly requested.
- [ ] Add monitoring/alert ownership for both Railway services and document the rollback commands.

Definition of done:

- Stable and dev frontends point to separate Railway APIs.
- Stable and dev APIs use separate databases and environment secrets.
- CI deploys dev predictably and stable only through explicit promotion.
- Cross-channel auth, cookies, OAuth, CORS, and cloud persistence are tested.
- A failed dev deployment cannot take down or mutate stable.
- Documentation and repository memory reflect the final deployment contract.

## Follow-up, if needed

- Add preview environments for pull requests only after stable/dev isolation is reliable.
- Add database backup/restore drills for stable.
- Add automated synthetic checks for both public frontend/API pairs.
- Consider a release manifest tying the stable Pages commit, Railway commit, and migration level together.
