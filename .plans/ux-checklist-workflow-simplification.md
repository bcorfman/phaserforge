# UX Checklist — Workflow Simplification (Intuitive → Fewer Steps → Shorter Pointer Travel)

Goal: reduce “many ways to do the same thing” so there is one obvious, simplest path for each common task, and keep related controls co-located to minimize *shorter pointer travel distance*.

This checklist is intentionally concrete: for each major task it defines a **recommended single obvious path**, plus what to **delete / merge / rename** so the editor stops offering multiple competing ways to do the same thing.

Source of truth for naming: `.plans/editor-workflows-inventory.md`.

## 0) Single Obvious Path (by major task)

- Selection (single): **A1** (canvas click; Entity List click stays as parity).
- Selection (multi): **A2** (marquee + Shift-add; Entity List Shift/Ctrl-add stays as parity).
- Rename item: **A4** (inline rename in Entity List); context “Rename…” should route into A4.
- Group: **A5 → Group…** (Selection Actions menu; one consistent “Group…” that always prompts for name) + shortcut routes into same prompt.
- Ungroup sprites: **A5 → Remove from formation** (not “Ungroup”, avoid multiple verbs).
- Dissolve formation: **A5 → Dissolve formation**.
- Import any asset: **A20** (Assets Dock only).
- Place new sprite from asset: **A21** (drag asset to canvas).
- Replace sprite’s asset: **A21** (drag asset onto sprite) + visible affordance so it’s discoverable.
- Background image assignment: **A21** (drag to Background Layers) or **A29** (Inspector picker as secondary).
- Music assignment: **A21** (drag to Scene Music) or **A30** (Inspector picker as secondary).
- Local YAML round-trip: **A23/A24/A25** (Viewbar YAML controls; cloud stays cloud-only).
- Cloud YAML round-trip: **A52/A53** (Cloud panel; local file controls stay in Viewbar).
- Toggle Edit/Play: **A7** (Tab as primary; button as parity).
- View navigation: **A8/A9** (Space+drag / MMB drag; wheel zoom; Viewbar buttons as parity).
- Grid snap: **A10** (Ctrl/Cmd+G as primary; button as parity).
- Formation authoring: **W2/W3** (create/tune in Inspector + direct manipulation).
- Actions/Events authoring: **W14** (**Actions/Events** panel is the only “discover → create handler → edit steps” surface; no separate Attached Actions UI).

## 1) Selection + Grouping / Ungrouping

- [x] **Keep (primary):** Selection bar `…` menu (**A5**) for all selection actions (Group / Remove from formation / Dissolve / Delete / Duplicate / Create formation from…).
- [x] **Keep (parity):** keyboard shortcuts (e.g. Ctrl/Cmd+Shift+G) route into the same UI + naming semantics as A5 (opens Group… prompt).
- [x] **Delete / merge:**
  - [x] Remove “Create Group” button variants that aren’t in A5 (top-right “Create Group”, inline buttons, etc.).
  - [x] Remove Inspector grouping entrypoints that duplicate A5 (Ungroup/Dissolve/Delete buttons removed from Group inspector).
- [x] **Rename (terminology standardization):**
  - [x] Replace “Ungroup” labels (for sprites) with **Remove from formation**.
  - [x] Replace “Dissolve group” labels with **Dissolve formation** (keep “formation” consistently across UI).
- [x] **Style contract check:** near-cursor actions stay near-cursor; grouping actions are not in Inspector.

## 2) Asset Import + Assignment

- [x] **Keep (primary):** Assets Dock import (**A20**) for images/spritesheets/audio/fonts.
- [x] **Keep (primary):** drag-drop assignment (**A21**) for:
  - [x] Create new sprite (drop on canvas),
  - [x] Replace sprite asset (drop on sprite),
  - [x] Assign background image (drop on Background Layers),
  - [x] Assign scene music (drop on Scene Music).
- [x] **Delete / merge:**
  - [x] Remove direct “Import” entrypoints from `SpriteImportPanel` as a competing importer; keep only Assets Dock “Advanced…” using `SpriteImportPanelView`.
  - [x] Fold/remove `AudioLibraryPanel` (removed; Assets Dock remains the audio import surface).
- [x] **Add affordance (discoverability):**
  - [x] Dragging an image/spritesheet over a sprite shows a replace/create hint tooltip (canvas drag hint).

## 3) YAML Round-trip (tight local loop)

- [x] **Keep (primary, local files):** Viewbar YAML controls (**A23/A24/A25**).
- [x] **Keep (primary, cloud):** Cloud panel (**A52/A53**) for cloud load/save only.
- [x] **Delete / merge:**
  - [x] Do not add any additional local file “Open/Save” entrypoints elsewhere (YAML panel, Inspector, etc.); Viewbar stays the single local file door.
  - [x] Cloud panel must not add “Open local YAML” actions; cloud and local remain separated to avoid duplicate workflows.

## 4) Viewport Navigation Consistency

- [x] **Fix copy:** Viewbar instructions match implementation (A8): `Space + drag` or `middle mouse drag`.
- [x] **Optional discoverability:** on-canvas hint shows while Space is held (“Pan mode: drag to move view”).

## 5) Missing / Under-supported Workflows

- [x] **Add workflow:** Convert/relink asset Embedded ↔ Path after import (project-level).
  - [x] Add `Relink…` action on asset row in Assets Dock.
  - [x] Keeps the same assetId so existing references remain intact.

## 6) Audit Pass (to confirm simplification worked)

- [x] For each major task (group, remove from formation, dissolve formation, import asset, place asset, replace asset, YAML loop local, YAML loop cloud, audio, input maps, actions/events), confirm:
  - [x] There is **one primary path** that is discoverable.
  - [x] Secondary paths (shortcuts) are consistent with the primary path, not separate behaviors.
  - [x] The path keeps UI interactions **co-located** (short pointer travel) where possible.
