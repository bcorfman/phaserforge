# Editor Workflows Inventory (Atomic + Composite)

This document inventories the workflows currently used in the editor UI and gestures.

## Atomic Workflows (building blocks)

These are the smallest user-visible workflows. Larger workflows below reference these by name.

### A1 — Select Single
- Click sprite/formation on canvas, or click it in the left sidebar list (Entity List).
- In Entity List: when a list item row is focused, `↑/↓` moves the highlight to the previous/next item in that list.

### A2 — Select Multiple
- Shift/Ctrl/Cmd-click sprites in the Entity List (additive selection).
- Shift-click sprite on canvas (add to selection).
- Drag a marquee rectangle on empty canvas (Shift to merge with existing selection).

### A3 — Clear Selection
- Click empty canvas (no Shift) to clear selection.

### A4 — Rename Item (inline)
- In Entity List: click an already-selected entity/group/scene/trigger to enter rename; `Enter` saves, `Esc` cancels.
- In Entity List: `F2` renames the highlighted sprite/formation/trigger (when a list row is focused).

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
- Alternative (Entity List): sprite row overflow `⋯` → `⧉ Duplicate…` (duplicates the full multi-selection when 2+ sprites are selected).

### A14 — Resize Bounds (drag handles)
- Select the thing that exposes bounds handles, then drag a bounds handle.

### A15 — Delete Selection
- `Delete`/`Backspace`, or remove via sidebar overflow menus (entity/group/scene/trigger).
- In Entity List: sprite row overflow `⋯` → `Delete…` deletes the full multi-selection when 2+ sprites are selected.

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

### A23 — Open YAML
- Use “Open YAML…” in the Viewbar (Viewport pane) to pick a `.yaml/.yml` file and load it directly into the editor state.
- Cloud panel can also load YAML into the editor.

### A24 — Save YAML
- “Save YAML” writes the *current project YAML* back to the last opened/saved file handle when available (otherwise routes to Save As…).

### A25 — Save YAML As
- “Save YAML As…” writes the *current project YAML* to a chosen location (File System Access API when available; download fallback otherwise).

### A26 — Create Formation (arrange + template clone)
- Pick arrange preset + params + template sprite; create a new formation by cloning.

### A27 — Edit Entity Properties (Inspector)
- Position/size/rotation, hitbox, physics/collision layer, visual/asset selection & frame settings.
- Events are shown after the core property foldouts so Handlers/Wiring tabs are visually scoped to only the Events panel.

### A28 — Edit Formation Layout / Properties (Inspector)
- Convert layout (freeform/grid/arrange), tweak layout params.
- Events are shown after formation editing foldouts so Handlers/Wiring tabs are visually scoped to only the Events panel.

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

### A36 — Apply Pattern to Event
- In an Event card: click `+ Add…` → `Pattern` → select a Pattern.
- If prompted, fill parameters → `Apply`.

### A37 — Create Pattern from selected steps
- Select 1+ steps in an Event card → `Convert → Pattern` → name it → confirm.

### A38 — Switch Sidebar Scope (Scene ↔ Project)
- In the left sidebar, click `Scene` or `Project` tabs.

### A39 — Expand / Collapse a Scene in the Scene Graph
- In Entity List → Scenes, click the chevron (▸/▾) next to a scene.

### A40 — Create Scene
- Entity List → Scenes → `+ Add`.

### A41 — Set Current Scene
- Entity List → Scenes → click a scene name.

### A42 — Rename Scene
- Entity List → Scenes → overflow menu `⋯` → `Rename…` (or click an already-selected scene row to inline-rename) → `Enter` to save / `Esc` to cancel.

### A43 — Duplicate Scene
- Entity List → Scenes → overflow menu `⋯` → `⧉ Duplicate Scene`.

### A44 — Set / Clear Base Scene
- Entity List → Scenes → overflow menu `⋯` → `★ Set as Base` / `★ Clear Base`.

### A45 — Delete Scene
- Entity List → Scenes → overflow menu `⋯` → `Delete…` (disabled if it would delete the last remaining scene).

### A46 — Reparent Entities via Scene Graph Drag/Drop
- In Entity List: drag selected sprite(s) onto a formation (group) row to add them to that formation.
- Drag sprite(s) onto the “Sprites” section to remove them from formations.

### A47 — Create Formation Draft (from an existing entity)
- Entity List → a sprite row overflow `⋯` → `Create formation from…` (opens a draft popup).
- In the draft popup: pick arrange preset/params → `Create`.

### A48 — Resize Assets Dock (sidebar splitter)
- Drag the horizontal splitter between Entity List and Assets Dock.

### A49 — Configure Startup Mode
- Project tab → Startup & Reset → `Startup mode` select (Reload Last YAML / New Empty Scene).

### A50 — Adjust UI Scale
- Toolbar → `UI Scale` slider.

### A51 — Change Theme (System/Light/Dark)
- Toolbar → theme toggle buttons.

### A52 — Open / Switch Project
- Project tab → `Projects` picker → optionally search/filter → `Open`.
- The picker now merges Local and Cloud-backed cached projects into one recent surface, while `Cloud` remains account/publish only.

### A53 — Create or Duplicate Project
- Project tab → `New Project` creates a new local project and switches the editor to it.
- Project tab → `Active Project Summary` → `Duplicate` creates a local copy and opens it.

### A54 — Cloud Load YAML
- Cloud panel → select a saved project → `Load`.

### A55 — Cloud Save YAML
- Cloud panel → `Save` (saves current YAML to the selected/active cloud project).

### A56 — Cloud Account Access
- Cloud panel → `Log in` tab (default) → enter email/password → `Log in`.
- First-time access: Cloud panel → `Create account` tab → enter email/password/invite code → `Create account`.

### A57 — Connect GitHub for Publishing
- Cloud panel → once signed in, click `Connect GitHub` → continue to GitHub. If GitHub already recognizes the authorization, the connection may complete immediately.
- If a different GitHub account is already linked, use `Switch GitHub…` from the signed-in account section. To actually switch accounts, first sign into that GitHub account in the browser or use a private window.

### A58 — Disconnect GitHub from PhaserForge
- Cloud panel → `Disconnect` removes the stored GitHub link/token from PhaserForge only.
- To revoke GitHub-side authorization entirely, follow the `GitHub authorized OAuth apps` link from the Cloud panel.

### A59 — Toggle Project Sync Mode
- Toolbar badge or Project tab header → `Online` / `Offline`.
- `Offline` marks the current working session as local-first; `Online` restores normal cloud-backed intent for linked projects.

### A60 — Manage Counters (Project + Scene)
- Scene State → Counters → `+ Add Global Counter` / `+ Add Scene Counter` → edit name/scope/value; delete via row controls.

### A61 — Manage Collections
- Scene State → Collections → `+ Add Collection` → edit derived-from + members; delete via row controls.

### A62 — Pin Selection While Dragging (Inspector)
- Inspector → enable `Pin selection while dragging` (selection stays stable while manipulating UI).

### A63 — Reset Project to New Empty Scene
- Project tab → Startup & Reset → `Reset Now → New Empty Scene` (confirm).

### A64 — Clear Scene Contents
- Scene tab → Scenes → overflow menu `⋯` → `Clear Scene…` (confirm).

### A65 — Layout Selection (Arrange / Position)
- With 2+ sprites selected: on-canvas selection bar → `Layout…`
- **Arrange items** (changes internal spacing):
  - `Distribute X/Y` spaces items evenly between endpoints (stable sort along the chosen axis).
  - `Apply Spacing X/Y` enforces fixed center-to-center spacing (units in Grid cells or Pixels).
- **Position selection** (moves the selection as one; preserves spacing):
  - `Set X / Set Y / Set X+Y` shifts the *selection bounds center* to the target value(s).
  - `Align selection` moves the *selection bounds* to world edges/center (Center targets the world center by default).
- **Advanced** (explicit overlap / edge matching):
  - `Stack …` intentionally overlaps by aligning item centers to the anchor item.
  - `Match … edges` aligns item edges to the anchor item.

### A66 — Create Text Entity
- Entity List → Scenes → Text → `+ Add`.

### A67 — Right Pane Startup Routing
- On cloud deployments, if auth is unresolved or no user is signed in, the right pane starts on `Cloud`.
- On cloud deployments, if a user is already signed in, the right pane starts on `Inspector`.
- After starting GitHub connect/switch from the Cloud panel, the right pane stays on `Cloud` after auth returns so the success state remains visible.
- On localhost/local deploys, the right pane stays `Inspector` only (no Cloud tab).

## Composite Workflows (built from atomic workflows)

### W1 — Basic Scene Layout (blocking + spacing)
- A1/A2 select → A8/A9 navigate → A10 optionally snap → A11 drag place → A59 arrange/position → A12 fine nudge → A6 iterate.

### W2 — Formation Authoring (grouping existing sprites)
- A2 select multiple sprites → A16 create group → A11 move formation → A28 convert/tune layout → A17/A18 adjust membership.

### W3 — Project Switching / Recovery
- A52 search/filter/open an existing project or A53 create/duplicate one.
- A59 toggle `Online` / `Offline` as needed.
- A49/A63 remain below the picker for startup/reset behavior on the active project.

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

### W10 — YAML Import / Export
- A25 Save YAML As… (export) or A23 Open YAML (import) → A6 undo/redo as needed.

### W11 — Mode-based Testing Loop
- Do any authoring workflow (W1–W9) → A7 toggle Play → validate → A7 back to Edit → A6 undo/redo or adjust.

### W12 — Multi-Scene Authoring Loop
- A40 create scene (optional) → A41 pick scene → (W1/W2/W3/W4/W5/W6/W7/W8/W9) author → A43 duplicate (optional) → A44 set base (optional).

### W13 — Cloud Round-trip Loop
- A53 cloud save → refresh/load on another device/session → A52 cloud load → A7 test → A24/A25 local export (optional).

### W14 — Cloud Publish Setup Loop
- A54 access cloud account → A55 connect GitHub for publishing → A53 cloud save (if needed) → publish from the Cloud panel.

### W14 — Event Authoring (discover → create handler → attach actions)
- A27/A28 select target → Events panel: pick an event from Events list → create handler on target → use A35 to add/edit action steps → A36 apply pattern (optional) → A7 test.

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
- Cloud panel can load YAML into the editor.
- Viewbar contains the local file Open/Save/Save As entrypoints (single primary surface for file-based YAML).

### Mode toggle is duplicated (likely OK)
- Canvas overlay toggle, `Tab`, runtime also emits toggle-mode.

### Action attachment editing is duplicated / fragmented
- Attached Actions panel vs Events panel both provide “add/reorder/remove/make-parallel/repeat children” UIs.
- Similar affordances exist again in some Inspector surfaces via Event foldouts.

## Missing Workflows

### Asset replacement discoverability (drag-drop exists, but may not be obvious)
- A21 supports dropping an asset onto an existing sprite to replace its asset, but the workflow is easy to miss without a visible “replace” hint/affordance.

### Convert/relink an already-imported asset between Embedded ↔ Path
- Import supports embedded vs path at creation time, but there’s no clear “convert later” workflow.

### “Save” mental model (in-place save loop)
- Viewbar supports “Save YAML” (in-place when a writable file handle exists) and “Save YAML As…” for first-time export.

### Pan instruction mismatch
- Viewbar copy mentions “Shift + drag” panning, but panning is `Space`+drag or middle mouse.
