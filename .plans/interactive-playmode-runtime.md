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
- Both `EditorScene` and `GameScene` create background display objects *before* entities, behind everything, non-interactive.

### Editor UI
- Inspector section when “no selection” or “scene selected”:
  - add/remove background layer
  - reorder layers
  - pick assetId
  - set layout + depth + parallax + alpha

### Tests
- Unit: reducer tests for adding/reordering layers
- E2E: verify background layer list in state snapshot; verify canvas still renders entities above (no pixel diffs)

## Phase 4: Service-backed Calls + scene transitions (`scene.goto`)
### Goal
Enable transitions between scenes driven by authored actions (`Call`).

### Runtime services (new)
- `RuntimeServices`:
  - `scene: SceneService` with `goto(sceneId, { transition, durationMs })`
  - stubs for `audio`, `input`, `collisions`, `vars` (implemented later)

### Compiler changes
- Expand `Call` attachment args to allow `string|number|boolean` in params.
- Replace current narrow `callRegistry` injection with a service op registry:
  - built-in op: `scene.goto`

### Editor UI for Call
- Keep free-text `callId`.
- If `callId === 'scene.goto'`, show structured fields:
  - `sceneId` (dropdown from `project.scenes` keys)
  - `transition` (enum: `cut|fade`)
  - `durationMs` (number)
- For other callIds, keep current numeric dx/dy editing (plus an “advanced args” JSON textarea for non-numeric).

### Tests
- Unit: compiler integration test that `Call` with string args reaches handler with correct payload
- E2E: a sample scene with a Call action triggers scene switch in Play mode

## Phase 5: Audio (project library + scene ambience/music)
### Goal
Load and play audio in GameScene; author per-scene ambience/music.

### Model
- Project-level audio library: asset id -> URL/dataUrl
- Scene-level:
  - `music?: { assetId, loop, volume, fadeMs }`
  - `ambience?: Array<{ assetId, loop, volume }>`

### Runtime
- `AudioService` manages Phaser sound instances; supports `playMusic`, `stopMusic`, `playSfx`.

### Tests
- Unit: AudioService state tests (no real audio playback assertions)
- E2E: entering a scene sets “current music assetId” in a bridge snapshot

## Phase 6: Input maps (keyboard + mouse + gamepad)
### Goal
Semantic input actions usable by conditions/calls, without leaking raw device keys into authored logic.

### Model
- `InputActionMapSpec`:
  - actions -> bindings (`keyboard`, `mouse`, `pointer`, `gamepad`)
- Scene chooses active input map id(s) or uses a project default.

### Runtime
- `InputService` updates per frame:
  - pressed/held/released for semantic actions
  - pointer position + deltas
  - gamepad buttons/axes (Phaser-supported)

### Editor UI
- Input Maps panel:
  - create action
  - bind keys/buttons/axes

### Tests
- Unit: pressed/held/released semantics across frames
- E2E: dispatch key event -> input action becomes pressed (bridge snapshot)

## Phase 7: Collisions + triggers (Arcade-only)
### Goal
Author collision rules and trigger zones; runtime emits enter/stay/exit events.

### Model
- Entity:
  - reuse existing `hitbox` for body size; add `body` + `collision` metadata
- Scene:
  - `collisionRules`: overlap/block between layers or specific targets
  - `triggers`: rectangular zones with scripts (onEnter/onExit/onClick)

### Runtime
- `CollisionService` builds Arcade bodies, registers overlaps, collects enter/stay/exit.
- Actions remain attachment-driven; responses are primarily service-backed Calls:
  - `audio.play_sfx`, `scene.goto`, `entity.destroy` (as future ops)

### Tests
- Unit: CollisionService emits enter/exit correctly
- E2E: move entity into trigger zone -> event fires (bridge snapshot)

## Acceptance Criteria (end of Phase 4 milestone)
- [x] Project YAML loads/saves; multiple scenes can be created/switched.
- [x] Play mode runs `GameScene`, not `EditorScene`.
- Background layers render in both modes.
- A `Call` with `callId: scene.goto` transitions between scenes in Play mode.
