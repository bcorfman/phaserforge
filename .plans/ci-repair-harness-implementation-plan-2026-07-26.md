# PhaserForge CI Repair Harness Implementation Plan

Status: proposed

Date: 2026-07-26

## Outcome

Provide a local-first, bounded repair loop for PhaserForge CI failures. Given a
GitHub pull-request failure, the harness will collect compact evidence,
reproduce the exact relevant CI command, prepare a constrained repair packet
for Codex, and independently verify any resulting patch.

The first supported target is the PR Chromium E2E gate. The harness will not
commit, push, merge, deploy, alter GitHub secrets, or mutate either hosted
database. A human remains responsible for accepting and publishing a verified
patch.

## Why PhaserForge-specific first

The first implementation is PhaserForge-specific because correct reproduction
depends on this repository's real CI topology:

- PR E2E runs Chromium tests tagged `@smoke|@critical` in two shards.
- Main-branch E2E runs a curated Chromium manifest through
  `scripts/run-main-e2e-shard.cjs`.
- Nightly/tag E2E runs the broader suite in Firefox, WebKit, and Edge over
  eight shards.
- Unit, jsdom, Storybook, build, deployment-health, and hosted cloud lifecycle
  checks have different commands and evidence needs.

The harness will nevertheless isolate a small reusable control core from a
`phaserforge` adapter. Do not publish a generic package or support another
repository until the PhaserForge path has handled approximately 10--20 real
failures and its abstractions have proved stable.

## Non-goals for the first release

- Fully autonomous CI repair, auto-commits, auto-pushes, auto-merges, or
  auto-deploys.
- Attempting to repair GitHub, runner, browser-installation, network, or
  third-party service incidents.
- Deployed dev/stable account lifecycle repair; that becomes a later dedicated
  adapter after the deterministic local PR path is reliable.
- A GUI/dashboard. Durable files and CLI output are the source of truth.
- Replacing existing test categorization, Playwright sharding, or the default
  worker count of `3`.

## Design principles

1. The verifier, not the model, decides whether an attempt succeeded.
2. Deterministic triage happens before any model call.
3. Evidence is compact by default; full logs and Playwright traces remain
   addressable artifacts, not prompt payloads.
4. Each repair attempt has an explicit token, time, and retry budget.
5. The loop stops on repeated evidence, no meaningful diff, scope violation,
   or an unsupported failure class.
6. Repository rules in `AGENTS.md` and the regression playbook are supplied
   once as stable context; the agent is not asked to rediscover the whole
   repository on every attempt.
7. Code-graph/MCP lookup is an optional targeted accelerator. A direct
   stack-trace/test/file search fallback must always work.
8. A repair may not weaken the verifier: skipping/deleting a failing test,
   broadening timeouts/retries, disabling a check, or changing CI configuration
   is denied unless the human explicitly scopes that change.

## Proposed layout

Keep the harness under `scripts/repair-harness/` so it can reuse the project
Node/TypeScript toolchain and existing `gh` helper conventions.

```text
scripts/
  repair-harness/
    cli.ts                 # `repair:ci` entry point and argument validation
    types.ts               # evidence, attempt, policy, and result contracts
    workflowCatalog.ts     # PhaserForge workflow/job -> reproduction mapping
    github.ts              # narrow gh CLI reads and artifact downloads
    triage.ts              # deterministic failure classification/extraction
    artifacts.ts           # Playwright report/trace metadata extraction
    reproduce.ts           # runs a scoped command and captures result
    policy.ts              # budgets, deny rules, stagnation, allowed paths
    packet.ts              # compact Markdown/JSON repair packet writer
    agent.ts               # explicit Codex command adapter; disabled by default
    verify.ts              # focused then required verification sequence
    state.ts               # durable run directory, JSONL events, resume state
    __tests__/
      ...
  inspect-gh-actions-failures.ts  # refactor to share non-breaking gh helpers
```

Each run writes only under a gitignored local directory such as
`.repair-harness/runs/<run-id>/`:

```text
state.json                 # current phase, budgets, selected scope
events.jsonl               # append-only commands/outcomes
evidence.json              # normalized, redacted failure envelope
reproduce/                 # stdout/stderr and structured result
artifacts/                 # downloaded reports/traces, referenced by path
packets/attempt-01.md      # compact context handed to the agent
verification/              # focused and required command outputs
summary.md                 # human-readable handoff
```

Add `.repair-harness/` to `.gitignore`. Never persist secrets, cookie storage
state, raw authorization headers, or unredacted response bodies there.

## Contracts

### Failure reference

The CLI accepts a PR number or an explicit Actions run/job reference:

```bash
npm run repair:ci -- --pr 123
npm run repair:ci -- --run 123456789 --job "E2E PR Chromium (shard 1/2)"
```

`--pr` finds failing checks using the existing `gh pr checks` approach. It must
report external/non-Actions checks as unsupported rather than pretending to
repair them.

### Normalized evidence envelope

The triage phase writes a schema-validated JSON record containing:

```json
{
  "workflow": "PhaserForge CI / E2E (PR)",
  "job": "E2E PR Chromium (shard 1/2)",
  "runId": "123456789",
  "commit": "<sha>",
  "scope": "pr-e2e-chromium",
  "reproduction": {
    "command": "npm run test:e2e -- --project=chromium --grep '@smoke|@critical' --shard=1/2 --fail-on-flaky-tests"
  },
  "failure": {
    "class": "assertion|compile|timeout|browser-crash|infrastructure|unknown",
    "testFile": "tests/e2e/example.spec.ts",
    "testTitle": "...",
    "message": "...",
    "stackExcerpt": "..."
  },
  "artifacts": {
    "tracePaths": [],
    "screenshotPaths": [],
    "reportPath": "..."
  },
  "redactionsApplied": []
}
```

The envelope deliberately has no model-produced root cause. Diagnosis remains
an explicit later phase so evidence and speculation cannot be confused.

### Workflow catalog

`workflowCatalog.ts` is the single source for mapping workflow/job identity to
local reproduction and required verification. Its first entries are:

| Scope | Local reproduction | Required verification after focused pass |
| --- | --- | --- |
| `pr-e2e-chromium` | Exact PR grep and shard | Same PR command for the affected shard; then the full PR command when the patch affects shared/editor code |
| `unit-node` | `npm run test:unit:node` narrowed to failing file when possible | `npm run test:unit:node` |
| `unit-jsdom` | `npm run test:unit:jsdom` narrowed to failing file when possible | `npm run test:unit:jsdom` |
| `storybook` | Exact failing Storybook test | `npm run test:stories` |
| `build` | `npm run build` | `npm run build` |

Main-manifest and nightly matrix scopes are added only after the PR slice is
proven. Deployment health and hosted cloud scopes require a separate proposal,
because their credentials and cleanup policy materially expand authority.

## Token and runtime budgets

The default first-release policy is:

- 0 model calls for known infrastructure failures.
- 1 compact diagnosis call, maximum 4,000 input tokens and 800 output tokens.
- 1 implementation call, maximum 8,000 input tokens and 2,000 output tokens.
- At most 1 retry implementation call, only when verification produced new,
  materially different evidence.
- Maximum 2 implementation attempts, 20 minutes wall time, and 12 changed
  files unless the user overrides those values explicitly.
- No full Actions log, full trace archive, source-tree dump, or previous chat
  transcript in a packet.

Use a deterministic log extractor: failing step plus the first matching error
and bounded surrounding lines. For Playwright, extract title, assertion,
stack, console errors, request failures, and artifact paths before allowing an
agent to inspect a trace.

Stagnation triggers a stop when either the evidence fingerprint is unchanged
after an attempted patch, no allowed product file changed, or the same failure
class/message recurs twice. The summary must then state reproduction commands
and evidence tried, not claim a fix.

## Phased implementation

### Phase 0 -- Lock down the current CI contract

Goal: make CI scope mechanically discoverable before attempting repair.

- [x] Add pure tests that parse the current PR, main, nightly, unit, Storybook,
  build, and deploy workflow command contracts.
- [x] Implement `workflowCatalog.ts` with only the supported PR Chromium and
  local non-E2E scopes enabled; represent all others as explicitly unsupported.
- [x] Add a command that prints the exact catalog and validates that each
  catalog command matches the workflow source.
- [x] Keep `scripts/main-e2e-shards.json` as the source of main shard members;
  do not duplicate it in the harness.

Exit criteria:

- A failed check is either mapped to an exact reproduction command or clearly
  rejected as unsupported.
- Tests catch a workflow/catalog command drift.

### Phase 1 -- Evidence collection and deterministic triage

Goal: produce a compact, redacted, reproducible failure envelope without a
model call.

- [x] Refactor the read-only reusable portions of
  `scripts/inspect-gh-actions-failures.ts` into shared helpers while preserving
  the existing `ci:checks` and `ci:checks:json` behavior and tests.
- [x] Add `github.ts` to fetch one resolved Actions run, failed job logs, and
  only that run's Playwright artifacts using authenticated `gh` commands.
- [x] Implement failure-class parsers for Vitest, TypeScript/build, and
  Playwright output; classify runner/network/action failures as infrastructure.
- [x] Implement artifact metadata extraction and redaction tests. Do not unpack
  or prompt raw trace/video contents by default.
- [x] Add `repair:ci:collect` to write the normalized evidence envelope and
  human-readable collection summary.

Exit criteria:

- The harness can collect a known fixture or a real failed PR job and identify
  its workflow scope, test location where available, reproduction command, and
  artifact paths.
- No credentials, cookies, tokens, or response secrets appear in artifacts,
  events, or summaries.

### Phase 2 -- Local reproduction and verification loop

Goal: reproduce the failure locally and verify a human-authored patch without
LLM integration.

- [ ] Implement `reproduce.ts` using `spawn` with captured stdout/stderr,
  duration, exit status, and an evidence fingerprint.
- [ ] Add focused reproduction for a Playwright file/title where parsing can
  identify it; otherwise execute the exact CI shard command.
- [ ] Implement `verify.ts`: focused failing test first, then the scope's
  required verification command.
- [ ] Add `policy.ts` deny rules for test removal/skips, timeout/retry
  inflation, workflow modification, secret/config paths, and broad file scope.
- [ ] Add JSONL event/state persistence, `--resume`, `--dry-run`, and
  `--no-agent` support.
- [ ] Add fixture-driven tests for success, reproduction mismatch, timeout,
  repeated failure, and policy denial.

Exit criteria:

- A developer can run collection, modify a patch manually, and have the
  harness produce an auditable focused-plus-required verification result.
- A non-reproducing or infrastructure failure stops without a repair attempt.

### Phase 3 -- Bounded Codex handoff

Goal: let the local harness request a repair while keeping all authority and
token use explicit.

- [ ] Add `packet.ts` to create concise diagnosis and implementation packets
  from stable repository guidance, the evidence envelope, the current diff,
  and a targeted file list.
- [ ] Add an `agent.ts` adapter that is opt-in via `--agent=codex` and invokes
  the locally installed Codex command through a documented environment/config
  contract. It must not assume credentials are available or embed them in a
  command or packet.
- [ ] Make diagnosis a separate call that emits only failure class, likely
  cause, files/symbols to inspect, exact reproduction command, and confidence.
- [ ] Permit implementation only if the diagnosis is non-infrastructure and
  policy approves its requested file scope.
- [ ] Enforce the Phase 0 budgets and stop conditions in code; record token
  usage when the selected Codex interface returns it, otherwise record call,
  duration, and packet byte size without inventing a token count.
- [ ] Require verification to complete before the summary can state
  `verified`; a passing model response alone is never success.

Exit criteria:

- One real or fixture-backed PR E2E failure can reach a verified local patch
  with no more than two implementation attempts.
- The agent cannot commit, push, merge, deploy, edit workflows, or weaken tests
  through the default policy.

### Phase 4 -- Operate, measure, and harden

Goal: shake out the PhaserForge adapter before any generalization.

- [ ] Run the harness against 10--20 naturally occurring failures or archived
  failure fixtures, recording only redacted evidence and outcomes.
- [ ] Track: failure class, reproduction rate, focused verification duration,
  required verification duration, attempts, packet size, token usage when
  available, human acceptance, and reason for stopping.
- [ ] Add a regression fixture for every misclassification, unsafe proposed
  change, false success, or token-expensive repeated loop.
- [ ] Tune parsers and catalog entries from measured failures, not anticipated
  abstractions.
- [ ] Decide whether main-manifest support is justified; add it as an adapter
  catalog entry with tests if approved.

Exit criteria:

- The PR Chromium path is demonstrably bounded, auditable, and useful on real
  failures.
- Extraction candidates are supported by repeated evidence, not convenience.

### Phase 5 -- Optional later scopes

Only begin after Phase 4 acceptance.

- [ ] Main Chromium manifest failures.
- [ ] Nightly cross-browser failures, including browser-specific reproduction
  and the existing WebKit compatibility command.
- [ ] Deployment health/version failures without repair authority.
- [ ] Dedicated hosted dev/stable lifecycle testing with disposable accounts,
  explicit cleanup, and secret isolation. This needs a separate approval and
  plan because it creates/deletes remote user data.
- [ ] Extract a generic core only after multiple adapters share the same tested
  contracts.

## Test strategy

Follow TDD for each pure helper and policy decision before integration wiring.

- Unit tests: log parsing, workflow mapping, command construction, redaction,
  policy decisions, evidence fingerprints, budgets, and state transitions.
- Integration tests: fixture-backed `gh` output/artifact manifests and child
  process execution through a controlled fake runner.
- CLI tests: argument validation, unsupported scope messages, resume behavior,
  and human-readable summaries.
- Manual acceptance: run against a deliberately preserved historical fixture
  before any live PR; then use one real failed PR only after `gh` authentication
  and artifact permissions are confirmed.

The harness itself is non-GUI. Its implementation verification is unit and
integration coverage plus narrow CLI smoke tests; it does not require editor
Chromium smoke unless its patch also changes editor files.

## Operational prerequisites

- Local authenticated `gh` with permission to read the target repository's PR
  checks, run logs, and artifacts.
- Node 26 and the repository's Playwright environment.
- A locally installed Codex CLI only for the opt-in agent phase; collection,
  reproduction, and verification must work without it.
- GitHub Actions artifacts retained long enough for repair collection.

## Mockups

No SVG mockup is proposed. The first release has no user-facing editor or
dashboard surface; its important design is the CLI/data contract above. Add a
mockup only if a later dashboard or human approval UI is approved.

## Definition of done for the first release

- `repair:ci:collect` collects and redacts evidence for a failed PR Chromium
  E2E job.
- `repair:ci` deterministically reproduces that job or stops with a precise
  unsupported/infrastructure reason.
- The optional Codex path is bounded to the documented budgets and cannot
  perform external writes by default.
- Verification is focused-first and then scope-required; summaries distinguish
  verified, unverified, blocked, and unsupported outcomes.
- Runs are resumable and auditable from local files without retaining secrets.
- Existing `ci:checks`, CI workflows, Playwright worker default, and normal
  test behavior remain unchanged unless a tested compatibility refactor is
  necessary.
