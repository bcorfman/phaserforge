# Editor Workflows Inventory (Atomic + Composite)

This document inventories the workflows currently used in the editor UI and gestures.

## Atomic Workflows (building blocks)

These are the smallest user-visible workflows. Larger workflows below reference these by name.

### A1 — Select Single
- Click sprite/formation on canvas, or click it in the left sidebar list (Entity List).

### A2 — Select Multiple
- Shift/Ctrl/Cmd-click sprites in the Entity List (additive selection).
- Shift-click sprite on canvas (add to selection).
- Drag a marquee rectangle on empty canvas (Shift to merge with existing selection).

### A3 — Clear Selection
- Click empty canvas (no Shift) to clear selection.

### A4 — Rename Item (inline)
- In Entity List: click an already-selected entity/group/scene to enter rename; `Enter` saves, `Esc` cancels.

### A5 — Open Selection Actions Menu
- Click `…` in the on-canvas selection bar (single surface; no right-click menu).

### A6 — Undo / Redo
- Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y (redo), or use on-canvas Undo/Redo buttons.

### A7 — Toggle Edit / Play
- Click “Play Mode / Edit Mode” button, or press `Tab`.

### A8 — Pan View
- Hold `Space` + drag (left mouse), or middle-mouse drag.

### A9 — Zoom View
- Mouse wheel zooms (anchored under pointer).
- Viewbar buttons: Fit / Reset / +/-.

### A10 — Toggle Grid Snap
- “Snap: 8px / Off” button, or Ctrl/Cmd+G.

### A11 — Move Selection (drag)
- Drag selected sprite(s) or formation on canvas.

### A12 — Move Selection (nudge)
- Arrow keys (Shift+Arrow = 10px).

### A13 — Duplicate by Drag
- Alt-drag a sprite selection to duplicate, then drag the duplicates.

### A14 — Resize Bounds (drag handles)
- Select the thing that exposes bounds handles, then drag a bounds handle.

### A15 — Delete Selection
- `Delete`/`Backspace`, or remove via sidebar overflow menus (entity/group/scene/trigger).

### A16 — Create Group (from selected sprites)
- Convert a multi-sprite selection into a new formation (group).

### A17 — Add Sprites to Group
- Add selected sprites into an existing group.

### A18 — Remove Sprites from Group
- Remove selected sprites from any groups (ungroup sprites), or remove individual members.

### A19 — Dissolve Group
- Remove a group container (members remain as sprites).

### A20 — Import Asset into Project
- Import images/spritesheets/audio/fonts via Assets Dock (from file or by path).
- Optional: “Advanced…” opens an import modal (multi-frame + auto-hitbox) from within Assets Dock.

### A21 — Drag Asset to Target
- Drag an asset from Assets Dock onto:
  - Canvas (creates a new sprite entity at drop point),
  - Existing sprite on canvas (replaces its asset),
  - Background Layers UI (assigns image),
  - Scene Music field (assigns audio).

### A22 — Set Scene World Size
- Edit W/H in the Viewbar; commit on blur or Enter.

### A23 — Edit Scene YAML Text
- Open YAML populates the YAML textarea; you edit text; Load applies it back into the editor state.

### A24 — Load YAML Source
- Load from file picker in the Scene YAML pane, or load via Cloud panel.

### A25 — Save YAML
- Save As… writes the YAML textarea contents to disk.
- Save writes back to the last opened/saved file handle when available (otherwise routes to Save As…).

### A26 — Create Formation (arrange + template clone)
- Pick arrange preset + params + template sprite; create a new formation by cloning.

### A27 — Edit Entity Properties (Inspector)
- Position/size/rotation, hitbox, physics/collision layer, visual/asset selection & frame settings.

### A28 — Edit Formation Layout / Properties (Inspector)
- Convert layout (freeform/grid/arrange), tweak layout params.

### A29 — Manage Background Layers (Inspector)
- Add/reorder/remove layers; assign image; edit layer layout/tint/parallax/etc.

### A30 — Manage Scene Audio (Inspector)
- Set music (select or A21 drop), configure loop/volume/fade; add/remove ambience entries.

### A31 — Manage Input Maps (Project scope)
- Create/duplicate/remove maps; create actions; “capture” a key/mouse/gamepad binding.

### A32 — Configure Scene Input (Scene inspector)
- Choose active/fallback map; configure mouse drive entity + axis locks + hide cursor.

### A33 — Manage Collision Rules (Scene inspector)
- Add/update/remove collision rules between layers.

### A34 — Manage Trigger Zones
- Add/remove triggers; select trigger; edit trigger details in inspector.

### A35 — Attach / Edit Action Flow
- Attach action presets to an entity/group; reorder/remove; open behavior/action flow editor; add steps (MoveUntil/Wait/Call), reorder steps.

## Composite Workflows (built from atomic workflows)

### W1 — Basic Scene Layout (blocking + spacing)
- A1/A2 select → A8/A9 navigate → A10 optionally snap → A11 drag place → A12 fine nudge → A6 iterate.

### W2 — Formation Authoring (grouping existing sprites)
- A2 select multiple sprites → A16 create group → A11 move formation → A28 convert/tune layout → A17/A18 adjust membership.

### W3 — Formation Authoring (generate/cloned formation)
- A26 create formation (arrange+template) → A1 select formation → A28 tune layout params → A11/A12 position.

### W4 — Asset-to-Scene Placement
- A20 import asset → A21 drag asset onto canvas (create entity) → A27 tune entity.

### W5 — Background Layer Setup
- A20 import image → A21 drag image to Background Layers (or A29 add layer + select asset) → A29 tune layer settings → A6 iterate.

### W6 — Scene Audio Setup
- A20 import audio → A30 set music (select or A21 drop) → A30 tune loop/volume/fade → A30 add ambience entries.

### W7 — Input Setup (Project → Scene)
- A31 create map/actions/bindings → A32 choose active/fallback maps → A32 configure mouse drive entity.

### W8 — Collision Setup
- A27 set per-entity collision layer names → A33 add/update rules between layers → A7 test in Play mode.

### W9 — Trigger Setup
- A34 add/select zone → (inspector) edit zone properties/hooks → A7 test in Play mode.

### W10 — YAML Round-trip
- A25 export YAML → A23 edit YAML text → A24 load YAML → A6 undo/redo as needed.

### W11 — Mode-based Testing Loop
- Do any authoring workflow (W1–W9) → A7 toggle Play → validate → A7 back to Edit → A6 undo/redo or adjust.

## Repetitive / Redundant Workflows (same task, multiple ways today)

### Grouping (A16) has many inconsistent entrypoints
- Canvas selection bar “Group”
- Canvas top-right “Create Group”
- Canvas selection menu “Create Group from Selection”
- Inspector multi-select “Group” (with editable name)
- Keyboard Ctrl/Cmd+Shift+G (auto-name)

### Ungrouping spans different concepts + many entrypoints
- “Dissolve group” (A19) vs “remove selected sprites from groups” (A18) vs “remove member” (Entity List).
- Entry via canvas bar/menu, keyboard Ctrl/Cmd+Shift+U, sidebar overflow menu, per-member remove button.

### Asset import is duplicated
- Assets Dock imports images/spritesheets/audio/fonts.
- SpriteImportPanel imports sprites *as entities* (and exports YAML).
- AudioLibraryPanel imports audio (duplicated vs Assets Dock audio tab).

### YAML load sources are duplicated / fragmented
- Toolbar Load YAML (file picker / file input fallback)
- Cloud panel can load YAML into the editor
- YAML textarea exists but Load doesn’t live there (toolbar-only), increasing pointer travel.

### Mode toggle is duplicated (likely OK)
- Canvas overlay toggle, `Tab`, runtime also emits toggle-mode.

## Missing Workflows

### Replace an existing selected sprite’s asset by direct manipulation
- You can change an entity’s asset via Inspector dropdown (A27), and you can drag an asset to the canvas to create a *new* entity (A21), but there’s no obvious “drop asset onto selected sprite to replace its asset” workflow.

### Convert/relink an already-imported asset between Embedded ↔ Path
- Import supports embedded vs path at creation time, but there’s no clear “convert later” workflow.

### “Save” mental model (in-place save loop)
- UI shows “Unsaved” and supports Export YAML, but there’s no “Save to same file” workflow (only export-as / picker).

### Pan instruction mismatch
- Viewbar copy mentions “Shift + drag” panning, but panning is `Space`+drag or middle mouse.
