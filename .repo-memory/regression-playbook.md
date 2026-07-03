# PhaserForge Regression Playbook

Use this file to keep previously solved bug classes from drifting back in.

## Default Approach

1. Identify the bug class, not just the symptom.
2. Find the narrowest existing invariant in tests, product memory, or workflow docs.
3. Add or tighten tests before implementation when practical.
4. Fix the product if the behavior is wrong.
5. Redesign the test if the bug is really flaky coverage rather than broken behavior.
6. Record any new durable rule in `.repo-memory/product-memory.md`.

## Common Regression Classes

### Persistence / reload regressions

- Risks: reload, reopen, snapshot selection, stale cache precedence, local/cloud divergence.
- Preferred coverage:
  - unit tests for reducers/helpers/history logic
  - targeted Playwright reload/reopen coverage for user-visible recovery flows
- Strong invariants to prefer:
  - latest active head restores after reload/reopen
  - legacy localStorage project YAML does not silently win over the durable store
  - restore sequencing does not transiently materialize the wrong project and make it durable

### Workflow regressions

- Risks: a previously simplified path gains duplicate entrypoints, extra steps, or mismatched labels.
- Preferred coverage:
  - store/helper tests where logic changed
  - scene/e2e tests for the primary user path
  - workflow doc updates when the flow materially changes

### Serialization / migration regressions

- Risks: semantic drift after save/load, legacy compatibility breaks, canonicalization mismatch.
- Preferred coverage:
  - round-trip unit tests
  - migration fixture tests
- Strong invariants to prefer:
  - parse legacy shapes, serialize canonical shapes
  - preserve optional metadata that users can see or rely on later

### History narrative regressions

- Risks: user-visible history summaries or grouping drift after reload, compaction, coalescing, or rebuild.
- Preferred coverage:
  - unit tests for history-event/revision helpers
  - targeted E2E for reload/reopen narrative preservation
- Strong invariants to prefer:
  - preserve action-time summaries such as specific rename/resize intent
  - do not let specific summaries degrade into generic “edited scene/project” text after rebuild

### Cross-surface regressions

- Risks: fix lands in one UI surface but not another, or one code path bypasses the fix.
- Preferred coverage:
  - at least one test for the underlying shared logic
  - one integration test on the user-facing path most likely to drift

## Choosing Memory vs Plan vs Test

- Put durable repo-wide rules in `.repo-memory/product-memory.md`.
- Put feature proposals, rollout steps, and historical design notes in `.plans/`.
- Put executable behavior guarantees in tests.
- If the lesson came from repeated fixes, confirm it against tests or recent plans before promoting it into repo memory.
- Transcript archive evidence can help identify repeated bug classes, but tests and current product docs should remain the final source of truth.

## Keep It Small

- If a lesson will matter again, add one short rule.
- If it only mattered for one feature rollout, keep it in the relevant `.plans/` file.
- Prefer updating an existing rule over adding a near-duplicate rule.
- Prefer naming one bug class with 2-3 strong invariants over listing every historical symptom.
