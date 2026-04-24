# Direct-Manipulation Canvas Editing Roadmap

## Summary
Implement canvas editing in three phases, with Phase 1 intentionally narrow and shippable: select from canvas, drag entities, drag formations as a unit, and resize `BoundsHit` rectangles directly on the Phaser canvas while keeping React store, inspector, JSON, and runtime scene synchronized.

The plan assumes the current architecture remains intact:
- React `EditorStore` remains the source of truth for `SceneSpec`
- Phaser `EditorScene` is the interaction/render layer
- group-aware movement continues to use `group-extents` and `limit` semantics where configured

All phases should be TDD-driven. Each gesture or editing behavior starts with store/helper tests, then scene-level interaction tests where practical, then implementation.

## Phase 1: Narrow V1 ✅ COMPLETED
### Goal
Make geometry-like things editable on the canvas without changing the overall editor model.

### Behaviors ✅ IMPLEMENTED
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

## Phase 2: Solid First Version ✅ COMPLETED
### Goal
Remove rough edges so the editor feels coherent instead of "barely works."

### Behaviors ✅ IMPLEMENTED
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

## Phase 3: Polished Editor ✅ COMPLETED
### Goal
Turn the canvas into a genuinely usable scene editor rather than a geometry patch panel.

### Mockups
- See `.plans/mockups/phase-3/README.md`
- Marquee multi-select: `.plans/mockups/phase-3/phase3-01-marquee-multiselect.svg`
- Regroup/ungroup UX: `.plans/mockups/phase-3/phase3-02-regroup-ungroup.svg`
- Undo/redo + snap + play/edit + pin: `.plans/mockups/phase-3/phase3-04-undo-redo-snap-playmode.svg`
- Scene Graph drag/drop group membership: `.plans/mockups/phase-3/phase3-05-dragdrop-group-membership.svg`
- Cursor context menu: `.plans/mockups/phase-3/phase3-06-cursor-context-menu.svg`
- Top-right selection actions: `.plans/mockups/phase-3/phase3-07-topright-selection-actions.svg`
- Convert group layout submenu: `.plans/mockups/phase-3/phase3-08-convert-group-layout-submenu.svg`

### Behaviors ✅ IMPLEMENTED
- ✅ Marquee multi-select for entities
- ✅ Keyboard nudging
- ✅ Optional grid snapping toggle
- ✅ Undo/redo integration for drag sequences (batched per canvas interaction)
- ✅ Regroup/ungroup UX:
  - ✅ create group from selected ungrouped entities
  - ✅ remove entity from group
  - ✅ dissolve group into ungrouped entities
- ✅ Scene Graph drag/drop group membership:
  - ✅ drag sprites onto formations to add members
  - ✅ drag members into Sprites dropzone to remove from formation
  - ✅ multi-select sprites in Scene Graph and drag into a formation
- ✅ Cursor context menu (right-click) with selection actions
- ✅ Convert group layout actions (freeform / grid / arrange) from the canvas context menu
- ✅ Optional top-right selection actions cluster (for group or multi-selection)
- ✅ Optional pinned inspector for selected object while dragging

### Architecture decisions
- Regroup/ungroup operations must update:
  - `groups`
  - entity positions only when needed
  - any selected behavior targets if a group id is removed or created
- Undo/redo should batch pointer-drag into a single history entry

### Implementation changes
- Add editor commands:
  - `create-group-from-selection`
  - `remove-entity-from-group`
  - `ungroup`
- Add history stack reducer or command log layer

## TDD Plan
### Phase 1 tests
- ✅ Store reducer tests:
  - ✅ moving entity updates only that entity
  - ✅ moving group updates all members and preserves spacing
  - ✅ updating bounds rewrites only that condition
- ✅ Geometry helper tests:
  - ✅ bounds handle hit detection
  - ✅ selection priority resolution
- ✅ Editor grouping tests:
  - ✅ grouped entities are excluded from ungrouped list
  - ✅ selected action resolves editable bounds condition
- ✅ Integration tests:
  - ✅ selecting `MoveUntil` exposes linked bounds editor
  - ✅ sample scene with `group-extents` + `limit` remains valid
- If practical, add lightweight scene interaction tests around emitted bus events rather than full Phaser pointer simulation

### Phase 2 tests
- ✅ Hover/selection precedence tests
- ✅ Empty-canvas clear-selection tests
- ✅ Drag threshold tests
- ✅ Active bounds highlight resolution tests

### Phase 3 tests
- ✅ regroup/ungroup reducer tests
- ✅ undo/redo batching tests

## Assumptions
- Phase 1 is the recommended implementation target for the next execution pass.
- Direct manipulation initially covers only entities, groups, and bounds; actions/conditions remain inspector-driven except where geometry is directly editable.
- Editing gestures update the scene model, not just temporary Phaser display objects.
- Canvas direct manipulation should cooperate with the current sample scene and browser editor without replacing the JSON/inspector workflows.

## Config Schema
To support expandability for new `arrange_*` functions, formations, and actions, introduce an external configuration file `editable-items.json` in `src/config/`. This JSON file explicitly defines which properties of each item type are editable on the canvas or in the inspector.

### Schema Definition
Use JSON Schema for validation. The config is a top-level object with keys for each item category.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "formations": {
      "type": "object",
      "description": "Map of formation type names to their editable properties.",
      "patternProperties": {
        ".*": {
          "type": "object",
          "properties": {
            "editable": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of property names that can be edited (e.g., 'x', 'y', 'spacingX')."
            },
            "canvas_handles": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Optional list of canvas handle types (e.g., 'position', 'spacing') for direct manipulation."
            }
          },
          "required": ["editable"]
        }
      }
    },
    "actions": {
      "type": "object",
      "description": "Map of action type names to their editable properties.",
      "patternProperties": {
        ".*": {
          "type": "object",
          "properties": {
            "editable": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of property names that can be edited."
            },
            "canvas_handles": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Optional list of canvas handle types."
            }
          },
          "required": ["editable"]
        }
      }
    },
    "arrange_functions": {
      "type": "object",
      "description": "Map of arrange function names to their editable properties.",
      "patternProperties": {
        ".*": {
          "type": "object",
          "properties": {
            "editable": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of property names that can be edited."
            },
            "canvas_handles": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Optional list of canvas handle types."
            }
          },
          "required": ["editable"]
        }
      }
    }
  },
  "additionalProperties": false
}
```

### Example Config
```json
{
  "formations": {
    "GridFormation": {
      "editable": ["x", "y", "spacingX", "spacingY"],
      "canvas_handles": ["position", "spacing"]
    }
  },
  "actions": {
    "MoveUntil": {
      "editable": ["bounds"],
      "canvas_handles": ["bounds"]
    }
  },
  "arrange_functions": {
    "arrange_grid": {
      "editable": ["rows", "cols"],
      "canvas_handles": []
    }
  }
}
```

This schema ensures the config is declarative and version-controlled, allowing easy updates without code changes.

## Loading Logic in the Editor
Load the config at editor startup to make it available globally. Store it in a new `ConfigStore` or extend `EditorStore` with a `config` slice for easy access via selectors.

### Implementation Steps
1. **File Location and Loading**:
   - Place `editable-items.json` in `public/config/` for static serving.
   - In `src/main.tsx` or `src/App.tsx`, add async loading:
     ```typescript
     import { useEffect } from 'react';
     import { useDispatch } from 'react-redux';
     import { setConfig } from './editor/EditorStore'; // New action

     function App() {
       const dispatch = useDispatch();
       useEffect(() => {
         fetch('/config/editable-items.json')
           .then(res => res.json())
           .then(config => dispatch(setConfig(config)))
           .catch(err => console.error('Failed to load config:', err));
       }, [dispatch]);
       // ... rest of App
     }
     ```

2. **Store Integration**:
   - Add to `EditorStore.tsx`:
     - New state: `config: EditableItemsConfig | null`
     - New action: `setConfig(config: EditableItemsConfig)`
     - Selector: `selectConfig` to access config in components.

3. **Usage in Components**:
   - In `Inspector.tsx`: For a selected formation/action, use `selectConfig` to get editable properties and render dynamic inputs (e.g., number fields for 'x', 'y').
   - In `EditorScene.ts`: Use config to conditionally render canvas handles (e.g., if 'position' in canvas_handles, add drag handles for entity positions).
   - Fallback: If config is missing or invalid, disable canvas editing for unknown items.

4. **Error Handling and Validation**:
   - Validate config against the JSON Schema using a library like `ajv` in the loading logic.
   - If invalid, log errors and use defaults (e.g., no editable properties).

### TDD for Config
- Add tests in `tests/editor/config.test.ts`:
  - Loading: Mock fetch, verify config is dispatched to store.
  - Validation: Test invalid JSON throws errors.
  - Usage: Test that inspector renders editable fields based on config.
  - Integration: Test canvas handles appear only for configured items.

This approach keeps the editor decoupled from `arcadeactions` changes, requiring only config updates for new items.

**Further Considerations** (if applicable, 1-3 items)

1. How to generate config automatically? Manually update the config file when new classes are added to phaseractions-studio. Consider a separate build script if needed for maintenance.
