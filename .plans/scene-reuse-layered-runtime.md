# Scene Reuse + Layered Runtime (Laser Gates Model)

## Summary
Implement two capabilities:
1) **Stage reuse**: quickly duplicate/rename scenes and treat them as reusable stages.
2) **Persistent base + swappable waves** (Laser Gates model): keep a constant base layer (player + tunnel + motion) while swapping wave layers (obstacles) during play; in edit mode, render the base as a **non-interactive ghost** behind the active scene for alignment.

This plan is split into **MVP (Laser Gates)**, **Add-ons (soon)**, and **Future**.

---

## MVP (Build Laser Gates-style game flow)

### 1) Data model: base scene + minimal metadata
- Add to `ProjectSpec`:
  - `baseSceneId?: Id` — optional, points at a scene in `project.scenes`.
  - `sceneMeta?: Record<Id, { name?: string; role?: 'base' | 'wave' | 'stage' }>` — optional display metadata (no runtime semantics beyond UI in MVP).
- Parsing/serialization:
  - Ensure `parseProjectYaml` preserves/validates:
    - if `baseSceneId` is present, it must exist in `scenes`.
    - if `sceneMeta` has unknown ids, ignore/drop them on parse (default: **ignore unknown** to avoid hard failures).

### 2) Editor UX: “stage reuse” + base selection
- Scenes panel:
  - Keep **Duplicate** for “copy stage and modify”.
  - Add **Rename scene** UI (store already has `rename-scene`; wire it up).
  - Add “Set Base” control:
    - One scene can be base at a time; clicking sets `project.baseSceneId = sceneId`.
    - Clicking again on the base scene clears `baseSceneId` (optional base).
  - Show role badge (Base / Wave / Stage) using `sceneMeta` (optional, purely organizational in MVP).

### 3) Edit-mode composition: ghost-render the base behind the active scene
- When `project.baseSceneId` is set and `currentSceneId !== baseSceneId`:
  - `EditorScene` renders:
    - Base scene sprites **behind** active sprites.
    - Base scene sprites are **non-interactive**: no selection, no drag, no bounds editing, no attachment editing.
- Implementation approach:
  - Extend `EditorScene.loadSceneSpec(...)` to accept `{ active: SceneSpec; reference?: SceneSpec }`.
  - Internally maintain two sprite maps (reference + active) so selection/hover logic only considers active.
  - Render ordering: reference sprites depth-offset (e.g. `depth - 10_000`) or a separate container.
  - Visual cue: lower alpha for reference sprites (e.g. multiply alpha by 0.35) without mutating authored data.

### 4) Play-mode composition: compile/run base + wave as separate layers
- MVP layers are exactly:
  - `baseLayer` (optional, persistent)
  - `activeLayer` (current scene)
- They compile separately (**separate namespaces**): no entity/group id conflicts possible; no direct cross-layer targeting in MVP.
- Runtime behavior in `GameScene`:
  - Keep `baseCompiled?: CompiledScene`, `activeCompiled?: CompiledScene`.
  - Update loop calls both action managers each frame.
  - Sprite synchronization loops over both compiled entity sets.
  - Asset ensuring loads textures used by either layer before building sprites.

### 5) Runtime scene switching for waves: `scene.gotoWave(sceneId)`
- Call payloads must support string args:
  - Change `CallActionSpec.args` and `compileCallAttachment` to pass through `number | string | boolean` (excluding `callId`).
- Add a `Call` handler in `GameScene` for:
  - `scene.gotoWave` with args `{ sceneId: string }`
- React/Phaser synchronization (avoid divergent “runtime scene != editor scene”):
  - Add a new EventBus event: `runtime-request-scene` with payload `{ sceneId: Id }`.
  - `GameScene` call handler emits it.
  - `AppShell` listens and dispatches `set-current-scene` when in play mode.
  - This triggers the existing `EventBus.emit('load-scene', ...)` path so Phaser reloads consistently.

### 6) EventBus load contract: pass project context (required for base composition)
- Update the `load-scene` event payload from `(sceneSpec, mode)` to `(project, currentSceneId, mode)`.
- `BootScene` becomes the router:
  - In edit mode: calls `editor.loadSceneSpec({ active, reference })` if base ghosting applies.
  - In play mode: calls `game.loadProject({ project, currentSceneId })` (GameScene decides base + active compilation).

---

## Add-ons (Worthwhile soon, not required for Laser Gates MVP)

### A) Generalize base+active into “named layer slots” (layer many scenes)
- Add to `ProjectSpec`:
  - `layerSlots?: Record<string, { sceneId: Id; persistent?: boolean; ghostInEdit?: boolean }>`
  - `activeSlot?: string` (defaults to `"wave"` or `"main"`).
- Runtime services:
  - `scene.setLayer(slotName, sceneId)`
  - `scene.clearLayer(slotName)`
  - `scene.swapLayer(slotName, sceneId)` (alias)
- Editor:
  - A “Layers” panel to assign scenes to slots and reorder draw priority.
  - Edit-mode: toggle which slots render as ghosts.

### B) “Wave list” convenience
- Project metadata:
  - Ordered `waves: Id[]` and optional `waveTags`.
- Service calls:
  - `scene.gotoNextWave()` / `scene.gotoRandomWave({ tag? })`

### C) Persistent entities beyond base scene
- Support “dont-destroy-on-swap” for specific entities/groups (player bullets, UI, etc.) without forcing them into the base scene.
- Likely expressed as: `persistentEntityIds: Id[]` in a slot, or a dedicated “persistent overlay” slot.

---

## Future Capabilities (Later planning)
- Cross-layer collisions/events (base player vs wave obstacles) once CollisionService exists:
  - Emit `collision.enter/exit` events that can trigger `scene.gotoWave`, cleanup, scoring, etc.
- Variables/save state service so wave progression and player stats persist cleanly across swaps.
- Audio service with persistent music bus + per-wave SFX triggers.
- Asset preloading per project (BootScene preloads once; layer swaps don’t re-decode images).

---

## Test Plan (TDD expectation)
- Unit tests:
  - `parseProjectYaml`/serialization round-trip for `baseSceneId` + `sceneMeta`.
  - Store reducer tests for: set/clear base scene, rename scene UI wiring, runtime-request-scene dispatch behavior.
  - Compiler test for Call args supporting string (`sceneId`) and not dropping them.
- Integration/e2e (Playwright):
  - Edit mode: base ghost sprites render but are not selectable/draggable (clicking them doesn’t change selection).
  - Play mode: base persists across `scene.gotoWave` (base entity positions continue updating while wave layer resets/changes).
  - Runtime-request-scene keeps React scene list/currentSceneId in sync.

---

## Assumptions / Defaults
- MVP uses **two layers only** (base + active) but structures code so named layer slots can be added without rewrites.
- **Separate namespaces** in MVP: wave scripts cannot directly target base entities; cross-layer interaction is deferred to collisions/events later.
- Edit mode continues to author exactly one scene at a time; base is reference-only “ghost”.

