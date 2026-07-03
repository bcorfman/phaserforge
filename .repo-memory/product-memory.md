# PhaserForge Product Memory

This file is the compact source of truth for product-wide behavior that should survive across features, refactors, and bug fixes.

If a change conflicts with this file, update this file in the same turn or explain why the behavior is intentionally changing.

## Read Order

For feature work or bug fixes, read in this order:

1. `AGENTS.md`
2. `.repo-memory/product-memory.md`
3. `.repo-memory/regression-playbook.md`
4. Relevant scoped `AGENTS.md`
5. Relevant tests and implementation
6. Relevant `.plans/*` file only when the task needs feature history or workflow context

## Durable Product Invariants

### Editor interaction

- The editor should have one obvious primary workflow for common tasks.
- Near-cursor actions should stay near-cursor unless there is an explicitly approved workflow reason to move them.
- Editor copy, hints, shortcuts, and gestures must match actual behavior.

### Persistence and history

- User work should survive reloads, tab close/reopen, and normal app restarts.
- The latest valid IndexedDB-backed project head wins over stale cached snapshots or legacy localStorage project state.
- History and persistence changes should preserve both data and the user-visible ability to recover/restore recent work.
- Restore sequencing is a product contract: workspace selection, active-project selection, project dispatch, scene load, and visible stabilization must happen in a consistent order.
- Project history should preserve user intent across reload/rebuild, not just restoreable state.

### Serialization and project data

- Project serialization should round-trip without semantic drift.
- Backward compatibility for persisted project data matters unless the task explicitly changes the contract.
- Canonicalization helpers and migration code are part of the product contract, not just implementation detail.
- Legacy project formats should be canonicalized into current structures instead of leaking old keys/meanings forward.

### Cross-surface consistency

- If the same concept appears in canvas, inspector, scene graph, docs, and tests, behavior and terminology should agree across all of them.
- A fix in one surface is not complete if another surface can silently reintroduce the same bug class.

### Action-time intent over later inference

- When the editor knows the user’s intent at action time, prefer storing that semantic meaning directly instead of re-inferring it later from diffs or rebuilt state.
- New heuristics should usually be fallback-only; recurring user-visible narrative bugs are often a sign that semantic meaning should be captured earlier.

## Where Detailed Truth Lives

- Workflow specifics: `.plans/editor-workflows-inventory.md`
- Workflow simplification decisions: `.plans/ux-checklist-workflow-simplification.md`
- Exact regression coverage: tests
- Feature-by-feature history and proposals: `.plans/`

## Update Rule

Update this file when a change does any of the following:

- introduces a new durable product rule
- changes a previously stable user-facing behavior
- resolves a recurring regression class by clarifying what must stay true
