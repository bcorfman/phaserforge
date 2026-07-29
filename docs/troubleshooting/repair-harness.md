# CI Repair Harness Quick Start

The repair harness is a local, bounded workflow for investigating PhaserForge
CI failures. It collects redacted evidence, reproduces the relevant command,
and independently verifies a patch. It does not commit, push, merge, deploy,
change GitHub secrets, or modify hosted databases.

## Prerequisites

- Run commands from the PhaserForge repository root.
- Install dependencies with `npm install`.
- Authenticate the GitHub CLI with `gh auth status` when collecting from GitHub.
- Have the repository's required browsers installed for E2E reproduction.
- For hosted validation, have Chromium installed and use only disposable,
  explicitly approved test accounts and records.

## Collect a failed PR job

For a pull request, collect the failing GitHub Actions check:

```bash
npm run repair:ci:collect -- --pr 123
```

For a known Actions run and job:

```bash
npm run repair:ci:collect -- \
  --run 123456789 \
  --job "E2E PR Chromium (shard 1/2)"
```

The command prints a run directory such as
`.repair-harness/runs/<run-id>/`. The directory contains the normalized
`evidence.json`, bounded logs, artifact metadata, and a collection summary.
Only redacted evidence is persisted; traces and videos are referenced by path
and are not unpacked into the repair packet by default.

## Reproduce the failure

Use the run directory printed during collection:

```bash
npm run repair:ci -- reproduce --run-dir .repair-harness/runs/<run-id>
```

When a test file and title were identified, the harness runs that focused test
first. Otherwise it runs the exact catalog command and shard collected from CI.
Use `--dry-run` to inspect the command without running it:

```bash
npm run repair:ci -- reproduce \
  --resume <run-id> \
  --dry-run
```

A local failure with a different evidence fingerprint is reported as a
reproduction mismatch. Infrastructure failures stop without an agent call.

## Verify a human-authored patch

After editing the product code, run focused verification followed by the
scope's required verification:

```bash
npm run repair:ci -- verify --resume <run-id>
```

Verification is the source of truth. A successful agent response alone cannot
produce a `verified` result.

## Optional Codex repair

Agent use is opt-in:

```bash
npm run repair:ci -- repair \
  --resume <run-id> \
  --agent=codex
```

The harness makes a separate diagnosis call, applies the policy checks, then
allows at most the configured implementation attempts before independent
verification. It denies workflow edits, test skips/removal, retry or timeout
inflation, secret/config changes, and excessive file scope by default.

Use `--dry-run` to prepare packets without invoking an agent. Use `--no-agent`
or omit `--agent=codex` when you want to ensure no agent can run.

## E2E timing diagnostics

The timing diagnostic reads an existing Playwright JSON report. It does not
change Playwright workers, retries, timeouts, or test source:

```bash
npm run repair:ci -- e2e-timing \
  --report playwright-report.json
```

Individual tests at or below 7 seconds are normal, tests above 7 seconds and
through 10 seconds are reported as warnings, and tests above 10 seconds fail
the diagnostic. The run directory contains redacted timing evidence grouped
by project and test file.

## Measure completed runs

Aggregate redacted outcomes from local runs with:

```bash
npm run repair:ci:metrics
```

This reports failure classes, reproduction rate, focused and required
verification durations, attempts, packet size, known token usage, human
acceptance, and stop reasons. Token usage is shown as unavailable when the
selected Codex interface does not return it. Add `--dry-run` to avoid writing
the aggregate `metrics.json` file.

## Inspect the supported catalog

With no subcommand, the CLI prints the workflow catalog and validates its
commands against the workflow files:

```bash
npm run repair:ci
```

The first supported E2E scope is PR Chromium. Unit Node, unit jsdom, Storybook,
and build scopes are also cataloged. Hosted validation is a separate, explicit
workflow described below; it is never added to the local Codex repair path.

## Clean handoff

Review `summary.md`, `evidence.json`, `events.jsonl`, and the verification
result before accepting a patch. The harness never publishes changes; a human
must review, commit, and push any repair separately.

## Hosted deployment validation

Hosted validation checks the configured GitHub Pages and Railway origins. It is
read-only by default and never deploys, promotes, changes secrets, alters
GitHub configuration, or repairs a remote failure. Every hosted command
requires the explicit scope flag and disables agent use:

```bash
--scope hosted --no-agent
```

### Configuration

Pass a JSON file to `--config`. The file uses the validated `HOSTED_*` keys;
URLs must be HTTPS and both API hosts must be listed in the allowlist:

```json
{
  "HOSTED_DEV_FRONTEND_URL": "https://pages.example/dev/",
  "HOSTED_DEV_API_URL": "https://dev-api.example",
  "HOSTED_STABLE_FRONTEND_URL": "https://pages.example/stable/",
  "HOSTED_STABLE_API_URL": "https://stable-api.example",
  "HOSTED_ALLOWED_API_HOSTS": ["dev-api.example", "stable-api.example"],
  "HOSTED_TEST_ACCOUNT_PROVIDER": "manual",
  "HOSTED_EXPECTED_DEV_CHANNEL": "dev",
  "HOSTED_EXPECTED_STABLE_CHANNEL": "stable"
}
```

`HOSTED_ALLOW_MUTATIONS` defaults to false. Hosted limits are separate from
local repair limits: `HOSTED_TIMEOUT_MS` defaults to 15 seconds,
`HOSTED_MAX_BROWSERS` to 1, `HOSTED_MAX_MUTATIONS` to 2, and
`HOSTED_MAX_CLEANUP_ATTEMPTS` to 2. Keep these bounds low and run-specific.

### Read-only probes and browser smoke

Deployment probes check health, channel, and optional commit metadata without
credentials:

```bash
npm run repair:ci -- hosted-probe \
  --config hosted.json --scope hosted --no-agent
```

The real-origin browser smoke opens the configured Pages URL and verifies API
routing, reachability, and unauthenticated state:

```bash
npm run repair:ci -- hosted-browser \
  --config hosted.json --scope hosted --no-agent
```

Use `--dry-run` with either command to validate configuration without making a
network request or launching a browser.

### Disposable lifecycle and isolation checks

Mutation commands require both `HOSTED_ALLOW_MUTATIONS=true` in the config and
the explicit `--allow-hosted-mutations` flag. Credentials are passed in
memory-only CLI arguments and are never written to the run directory:

```bash
npm run repair:ci -- hosted-mutate \
  --config hosted.json --scope hosted --no-agent \
  --allow-hosted-mutations \
  --email disposable@example.test --password '<password>'
```

The two-sided isolation check requires separate disposable accounts and
creates one uniquely marked project in each environment:

```bash
npm run repair:ci -- hosted-isolation \
  --config hosted.json --scope hosted --no-agent \
  --allow-hosted-mutations \
  --dev-email dev-disposable@example.test \
  --dev-password '<dev-password>' \
  --stable-email stable-disposable@example.test \
  --stable-password '<stable-password>'
```

The runner checks both directions of visibility, deletes both projects, and
confirms absence afterward. If deletion cannot be confirmed, the result is
`cleanup-required`; do not start another mutation run until the remote record
has been handled by the designated operator.

### OAuth preflight

OAuth preflight is opt-in and checks only configured callback/redirect metadata;
it does not authorize a provider or store OAuth credentials. Enable it with
`HOSTED_ALLOW_OAUTH=true`, `HOSTED_OAUTH_CALLBACK_HOST`,
`HOSTED_EXPECTED_DEV_OAUTH_REDIRECT`, and
`HOSTED_EXPECTED_STABLE_OAUTH_REDIRECT`:

```bash
npm run repair:ci -- hosted-oauth-preflight \
  --config hosted.json --scope hosted --no-agent \
  --allow-hosted-oauth
```

Any future live provider login requires a human-provided manual checkpoint;
the harness must not automate provider authorization.

### Hosted run artifacts and failure handling

Hosted runs are written beneath `.repair-harness/runs/<run-id>/` and include:

- `hosted-config.json`: redacted validated configuration;
- `hosted-evidence.json`: approved response or isolation fields only;
- `hosted-events.jsonl`: normalized hosted step outcomes;
- `hosted-metrics.json`: bounded status and cleanup metrics;
- `state.json`, `events.jsonl`, and `hosted-summary.md`: the standard run
  state/event/summary contracts and the recommended next diagnostic.

Passwords, session cookies, authorization headers, CSRF values, OAuth codes,
database URLs, and unrestricted response bodies must not enter these files.
A hosted failure produces evidence and a next diagnostic step; it never invokes
Codex repair or performs an automatic remote repair. The local `repair` command
rejects hosted scope and hosted reproduction commands by design.
