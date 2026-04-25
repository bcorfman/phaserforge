# Store-Level Command History (Undo/Redo) Roadmap

## Summary
Implement a **Store-level command/history system** in `EditorStore` so that **every editor mutation** (entity/group/attachment/scene/project edits) is undoable/redoable, with **canvas drags batched into a single history entry**. Replace Phaser-side `operationHistory` with Store history and route Undo/Redo UI + shortcuts through the Store.

## Key Design (Decision-Complete)

### 1) History is data-only and slice-based (no functions in state)
Add a `history` field to `EditorState`:

- `history.past: HistoryEntry[]`
- `history.future: HistoryEntry[]`
- `history.pending?: PendingHistory` (for drag batching/coalescing)

`HistoryEntry` stores **before/after snapshots** of the mutated slice:
- `scope: 'scene' | 'project'`
- For `scene` scope: `{ sceneId, beforeScene, afterScene }`
- For `project` scope: `{ beforeProject, afterProject, beforeCurrentSceneId, afterCurrentSceneId }`
- Always store `{ beforeSelection, afterSelection }`
- Always store `{ beforeExpandedGroups, afterExpandedGroups }` **only when it materially changes** (e.g., group created/deleted/ungroup/regroup); otherwise keep UI state stable.

Constraints:
- History is **not persisted** to localStorage (only `project` YAML remains persisted as today).
- Cap history length: default `MAX_HISTORY = 100` entries (drop oldest from `past`).

### 2) Which operations are undoable
Undoable = any reducer action that changes authored content:
- Scene content: `update-entity`, `import-entities`, `move-*`, `update-bounds`, `update-group`, arrange ops, group membership ops, dissolve/ungroup/group, attachments CRUD/reorder, scene graph removals, world size changes.
- Project structure: `create-scene`, `duplicate-scene`, `delete-scene`, `rename-scene`, `load-yaml-text`, `reset-scene`.

Not undoable (UI-only):
- `select`, `select-multiple` (selection is recorded *as metadata* on content commands, but selection-only actions do not create history entries)
- `toggle-group-expanded` (except when a group is created/deleted/undo restores it and we must restore expansion state)
- `set-theme-mode`, `set-ui-scale`, `set-startup-mode`, `dismiss-view-hint`, `set-status`, `set-error`, `export-yaml`, etc.

### 3) Drag batching/coalescing (Phase 3 requirement)
Use existing `begin-canvas-interaction` / `end-canvas-interaction` to create a **pending history entry**:
- On `begin-canvas-interaction`: set `history.pending = { scope:'scene', sceneId, beforeScene, beforeSelection, beforeExpandedGroups, changed:false, kind:'canvas-interaction' }`
- During pending interaction:
  - `move-entity`, `move-group`, `move-entities`, `update-bounds` apply normally **but do not push history**; set `pending.changed = true`.
- On `end-canvas-interaction`:
  - If `pending.changed === true`, push **one** `HistoryEntry` with `beforeScene` and current `afterScene`.
  - Clear `future` on commit.
  - If unchanged, do nothing besides clearing `pending`.

Optional (explicitly included): **nudge coalescing**
- Merge consecutive `move-*` commands outside a pending interaction if:
  - same `sceneId`, same selection kind/id(s), and within `MERGE_WINDOW_MS = 500`.
- Implementation: update the last `past` entry’s `afterScene` instead of pushing a new entry.

### 4) Store-level undo/redo actions + wiring
Add `EditorAction` variants:
- `{ type: 'history-undo' }`
- `{ type: 'history-redo' }`

Behavior:
- Undo: pop last `past` entry, apply its `before*` snapshot to state, push entry to `future`, restore `beforeSelection` (+ `beforeExpandedGroups` if present).
- Redo: pop first `future` entry, apply its `after*` snapshot, push to `past`, restore `afterSelection` (+ `afterExpandedGroups` if present).
- Undo/redo should set `dirty = true` if the resulting `project` differs from last exported/saved baseline (keep existing “dirty” semantics; simplest: preserve `dirty` from the snapshot state).

## Implementation Changes (Concrete Steps)

### A) Refactor `EditorStore` reducer into “apply” + “history wrapper”
- [x] Split reducer logic into:
  - [x] `applyAction(state, action): EditorState` (existing switch cases; **no history manipulation**)
  - [x] `reducer(state, action): EditorState` (wraps `applyAction` to record history or perform undo/redo)
- [x] Implement helpers:
  - [x] `isUndoableAction(action): boolean`
  - [x] `getHistoryScope(action): 'scene' | 'project'` (scene by default; project for scene CRUD, YAML load, reset)
  - [x] `pushHistoryEntry(stateBefore, stateAfter, scope): EditorState` (caps, clears future, handles pending merge rules)

### B) Replace Phaser-local history
- [x] In `EditorScene`:
  - [x] Remove `operationHistory/historyIndex` and all `undo/redo/recordOperation/finalizeRecordedOperation` logic.
  - [x] Stop subscribing to `EventBus.on('history-undo'/'history-redo')`.
  - [x] Remove keyboard shortcuts (Ctrl/Cmd+Z/Y) in favor of App-level keydown.
- [x] In `AppShell`:
  - [x] Add a window `keydown` handler (ignore when focused in input/textarea/select/contenteditable) that dispatches:
    - [x] Ctrl/Cmd+Z → `history-undo`
    - [x] Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y → `history-redo`

### C) UI wiring
- [x] Update `CanvasOverlay` Undo/Redo buttons to `dispatch({type:'history-undo'})` / `dispatch({type:'history-redo'})` (stop using `EventBus.emit('history-undo')`).
- [x] Keep the visual layout exactly as the Phase 3 mockups (Undo/Redo/Snap/Mode in-canvas overlay).

### D) Test bridge + existing tests compatibility
- [x] Update `src/testing/testBridge.ts` so `window.__PHASER_ACTIONS_STUDIO_TEST__.undo()` / `redo()` triggers Store-level undo/redo (not Phaser scene methods).
  - [x] Add `registerUndoRedoHandlers({undo, redo})` called from `AppShell`.
- [x] Update/extend Playwright tests:
  - [x] Ensure Undo/Redo works for:
    - [x] move entity
    - [x] create/remove entity
    - [x] add to group/remove from group (including drag/drop)
    - [x] dissolve group / ungroup / regroup
    - [x] attachment add/remove/reorder
    - [x] scene create/delete/rename
  - [x] Ensure drag sequences still undo as a single step (existing `begin/end-canvas-interaction` path).

## Test Plan (TDD-Driven)

### Unit (Vitest)
- [x] Add a new suite focused on history behavior (or extend `tests/editor/editor-store.test.ts`):
  - [x] `history-undo`/`history-redo` restores `project` and `selection` correctly for:
    - [x] `update-entity`
    - [x] `remove-scene-graph-item` for entity + group + attachment
    - [x] `add-entities-to-group` / `remove-entities-from-groups`
    - [x] `create-scene` + undo/redo
  - [x] Drag batching:
    - [x] `begin-canvas-interaction` → multiple `move-entity` → `end-canvas-interaction` creates **one** history entry
    - [x] Undo restores exact pre-drag positions
  - [x] Merge window (nudges):
    - [x] repeated `move-entity` actions within 500ms merge into one history entry

### E2E (Playwright)
- [x] Undo/redo after drag (existing coverage should remain but now validates Store path)
- [x] Undo/redo for group membership drag/drop in Scene Graph
- [x] Undo/redo for delete sprite + restore
- [x] Undo/redo for dissolve group + restore
- [x] Undo/redo for attachment removal + restore

## Assumptions / Defaults
- History cap: `100`.
- History is not persisted across reloads.
- Undo/redo restores `selection` to what it was **before/after** the command.
- `expandedGroups` is treated as UI state:
  - Not tracked for most commands, but commands that create/delete/restore groups record enough to avoid surprising collapses after undo.
- `dirty` handling default: store `dirty` in the snapshots and restore it with undo/redo (simple and predictable).
