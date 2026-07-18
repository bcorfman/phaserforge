# Interactive Play Mode — Current Architecture and Active Work

Updated 2026-07-18.

This document describes the current editor/runtime contract and the remaining
input-map work. The original phased implementation roadmap is preserved in
[interactive-playmode-runtime-roadmap-history.md](archive/interactive-playmode-runtime-roadmap-history.md).

## Phase status

### Phase 1 — Canonical project and editor state

- [x] Make `ProjectSpec` the canonical authored project model.
- [x] Support multiple scenes through `EditorStore.currentSceneId`.
- [x] Move persistence to validated project records and project history.
- [x] Keep YAML as import/export and compatibility, not internal authority.

### Phase 2 — Editor/runtime separation

- [x] Keep `BootScene` as the runtime coordinator.
- [x] Keep `EditorScene` focused on authoring and editor gestures.
- [x] Run Play mode in `GameScene` with gameplay input isolated from edit mode.
- [x] Preserve exact view state across mode changes where practical.

### Phase 3 — Runtime services and scene composition

- [x] Render background layers consistently in Edit and Play.
- [x] Support scene transitions through service-backed operations.
- [x] Support project audio assets, scene music, ambience, and SFX.
- [x] Support semantic input maps, scene map selection, and mouse controls.
- [x] Support Arcade-style collision rules, trigger zones, and trigger calls.
- [x] Support base-scene composition and wave-scene switching.

### Phase 4 — Current editor authoring model

- [x] Use event blocks and typed events for current event authoring.
- [x] Use patterns, collections, and counters where the current editor exposes
  reusable behavior and derived state.
- [x] Keep project history, persistence, asset workflows, pixel scale, render
  mode, formations, and text editing aligned with runtime compilation.

### Phase 5 — Input completion

- [ ] Define the authored contract for pointer `move`/`drag` bindings.
- [ ] Add pointer-binding authoring and capture UI.
- [ ] Evaluate pointer bindings as semantic runtime actions.
- [ ] Add interactive gamepad-axis capture while preserving threshold semantics.
- [ ] Add focused unit and E2E coverage for pointer and axis bindings.

## Current architecture

### Authored project

- `ProjectSpec` is the canonical model for editor state, persistence, runtime
  compilation, and publishing.
- A project owns multiple `GameSceneSpec` scenes, project assets, input maps,
  patterns, collections, counters, and optional base-scene metadata.
- `EditorStore` owns `project`, `currentSceneId`, selection, history, dirty
  state, and project synchronization state.
- IndexedDB-backed project records and project history are authoritative.
  YAML is the human-readable import/export and compatibility adapter.

### Editor/runtime topology

- `BootScene` owns runtime orchestration and service-backed operation
  registration.
- `EditorScene` is the edit-mode authoring surface. It owns canvas gestures,
  selection, and editor camera state.
- `GameScene` is the play-mode runtime. It receives a project and scene,
  owns gameplay input/audio/collision state, and runs compiled behavior.
- Edit and Play remain two modes. The inactive scene is slept so editor input
  and gameplay input do not compete.
- Base-scene composition supports a persistent base plus swappable wave scenes;
  edit mode can render the base as a ghost reference.

### Current authored/runtime surfaces

These roadmap areas are implemented and should be treated as maintenance
contracts rather than open implementation phases:

- Project and multi-scene editing, scene naming/roles, project history, and
  persistence.
- Background layers with edit/play rendering parity.
- Scene transitions through service-backed operations such as `scene.goto`.
- Project audio assets plus scene music and ambience.
- Semantic input actions with project defaults and scene active/fallback maps.
- Mouse cursor options, mouse-driven entity motion, keyboard/mouse capture,
  gamepad-button capture, and pressed/held/released action state.
- Arcade-style collision rules, trigger zones, trigger events, and supported
  trigger calls.
- The newer event-block, typed-event, pattern, collection, counter, formation,
  text, pixel-scale, and render-mode workflows that were added after the
  original roadmap.

## Input maps: active contract

Input maps are project-scoped. A scene selects an active map and optional
fallback map, or inherits the project default. The scene inspector also owns
Play-mode cursor and mouse-drive settings.

Historical visual references are retained in the archive:

- [phase6-input-maps.svg](archive/mockups/interactive-playmode-runtime/phase6-input-maps.svg)
- [phase6b-mouse-gamepad.svg](archive/mockups/interactive-playmode-runtime/phase6b-mouse-gamepad.svg)

The model supports keyboard, mouse, pointer, and gamepad bindings. Runtime
gamepad axes can already be evaluated when authored as an axis binding, but
the editor does not yet capture axes interactively. Pointer bindings are
represented in the model but are not currently evaluated as semantic held
actions by the basic input service.

## Mouse input

Mouse input has two related paths:

- **Semantic mouse bindings:** an input map can bind left, middle, or right
  mouse buttons to an action with `down`, `up`, or `held` semantics. In Play
  mode, `GameScene` feeds Phaser pointer-down/pointer-up events into the input
  service, so authored actions do not need to depend on raw browser buttons.
- **Scene mouse controls:** `SceneInputPanel` configures Play-mode OS-cursor
  visibility, an optional entity driven by the pointer, and independent
  Affect X/Affect Y axis locks. These settings are scene-level behavior rather
  than input-map bindings.

The runtime also records screen/world pointer position and deltas, and reports
entity pointer clicks through the collision/trigger path. The remaining gap is
the general `pointer` binding contract: move/drag regions still need an
authoring model and runtime action semantics instead of being treated as
ordinary held button actions.

## Active work

### 1. Define and implement pointer bindings

- Decide the authored contract for `move` and `drag` bindings, including what
  `region` means and whether the result is an action edge, held state, or
  pointer data consumed by an action.
- Add the corresponding editor capture/authoring UI.
- Add runtime evaluation and focused unit/E2E coverage.

### 2. Add gamepad-axis capture

- Capture an axis and direction in `InputMapsPanel`.
- Preserve the existing threshold semantics and axis aliases used by
  `BasicInputService`.
- Add a test that captured bindings round-trip and drive the expected action.

### 3. Keep runtime and editor contracts aligned

For future input/runtime changes, update the model, validation, serialization,
editor controls, runtime service, and test bridge together. Prefer the current
event/action and history architecture over the old free-form Call-only
examples in the historical roadmap.

## Historical material

The original phases, completed acceptance criteria, and superseded mockup
assumptions remain in [interactive-playmode-runtime-roadmap-history.md](archive/interactive-playmode-runtime-roadmap-history.md)
for provenance. They are not a checklist for new implementation work.
