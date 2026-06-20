# Project Tree + History Implementation Plan

## Summary
Implement a single left-sidebar `Project Tree` that replaces the current separate `Scene` and `Project` sidebar tabs, adds project-root management actions, and introduces a `Project Revisions` drill-in pane with safe `Copy...` and `Restore...` dialogs.

This plan follows the approved mockups in:
- `.plans/mockups/project-tree-history-2026-06-19/01-project-tree-manage-menu.svg`
- `.plans/mockups/project-tree-history-2026-06-19/02-project-revisions-pane.svg`
- `.plans/mockups/project-tree-history-2026-06-19/03-project-inline-rename.svg`
- `.plans/mockups/project-tree-history-2026-06-19/04-copy-dialog.svg`
- `.plans/mockups/project-tree-history-2026-06-19/05-restore-dialog.svg`

It also refines the earlier history plan in `.plans/project-history-and-asset-dedup-plan-2026-06-05.md` by defining the editor-side workflows and exact restore semantics.

## Product decisions locked in
- The left sidebar no longer has separate `Scene` and `Project` tabs.
- The left sidebar defaults to `Project Tree`.
- The project is the root node, with one or more scenes underneath it.
- A top-right `Manage` button sits in the Project Tree header, in the same general position the current scene tree uses for `+ Add`.
- `Manage` menu contains only:
  - `Rename`
  - `History`
  - `Clear Project ...`
- Project rename uses the same inline rename interaction pattern as scene rename.
- `History` does not open a modal and does not use tabs.
- `History` replaces the Project Tree with a `Project Revisions` pane in the same left-sidebar footprint.
- The `Project Revisions` pane uses a back arrow in the header to return to the Project Tree, matching the Inspector action-properties drill-in pattern.
- Revision row actions remain compact:
  - `Restore...`
  - `Copy...`
- Explanations live in dialogs, not in the row buttons.
- `Project Name` and publish name remain separate concepts.
  - `Project Name` is the editor working title.
  - `Publish Name / Release Slug` is used only in publish flow.

## Key behavior semantics

### Project Tree
- The project root is always visible at the top of the tree.
- Scene rows remain below the project root.
- Existing scene-level row menus and add-scene affordances remain, adjusted to fit the new hierarchy.

### Project rename
- Triggered by `Manage -> Rename`.
- Inline edit appears on the project root row.
- Uses the same keyboard contract as scene rename:
  - `Enter` saves
  - `Esc` cancels

### Clear Project
- Triggered by `Manage -> Clear Project ...`
- Behavior should match the existing `Reset Now -> New Empty Scene` outcome.
- The change should be routed through the new project-root affordance rather than the old Startup/Reset panel as the primary path.
- Before clearing, create a protective history revision if history is enabled for the current project type.

### Project Revisions pane
- Entered via `Manage -> History`.
- Replaces the Project Tree pane in-place.
- Header contains:
  - back arrow
  - `PROJECT REVISIONS` title
- Selecting or hovering a revision previews it on the canvas immediately.
- Preview is read-only.
- Returning with the back arrow exits preview mode and restores normal live editing state.

### Copy dialog semantics
- `Copy...` opens a dialog asking the user to name a separate new project.
- Confirming creates a distinct project starting from the selected revision.
- The current project remains unchanged.

### Restore dialog semantics
- `Restore...` opens a confirmation dialog.
- Dialog explains:
  - current project will be replaced by the selected revision as the new current state
  - current state will be saved into history first
  - this is not a literal rewind; it creates a new current head based on an older revision
- Confirming should:
  1. create a protective revision from the current head
  2. promote the selected older revision content into a new current head
  3. keep history linear and append-only

## State/model changes

### New sidebar mode
Add an explicit left-sidebar mode for project-root workflows, for example:
- `projectTree`
- `projectRevisions`

This should replace the current scene/project tab toggle for the left sidebar.

### New revision-preview state
Add editor state for history browsing, for example:
- whether revision preview mode is active
- selected revision id
- preview project/spec snapshot
- whether canvas is rendering preview content vs current live project

The preview state should be isolated from normal selection/edit state so browsing revisions does not mutate the live project.

### New project-root menu actions
Add command/store actions for:
- open project root rename
- open project revisions pane
- clear current project

### New history dialog states
Add dialog state for:
- copy revision dialog
- restore revision dialog

Each dialog should carry the selected revision id and any needed metadata for display.

## UI implementation areas
- Left sidebar tree component
- project root row rendering
- top header action area for `Manage`
- project menu popup
- revisions list pane
- preview-mode canvas plumbing
- publish pane labels to preserve `Project Name` vs `Publish Name / Release Slug`

Likely relevant areas include:
- `src/editor/**`
- `src/App.tsx`
- `src/phaser/EditorScene.ts`

Because this is a GUI/editor workflow change, Chromium smoke E2E is required before completion.

## TDD order

### Phase 1: store/reducer tests
Add tests first for:
- left sidebar mode transitions:
  - tree -> revisions
  - revisions -> tree via back arrow action
- project root rename state
- selected revision preview state
- copy dialog open/close state
- restore dialog open/close state
- clear-project command routing

### Phase 2: helper tests
Add tests for pure helpers such as:
- deriving project tree rows with project root + scenes
- formatting revision summaries for the pane
- constructing restore flow metadata
- constructing copy default name suggestions

### Phase 3: integration/store behavior tests
Add tests for:
- `Manage -> Rename` entering inline rename on project root
- `Manage -> History` switching to revisions pane
- back arrow returning to Project Tree and clearing preview mode
- selecting a revision producing preview state without mutating live project
- confirming `Copy...` creating a separate project
- confirming `Restore...` creating a protective current-head revision and then a new current head from the selected revision
- `Clear Project ...` matching current reset behavior

### Phase 4: scene/editor interaction tests
Where practical, add scene-level interaction tests for:
- preview rendering on canvas while revisions pane is active
- returning from preview to live project rendering
- rename inline behavior matching scene rename keyboard semantics

### Phase 5: Playwright E2E
Add or update Chromium smoke coverage for:
- project tree present with project root and scenes
- manage menu contains `Rename`, `History`, `Clear Project ...`
- project rename inline flow
- open revisions pane and return with back arrow
- revision highlight updates canvas preview
- `Copy...` dialog creates separate project
- `Restore...` dialog explains the non-rewind semantics and completes successfully

Assertions should prefer stable visible invariants over timing-sensitive checks.

## Recommended implementation sequence

### Step 1: left-sidebar structure
- Remove Scene/Project tab switcher from the left sidebar
- Introduce Project Tree header + project root row
- Preserve scene list behavior under the root

### Step 2: project root commands
- Add `Manage` menu
- Wire `Rename`
- Wire `Clear Project ...` to current reset behavior

### Step 3: revisions pane shell
- Add in-place Project Revisions pane
- Add back-arrow navigation
- Render revision list metadata

### Step 4: preview mode
- Add canvas preview plumbing
- Ensure preview is read-only and easy to exit

### Step 5: dialogs + command execution
- Add `Copy...` dialog flow
- Add `Restore...` dialog flow with explicit messaging
- Implement safe restore semantics

### Step 6: publish naming separation
- Ensure publish UI continues to display project name separately from publish slug/name
- Do not regress earlier naming separation decisions

## Open implementation questions
- For local-only projects, what persistence layer will hold revisions in this first pass?
- Should revision preview preserve camera/zoom from the current live session, or reset to a canonical framing?
- Does `Clear Project ...` always create a protective revision, or only when the current project is cloud-backed?
- When `Copy...` creates a new project, should the editor switch into it immediately or keep focus on the current project?

## Recommendation on defaults
- `Copy...` is the safer fork action and should remain available but not necessarily primary in layout.
- `Restore...` is acceptable as a compact row label so long as the confirmation dialog keeps the current explicit wording.
- The actual restore implementation should always preserve the current head first so the system never performs destructive irreversible replacement.

## Definition of done
- Project Tree replaces left-sidebar Scene/Project tab split.
- Project root is visibly above scenes.
- Manage menu supports `Rename`, `History`, and `Clear Project ...`
- Revisions pane is in-place and uses a back arrow, not tabs.
- Revision highlight previews on the canvas.
- `Copy...` and `Restore...` dialogs match the approved semantics.
- Publish name remains separate from Project Name.
- Required unit/integration tests pass.
- Chromium smoke E2E for this GUI change passes with zero flakes.
