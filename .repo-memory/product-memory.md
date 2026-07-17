# PhaserForge Product Memory

Compact durable rules that should survive refactors and feature work.

## Durable Invariants

### Editor interaction

- The editor should have one obvious primary workflow for common tasks.
- Near-cursor actions should stay near-cursor unless there is an approved workflow reason to move them.
- Editor copy, hints, shortcuts, and gestures must match actual behavior.
- Pixel-authored geometry such as entity positions, trigger rects, and hitbox rectangles should round to integer pixels unless a field is intentionally continuous.
- Pixel-art textures should use nearest-neighbor filtering on runtime loads, not just global Phaser config.
- Authored random layout/variation features should be deterministic from stored seeds and named streams, never from preview-time `Math.random()`.
- Authored sprite tint should remain independent of editor selection styling; selection affordances should not overwrite the saved tint.

### Persistence and history

- User work should survive reloads, tab close/reopen, and normal app restarts.
- The latest valid IndexedDB-backed project head wins over stale cached snapshots or legacy localStorage state.
- Restore sequencing is a product contract and must remain stable.
- Project history should preserve user intent across reload/rebuild, not just restoreable state.

### Serialization and project data

- `ProjectSpec` is the canonical project model for editor state, persistence, publish, and runtime compilation. YAML is a supported human-readable import/export and compatibility adapter, not the internal persistence authority or required publishing pipeline.
- Project serialization should round-trip without semantic drift.
- Backward compatibility for persisted project data matters unless the task explicitly changes the contract.
- Legacy project formats should canonicalize into current structures instead of leaking old meanings forward.

### Cross-surface consistency

- If the same concept appears in canvas, inspector, scene graph, docs, and tests, behavior and terminology should agree.
- A fix in one surface is incomplete if another surface can silently reintroduce the same bug class.

### Action-time intent

- When the editor knows user intent at action time, prefer storing that semantic meaning directly instead of re-inferring it later.

## Reference Surfaces

- Workflow specifics: `.plans/editor-workflows-inventory.md`
- Workflow simplification decisions: `.plans/ux-checklist-workflow-simplification.md`
- Exact behavior guarantees: tests
- Active workflow/proposal notes: top-level `.plans/`

## Update Rule

Update this file only when a change introduces or clarifies a durable product rule.
