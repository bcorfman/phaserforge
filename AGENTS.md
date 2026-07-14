# AGENTS.md for phaserforge

## Read Order

For feature work or bug fixes, read the smallest useful set in this order:

1. `AGENTS.md`
2. `.repo-memory/product-memory.md`
3. `.repo-memory/regression-playbook.md`
4. Relevant scoped `AGENTS.md`
5. Relevant tests and implementation
6. Relevant top-level `.plans/*` only when current workflow context or an active proposal matters

Use `.plans/archive/` only for historical context after checking current tests, implementation, and repo memory first.

## Core Rules

- TDD first: store/helper tests, then scene/integration tests where practical, then implementation.
- Before reporting any code change complete, run the required verification for that change type.
- `arcadeactions/` is reference-only. Do not modify it.
- Do not change the default Playwright worker count from `3` in `playwright.config.ts`.
- Tests and implementation are the latest ground truth. `.repo-memory/` holds compact durable rules. Top-level `.plans/` holds the small active workflow/proposal surface.
- Favor live derived data over persisted flags/counts when the source data is already loaded and the calculation is cheap; use stored metadata only when loading the full source would be meaningfully expensive.

## Verification

- GUI/editor changes under `src/editor/**`, `src/App.tsx`, or `src/phaser/EditorScene.ts` require local Chromium smoke:
  - `npm run test:e2e -- --project=chromium --grep @smoke`
- Non-GUI changes should prefer unit/integration coverage and run E2E when user-visible behavior is affected.
- If fixing a browser-specific Playwright failure, also run that same local Playwright project or spec before declaring the fix complete.
- If a direct product fix fails to remove an E2E flake more than twice, redesign the test to use a less brittle invariant.

## Editor Workflow Policy

These rules apply to `src/editor/**`, `src/App.tsx`, and `src/phaser/EditorScene.ts`.

Priorities:
1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency

Ask the user to confirm before implementing a change that materially changes:
- a primary workflow, entry point, gesture, shortcut, or selection model
- an established style contract such as where actions live or how paired controls are laid out

When confirming, include:
- impacted workflow names from `.plans/editor-workflows-inventory.md` when available
- current vs proposed primary path
- entry points added/removed/merged
- expected impact on steps and pointer travel
- style contract affected

If a workflow materially changes, update `.plans/editor-workflows-inventory.md` and update `.plans/ux-checklist-workflow-simplification.md` only when the checklist/decision record itself changed.

## Code Navigation

For architecture work, use Serena first to locate the smallest relevant symbol set before reading files broadly.
