# Hosted Deployment Validation Harness Implementation Plan

Status: proposed

Date: 2026-07-27

## Outcome

Extend the PhaserForge repair harness with a separately approved hosted
deployment-validation adapter. The adapter will validate the deployed
development and stable environments through the real GitHub Pages browser
origin and Railway APIs, while keeping remote mutations limited to explicitly
scoped disposable test data.

The adapter is a validation and diagnosis tool. It must not deploy, promote,
change secrets, alter GitHub configuration, or repair remote state
automatically.

## Original validation workflow

The first supported scenario is:

- Development frontend: `https://bcorfman.github.io/phaserforge/dev/`
- Development API: `https://phaserforge-development.up.railway.app`
- Stable API: `https://phaserforge-production.up.railway.app`

These URLs must remain configurable. The implementation must use the actual
configured public domains rather than assuming these defaults.

The adapter will validate:

1. Development API health and deployment channel/version.
2. Development frontend API routing through the real Pages origin.
3. Login/signup, reload persistence, project create/update/list/delete.
4. CSRF, CORS, and cross-site cookie behavior in a real browser.
5. Isolation between development and stable environments.
6. GitHub OAuth callback routing when OAuth is explicitly enabled.

## Non-goals and authority boundary

- No deploy, rollback, promotion, migration, secret, or workflow mutation.
- No use of the production database cleanup script.
- No reuse of a personal account or existing user-owned project.
- No automatic creation of long-lived accounts.
- No OAuth credential storage or automated provider authorization.
- No assumption that a passing hosted check authorizes a release.
- No editor UI, dashboard, or SVG mockup.

The adapter must stop when credentials, cleanup capability, environment
identity, or expected deployment metadata is missing.

## Proposed layout

Keep the adapter under the existing harness directory:

```text
scripts/repair-harness/
  hosted/
    config.ts          # URL, expected channel, and safety validation
    probes.ts          # health/version/CORS response checks
    browser.ts         # real-origin Playwright lifecycle checks
    accounts.ts        # disposable-account contract and cleanup
    isolation.ts       # dev/stable record separation checks
    oauth.ts           # optional callback-host validation
    run.ts             # bounded adapter orchestration
    evidence.ts        # redacted hosted evidence envelope
    __tests__/
      ...
```

Use the existing run directory contract:

```text
.repair-harness/runs/<run-id>/
  hosted-config.json       # redacted, non-secret configuration
  hosted-evidence.json     # normalized result envelope
  hosted-events.jsonl      # redacted step outcomes
  hosted-browser/          # screenshots/traces only when explicitly enabled
  hosted-summary.md
```

Never persist passwords, session cookies, authorization headers, CSRF values,
OAuth codes, database URLs, or raw response bodies containing credentials.

## Configuration and safety contract

Add a validated configuration contract rather than reading arbitrary
environment variables throughout the adapter:

```text
HOSTED_DEV_FRONTEND_URL       required
HOSTED_DEV_API_URL            required
HOSTED_STABLE_FRONTEND_URL    required for isolation checks
HOSTED_STABLE_API_URL         required for isolation checks
HOSTED_EXPECTED_DEV_CHANNEL   defaults to dev
HOSTED_EXPECTED_STABLE_CHANNEL defaults to stable
HOSTED_EXPECTED_DEV_COMMIT    optional, recommended for deployment checks
HOSTED_EXPECTED_STABLE_COMMIT optional, recommended for deployment checks
HOSTED_TEST_ACCOUNT_PROVIDER  required: external/manual/fixture
HOSTED_ALLOW_MUTATIONS        explicit opt-in; defaults to false
HOSTED_ALLOW_OAUTH            explicit opt-in; defaults to false
```

Before any mutation, validate that:

- frontend and API URLs are HTTPS;
- dev and stable API origins are distinct;
- configured API hosts match an explicit allowlist or approved config file;
- test data uses a generated run-specific marker;
- mutation mode is explicitly enabled;
- cleanup is available and has been tested before the first mutation;
- the run has a bounded timeout and one cleanup attempt per created resource.

The default mode is read-only deployment probing. Browser lifecycle and
isolation mutations require an explicit flag such as
`--allow-hosted-mutations`.

## Phase 1 — Read-only deployment probes

- [ ] Add configuration parsing and safety validation tests.
- [ ] Implement `GET /api/v1/health` checks with status, JSON shape, and
  bounded response timing.
- [ ] Implement `GET /api/v1/version` checks for expected channel and optional
  commit.
- [ ] Record sanitized status, headers, timing, and mismatch reasons.
- [ ] Redact response bodies to approved fields only.
- [ ] Add a CLI command such as:
  `npm run repair:ci -- hosted-probe --config <path>`.
- [ ] Classify DNS, TLS, timeout, 5xx, wrong-channel, and wrong-commit cases
  distinctly as deployment/infrastructure evidence.

Exit criteria:

- A read-only run can distinguish an unhealthy API from a healthy API serving
  the wrong channel or commit.
- No credentials or unrestricted response bodies enter the run directory.

## Phase 2 — Real-origin browser smoke

- [ ] Add a Playwright adapter using the repository's installed Chromium.
- [ ] Open the configured development Pages frontend, not the local dev
  server.
- [ ] Assert that API requests target the configured development API origin.
- [ ] Capture request failures, console errors, final URL, and approved
  response metadata without storing cookie values or auth headers.
- [ ] Add read-only checks for app load, API reachability, and unauthenticated
  state.
- [ ] Add a separate explicit mutation mode for login/signup, project CRUD,
  and reload persistence.
- [ ] Use run-specific project names such as
  `REPAIR-HARNESS-DEV-<run-id>`.
- [ ] Assert that reload preserves authentication and the updated project.

Exit criteria:

- The browser test proves the actual Pages-to-Railway origin and cookie path.
- Mutation mode cannot run accidentally from ordinary repair or probe commands.

## Phase 3 — Security and lifecycle assertions

- [ ] Assert that the CSRF request sets the expected cookie name without
  recording its value.
- [ ] Assert that authenticated writes send the CSRF header while omitting the
  header value from evidence.
- [ ] Assert CORS allows the configured Pages origin and does not silently
  broaden to an unsafe wildcard for credentialed requests.
- [ ] Assert session and CSRF cookies have `Secure` and the configured
  cross-site policy in hosted mode.
- [ ] Verify create, update, reload, list, and delete behavior with a
  disposable account.
- [ ] Make cleanup run in a `finally` path and record cleanup success/failure.
- [ ] Stop with `cleanup-required` if deletion cannot be confirmed.

Exit criteria:

- Every remote resource created by a run has a recorded cleanup result.
- A failed assertion cannot be reported as a clean run when cleanup failed.

## Phase 4 — Dev/stable isolation

- [ ] Require separate explicitly configured dev and stable test accounts.
- [ ] Create a uniquely marked development project and verify it is absent
  from stable.
- [ ] Create a uniquely marked stable project and verify it is absent from dev.
- [ ] Delete both records and verify absence after deletion.
- [ ] Record only project markers, ownership-independent IDs if safe, and
  boolean presence results.
- [ ] Add tests preventing accidental use of the same account or same API
  origin for both sides of the isolation check.

Exit criteria:

- The adapter proves both directions of isolation without broad database
  access or destructive cleanup.

## Phase 5 — Optional OAuth and bounded operations

- [ ] Add an opt-in OAuth preflight that checks the configured callback host
  and expected dev/stable redirect configuration without completing a real
  provider authorization.
- [ ] Require a human-provided/manual OAuth checkpoint for any live login.
- [ ] Integrate hosted evidence with the existing redaction, state, event,
  metrics, and summary contracts.
- [ ] Enforce a separate hosted timeout, browser count, mutation count, and
  cleanup budget.
- [ ] Add `--dry-run`, `--no-agent`, and explicit hosted-scope validation.
- [ ] Ensure the Codex repair path cannot invoke hosted mutation commands.

Exit criteria:

- Hosted validation is auditable and bounded independently of local CI repair.
- A hosted failure produces evidence and a recommended next diagnostic step,
  never an automatic remote repair.

## Test strategy

### Pure tests

- URL/allowlist validation and environment identity checks.
- Channel/version response parsing.
- Header redaction and approved-field response projection.
- Failure classification and timeout handling.
- Mutation and cleanup state transitions.
- Isolation marker generation and comparison.

### Browser/integration tests

- Use mocked HTTP fixtures for CSRF, CORS, cookies, auth, and CRUD contract
  tests.
- Use a controlled local HTTPS or Playwright route fixture for browser-origin
  behavior; do not make normal unit tests depend on Railway or Pages.
- Add a separately labeled live smoke command that requires explicit config and
  mutation approval.
- Preserve one deliberately failing fixture for wrong channel, wrong origin,
  cleanup failure, and cross-environment leakage.

### Verification

- `npm run test:unit:node`
- Focused harness tests for every new helper and policy.
- Browser adapter tests with controlled fixtures.
- Live read-only probe against configured environments when credentials and
  deployment URLs are available.
- Live mutation/isolation run only as a manual acceptance step with disposable
  accounts and confirmed cleanup.

## Operational prerequisites

- Current public Pages and Railway URLs for both channels.
- A documented way to provision disposable dev and stable test accounts, or a
  human-operated account provider with no password persistence.
- Permission to create and delete only the adapter's test records.
- A confirmed cleanup path and an owner for cleanup failures.
- Chromium installed locally.
- Explicit approval for live hosted mutations.

## Rollout and acceptance

1. Land read-only probes and fixture tests.
2. Run probes against dev and stable deployment URLs.
3. Add real-origin read-only browser checks.
4. Run one manually supervised disposable-account lifecycle test.
5. Run the two-sided isolation test and inspect all cleanup evidence.
6. Operate on several real deployment incidents before considering the adapter
   generally reliable.

Do not add the hosted adapter to the default repair path until cleanup,
environment identity, and secret-redaction checks have passed repeated manual
acceptance.

## SVG/mockup decision

No SVG mockups are needed. The work introduces no editor workflow, visual
surface, or dashboard. The relevant contracts are CLI arguments, browser
assertions, run artifacts, and safety policy.
