# Editor Rules (Workflows + Style Contract)

Scope: `src/editor/**`

These rules enforce editor UX priorities while designing mockups and implementing UI changes.

## UX Priorities (in order)
1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency (match established editor patterns)

## Workflow Discipline

- Prefer **one obvious primary path** per task. Avoid adding new entrypoints for an existing task unless it replaces another or has a clear reason (accessibility/discoverability/keyboard parity).
- When introducing new interactions, define/update the **atomic workflow** first (A##), then reference it in any composite workflows (W##) in `.plans/editor-workflows-inventory.md` when applicable.
- If a change materially affects user workflows, ensure documentation updates per root `AGENTS.md`.

## Style Contract (must follow unless explicitly approved)

- **Paired inputs are side-by-side:** conceptual pairs (X/Y, W/H, rows/cols, startX/startY, spacingX/spacingY, etc.) should be rendered in a two-column row (existing grid-2 pattern) rather than stacked line-by-line.
- **Near-cursor actions stay near-cursor:** selection/object actions should live in near-cursor surfaces (selection bar/context menu) before adding inspector/toolbar buttons.
- **Context menu parity:** if comparable canvas/editor objects support right-click actions, new comparable objects should too (or the deviation must be confirmed).
- **Reuse established panel patterns:** prefer existing foldouts, compact button styles, selection pills, inline menus, and validated numeric inputs rather than introducing novel layout patterns without reason.

## Style vs Workflow Tie-break

If following a simpler/shorter workflow would violate an established style contract, pause and ask the user which to prioritize. Provide 1–2 alternatives that preserve style.

## Testing (when behavior changes)

For workflow-affecting behavior changes, follow the project TDD requirement:
- Store/helper tests first
- Scene-level/e2e tests (Playwright) where practical for the primary path

