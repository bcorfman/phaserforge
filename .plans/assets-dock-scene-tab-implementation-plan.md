# Implementation Plan — Option A “Docked Assets Splitter” (`ux-idea-g2-scene-tab-with-assets-splitter.svg`)

## Summary
Implement a **docked Assets panel** in the **Scene tab sidebar** (resizable splitter) to make the core loop fast: **import once → drag/assign → iterate scenes**. Remove all per-feature import panes (Sprite import, Audio import, background “pick file”) and replace them with **asset references** to globally-imported, named assets.

Day‑1 scope: **Images + Audio + Fonts**.

---

## Key Changes

### 1) Data model: introduce reusable asset refs for sprites (backward compatible)
**Goal:** entities stop embedding image data; they reference named assets, matching audio/background behavior.

- Extend `SpriteAssetSource` union in `src/model/types.ts` with:
  - `{ kind: 'asset'; assetId: Id }`
- Add `name?: string` (display name) to asset specs:
  - `ImageAssetSpec`, `SpriteSheetAssetSpec`, `AudioAssetSpec`, and new `FontAssetSpec`
- Add `assets.fonts: Record<Id, FontAssetSpec>` under `ProjectSpec.assets`
- Backward compatibility:
  - Existing YAML with `embedded`/`path` entity sprite sources continues to work.
  - New UI uses `kind: 'asset'` by default.

**Policies**
- **Asset IDs are immutable** in v1; only `name` (display label) is editable.
- Asset deletion is **blocked if referenced** (UI shows “Used by …” and prevents delete).

### 2) EditorStore actions (TDD-first)
Add reducer + helper coverage before wiring UI.

New/updated actions in `src/editor/EditorStore.tsx`:
- `add-image-asset-from-file|path` (adds to `project.assets.images`)
- `add-spritesheet-asset-from-file|path` (adds to `project.assets.spriteSheets` with grid)
- `add-font-asset-from-file|path` (adds to `project.assets.fonts`)
- `set-asset-display-name` (per asset kind; edits `name`)
- `remove-asset` (per kind; **must refuse if referenced** and set `error`/status)
- `create-entity-from-asset` (image/spritesheet → inserts `EntitySpec` with `asset.source.kind='asset'`)
- `assign-asset-to-target` (drop/picker semantics):
  - background layer slot → sets/creates `BackgroundLayerSpec.assetId`
  - scene music/ambience → set `SceneMusicSpec.assetId` / append ambience
  - entity sprite → set entity `asset.source.kind='asset'` + preserve frame where possible

Reference detection helper (unit-tested):
- `getAssetReferences(project, assetKind, assetId) -> { count, locations[] }`
  - Tracks: background layers, scene music/ambience, entities with asset refs.
  - Audio “MUS/AMB/SFX” badges are inferred from usage, not stored.

### 3) Runtime/compiler support for `SpriteAssetSource.kind='asset'`
**Goal:** preview/edit rendering and play mode can resolve assetId → actual texture data.

- Update asset loading/lookup layer used by Phaser/compile pipeline to:
  - Resolve `assetId` to `project.assets.images[assetId]` or `project.assets.spriteSheets[assetId]`
  - Use that asset’s `source.kind` (`embedded` or `path`) to load the texture
  - For spritesheet assets, use the grid from `SpriteSheetAssetSpec.grid`
- Ensure existing embedded/path-per-entity still works unchanged.

### 4) UI: Docked Assets panel inside Scene tab (splitter)
Implement the UX shown in `ux-idea-g2…svg`:

- In `src/editor/EntityList.tsx` (Scene tab sidebar):
  - Render **Scene Tree (top)** + **Assets Dock (bottom)** with a draggable splitter.
  - Persist splitter height in `localStorage` (e.g. `phaseractions.assetsDockHeight.v1`) with min/max clamps.
- Assets Dock UI:
  - Search box, type filter pills: Images / Audio / Fonts.
  - List items show:
    - `display: (asset.name ?? asset.id)`
    - usage badges for audio inferred from scene references.
  - `+ Import` opens an import flow that supports:
    - Image (single), Spritesheet (requires frame width/height), Audio, Font
    - Source mode: Embedded file or Asset path (reuse patterns from existing import panels)
  - Asset row overflow menu (`⋯`):
    - Edit Display Name…
    - Delete… (disabled if referenced; shows reference summary)

### 5) “No pane bouncing”: assign/creation flows from Scene tree
Remove old “import in project tab” approach entirely.

- Remove/retire these UI entrypoints:
  - `SpriteImportPanel` / “Import Sprites” section
  - `AudioLibraryPanel` / “+ Add Audio”
  - BackgroundLayers “pick file to add” flow
- Replace with:
  - **Drag & drop**
    - Drag Image/Spritesheet asset from dock → canvas: **creates sprite at drop point**
    - Drag Image asset → Background row/layer slot: assigns `assetId`
    - Drag Audio asset → Music/Ambience slots: assigns `assetId` (music replaces; ambience appends)
  - **`+ Add` on Scene features**
    - When a Scene feature requires an asset, it focuses the Assets dock and pre-filters to the required type.
    - If missing, user clicks `+ Import` (dock stays visible) and immediately drags/assigns.

### 6) Tests + acceptance criteria (TDD requirement)
Unit (Vitest):
- Reducer tests for new asset actions, including:
  - add image/audio/font assets
  - create entity from asset
  - assign asset to background/music/entity
  - delete asset blocked when referenced
  - display-name edits do not change references
- Serialization/migration tests:
  - round-trip new `assets.fonts`
  - ensure old YAML still loads

E2E (Playwright):
- Import image asset in dock → drag to canvas → entity appears with asset ref
- Import audio asset in dock → assign to scene music → play mode snapshot uses it
- Attempt delete referenced asset → blocked with visible error/status
- Splitter persists after reload

Acceptance criteria:
- No remaining UI path imports sprites/audio/background directly outside Assets dock.
- Scene editing + asset selection are visible simultaneously (splitter).
- Entities created via dock use `SpriteAssetSource.kind='asset'`.
- Existing projects with embedded/path entity sprites still render.

---

## Assumptions / Defaults
- Assets dock is implemented **in Scene tab only** (Option A); Project tab no longer hosts import panels.
- Audio MUS/AMB labeling is **inferred from usage**; no stored category metadata in v1.
- Asset IDs remain immutable; only `name` is editable.
- Deleting assets is blocked when referenced; references must be removed first.

