# Editor Workflows

This page is generated from `.plans/editor-workflows-inventory.md`.
Do not edit it by hand; update the inventory and regenerate this page instead.

This reference mirrors the workflow inventory in a docs-friendly format so tutorial pages can link to stable workflow sections without duplicating the source material.

## Atomic Workflows

### Canvas, selection, and viewport

#### A1 — Select Single
- Click a sprite, text entity, formation, or trigger zone on the canvas.
- Click a scene-graph row for a sprite, text entity, formation, trigger, or scene.

#### A2 — Select Multiple
- Shift-click sprite(s) on the canvas.
- Shift/Ctrl/Cmd-click sprite rows in the scene graph.
- Drag a marquee on empty canvas; hold `Shift` to merge the marquee result into the current selection.

#### A3 — Clear Selection
- Click empty canvas with no modifier.

#### A4 — Rename Item Inline
- In the scene graph, click an already-selected entity/group/scene row to rename inline.
- With keyboard focus in the scene graph, press `F2` to rename the selected ungrouped sprite, formation, or trigger.
- `Enter` saves; `Esc` cancels.

#### A5 — Open Local Actions Menu
- Click `⋯` on a scene-graph row, asset row, canvas selection bar, or action row.

#### A6 — Undo / Redo
- `Ctrl/Cmd+Z` undo.
- `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` redo.
- Or use the on-canvas `Undo` / `Redo` buttons.

#### A7 — Toggle Edit / Play
- Click `Play Mode / Edit Mode`.
- Or press `Tab`.

#### A8 — Pan View
- Hold `Space` and drag.
- Or middle-mouse drag.

#### A9 — Zoom View
- Mouse wheel zooms under the pointer.
- Or use `-` / `+` zoom buttons.

#### A10 — Fit / Reset View
- Use `Fit` to frame the current scene.
- Use `Reset` to restore default zoom.

#### A11 — Toggle Grid Snap
- Click `Snap: 8px / Off`.
- Or press `Ctrl/Cmd+G`.

#### A12 — Move Selection by Drag
- Drag selected sprite(s) or a selected formation on the canvas.

#### A13 — Move Selection by Nudge
- Arrow keys nudge by 1px.
- `Shift+Arrow` nudges by 10px.

#### A14 — Duplicate by Alt-drag
- `Alt`-drag a sprite selection on the canvas to duplicate and immediately move the copy.

#### A15 — Duplicate via Scene Graph Dialog
- Scene-graph sprite overflow `⋯` → `⧉ Duplicate…`.
- Configure whether to include attachments, handlers, and same-group placement.
- Confirm duplication.

#### A16 — Resize Bounds / Handles
- Select the thing that exposes editable bounds handles.
- Drag the handle on canvas.

#### A17 — Delete Selection / Item
- `Delete` / `Backspace` on a selection.
- Or remove via scene-graph overflow menus.

#### A18 — Open Layout Popover
- With 2+ sprites selected, use `Layout…` from the on-canvas selection bar.

#### A19 — Apply Layout Operations
- In the layout popover: distribute X/Y, set fixed spacing X/Y, set selection center X/Y, align selection to world edges/center, stack centers, or match edges.

### Grouping and formations

#### A20 — Group Selection into a Formation
- Select 2+ ungrouped sprites.
- Use `Group…` from the on-canvas selection bar, the selection menu, or `Ctrl/Cmd+Shift+G`.
- Name the formation and confirm.

#### A21 — Add Selected Sprites to an Existing Formation
- Select sprite(s).
- Open the canvas selection menu.
- Choose a target formation under `Add to formation…`.

#### A22 — Remove Selected Sprites from Their Formation
- Select grouped sprite(s).
- Click `Remove from formation` on the selection bar or selection menu.

#### A23 — Dissolve Formation
- Select a formation.
- Click `Dissolve` on the selection bar, in the selection menu, or press `Ctrl/Cmd+Shift+U`.

#### A24 — Reparent / Reorder via Scene Graph Drag and Drop
- Drag sprite rows onto a formation to add them.
- Drag grouped sprites within a formation to reorder member order.
- Drag grouped sprites onto the `Sprites` section to ungroup them.
- Drag ungrouped sprite rows within `Sprites` to reorder `spriteOrder`.

#### A25 — Start Formation Draft
- Scene graph → `Formations` → `+ Add`.
- Scene-graph sprite overflow `⋯` → `Create formation from…`.
- Assets Dock image/spritesheet overflow `⋯` → `Create formation from…`.

#### A26 — Edit / Commit Formation Draft
- In the floating draft panel, choose template source, name, preset, count, and params.
- Drag the draft panel by its title.
- `Enter` commits; `Esc` cancels.

### Scene graph and scene management

#### A27 — Expand / Collapse Scene
- Click the scene chevron in the scene graph.

#### A28 — Expand / Collapse Formation Members
- Click the formation chevron in the scene graph.

#### A29 — Create Scene
- Project Tree → `Scenes` → `+ Add`.

#### A30 — Set Current Scene
- Click a scene row.

#### A31 — Manage Scene Metadata
- Scene overflow `⋯` → `Rename…`, `⧉ Duplicate Scene`, `★ Set as Base / Clear Base`, `Clear Scene…`, or `Delete…`.

#### A31a — Manage Project Root
- Project Tree header → `Manage` → `Create New`, `Open...`, `Toggle Sync Mode`, `Import YAML`, `Export as YAML`, `Rename`, `History`, or `Clear Project ...`.
- `Rename` opens inline rename on the project root row.
- `History` swaps the left pane into `Project Revisions`.

#### A31b — Browse Project Revisions
- Project Tree header → `Manage` → `History`.
- Select a revision row to preview it in the canvas.
- Use `Restore...` or `Copy...`, or use the back arrow to return to Project Tree.

#### A32 — Create Sprite from an Existing Asset
- Drag an image/spritesheet asset onto the canvas.
- Double-click an image/spritesheet in Assets Dock.
- Scene graph → `Sprites` → `+ Add ▾` → `Sprite (from Asset)` → choose asset.

#### A33 — Create Text Entity
- Scene graph → `Text` → `+ Add`.

#### A34 — Select with Keyboard in Scene Graph
- With focus inside the scene graph, `↑/↓` moves the selected ungrouped sprite, formation, or trigger within its visible section.

### Assets

#### A35 — Switch Asset View
- In Assets Dock, search assets and switch tabs between `Images`, `Audio`, and `Fonts`.
- Toggle image thumbnails on/off.

#### A36 — Import Assets
- Assets Dock → `+ Add` → `From device…`.
- Assets Dock → `+ Add` → `From demo pack`.

#### A37 — Drag Asset to a Target
- Drag image/spritesheet asset to canvas empty space to create a sprite.
- Drag image/spritesheet asset onto an existing canvas sprite to replace its asset.
- Drag image asset onto Background Layers to create/replace a layer.
- Drag audio asset onto Scene Music to assign music.

#### A38 — Manage Asset Row Actions
- Asset overflow `⋯` → `Rename…`, `Delete…`.
- Image/spritesheet asset overflow also offers `Create formation from…`.

### Inspector: entities, formations, actions, scene systems

#### A39 — Edit Single Entity Properties
- In Inspector, edit transform, sprite size, text settings, hitbox, physics, visual settings, asset selection, frame settings, alpha/visibility/depth, and flip.
- Text entities can also be rasterized to a sprite.
- If the entity is in a formation, `Apply Asset to Formation` pushes the chosen asset to sibling members.

#### A40 — Edit Multi-selection Properties
- With 2+ sprites selected, use the multi-entity inspector to bulk-edit shared transform/scale/rotation/origin, flip, alpha, visibility, and depth.

#### A41 — Edit Formation Properties
- In Inspector, rename the formation, inspect member count/layout summary, convert layout type, open the layout inspector, edit layout params, select/remove individual members, and delete the formation.

#### A42 — Create / Edit Event Blocks
- In `Actions/Events`, add an event block.
- Rename it and choose trigger type: scene start, update, input action, visible edge, or custom event.
- Switch between `Handlers` and `Wiring`.

#### A43 — Create / Edit Action Steps
- Use `+ Add Action` or an action overflow menu to add above, below, or as a child.
- Drag actions to reorder.
- Open an action to edit its parameters in the attachment inspector.
- Remove one or many selected actions.

#### A44 — Group / Ungroup Parallel Actions
- Select multiple actions and click `Make Parallel`.
- Select a parallel group and `Ungroup`.
- Drag a parallel group to reorder it among sibling rows.

#### A45 — Create / Apply Patterns and Loop Templates
- Select actions → `Convert → Pattern`.
- In the Action Library, apply an existing pattern.
- Use loop templates such as repeat variants, including `Repeat with Children…`.

#### A46 — Edit Attachment Details
- Select an action row or `Open` it from overflow.
- Edit its name, enabled state, target application mode, preset-specific parameters, and remove it.
- Use `Back to Actions/Events` to return from the attachment inspector.

#### A47 — Manage Background Layers
- Add a layer, select a layer, reorder up/down, remove it, assign image asset, and edit layout/depth/alpha/parallax/tint.
- Dragging an image asset onto the panel can add or replace a layer.

#### A48 — Manage Scene Audio
- Assign or clear scene music.
- Edit music loop, volume, and fade.
- Add/remove ambience rows and edit each ambience asset, loop, and volume.
- Dragging an audio asset onto the Music field assigns music.

#### A49 — Manage Input Maps (Project Scope)
- Project Tree → `Input Maps` → `+ Add`.
- Select a map from the tree-style list, use the row `⋯` menu to duplicate/remove/set default, or use the details panel to clear/set the project default.
- Create a new action by binding it, and capture keyboard/mouse/gamepad input for an action.

#### A50 — Configure Scene Input
- Pick active and fallback maps.
- Jump directly to the Project Tree input maps panel with `Edit Input Maps…`.
- Configure mouse cursor hiding, drive entity, and axis locks.

#### A51 — Manage Collision Rules
- Add a collision rule, edit its layer pair and behavior, and remove it.

#### A52 — Manage Trigger Zones
- Scene graph → `Trigger Zones` → `+ Add`.
- Select a trigger zone or delete it from the scene graph.

#### A53 — Edit Trigger Zone Details
- In Inspector, edit enabled/name/x/y/width/height.
- Configure enter/exit/click operations and their parameters.
- Delete the trigger zone.

#### A54 — Manage Counters
- Add global or scene counters.
- Edit name, scope, value, and derived collection.
- Remove counters.

#### A55 — Manage Collections
- Add a collection.
- Edit its name.
- Include/exclude entities and formations as members.
- Remove collections.

### Project, files, panes, and cloud

#### A56 — Switch Sidebar Scope
- Click `Scene` or `Project` in the left sidebar.

#### A57 — Manage Project Library
- Project Tree header → `Manage` → `Open...`.
- In the popup, filter/search/open recent projects and refresh cloud-backed projects.
- Project Tree header → `Manage` → `Create New`.
- Project Tree header → `Manage` → `Import YAML`.
- Project Tree header → `Manage` → `Export as YAML`.

#### A58 — Toggle Sync Mode
- Click the toolbar `Online / Offline` badge.
- Or use Project Tree header → `Manage` → `Toggle Sync Mode`.

#### A60 — Open / Save YAML from the Viewbar
- `Open YAML…`
- `Save YAML`
- `Save YAML As…`

#### A61 — Set Scene World Size
- Edit `W` / `H` in the viewbar and commit on blur or `Enter`.

#### A62 — Switch Inspector / Cloud Pane
- In cloud-enabled deployments, switch the right pane between `Inspector` and `Cloud`.

#### A63 — Cloud Account Access
- In the Cloud pane, log in or create an account with invite code.
- Log out from the signed-in account surface.

#### A64 — Resolve Cloud vs Device Workspace Conflict
- Only for ambiguous cloud recovery cases such as offline divergence, compare cloud vs device YAML summaries.
- Export both snapshots, choose cloud, or keep device.
- For linked online projects, startup keeps the device workspace active and older cloud versions are recovered through Manage/History instead of a startup conflict prompt.

#### A65 — Connect / Switch / Disconnect GitHub
- In the Cloud pane, connect GitHub, switch the linked GitHub account, or disconnect it from PhaserForge.

#### A66 — Publish to GitHub Pages
- In the Cloud pane, set project title and repository name.
- Run publish precheck.
- Confirm overwrite/update/create as needed.

#### A67 — Adjust UI Scale
- Use the toolbar `UI Scale` slider.

#### A68 — Change Theme
- Use the toolbar theme buttons: system, light, dark.

#### A69 — Resize Workspace Panes
- Drag the left sidebar splitter.
- Drag the right inspector/cloud splitter.
- Drag the Assets Dock horizontal splitter inside the left sidebar.

#### A70 — Dismiss the View Hint
- Dismiss the one-time `View Controls` hint overlay.

#### A71 — Pin Selection While Dragging
- In Inspector, toggle `Pin selection while dragging`.

## Composite Workflows

### W1 — Basic Scene Layout
- A1/A2 select → A8/A9/A10 navigate → A11 optionally snap → A12 place → A13 fine-tune → A6 iterate.

### W2 — Group Existing Sprites into a Formation
- A2 select multiple sprites → A20 group → A41 adjust formation → A21/A22/A24 refine membership/order.

### W3 — Create a Formation from a Template
- A25 start draft → A26 edit template/preset/count/params → commit → A41 refine layout and members.

### W4 — Asset Import to Sprite Placement
- A36 import asset → A32 create sprite from asset → A39 tune the created sprite.

### W5 — Asset Replacement
- A35 find asset → A37 drag asset onto an existing canvas sprite → A39 refine frame/size/visual settings.

### W6 — Background Setup
- A36 import image → A37 drag image to Background Layers or A47 add a layer manually → A47 tune layer settings.

### W7 — Scene Audio Setup
- A36 import audio → A48 assign music → A48 add ambience rows → A7 test in Play mode.

### W8 — Input Setup
- A49 create/select maps and bind actions → A50 choose scene active/fallback maps → A50 configure mouse drive and cursor behavior.

### W9 — Collision Setup
- A39 set per-entity collision settings as needed → A51 add/edit collision rules → A7 test in Play mode.

### W10 — Trigger Authoring
- A52 add/select trigger zone → A53 edit geometry and enter/exit/click behavior → A7 test in Play mode.

### W11 — Entity Behavior / Event Authoring
- A1 select entity → A42 create handler → A43 add/reorder actions → A45 optionally convert/apply patterns → A46 tune an action → A7 test.

### W12 — Formation Behavior / Event Authoring
- A1 select formation → A42 create handler → A43/A44/A45 build grouped action flow → A7 test.

### W13 — Bulk Edit Pass
- A2 multi-select sprites → A18/A19 normalize spacing or alignment → A40 bulk-edit shared visuals/transform values.

### W14 — Project Switching / Recovery
- A57 open/create/duplicate/import/export a project → A58 choose Online vs Offline behavior → Manage `Clear Project ...` when you need a fresh empty scene.

### W15 — Local File Round-trip
- A60 open YAML or project import → edit via W1-W13 → A60 save in place or save as.

### W16 — Cloud Publish Loop
- A63 sign in → A65 connect GitHub → A66 precheck and publish → verify the Pages URL.

### W17 — Workspace Conflict Recovery
- A63 sign in → if an offline/ambiguous divergence is detected, A64 compare cloud/device snapshots → keep the desired workspace → continue editing or publish.
- For normal linked online startup, continue editing immediately and use Manage/History to restore or copy an older cloud-backed revision when needed.

### W18 — Multi-scene Authoring
- A29 create scene → A30 switch scene → use W1-W13 inside that scene → A31 duplicate/base/clear/delete scene as needed.

## Repetitive / Redundant Workflows

### Creating a sprite from an existing asset has three entry points
- A32 supports drag-to-canvas, double-click in Assets Dock, and scene-graph `Sprites → + Add ▾`.
- Recommendation: keep drag-to-canvas as the primary path and decide whether the other two are backups or unnecessary duplication.

### YAML import is split across two surfaces
- A57 `Import…` in Project scope and A60 `Open YAML…` in the viewbar both load YAML into the editor.
- Recommendation: choose one primary import surface and make the other clearly secondary.

### Sync mode is toggled in two places
- A58 is available in both the toolbar and the Project picker.
- Recommendation: this is probably acceptable, but one should be the obvious primary control.

### Formation creation is reachable from several starting points
- A25 starts from `Formations + Add`, sprite overflow, and asset overflow.
- Recommendation: this is defensible because each path starts from a different user intent, but the draft should be presented as the single canonical next step.

### Group removal uses several paths
- A22/A23 are available from the canvas selection bar, canvas selection menu, scene-graph drag/drop, and keyboard shortcut.
- Recommendation: keep the near-cursor selection bar as the primary path and treat the rest as accelerators.

### GitHub connect appears in both account and publish areas
- A65 can be started from the account section and the publish CTA.
- Recommendation: acceptable, but the publish CTA should likely be the primary route because it preserves intent.

## Missing or Incomplete Workflows

### No workflow to remove a single input binding or delete an action from a map
- A49 supports creating maps and adding bindings, but there is no visible per-binding removal flow and no explicit delete-action flow short of removing the entire map.

### Multi-select editing is still partial
- A40 covers only a subset of transform/visual fields.
- Text, hitbox, physics, asset reassignment, and actions/events remain disabled for multi-select.

### Cloud is no longer a project browser/editor surface
- The current Cloud pane is account/publish/conflict-resolution focused.
- If explicit cloud save/load/browse workflows are still a product goal, they are currently missing as user-facing workflows.
