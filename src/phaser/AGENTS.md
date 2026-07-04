# Canvas / Gesture Rules

Scope: `src/phaser/**`, especially `EditorScene.ts`

## Priorities

1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency

## Confirm First

Ask the user before changing:
- selection semantics
- drag/move/duplicate gestures
- snap behavior or bounds handles
- pan/zoom/fit/reset controls or shortcuts
- mode toggles
- right-click canvas behavior

## Canvas Contract

- Comparable interactive canvas objects should participate in the same context-menu system.
- Hover, cursor, and interaction affordances should match existing canvas behavior.
- If gestures or shortcuts change, update any user-facing hints/copy that describe them.

## Tests

- Add or update Playwright coverage for primary gesture paths when interaction behavior changes.
