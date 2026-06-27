# E2E Dev-Server Reliability Plan

Date: 2026-06-27

## Why this needs its own track

This is not looking like a product-specific regression anymore.

Recent evidence from local Chromium runs on June 27, 2026:

- Targeted history regressions passed:
  - `tests/e2e/project-history-scene-world-reload.spec.ts`
  - `tests/e2e/cloud-history-repo-persistence.spec.ts`
- The broader Chromium smoke run later failed across many unrelated specs with the same error:
  - `page.goto('/')`
  - `net::ERR_CONNECTION_REFUSED`
  - `http://127.0.0.1:4173/`

The failure pattern spanned unrelated areas:

- app boot
- cloud workspace conflict
- preview/edit mode stability
- project picker
- project tree history
- reload persistence
- text entities
- YAML load

That points to shared E2E infrastructure instability, not one feature family.

## Current architecture

Relevant files:

- [playwright.config.ts](/home/bcorfman/dev/phaserforge/playwright.config.ts:1)
- [scripts/playwright-no-deprecation.cjs](/home/bcorfman/dev/phaserforge/scripts/playwright-no-deprecation.cjs:1)
- [scripts/e2e-external-webserver.cjs](/home/bcorfman/dev/phaserforge/scripts/e2e-external-webserver.cjs:1)
- [tests/e2e/helpers.ts](/home/bcorfman/dev/phaserforge/tests/e2e/helpers.ts:1)

Current behavior:

1. Playwright uses `http://127.0.0.1:4173`.
2. The runner wrapper starts a managed external Vite dev server.
3. The external server helper waits for the port to open once.
4. The helper runs the Vite process with `stdio: 'ignore'`.
5. The suite then assumes the server will remain healthy for the duration of the run.
6. E2E helpers serialize some browser boot behavior with a file mutex, but they do not supervise server liveness.

## Likely root problem

The current system treats:

- `server became reachable once`

as if it means:

- `server will remain healthy and ready for the whole smoke run`

That is too weak a contract.

The recurring failure suggests one or more of these are happening:

1. The shared Vite dev server exits after initial readiness.
2. The server remains alive but stops listening briefly under load.
3. The wrapper loses observability because stdout/stderr are discarded.
4. The suite architecture is using a live dev server where a more stable preview/static server would be more appropriate.
5. The current worker/server interaction still allows boot-phase or lifecycle contention even after browser-side mutexing.

## Goal

Make local Playwright smoke runs fail only for:

- real product regressions, or
- clearly surfaced infrastructure failures with actionable logs

Not for silent shared-server disappearance.

## Non-goals

- Do not change Playwright default worker count in `playwright.config.ts`.
- Do not solve every browser-specific flake in this track.
- Do not redesign unrelated tests unless they are masking the server-lifecycle issue.

## Desired end state

The E2E server path should provide all of the following:

- observable startup
- observable shutdown
- observable crash reason
- explicit liveness expectations during the run
- deterministic failure mode when the server dies
- minimal reliance on live-dev-server behavior for smoke tests

## Plan

### Phase 1: Instrument and prove the failure mode

Before changing architecture, make the server lifecycle visible.

Tasks:

- Capture managed server stdout/stderr to log files under a deterministic location.
- Record:
  - process start time
  - PID
  - command line
  - readiness timestamp
  - exit timestamp
  - exit code / signal
- Emit the server log path at the start of each Playwright run.
- If the server exits before suite completion, fail with an explicit server-lifecycle error instead of leaving tests to discover it only through `ERR_CONNECTION_REFUSED`.

Deliverable:

- one reproducible run where we can answer:
  - did Vite exit?
  - if yes, when?
  - with what code/signal?
  - what was on stderr just before exit?

### Phase 2: Distinguish startup issues from long-run liveness issues

Once logs exist, classify the instability:

- startup failure
- early post-start crash
- mid-run crash
- health degradation without process exit

Tasks:

- Add a lightweight health probe in the wrapper while tests run.
- Log probe failures with timestamps.
- Correlate probe failures with Playwright failures.

Deliverable:

- a short incident matrix showing whether the issue is:
  - startup-only
  - post-ready crash
  - intermittent health degradation

### Phase 3: Replace the smoke server with a more stable serving model

If the suite is using Vite dev mode only because it was convenient, change that.

Preferred direction:

1. build once
2. serve the built app with a simple preview/static server
3. run smoke against that server

Why:

- less moving runtime state
- no HMR/watch behavior
- fewer dev-server lifecycle surprises
- better match for user-observable app boot

Candidate options:

- `vite preview`
- a tiny static file server against built artifacts

Decision criteria:

- deterministic startup
- easy health check
- stable port ownership
- acceptable local startup time

Deliverable:

- one new smoke-server path that does not depend on live dev-server semantics

### Phase 4: Keep feature-targeted local runs ergonomic

We may still want live-dev-server behavior for ad hoc debugging, but that should not be the default reliability path for smoke.

Tasks:

- Separate commands conceptually:
  - stable smoke path
  - optional dev-mode debugging path
- Keep the stable path as the default for `npm run test:e2e -- --project=chromium --grep @smoke`.
- Allow an opt-in debug mode if needed for local iteration.

Deliverable:

- clearer split between:
  - reliable verification
  - convenient dev debugging

### Phase 5: Add fail-fast server supervision

Regardless of server type, the wrapper should actively supervise it.

Tasks:

- keep stdout/stderr attached to files
- detect child exit immediately
- fail the run with a clear infra error
- optionally stop the suite early if the shared server dies

Deliverable:

- no more “ten unrelated specs fail with `ERR_CONNECTION_REFUSED`” without a clearer primary cause being surfaced first

### Phase 6: Reassess browser boot mutexing

The current file mutex in `tests/e2e/helpers.ts` may still be useful, but it is not the real fix if the server itself is unstable.

Tasks:

- keep it only if it still reduces contention after the server-path changes
- remove or simplify it if it becomes redundant

Deliverable:

- the simplest boot coordination that still preserves stability

## Implementation order

Recommended order:

1. Phase 1 instrumentation
2. one reproduction run
3. Phase 2 classification
4. Phase 3 server-model switch
5. Phase 5 supervision hardening
6. Phase 6 cleanup

## Suggested concrete changes

Likely files to touch:

- [scripts/e2e-external-webserver.cjs](/home/bcorfman/dev/phaserforge/scripts/e2e-external-webserver.cjs:1)
- [scripts/playwright-no-deprecation.cjs](/home/bcorfman/dev/phaserforge/scripts/playwright-no-deprecation.cjs:1)
- [playwright.config.ts](/home/bcorfman/dev/phaserforge/playwright.config.ts:1)
- [package.json](/home/bcorfman/dev/phaserforge/package.json:1)
- possibly [tests/e2e/helpers.ts](/home/bcorfman/dev/phaserforge/tests/e2e/helpers.ts:1)

Potential new assets:

- `scripts/e2e-server-health.cjs`
- `scripts/e2e-smoke-server.cjs`
- `.artifacts/e2e-server-logs/` or similar ignored path

## Verification plan

Unit/smaller verification:

- wrapper-level tests for server supervisor logic if practical
- manual dry run that confirms logs are created and exit reasons are surfaced

E2E verification:

1. run one targeted smoke spec repeatedly
2. run the full local Chromium smoke suite
3. rerun the full local Chromium smoke suite at least once more

Success criteria:

- no suite-wide `ERR_CONNECTION_REFUSED` cascade
- if the server fails, the run reports the server failure directly
- Chromium smoke passes without flaky infra-induced retries

## Decision point

If instrumentation shows the Vite dev server itself is not dying and the port remains healthy, then this plan should pivot from “server lifecycle” to “networking/runner isolation.” But right now the evidence most strongly supports the shared-server lifecycle as the primary suspect.

## Recommendation

Treat this as a dedicated infrastructure reliability task, not as incidental cleanup on whichever feature branch happens to hit it next.
