# PhaserForge Regression Playbook

Use this file to keep previously solved bug classes from drifting back in.

## Default Approach

1. Identify the bug class.
2. Find the narrowest invariant in tests, product memory, or workflow docs.
3. Add/tighten tests first when practical.
4. Fix product behavior, or redesign the test if the failure is flake.
5. Add product memory only for a durable rule that will matter again.

## Common Regression Classes

- Persistence/reload: stale cache precedence, reload/reopen recovery, local/cloud divergence. Cover with reducer/helper tests plus targeted Playwright reload/reopen checks.
- Workflow: duplicate entry points, extra steps, mismatched labels, inconsistent primary path. Cover shared logic plus the primary user path.
- Geometry/rendering: fractional authored geometry, blurry sprites, pixel-scale drift. Cover reducer/unit plus runtime/bootstrap tests.
- View restore: mode-switch restores are same-canvas exact transfers; capture only zoom/scroll, wake reused scenes before applying pending camera state, assert scroll after active-scene-ready handoff.
- Serialization/migration: save/load drift, canonicalization mismatch, legacy compatibility. Cover round-trip and migration fixtures.
- History narrative: summaries/grouping drift after reload, compaction, or rebuild. Cover helper tests plus targeted reload/reopen E2E.
- Cross-surface: one surface fixed while another can reintroduce the bug. Cover shared logic plus one user-facing integration path.
- Event/action model: editor controls, `ValueSourceSpec`, validation, compiler routing, runtime event context, and docs must move together.

## Keep It Small

- Add one short rule per bug class, not a list of historical symptoms.
- Prefer updating an existing rule over adding a near-duplicate rule.
