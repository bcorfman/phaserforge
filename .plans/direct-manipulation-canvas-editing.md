# Direct-Manipulation Canvas Editing Roadmap

## Summary
Implement canvas editing in three phases, with Phase 1 intentionally narrow and shippable: select from canvas, drag entities, drag formations as a unit, and resize `BoundsHit` rectangles directly on the Phaser canvas while keeping React store, inspector, JSON, and runtime scene synchronized.

The plan assumes the current architecture remains intact:
- React `EditorStore` remains the source of truth for `SceneSpec`
- Phaser `EditorScene` is the interaction/render layer
- group-aware movement continues to use `group-extents` and `limit` semantics where configured

All phases should be TDD-driven. Each gesture or editing behavior starts with store/helper tests, then scene-level interaction tests where practical, then implementation.

## Phase 1: Narrow V1
### Goal
Make geometry-like things editable on the canvas without changing the overall editor model.

### Behaviors
- Click canvas entity to select that entity
- Click formation hull to select that group
- Drag selected entity to update its `x/y`
- Drag selected group to translate all member entities together
- Show draggable handles for the first editable `BoundsHit` rectangle
- Drag bounds edges/corners to update `minX/maxX/minY/maxY`
- Keep inspector and JSON panel in sync during or immediately after drag
- Preserve current list/inspector editing; canvas editing augments it

### Architecture decisions
- React store remains authoritative; Phaser does not become source of truth
- Canvas gestures emit editor actions over `EventBus`, and React dispatch updates store
- Updated store state re-emits `load-scene`, and Phaser re-renders from compiled state
- During active drag, Phaser may use a transient preview overlay, but persisted scene updates must flow through the store
- No freeform regroup/ungroup in Phase 1
- No multi-select in Phase 1
- No dragging while behavior playback is actively animating; entering edit-drag should pause or temporarily stop action playback for the edited scene instance

### Required API/state additions
- New editor actions in `EditorStore`:
  - `move-entity { id, dx, dy }`
  - `move-group { id, dx, dy }`
  - `update-bounds { id, bounds }`
  - `begin-canvas-interaction { kind, id }`
  - `end-canvas-interaction`
- New optional editor state:
  - `interaction?: { kind: 'entity' | 'group' | 'bounds'; id: string; handle?: 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br' }`
- New `EventBus` events:
  - `canvas-select`
  - `canvas-move-entity`
  - `canvas-move-group`
  - `canvas-update-bounds`
  - `canvas-interaction-start`
  - `canvas-interaction-end`

### Implementation changes
- In `EditorScene`, add Phaser hit areas for:
  - each entity rectangle
  - each group hull
  - bounds rectangle handles
- Add a small input controller inside `EditorScene` that:
  - resolves pointer-down target using strict priority:
    1. bounds handles
    2. entity
    3. group hull
    4. bounds body
  - tracks drag origin in world coordinates
  - emits deltas to React through `EventBus`
- Add store reducers that:
  - move one entity by delta
  - move all group members by delta
  - update bounds immutably
- Add store-side clamping for bounds so `min <= max` remains valid
- When dragging a group:
  - move only current member positions in `SceneSpec.entities`
  - do not rewrite membership
  - keep relative spacing unchanged
- Bounds editing target:
  - only `BoundsHit` conditions are direct-manipulable
  - if multiple exist, only the currently selected condition or the condition linked from the selected `MoveUntil` is editable on canvas
  - if nothing relevant is selected, render no drag handles

## Phase 2: Solid First Version
### Goal
Remove rough edges so the editor feels coherent instead of “barely works.”

### Behaviors
- Hover affordances for selectable entities, groups, and bounds handles
- Cursor changes by interaction type
- Better visual handles for bounds edges/corners
- Drag threshold before movement starts
- Stable selection precedence with no accidental group-vs-member grabs
- Inline readout overlay during drag:
  - entity position
  - group delta
  - bounds dimensions
- Editing a `MoveUntil` action highlights its linked bounds on canvas
- Clicking empty canvas clears selection

### Architecture decisions
- Add a dedicated canvas overlay layer in `EditorScene` for:
  - hover outlines
  - drag handles
  - transient labels
- Add pure helper modules for:
  - hit testing priority
  - bounds-handle geometry
  - drag delta quantization/snapping hooks
- Keep playback/editing separation explicit:
  - direct manipulation edits scene data
  - animation preview can be resumed after drag, but editing should not fight active movement

### Implementation changes
- Add `editor/canvasGeometry.ts` and `editor/canvasInteraction.ts` style helper modules
- Add derived selectors for:
  - active editable bounds condition
  - selected group member ids
  - canvas-editable overlays
- Add readable labels in the inspector and canvas overlay for:
  - `Any Member`
  - `Every Member`
  - `Formation Edges`
  - `Stop on Contact`
  - `Clamp at Edge`
  - `Bounce Back`
  - `Wrap Around`
- If a selected entity belongs to a group, show both:
  - member highlight
  - softer parent formation hull highlight

## Phase 3: Polished Editor
### Goal
Turn the canvas into a genuinely usable scene editor rather than a geometry patch panel.

### Behaviors
- Marquee multi-select for entities
- Keyboard nudging
- Optional grid snapping toggle
- Undo/redo integration for drag sequences
- Regroup/ungroup UX:
  - create group from selected ungrouped entities
  - remove entity from group
  - dissolve group into ungrouped entities
- Formation re-layout tools for grid groups:
  - drag spacing handles
  - drag anchor/origin
  - recalculate member positions from formation metadata
- Optional playback/edit mode toggle
- Optional pinned inspector for selected object while dragging

### Architecture decisions
- Introduce explicit group layout metadata in the scene model for editable formations:
  - `layout?: { type: 'grid'; rows; cols; startX; startY; spacingX; spacingY } | { type: 'freeform' }`
- Preserve backward compatibility:
  - groups without layout metadata are treated as `freeform`
- Regroup/ungroup operations must update:
  - `groups`
  - entity positions only when needed
  - any selected behavior targets if a group id is removed or created
- Undo/redo should batch pointer-drag into a single history entry

### Implementation changes
- Extend `GroupSpec` with optional layout metadata
- Add editor commands:
  - `create-group-from-selection`
  - `remove-entity-from-group`
  - `dissolve-group`
  - `reflow-grid-group`
- Add grid-layout inspector controls and canvas spacing handles
- Add history stack reducer or command log layer

## TDD Plan
### Phase 1 tests
- Store reducer tests:
  - moving entity updates only that entity
  - moving group updates all members and preserves spacing
  - updating bounds rewrites only that condition
- Geometry helper tests:
  - bounds handle hit detection
  - selection priority resolution
- Editor grouping tests:
  - grouped entities are excluded from ungrouped list
  - selected action resolves editable bounds condition
- Integration tests:
  - selecting `MoveUntil` exposes linked bounds editor
  - sample scene with `group-extents` + `limit` remains valid
- If practical, add lightweight scene interaction tests around emitted bus events rather than full Phaser pointer simulation

### Phase 2 tests
- Hover/selection precedence tests
- Empty-canvas clear-selection tests
- Drag threshold tests
- Active bounds highlight resolution tests

### Phase 3 tests
- regroup/ungroup reducer tests
- layout metadata round-trip tests
- undo/redo batching tests
- grid reflow spacing tests

## Assumptions
- Phase 1 is the recommended implementation target for the next execution pass.
- Direct manipulation initially covers only entities, groups, and bounds; actions/conditions remain inspector-driven except where geometry is directly editable.
- Editing gestures update the scene model, not just temporary Phaser display objects.
- Group dragging edits member entity positions directly in v1; explicit editable group layout metadata is deferred to Phase 3.
- Canvas direct manipulation should cooperate with the current sample scene and browser editor without replacing the JSON/inspector workflows.
