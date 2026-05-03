# AGENTS.md for phaseractions-studio

## Project Guidelines

### TDD Requirement
All phases and implementation changes should be TDD-driven. Each gesture or editing behavior starts with store/helper tests, then scene-level interaction tests where practical, then implementation. Maintain comprehensive test coverage for reducers, helpers, and integrations.

### ArcadeActions Reference Only
The `arcadeactions` directory is for reference only. Do not modify or add files to it. Use it to understand formations, actions, and arrange functions, but all changes must stay within `phaseractions-studio`. For expandability, rely on external config files and editor-side logic.

### Playwright Workers Default (Do Not Change)
Do not change the default Playwright worker count in `playwright.config.ts`. The default must remain `3` (overridable only via `PW_WORKERS`).

## Editor UX / Workflow Policy

These rules apply to any changes under `src/editor/**`, `src/App.tsx`, or `src/phaser/EditorScene.ts`.

### Priorities (in order)
1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency (match established editor patterns)

### Significant Change Confirmation (ask before implementing)
Ask the user to confirm before implementing any change that is likely to:
- Significantly change a workflow (primary entrypoint, gesture/shortcut, selection semantics, moving controls across panes, or adding a second way to do the same task).
- Introduce, remove, or materially alter a style contract (examples: paired inputs become stacked; context menus added/removed/moved; actions moved from near-cursor surfaces to inspector/toolbar).

When asking for confirmation, include:
- Workflow(s) impacted (use `.plans/editor-workflows-inventory.md` names when available).
- Current vs proposed primary path (brief steps).
- Entry points added/removed/merged (buttons/menus/shortcuts/gestures).
- Expected change in steps and pointer travel.
- Style contract impacted (what rule changes and why).

### Style vs Workflow Tie-break
If an established style would be violated but the user may benefit from a simpler/shorter workflow, pause and ask which to prioritize before implementing. Provide 1–2 alternatives that preserve style.

### Documentation Update (only when workflows materially change)
If a workflow is added/removed/meaningfully altered, update:
- `.plans/editor-workflows-inventory.md`
- `.plans/ux-checklist-workflow-simplification.md` (only if decisions/checklist need updating)
