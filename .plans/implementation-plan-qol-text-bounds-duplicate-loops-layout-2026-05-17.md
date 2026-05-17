# Implementation Plan — QoL Mockups (Text, Bounds Helper, Duplicate Options, Loop Templates, Align/Distribute)

Date: 2026-05-17

This plan covers implementing the following mockups:

- `.plans/mockups/pattern-demo-quality-of-life-2026-05-17/01-text-entity-create-and-inspect.svg`
- `.plans/mockups/pattern-demo-quality-of-life-2026-05-17/03-bounds-helper-calculator.svg`
- `.plans/mockups/pattern-demo-quality-of-life-2026-05-17/04-duplicate-entity-options.svg`
- `.plans/mockups/pattern-demo-quality-of-life-2026-05-17/06-loop-templates.svg`
- `.plans/mockups/pattern-demo-quality-of-life-2026-05-17/07-align-distribute-spacing-panel.svg`

## Summary

Implement five editor/runtime improvements:

1) **Text entities** (in-scene labels) with Inspector editing and optional “Rasterize to Sprite…”
2) **Bounds Helper** calculator UI for BoundsHit conditions that can auto-pull sprite size from current selection and apply computed bounds
3) **Duplicate behavior**: duplicating an entity copies its entity-targeted attachments + handler grouping (event blocks) by default; add a **“Duplicate…”** dialog with options
4) **Loop Templates**: add a “Loops” tab/category in the Add Step drawer that inserts common loop scaffolds by expanding into existing actions
5) **Align / Distribute / Spacing** panel opened from the near-cursor selection bar to complement Snap-to-Grid

All phases are **TDD-driven** (store/helper tests → scene/editor tests where practical → implementation) and completion requires `npm run test:e2e`.

## Decisions / Assumptions (locked)

- Text entities are **not allowed** to be members of formations/groups.
- Text font selection supports **both**:
  - project Font assets, and
  - a free-form `fontFamily` string override.
- Loop Templates v1 ships with the **4 templates** shown in the mock.
- Duplication copies only the duplicated entity’s **own** entity-targeted attachments / event blocks; no attempt is made to remap cross-entity references inside params.

## 1) Text Entities

### Model

Extend `EntitySpec` with optional `text` block:

- `text.value: string`
- `text.fontAssetId?: Id` (references `project.assets.fonts`)
- `text.fontFamily?: string` (free-form override)
- `text.fontSize?: number` (default 14)
- `text.color?: string` (default `#FFFFFF`)
- `text.align?: 'left'|'center'|'right'` (default `center`)

Font resolution precedence:

1) `text.fontFamily` if non-empty
2) else if `text.fontAssetId` points to an existing font asset: use `(fontAsset.name ?? fontAsset.id)` as the CSS font-family
3) else fallback: `system-ui`

Sizing policy:

- Keep `EntitySpec.width/height` authoritative for bounds/hit tests (matches current model).
- On create and on edits to `text.value/font/fontSize`, re-measure and update `width/height` automatically.

### Font loading (v1)

Add a font loader that registers project font assets via `FontFace` into `document.fonts`:

- embedded source uses `dataUrl`
- path source uses fetchable relative URL (respect existing Vite base `./`)

Failure mode: warn (non-blocking) and fall back to system fonts.

### Editor UX

- Scene → Sprites header `+ Add` becomes a dropdown:
  - `Sprite (import)` (existing)
  - `Text (new)` creates a new entity with `text.value='Text'` and measured `width/height`.
- Inspector for text entities:
  - Content, Font (asset dropdown + family override), Size, Color, Anchor (origin), Position
  - Optional section: `Rasterize to Sprite…`

### Runtime / rendering

In `EditorScene` and `GameScene`:

- Entities with `text` render as Phaser `Text` objects (not sprites).
- Apply shared display props (x/y, rotation, scale, origin, alpha, visible, depth).
- Hit testing / selection uses `getBounds()` so text is selectable/movable.

### Rasterize to Sprite…

Dialog action that:

- renders text into a canvas,
- stores it as a new embedded image asset (data URL),
- sets entity `asset` to that image and removes `text`,
- preserves transform/display props.

Default: set `width/height` to raster size.

### Tests

- Unit: text measurement helper (canvas mocked), font loader (FontFace mocked)
- Store: create text entity; update text fields updates width/height
- E2E: create text entity, edit text, move it, save/load YAML roundtrip

## 2) Bounds Helper Calculator

### UX placement

Inside any Inspector bounds editor for BoundsHit (Bounce/Patrol and any other attachment exposing bounds):

- show “Bounds Helper” subpanel
- disable Apply until BoundsHit is enabled

### Behavior

Inputs:

- Center `cx/cy` (defaults from selected entity position)
- Travel span `±xSpan`, `±ySpan`
- Sprite size:
  - `Auto from selection` pulls the axis-aligned world bounds of selected entity from the Phaser scene bridge:
    - `halfW=(maxX-minX)/2`, `halfH=(maxY-minY)/2`
  - allow manual override of halfW/halfH after autofill

Compute:

- `minX = cx - xSpan - halfW`
- `maxX = cx + xSpan + halfW`
- `minY = cy - ySpan - halfH`
- `maxY = cy + ySpan + halfH`

`Apply to BoundsHit` writes these bounds back into the attachment’s BoundsHit condition.

### Tests

- Unit: `computeEdgeSafeBounds(...)`
- Store/UI: applying helper updates only the target attachment
- E2E: auto-from-selection, apply, confirm bounds overlay/handles and YAML persistence

## 3) Duplicate Entity Options + Copy Attachments on Duplicate

### Default behavior (Alt+Drag + “Duplicate”)

When duplicating an entity:

- clone `scene.entities[sourceId]` → new entity id
- clone **entity-targeted attachments** where `attachment.target` is `{type:'entity', entityId: sourceId}`
  - preserve Repeat tree structure: new ids + remap `parentAttachmentId` and `children[]`
- clone **event blocks** that target the source entity
  - allocate new `eventId`s and remap cloned attachments’ `eventId` accordingly
- group membership: keep current behavior (copy into same group; group layout becomes `freeform`)

### Escape hatch: “Duplicate…” dialog

Add `Duplicate…` to entity overflow menu (EntityList), with options:

- Include behaviors (attachments) ✅ default on
- Include handlers (event blocks) ✅ default on
- Copy into same group ✅ default on

Alt+Drag does **not** show a popup; it uses defaults.

### Tests

- Store: duplication clones attachments + event blocks correctly; options disable parts as expected
- E2E: extend `tests/e2e/alt-drag-duplicate.spec.ts` to assert duplicated entity also gets attachments / handler grouping

## 4) Loop Templates

### UX

Extend `ActionLibraryDrawer` with a new category/tab: `Loops`.

Loops list (v1):

1) Intro then Repeat…
2) Repeat N times…
3) Repeat until Condition…
4) Repeat with Cooldown…

Templates are authoring shortcuts only: they insert existing actions/attachments (Repeat/Wait/etc).

### Template expansion rules

- Intro then Repeat…:
  - insert one placeholder “Intro step”
  - insert `Repeat` containing one placeholder child
  - focus first placeholder
- Repeat N times…:
  - insert `Repeat` with `params.count = N` containing one placeholder child
- Repeat until Condition…:
  - insert a Repeat scaffold plus the minimum condition wiring needed using existing supported presets/inline condition infrastructure
  - exact mapping determined by what’s already supported in `SUPPORTED_PRESETS` and compiler/runtime behavior
- Repeat with Cooldown…:
  - insert `Repeat` with children `[<placeholder action>, Wait(durationMs)]`

### Tests

- Unit/store: template expansion produces expected attachment graphs
- E2E: open `+ Add…` drawer, select Loops, apply template, verify inserted steps

## 5) Align / Distribute / Spacing Panel

### Entry point

Add `Layout…` button to the near-cursor selection bar when `selection.kind==='entities'` and `ids.length>=2`.

Click opens a popover anchored near the selection bar (match existing canvas popover patterns).

### Behavior

All operations act on the current selection.

Snap-to-grid integration:

- If grid snapping is enabled, final positions are snapped using current `gridSize`.
- Units toggle:
  - Grid: spacing is in multiples of `gridSize`
  - Pixels: spacing is raw px

Implement:

- Align left/centerX/right/top/centerY/bottom relative to anchor (default: first selected)
  - align uses axis-aligned bounds from scene bridge
- Distribute X / Y by centers (sort by axis, even gaps)
- Spacing X sets fixed center-to-center spacing while preserving sort order

### Tests

- Unit: geometry helpers (align/distribute/spacing)
- Store: deterministic position updates + single undo step
- E2E: select entities, apply distribute/spacing with Snap on/off

## Acceptance / Verification

Required before calling this work “done”:

- `npm run test:unit`
- `npm run test:e2e`

