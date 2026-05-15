---
name: workflow-audit
description: Identify, name, de-duplicate, and fix missing GUI workflows; enforce a single obvious primary path per task.
---

## When to use

Use this skill when:
- Adding/updating/deleting GUI features (menus, panels, gestures, shortcuts, inspector controls)
- You suspect multiple ways exist to do the same task
- You suspect a feature has no in-product workflow (only config/YAML/manual edits)
- You need to reduce pointer travel and steps without breaking established style patterns

## Inputs needed

Ask for (or infer) the scope:
- Which surface(s): canvas, inspector, toolbar, dock, sidebar, context menus
- Which tasks: selection, grouping, import, assignment, YAML round-trip, etc.
- Any “do not change” constraints (keyboard shortcuts, worker counts, etc.)

## Process

### 1) Inventory (atomic first)

1. Identify **atomic workflows** (gestures/actions) first:
   - selection (single/multi/marquee)
   - open action menus
   - edit values
   - import assets
   - assign assets
   - undo/redo
   - mode toggles
2. Name them consistently (e.g., `A1 — Select Single`).
3. Compose **composite workflows** (e.g., `W3 — Create formation`) by referencing atomic names.

Deliverable:
- A short list of A## and W## workflows (or update existing workflow inventory doc).

### 2) Detect duplicates (repetitive workflows)

For each composite workflow (W##):
- List all entrypoints (buttons, menus, shortcuts, gestures).
- Flag when the same task is achievable via multiple inconsistent paths (naming, steps, location).
- Decide a single **primary path** (the one you want users to discover first).

Deliverable:
- “Duplicates” section: task → entrypoints → recommended primary → what to remove/merge.

### 3) Detect missing workflows

For each capability that exists in data model / UI:
- Confirm there is a user-visible workflow to create/edit/remove it in-product.
- If not, propose the minimal workflow that fits existing patterns.

Deliverable:
- “Missing workflows” section: capability → missing user path → proposed path.

### 4) Propose improvements (priorities)

Propose changes in priority order:
1) more intuitive
2) fewer steps
3) shorter pointer travel
4) style consistency

If (1–3) conflicts with (4), present tradeoffs and ask the user which to prioritize.

### 5) Confirmation gate (only for significant changes)

If the proposed change:
- changes a primary entrypoint,
- changes gestures/shortcuts,
- moves actions to different surfaces (near-cursor → inspector/toolbar),
- or breaks an established style pattern,

then stop and ask the user to confirm the new primary workflow before implementing.

### 6) Implementation guidance (if approved)

- Start with store/helper tests where applicable.
- Add interaction/e2e tests for the primary path where practical.
- Remove/merge redundant entrypoints rather than adding new ones.
- Update workflow docs if workflows materially change.

## Output format (recommended)

- **Atomic workflows:** list A##
- **Composite workflows:** list W## referencing A##
- **Duplicates:** task → entrypoints → primary path → removal plan
- **Missing:** capability → minimal workflow
- **Proposed changes:** grouped by surface with step/pointer-travel notes
- **Confirmation needed:** yes/no with reason

## Exit criteria

- Every targeted task has one obvious primary path.
- Redundant entrypoints are removed or intentionally retained with a documented reason.
- Missing workflows are added (or explicitly deferred).
- Tests updated for changed workflows when practical.

