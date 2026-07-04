# PhaserForge Regression Playbook

Use this file to keep previously solved bug classes from drifting back in.

## Default Approach

1. Identify the bug class, not just the symptom.
2. Find the narrowest existing invariant in tests, product memory, or workflow docs.
3. Add or tighten tests first when practical.
4. Fix the product if behavior is wrong.
5. Redesign the test when the failure is flake rather than product behavior.
6. Record a new durable rule in `.repo-memory/product-memory.md` only if it will matter again.

## Common Regression Classes

### Persistence / reload

- Risks: stale cache precedence, reload/reopen recovery, local/cloud divergence.
- Preferred coverage: reducer/helper tests plus targeted Playwright reload/reopen checks.

### Workflow

- Risks: duplicate entry points, extra steps, mismatched labels, inconsistent primary path.
- Preferred coverage: shared logic tests plus E2E on the primary user path.

### Geometry / rendering

- Risks: fractional authored geometry, blurry sprite rendering, inconsistent pixel scaling.
- Preferred coverage: reducer/unit tests plus runtime/bootstrap tests.

### Serialization / migration

- Risks: save/load drift, canonicalization mismatch, legacy compatibility breaks.
- Preferred coverage: round-trip and migration fixture tests.

### History narrative

- Risks: summaries/grouping drift after reload, compaction, or rebuild.
- Preferred coverage: helper tests plus targeted E2E for reload/reopen preservation.

### Cross-surface

- Risks: a fix lands in one surface but not another.
- Preferred coverage: one shared-logic test and one user-facing integration path.

## Keep It Small

- Add one short rule per bug class, not a list of historical symptoms.
- Prefer updating an existing rule over adding a near-duplicate rule.
