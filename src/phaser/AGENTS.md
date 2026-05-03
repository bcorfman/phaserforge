# Canvas / Gesture Rules (Workflow + Style)

Scope: `src/phaser/**` (especially `EditorScene.ts`)

## UX Priorities (in order)
1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency (match established editor patterns)

## Significant-by-default changes (confirm before implementing)

Treat changes as significant and ask the user to confirm before implementing if they touch:
- Selection behavior (single/multi/marquee), clearing selection, delete semantics
- Drag/move/duplicate gestures (Alt-duplicate), snapping behavior, bounds handle behavior
- Pan/zoom/fit/reset controls or shortcuts
- Mode toggling (Edit/Play) shortcuts or surfaces
- Right-click context menu behavior on canvas objects

## Canvas Style Contract

- **Context menu parity:** if most interactive canvas objects expose right-click actions, new comparable objects should participate in the same context menu system rather than relocating actions to inspector/toolbar by default.
- **Affordances stay consistent:** maintain hover/cursor feedback patterns for new interactive objects to match existing canvas interactions.

## Copy must match behavior

If gestures/shortcuts change, update any user-facing copy/hints that describe them so instructions remain accurate.

## Tests (when behavior changes)

For gesture/interaction changes, add/update Playwright tests where practical to cover the primary workflow path.

