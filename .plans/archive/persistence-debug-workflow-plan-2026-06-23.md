# Persistence Debug Workflow Plan

Date: 2026-06-23

## Goal

Replace the current slow persistence-debug loop:

1. make a fix locally
2. run a small local check
3. push
4. wait for GitHub Actions
5. discover a different E2E failure
6. repeat

with a faster staged workflow that catches persistence, restore, and cloud-sequencing bugs locally before pushing.

## Tracking checklist

Use this section as the living progress tracker for this plan. Mark items off as we complete them.

### Phase 0: workflow adoption

- [ ] Agree that persistence/cloud-restore work uses this plan by default
- [ ] Stop treating GitHub Actions as the first meaningful feedback loop
- [ ] Stop relying on pasted CI failures as the primary debugging input
- [ ] Use a staged local gate before each persistence-related push

### Phase 1: local gate definition

- [x] Finalize the must-run unit tests for persistence changes
- [x] Finalize the must-run EditorStore tests for restore/order changes
- [x] Finalize the must-run targeted Chromium persistence specs
- [x] Finalize the Chromium smoke command used after targeted fixes
- [x] Write down the exact pre-push persistence command sequence in the repo plan/docs

### Phase 2: fast test tooling

- [x] Add a dedicated `npm run test:persistence` script or equivalent
- [x] Make the script run unit/store coverage first
- [x] Make the script include the targeted Chromium persistence specs
- [x] Keep the script Chromium-only by default for iteration speed
- [x] Document how to run a single persistence spec repeatedly during debugging

### Phase 3: mocked-cloud E2E coverage

- [ ] Audit existing mocked-cloud persistence/restore specs
- [ ] Identify missing restore/conflict/reload scenarios
- [ ] Add or strengthen local-vs-cloud divergence coverage
- [ ] Add or strengthen delayed-write / midstream reload coverage
- [ ] Add or strengthen cloud-backed reload/latest-head coverage
- [ ] Add or strengthen cloud restore without transient empty-scene overwrite coverage

### Phase 4: restore sequencing instrumentation

- [ ] Identify the startup/restore milestones worth logging
- [x] Add debug events for workspace load
- [x] Add debug events for latest-active marker load
- [x] Add debug events for active project record selection
- [x] Add debug events for cloud fetch / cloud restore application
- [x] Add debug events for project dispatch into editor state
- [x] Add debug events for scene load completion
- [x] Add debug events for camera/view restore completion
- [x] Add debug events for inspector/entity-list stabilization

### Phase 5: restore invariant assertions

- [ ] Define the canonical restore invariants for E2E tests
- [x] Assert project id correctness after restore
- [x] Assert title correctness after restore
- [x] Assert active scene correctness after restore
- [ ] Assert no empty-scene transient becomes durable
- [ ] Assert no second bootstrap path overwrites the restored project
- [x] Assert camera/view state stability after restore
- [x] Assert project tree / inspector / entity list stability after restore

### Phase 6: CI monitoring workflow

- [ ] Confirm agent-side GitHub Actions inspection is part of the default loop
- [ ] Capture the failing spec name directly from CI before proposing a fix
- [ ] Capture the failing browser project directly from CI before proposing a fix
- [ ] Reproduce the named CI failure locally before broader reruns when possible
- [ ] Rerun the local persistence gate before the next push

### Phase 7: optional supporting coverage

- [ ] Identify Storybook/component-test candidates for cheap restore/cloud UI checks
- [ ] Add isolated UI checks for conflict modal empty/loading/error states where useful
- [ ] Add isolated UI checks for restore-related panel states where useful

### Phase 8: retrospective cleanup

- [ ] Review whether the new loop materially reduces time-to-fix
- [ ] Review whether GitHub Actions is now mostly validation instead of discovery
- [ ] Trim or expand the persistence gauntlet based on real usage
- [ ] Update this plan with the final standard workflow once it stabilizes

## Problem statement

The current loop is too expensive for persistence and cloud-restore work:

- GitHub Actions becomes the first meaningful feedback cycle
- local verification is not yet targeted enough for restore/conflict flows
- Chromium, Firefox, and WebKit failures get mixed together too early
- cloud restore regressions are difficult to reproduce because the app can transiently boot an empty scene before the restored project fully wins
- the agent is not yet consistently inspecting CI failures directly before proposing fixes

The result is a 12-15 minute iteration cost per fix, with too much uncertainty between local green runs and CI outcomes.

## New default workflow

For persistence, cloud restore, IndexedDB, conflict resolution, or startup sequencing changes, use this staged workflow by default.

### Stage 1: fast local correctness

Run narrow unit/integration coverage first:

- persistence serialization/dehydration/hydration tests
- revision materialization tests
- EditorStore sequencing tests where restore/order matters
- any helper tests covering bootstrap, autosave barriers, and latest-head selection

Representative commands:

```bash
npm test -- --run tests/editor/projectPersistence.test.ts
npm test -- --run tests/editor/editor-store*.test.ts
```

Expected outcome:

- no push until the data model and ordering assumptions are covered by fast tests
- every persistence bug fix should either add a new fast test or strengthen an existing one

### Stage 2: targeted Chromium reproduction

Before broader smoke or cross-browser runs:

- reproduce the specific failure in one targeted Playwright spec
- prefer local mocked cloud routes over waiting for real server/CI feedback
- rerun that single Chromium spec until stable

Representative commands:

```bash
npm run test:e2e -- --project=chromium tests/e2e/reload-recovers-latest-active-snapshot.spec.ts
npm run test:e2e -- --project=chromium tests/e2e/cloud-workspace-conflict.spec.ts
npm run test:e2e -- --project=chromium tests/e2e/cloud-reload-preserves-latest-head.spec.ts
```

Expected outcome:

- the exact failing flow is reproducible locally
- we fix the bug while watching the same spec pass repeatedly

### Stage 3: Chromium smoke gate

After the targeted persistence spec is stable:

```bash
npm run test:e2e -- --project=chromium --grep @smoke
```

Expected outcome:

- editor-wide Chromium smoke stays green
- cloud restore fixes do not silently break adjacent startup/project flows

### Stage 4: browser-specific verification only when warranted

Run Firefox/WebKit or equivalent project-specific local repro only when:

- GitHub Actions failed in a specific browser
- timing/layout behavior differs across engines
- the change touches startup, reload, or rendering timing in ways Chromium may not fully cover

Expected outcome:

- cross-browser runs happen after Chromium is stable, not before
- browser-specific failures are reproduced locally instead of only being diagnosed from CI

### Stage 5: push only after the local gate is satisfied

For persistence work, do not treat “some tests passed locally” as enough. The pre-push expectation is:

1. targeted unit/store tests passed
2. targeted Chromium restore/conflict spec passed
3. Chromium smoke passed
4. if CI previously failed in Firefox/WebKit, that same spec/project was run locally too

### Pre-push persistence command sequence

Run these in order for persistence, cloud-restore, IndexedDB, or startup-sequencing work:

```bash
npm run test:persistence:unit
npm run test:e2e -- --project=chromium tests/e2e/reload-recovers-latest-active-snapshot.spec.ts
npm run test:e2e -- --project=chromium tests/e2e/cloud-workspace-conflict.spec.ts
npm run test:e2e -- --project=chromium tests/e2e/cloud-reload-preserves-latest-head.spec.ts
npm run test:e2e -- --project=chromium --grep @smoke
```

For the default local gauntlet, use:

```bash
npm run test:persistence
```

For tight iteration on one failure, rerun a single spec repeatedly:

```bash
npm run test:e2e -- --project=chromium tests/e2e/cloud-reload-preserves-latest-head.spec.ts
```

## Local test suite backlog

Create a persistence-focused local gauntlet command so we stop assembling ad hoc commands each time.

### Proposed script

Add a script along the lines of:

```bash
npm run test:persistence
```

Initial contents should include:

- `tests/editor/projectPersistence.test.ts`
- relevant `tests/editor/editor-store*.test.ts`
- `tests/e2e/reload-recovers-latest-active-snapshot.spec.ts`
- `tests/e2e/cloud-workspace-conflict.spec.ts`
- `tests/e2e/cloud-reload-preserves-latest-head.spec.ts`
- Chromium only by default

### Storybook / component-test role

Use Storybook or UI-level tests only where they can cheaply validate:

- project tab empty/loading/error states
- cloud conflict modal rendering
- restore-related visual regressions in isolated panels

Do not rely on Storybook alone for correctness of persistence ordering, but do use it to catch quick UI regressions without full E2E cost.

## Cloud mocking strategy

For local persistence iteration, prefer mocked cloud responses in Playwright:

- `/api/v1/auth/csrf`
- `/api/v1/auth/me`
- `/api/v1/games`
- `/api/v1/games/:id`
- publish endpoints when needed

Target scenarios to cover locally:

1. local project opens, gains cloud linkage, reloads cleanly
2. device and cloud diverge, conflict picker appears, restore path wins deterministically
3. active-project persistence is delayed midstream, reload still restores latest valid head
4. cloud-backed project reloads without a transient empty-scene overwrite

## CI monitoring workflow

Stop relying on the user to paste GitHub Actions failures back into the loop.

### New default

When a PR or branch fails in CI:

1. inspect the failing check directly
2. read the failing spec name, browser project, and relevant error/log context
3. reproduce that same spec locally if possible
4. fix locally
5. rerun the matching local gate before pushing again

### Why this matters

- reduces relay-debugging errors
- lets the agent correlate failures across runs
- makes browser-specific failures actionable faster

## Restore sequencing / display jitter plan

The “small display adjustments” after cloud restore likely indicate startup order issues rather than isolated styling bugs.

We should explicitly instrument and test the restore path milestones.

### Suspected causes

- empty project/scene loads first, then restored project overwrites later
- camera/view state restores against the wrong scene or wrong project id
- editor UI panels bind to intermediate state before final project hydration completes
- workspace state, latest-active marker, and project record are being written/read in a sequence that allows partial startup states to leak into the UI

### Instrumentation backlog

Add lightweight debug events around:

1. bootstrap source chosen
2. workspace state loaded
3. latest-active marker loaded
4. active project record loaded
5. cloud project fetched
6. project dispatched into editor state
7. scene load completed
8. view/camera restore completed
9. inspector/entity list synchronized

### Test invariants to assert

For restore/reload specs, assert stable invariants rather than only final labels:

- restored project id is correct
- restored title is correct
- current scene id is correct
- no second bootstrap replaces the restored project
- no empty-scene transient state becomes durable
- expected camera/view state is preserved
- expected project tree / inspector / entity list state matches the restored project

## TDD expectations for persistence work

Persistence changes should follow a stricter version of the project’s TDD rule:

1. add or update store/helper tests first
2. add targeted scene/editor integration coverage where practical
3. add or update the smallest relevant E2E restore/conflict spec
4. implement the change
5. rerun the staged local gate

If a persistence bug fix cannot be described by a new test, the change is probably under-specified.

## Implementation checklist

This is the execution-oriented checklist for the actual repo work.

### Immediate process changes

- [ ] Use targeted unit/store tests before every persistence push
- [ ] Reproduce persistence failures in Chromium locally before broader E2E runs
- [ ] Rerun the same targeted Chromium spec until stable before moving on
- [ ] Run Chromium smoke after the targeted spec passes
- [ ] Run browser-specific local repro when CI names a specific failing browser
- [ ] Inspect GitHub Actions failures directly instead of waiting for pasted logs

### Fast test inventory

- [ ] Audit `tests/editor/projectPersistence.test.ts` coverage gaps
- [ ] Audit relevant `tests/editor/editor-store*.test.ts` coverage gaps
- [ ] Add missing fast tests for dehydrate/hydrate behavior
- [ ] Add missing fast tests for latest-active marker selection behavior
- [ ] Add missing fast tests for delayed-write / barrier behavior
- [ ] Add missing fast tests for restore-order / bootstrap-order behavior

### Targeted E2E inventory

- [ ] Audit `tests/e2e/reload-recovers-latest-active-snapshot.spec.ts`
- [ ] Audit `tests/e2e/cloud-workspace-conflict.spec.ts`
- [ ] Audit `tests/e2e/cloud-reload-preserves-latest-head.spec.ts`
- [ ] Decide whether additional Chromium-only persistence specs are needed
- [ ] Add missing mocked-cloud scenarios discovered during the audit

### Tooling / commands

- [ ] Add `npm run test:persistence` or equivalent local gauntlet script
- [ ] Verify the gauntlet runs quickly enough for repeated local use
- [ ] Document the one-spec rerun command for persistence debugging
- [ ] Document the full pre-push persistence command sequence

### Runtime/debugging work

- [ ] Add restore/bootstrap debug events for sequencing milestones
- [ ] Audit where an empty scene can win temporarily during restore
- [ ] Audit view/camera restore timing relative to project/scene load
- [ ] Audit when inspector/project-tree/entity-list bind to intermediate state
- [ ] Add E2E assertions for stable restore invariants, not just final text labels

### UI/supporting coverage

- [ ] Identify useful Storybook/component-test coverage for conflict UI
- [ ] Add lightweight UI/story tests for conflict/restore-related visual states where useful

## Definition of done for future persistence fixes

A persistence/cloud-restore change is not considered complete until:

1. fast tests covering the data/order change pass locally
2. the targeted mocked-cloud or restore Chromium spec passes locally
3. Chromium smoke passes locally
4. any previously failing named browser project is reproed locally and passes
5. the agent has reviewed CI failures directly if a CI regression triggered the work

## Bottom line

The main change is procedural:

- GitHub Actions should validate a fix, not discover it
- Chromium should be the primary local editor/persistence gate
- persistence work should have a dedicated fast gauntlet
- mocked cloud restore flows should be reproducible locally
- restore sequencing needs explicit instrumentation so we can debug startup/order bugs instead of inferring them from end-state failures
