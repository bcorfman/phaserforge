# CI Repair Harness Quick Start

The repair harness is a local, bounded workflow for collecting PhaserForge CI
evidence, reproducing failures, verifying changes, diagnosing E2E timing
telemetry, and (only when explicitly requested) invoking Codex for a narrowly
scoped repair.

It can commit, push, and open a ready-for-review pull request when invoked with
`--publish`. It never merges a pull request, deploys, changes GitHub secrets or
configuration, or performs an unapproved hosted mutation. Published pull
requests still require human review before they can proceed.

## Prerequisites

- Run commands from the PhaserForge repository root.
- Install dependencies with `npm install`.
- Authenticate the GitHub CLI with `gh auth status` when collecting from GitHub.
- Have the repository's required browsers installed for E2E reproduction.
- For hosted validation, have Chromium installed and use only disposable,
  explicitly approved test accounts and records.

The CLI is exposed through:

```bash
npm run repair:ci -- <command> [options]
```

The convenience scripts `repair:ci:collect` and `repair:ci:metrics` invoke the
same CLI.

## Safety and bounded behavior

The harness separates evidence collection, reproduction, verification, agent
repair, and hosted validation. A successful model response is never sufficient
to call a repair verified: independent verification must pass.

The local Codex repair path:

- does not run for infrastructure failures;
- rejects hosted reproduction commands and hosted scope;
- requires an explicit `--agent=codex`;
- makes separate diagnosis and implementation calls;
- enforces wall-time, packet, implementation, and token budgets;
- redacts secrets before persisting evidence, packets, events, and summaries;
- rejects workflow changes, test removal/skips/`.only`, timeout or retry
  inflation, worker-count changes, secret/config changes, and excessive file
  scope by default;
- requires the diagnosis reproduction command to match collected CI evidence;
- records independent focused and required verification results.

The `--allow-timing-config` option only allows the agent policy to consider
`playwright.config.ts` for a timing repair. It does not permit workflow,
timeout, retry, or worker-count edits by the agent. The automated E2E timing
repair has a separate, explicit concurrency path that can apply
`PW_WORKERS=1` to the Full Matrix workflow when isolated WebKit evidence
demonstrates broad runner contention.

## Collect a failed PR job

Pass `--clean` when starting a new harness run to remove existing `.log`
files anywhere under `.repair-harness/runs` before the run begins. Other run
artifacts, including evidence and state files, are preserved:

```bash
npm run repair:ci:collect -- --pr 123 --clean
```

The option is also supported by the timing and hosted run commands. Do not use
it when resuming a run whose logs you still need.

To remove every file under `.repair-harness` and the complete
`.repair-harness/runs` directory tree, including evidence, state, metrics, and
logs, use the stronger `--clean-all` option when starting a new run:

```bash
npm run repair:ci:collect -- --pr 123 --clean-all
```

If both flags are supplied, `--clean-all` takes precedence. Do not use either
cleanup option when resuming a run.

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

Use `--dry-run` to prepare packets without invoking an agent. Do not use
`--no-agent` with this command: the repair command intentionally fails unless
`--agent=codex` is explicitly supplied. Hosted commands are the separate
no-agent path.

## E2E timing diagnostics

The timing diagnostic accepts either Playwright's JSON report or the `index.html`
file from the downloaded GitHub Actions HTML report artifact. Playwright embeds
`report.json` inside that HTML file, so there is no need to find or create a
separate JSON file:

```bash
npm run repair:ci -- e2e-timing \
  --report .plans/index.html
```

Replace `.plans/index.html` with the path where the artifact was downloaded.
The command extracts only the embedded test results and writes normalized
output under `.repair-harness/runs/<run-id>/`, including
`e2e-timing-summary.md`, `e2e-timing-evidence.json`, and
`e2e-timing-events.jsonl`.

It does not change Playwright workers, retries, timeouts, or test source.

Individual tests at or below 7 seconds are normal, tests above 7 seconds and
through 10 seconds are reported as warnings, and tests above 10 seconds fail
the diagnostic. The run directory contains redacted timing evidence grouped
by project and test file.

### Fully automated GitHub matrix repair

To have the harness resolve the PR's failing Actions run, download every matrix
artifact, merge the shard reports, ask Codex for a bounded timing repair, and
independently verify it:

```bash
npm run repair:ci -- e2e-timing-repair \\
  --pr 123
```

The harness automatically discovers Codex from `PATH` or the VS Code extension
installation and invokes `codex exec` non-interactively.

Use `--run <run-id>` instead of `--pr` when the Actions run is known. The
download is automatic; no artifact or `index.html` download is required. `--pr`
also works when the E2E check passed, because timing failures are distinct from
test assertion failures. The command stops after verification by default. Add
`--publish` only when the
verified change should be committed, pushed on an `agent/*` branch, and opened
as a ready-for-review PR:

```bash
npm run repair:ci -- e2e-timing-repair \\
  --pr 123 --publish
```

Publication stages all verified changes, commits them with the harness repair
commit message, pushes `agent/e2e-timing-<source-run>`, and opens a non-draft
PR. The CLI reports the PR URL and explicitly says that human review is
required; it does not merge or approve the PR.

For systemic timing findings where an approved runner/project configuration
change is appropriate, explicitly enable elevated timing repair:

```bash
npm run repair:ci -- e2e-timing-repair \\
  --run 30501317589 --allow-timing-config --publish
```

This still rejects timeout/retry inflation and worker-count changes. The flag
only approves review of `playwright.config.ts`; independent verification must
pass before anything is published.

The command does not repair warnings (7–10 seconds); only tests over the
10-second hard ceiling are eligible for an agent repair. The automated broad
timing path may update the Full Matrix workflow to `PW_WORKERS=1` after a clean
single-worker WebKit isolation replay. Agent implementation policy still
rejects arbitrary workflow, retry, worker, and timeout changes.

Supported timing-repair options are `--pr <number>` or `--run <run-id>`,
`--repo`, `--publish`, `--max-iterations`, `--model`, `--reasoning`,
`--allow-timing-config`, `--clean`, and `--clean-all`. While waiting for a
dispatched workflow, the harness prints the workflow run ID and current status
instead of remaining silent.

## Measure completed runs

Aggregate redacted outcomes from local runs with:

```bash
npm run repair:ci:metrics
```

This reports failure classes, reproduction rate, focused and required
verification durations, attempts, packet size, known token usage, human
acceptance, and stop reasons. Token usage is shown as unavailable when the
selected Codex interface does not return it. Add `--dry-run` to avoid writing
the aggregate `metrics.json` file. Use `--repo <path>` and `--runs-root <path>`
to select the source directory.

## Inspect the supported catalog

With no subcommand, the CLI prints the workflow catalog and validates its
commands against the workflow files:

```bash
npm run repair:ci
```

The supported generic repair scopes are PR Chromium, Node unit, jsdom unit,
Storybook, and build. Main Chromium, Full Matrix, docs build, frontend deploy,
and Railway deploy are cataloged but unsupported for generic local repair.
Hosted validation is a separate, explicit workflow described below; it is never
added to the local Codex repair path.

## Clean handoff

Review `summary.md`, `evidence.json`, `events.jsonl`, `state.json`, and the
verification result before accepting a patch. If Codex was used, also review
the diagnosis and implementation packets. With `--publish`, the harness
commits, pushes, and opens a ready-for-review PR, but a human must still review
and approve it before merge.

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
`HOSTED_MAX_CLEANUP_ATTEMPTS` to 2. `HOSTED_ALLOW_OAUTH` defaults to false;
the account provider must be `external`, `manual`, or `fixture`. Optional
configuration includes expected dev/stable commits, custom CSRF/session cookie
names, expected cookie SameSite mode (`lax`, `strict`, or `none`), and OAuth
callback/redirect metadata. Numeric hosted bounds must be integers from 1 to
10; the timeout must be between 100 and 120000 milliseconds. Keep these
bounds low and run-specific.

### Read-only probes and browser smoke

Deployment probes check health, channel, and optional commit metadata without
credentials:

```bash
npm run repair:ci -- hosted-probe \
  --config hosted.json --scope hosted --no-agent
```

The real-origin browser smoke opens the configured Pages URL and verifies API

```bash
npm run repair:ci -- hosted-browser \
  --config hosted.json --scope hosted --no-agent
```

Use `--dry-run` with either command to validate configuration without making a
network request or launching a browser. `--repo`, `--run-id`, `--clean`, and
`--clean-all` are also accepted. The smoke check also records
unexpected API origins, failed requests, browser console errors, and projected
API response metadata.

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

Use `--signup` and optional `--invite-token` when the disposable account must
be created. `--repo`, `--run-id`, `--clean`, and `--clean-all` are also
accepted.

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

The mutation path also verifies the updated project after reload and checks
hosted security invariants: CSRF header use, exact CORS origin and credentials,
and Secure/SameSite session and CSRF cookies.

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

## Run artifacts and handoff

Local runs are stored under `.repair-harness/runs/<run-id>/`. Review
`summary.md`, `evidence.json`, `events.jsonl`, `state.json`, and any
`reproduce/` or `verification/` result. Codex runs also store redacted
diagnosis and implementation packets. State phases include collection,
reproduction, diagnosis, implementation, verification, and hosted validation;
statuses include `active`, `verified`, `failed`, and `stopped` as applicable.

Hosted runs additionally write `hosted-config.json`, `hosted-evidence.json`,
`hosted-events.jsonl`, `hosted-metrics.json`, and `hosted-summary.md`.

For a published timing repair, review the ready-for-review PR and the
independent verification result before approving or merging it.

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
