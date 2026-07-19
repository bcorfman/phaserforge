# Stable and development deployment

PhaserForge has two release channels:

- `/stable/` → the stable Pages bundle → the stable Railway API and database
- `/dev/` → the development Pages bundle → the development Railway API and database

Never point both Pages channels at the same Railway database. Development data and credentials must remain disposable and separate from stable data.

## GitHub configuration

In **Repository → Settings → Secrets and variables → Actions → Variables**, create:

- `VITE_API_BASE_URL_DEV`: the public development Railway URL
- `VITE_API_BASE_URL_STABLE`: the public stable Railway URL

Delete the old shared `VITE_API_BASE_URL` variable after both new variables are present. A normal successful `main` CI run deploys `/dev/`; a stable Pages deployment is an explicit `workflow_dispatch` promotion.

These two `VITE_API_BASE_URL_*` variables intentionally remain repository-level variables. The Pages workflow builds both channel artifacts in one job: it needs the development URL while building `/dev/` and the stable URL while building `/stable/`. Vite embeds these values into static JavaScript at build time; Railway environment variables are not available to the published browser bundle. By contrast, `RAILWAY_PUBLIC_URL` is used by one backend deployment job at a time, so it is correctly configured as the same variable name with different values in the GitHub `development` and `stable` environments.

For the Railway workflow, configure the GitHub environments named exactly `phaserforge / development` and protected `phaserforge / production`. Add `RAILWAY_TOKEN` as an environment secret to each environment, using that environment's resources. Add the non-sensitive Railway IDs as environment variables:

- `RAILWAY_PROJECT_ID`
- `RAILWAY_ENVIRONMENT_ID`
- `RAILWAY_SERVICE_ID`

Add `RAILWAY_PUBLIC_URL` as an environment variable in each GitHub environment. Production should require reviewers before a deployment job can start.

## Railway dashboard configuration

For each service, open **Variables** and set the environment-specific values:

```text
PUBLIC_BASE_URL=https://<this-service-domain>
FRONTEND_BASE_URL=https://bcorfman.github.io/phaserforge/<channel>/
CORS_ALLOW_ORIGINS=https://bcorfman.github.io
COOKIE_SAMESITE=none
COOKIE_SECURE=true
TRUST_PROXY=true
DEPLOY_CHANNEL=<dev-or-stable>
```

Attach a separate Postgres service to each environment so `DATABASE_URL` is supplied by that environment's database. Configure separate GitHub OAuth apps/callbacks if OAuth is enabled. The callback is:

```text
https://<this-service-domain>/api/v1/auth/github/callback
```

In **Settings → Networking**, confirm the public domain and copy it into `PUBLIC_BASE_URL`, the matching GitHub Actions variable, and the matching Pages build variable. In **Deploy**, confirm the repository, branch/ref, and the healthcheck path `/api/v1/health` from `railway.toml`.

## Verification

After each deployment, check:

```text
GET <service-domain>/api/v1/health  → {"status":"ok"}
GET <service-domain>/api/v1/version → the expected channel and commit
```

Then use an environment-specific test account to create and delete a test game. Do not copy stable production data into development without an approved sanitized-fixture process.

## Migration and rollback rules

Use expand/migrate/contract sequencing for schema changes:

1. Add nullable or additive fields.
2. Deploy code that works with both old and new shapes.
3. Run the forward migration or backfill.
4. Remove old fields only after stable has passed the compatibility window.

Application-only rollback should redeploy the last known-good commit through the same channel workflow. Treat destructive or irreversible migrations as a separate release: restore stable from its Railway backup or apply a documented forward repair before attempting an application rollback. Never point a rollback at the other channel's database.

Keep the previous healthy Railway deployment available until the post-deploy health and smoke checks pass. Record the Pages commit, Railway commit, and migration level together when promoting stable.
