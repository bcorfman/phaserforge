# Interactive Play Mode Runtime Roadmap (Project + Multi-Scene)

## Summary
Today “Play mode” is still `EditorScene`: it compiles one `SceneSpec`, renders entities, and in play mode just runs `compiled.startAll()` while gating most keyboard/pointer handling behind `mode === 'edit'`. This previews NPC/attachment behavior but cannot run an interactive game.

This plan introduces a real game runtime alongside the editor:
- [x] Promote authored content from a single `SceneSpec` to a `ProjectSpec` with multiple scenes.
- [x] Persist **project YAML only** as the primary format.
- [x] Add a dedicated `GameScene` for Play mode (Arcade physics only).
- Keep the attachment compiler, but route engine effects via runtime services (`scene.goto`, audio, input, collisions).
- Keep `EditorScene` editor-first; it renders the active scene (including backgrounds) but does not own gameplay input.

All phases should be TDD-driven:
- store/helper tests first
- scene-level interaction/e2e tests where practical
- then implementation

## Phase 1: ProjectSpec + Multi-Scene Store (no runtime split yet)
### Goal
Make the editor capable of owning a project with multiple scenes, without changing core entity/group/attachment editing semantics.

### Decisions (locked)
- [x] Persistence is **project YAML only** (authoritative key `phaseractions.projectYaml.v1`).

### Required model additions
- [x] Add `ProjectSpec`:
  - `id: string`
  - `assets: { images: Record<string, ImageAssetSpec>; spriteSheets: Record<string, SpriteSheetAssetSpec> }`
  - `audio: { sounds: Record<string, AudioAssetSpec> }` (stub for now)
  - `inputMaps: Record<string, InputActionMapSpec>` (stub for now)
  - `scenes: Record<string, GameSceneSpec>`
  - `initialSceneId: string`
- [x] Add `GameSceneSpec`:
  - Base: existing `SceneSpec`
  - Add: `backgroundLayers?: BackgroundLayerSpec[]` (can be empty in this phase)

### Serialization/storage changes
- [x] Add `parseProjectYaml(text): ProjectSpec` and `serializeProjectToYaml(project): string`.
- [x] Update load/export UI to use project YAML only.

### Store changes
- [x] Replace `EditorState.scene` with:
  - `project: ProjectSpec`
  - `currentSceneId: string`
- [x] All existing editor reducers (`update-entity`, attachments, grouping, bounds edits) operate on
  `project.scenes[currentSceneId]`.
- [x] Add new reducer actions:
  - `create-scene`, `duplicate-scene`, `delete-scene`, `rename-scene`, `set-current-scene`

### UI changes
- [x] Add a “Scenes” list/picker (left panel, above Entities/Formations):
  - shows scene name/id
  - create/duplicate/delete
  - selecting a scene swaps the canvas and inspector context

### Tests
- Unit (Vitest):
  - [x] project YAML serialize/parse round-trip
  - [x] reducers: editing affects only active scene; switching scenes preserves edits
- E2E (Playwright):
  - [x] create a second scene; switch; verify entity counts differ via test bridge state snapshot

## Phase 2: Runtime split (BootScene + GameScene) and mode semantics
### Goal
Make Play mode run a dedicated interactive runtime scene, not `EditorScene`.

### Decisions (locked)
- [x] Modes remain **two**: Edit and Play. Play is the real interactive runtime.

### Phaser boot changes
- [x] Update game config to register:
  - [x] `BootScene` (orchestrates which scene is active, owns services)
  - [x] `EditorScene` (authoring)
  - [x] `GameScene` (play runtime)
- Replace the current `EventBus.emit('load-scene', state.scene, state.mode)` contract with:
  - `runtime:load-project(project, currentSceneId, mode)`
  - `runtime:set-mode(mode)`
  - `runtime:set-active-scene(sceneId)`

### Editor vs Play ownership
- Edit mode:
  - `EditorScene` handles editor pointer/keyboard shortcuts (as today)
- Play mode:
  - `GameScene` owns input; Escape (and toolbar button) returns to Edit
  - `EditorScene` is paused/slept (no editor gesture conflicts)

### Tests
- E2E:
  - [x] toggling play mode results in `GameScene` being active (expose active scene key via test bridge)

## Phase 3: Background layers (authoring + rendering parity)
### Goal
Support background images per scene, rendered in both Edit and Play.

### Model
- [x] `BackgroundLayerSpec`:
  - `assetId: string`
  - `x,y,depth`
  - `alpha?`, `tint?`
  - `scrollFactor?: {x,y}`
  - `layout: 'stretch'|'cover'|'contain'|'center'|'tile'`

### Rendering
- [x] Both `EditorScene` and `GameScene` create background display objects *before* entities, behind everything, non-interactive.

### Editor UI
- [x] Inspector section when “no selection” or “scene selected”:
  - [x] add/remove background layer
  - [x] reorder layers
  - [x] pick assetId
  - [x] set layout + depth + parallax + alpha

### Tests
- [x] Unit: reducer tests for adding/reordering layers
- [x] E2E: verify background layer list in state snapshot; verify canvas still renders entities above (no pixel diffs)

## Phase 4: Service-backed Calls + scene transitions (`scene.goto`)
### Goal
Enable transitions between scenes driven by authored actions (`Call`).

### Runtime services (new)
- [x] `RuntimeServices`:
  - [x] `scene: SceneService` with `goto(sceneId, { transition, durationMs })`
  - [x] stubs for `audio`, `input`, `collisions`, `vars` (implemented later)

### Compiler changes
- [x] Expand `Call` attachment args to allow `string|number|boolean|null` in params.
- [x] Replace current narrow `callRegistry` injection with a service op registry.
- [x] Add built-in op: `scene.goto`.

### Editor UI for Call
- [x] Keep free-text `callId`.
- [x] If `callId === 'scene.goto'`, show structured fields:
  - [x] `sceneId` (dropdown from `project.scenes` keys)
  - [x] `transition` (enum: `none|fade`)
  - [x] `durationMs` (number)
- [x] For other callIds, keep numeric dx/dy editing + an “Advanced args (JSON)” textarea for shallow primitive args.

### Tests
- [x] Unit: compiler integration test that `Call` with string args reaches handler with correct payload
- [x] E2E: a sample scene with a Call action triggers scene switch in Play mode

## Phase 5: Audio (project library + scene ambience/music)
### Goal
Load and play audio in GameScene; author per-scene ambience/music.

### Mockups
- Audio library + scene audio inspector: `.plans/mockups/interactive-playmode-runtime/phase5-audio.svg`

### Model
- [x] Project-level audio library: asset id -> URL/dataUrl
- [x] Scene-level:
  - [x] `music?: { assetId, loop, volume, fadeMs }`
  - [x] `ambience?: Array<{ assetId, loop, volume }>`

### Runtime
- [x] `AudioService` manages Phaser sound instances; supports `playMusic`, `stopMusic`, `playSfx`.

### Editor UI
- [x] Project audio library panel (add/remove sounds)
- [x] Scene audio inspector (music + ambience authoring)

### Tests
- [x] Unit: AudioService state tests (no real audio playback assertions)
- [x] E2E: entering a scene sets “current music assetId” in a bridge snapshot

## Phase 6: Input maps (keyboard + mouse + gamepad)
### Goal
Semantic input actions usable by conditions/calls, without leaking raw device keys into authored logic.

### Mockups
- Input Maps panel + scene binding: `.plans/mockups/interactive-playmode-runtime/phase6-input-maps.svg`
- Mouse cursor + click + gamepad button capture (follow-up): `.plans/mockups/interactive-playmode-runtime/phase6b-mouse-gamepad.svg`

### Model
- [x] `InputActionMapSpec`: actions -> bindings (`keyboard`, `mouse`, `pointer`, `gamepad`)
- [x] Project-level default input map id
- [x] Scene chooses active + fallback input map ids (or uses project default)

### Runtime
- [x] `InputService` updates per frame:
  - [x] pressed/held/released for semantic actions
  - [x] pointer position + deltas
  - [x] basic gamepad buttons/axes via `navigator.getGamepads()`

### Editor UI
- [x] Input Maps panel:
  - [x] create/duplicate/remove input maps
  - [x] set project default input map
  - [x] bind keyboard + mouse buttons via capture
  - [x] bind gamepad *buttons* via capture (SNES-style pads)
  - [ ] bind gamepad axes via capture (optional)
  - [ ] pointer bindings UI (move/drag regions)
- [x] Scene inspector: choose active/fallback maps + preview actions
- [ ] Scene inspector: Mouse options
  - [x] Hide/show OS cursor (Play mode only)
  - [x] Mouse-driven entity motion axis locks (Affect X / Affect Y) + drive entity picker

### Tests
- [x] Unit: pressed/held/released semantics across frames
- [x] E2E: dispatch key event -> input action becomes pressed (bridge snapshot)
- [x] E2E: click entity in Play mode -> snapshot reports clicked entity id

## Phase 7: Collisions + triggers (Arcade-only)
### Goal
Author collision rules and trigger zones; runtime emits enter/stay/exit events.

### Mockups
- Collisions + triggers authoring (rules + zones): `.plans/mockups/interactive-playmode-runtime/phase7-collisions-triggers.svg`

### Model
- [x] Entity:
  - [x] reuse existing `hitbox` for body size; add `body` + `collision` metadata
- [x] Scene:
  - [x] `collisionRules`: overlap/block between layers or specific targets
  - [x] `triggers`: rectangular zones with scripts (onEnter/onExit/onClick)

### Runtime
- [x] `CollisionService` computes AABB overlaps, collects enter/stay/exit/click events.
- [x] `collisionRules` support `overlap` and `block` interactions (simple separation for `block`).
- [x] Trigger scripts execute service-backed Calls (future; model/UI support exists):
  - [x] `audio.play_sfx`, `scene.goto`, `entity.destroy`

### Tests
- [x] Unit: CollisionService emits enter/exit correctly
- [x] E2E: move entity into trigger zone -> event fires (bridge snapshot)

## Acceptance Criteria (end of Phase 4 milestone)
- [x] Project YAML loads/saves; multiple scenes can be created/switched.
- [x] Play mode runs `GameScene`, not `EditorScene`.
- Background layers render in both modes.
- A `Call` with `callId: scene.goto` transitions between scenes in Play mode.
