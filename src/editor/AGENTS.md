# Editor Rules

Scope: `src/editor/**`

## Priorities

1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency with the existing editor

## Workflow Rules

- Prefer one obvious primary path per task.
- Avoid adding a second entry point for an existing task unless it replaces another path or has a clear accessibility/discoverability reason.
- If a change materially affects a workflow, update `.plans/editor-workflows-inventory.md`.

## Style Contract

- Paired controls stay side-by-side using existing two-column patterns.
- Near-cursor actions stay near-cursor before adding inspector or toolbar actions.
- Comparable objects should keep context-menu parity unless the user approves a deviation.
- Reuse existing foldouts, compact buttons, inline menus, and validated numeric inputs before inventing a new pattern.

## Tests

- Follow TDD.
- Add scene/e2e coverage for the primary user path when workflow behavior changes.
