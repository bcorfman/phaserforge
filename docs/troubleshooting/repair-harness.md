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

The first supported E2E scope is PR Chromium. Unit Node, unit jsdom,
Storybook, and build scopes are also cataloged. Main-manifest, nightly matrix,
deployment, and hosted lifecycle scopes remain explicitly unsupported.

## Clean handoff

Review `summary.md`, `evidence.json`, `events.jsonl`, and the verification
result before accepting a patch. The harness never publishes changes; a human
must review, commit, and push any repair separately.
