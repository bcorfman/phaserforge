# Scene Reuse + Layered Runtime (Laser Gates Model)

## Summary
Implement two capabilities:
1) **Stage reuse**: quickly duplicate/rename scenes and treat them as reusable stages.
2) **Persistent base + swappable waves** (Laser Gates model): keep a constant base layer (player + tunnel + motion) while swapping wave layers (obstacles) during play; in edit mode, render the base as a **non-interactive ghost** behind the active scene for alignment.

This plan is split into **MVP (Laser Gates)**, **Add-ons (soon)**, and **Future**.

---

## MVP (Build Laser Gates-style game flow)

### 0) Laser Gates mechanics → Studio capabilities (mapping)
This is a quick parity map from the current Laser Gates architecture (persistent tunnel + swappable waves) to the Studio’s model.

- **Persistent tunnel + player + hills** → `baseSceneId` + runtime `baseLayer` (items 1 + 4).
  - Base layer owns: tunnel walls/hills, player ship, shot spawner, any always-on scroll actions.
- **Obstacle “waves” that swap independently** → active scene id treated as `wave` (items 4 + 5).
  - Wave layer owns: obstacles + their actions + their cleanup.
- **Wave completes / player dies / obstacle exits bounds** → wave emits `scene.gotoWave(...)` (item 5) + per-wave cleanup contract.
- **Input drives player motion + fire** → input maps + a small set of runtime ops/actions that can:
  - Read action states (held/pressed) and update entity velocity/position.
  - Spawn/destroy entities for shots.
- **Shot hits obstacle (destroy block / remove shot)** → collision events must be scriptable (not just trigger zones).
  - Studio needs a minimal “collision event → Call op” path (parallel to trigger zones) so authored YAML can express “on overlap, destroy target(s)”.
- **Player hits obstacle (damage flash + restart wave)** → collision events + a wave-level “fail → gotoWave” handler.
  - Visual flash is optional for MVP; the essential behavior is “collision ends wave”.

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
  - Keep **Duplicate** for “copy stage and modify”. ✅
  - Add **Rename scene** UI (store already has `rename-scene`; wire it up). ✅
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

### 5.5) MVP collision scripting: collision event → Call ops (required for Laser Gates)
Laser Gates waves are mostly “if shot overlaps obstacle, destroy obstacle + remove shot; if player overlaps obstacle, end wave”.

- Extend runtime so **collision events** (from `collisionRules`) can invoke `Call` ops similarly to trigger zones.
  - Keep it minimal: `enter` events only is enough for MVP.
  - Event payload should be able to reference:
    - `instigator` (e.g. the shot or the player), and
    - `other` (the obstacle).
- Add a tiny set of built-in ops to cover Laser Gates loops:
  - `entity.destroy` (already exists for general cleanup)
  - `scene.gotoWave` (wave swap without resetting base)
  - Optional convenience: `entity.destroy_other` (destroy overlap counterpart) if targeting ergonomics get awkward.

### 6) EventBus load contract: pass project context (required for base composition) ✅
- Implemented via `runtime:load-project (project, currentSceneId, mode)` + `runtime:set-active-scene` with `BootScene` routing. ✅
- In edit mode: `BootScene` calls `editor.loadSceneSpec(project, sceneSpec)`. ✅
- In play mode: `BootScene` calls `game.loadSceneSpec(project, sceneSpec)`. ✅

---

## Laser Gates parity checklist (what must be true for a Phaser clone)
- **Authoring**:
  - Base scene can be designated and ghost-rendered under waves in edit mode.
  - Waves can be duplicated/renamed quickly and organized.
- **Runtime**:
  - Base layer persists across wave swaps (player + scroll never reset).
  - Wave layer can be replaced while base continues running.
  - Input maps can drive the player entity (move + fire).
  - Shots can be spawned/destroyed deterministically.
  - Collision rules can trigger authored actions/ops (shot-hit + player-hit).

## Suggested implementation order (Laser Gates MVP)
1) `baseSceneId` + editor “Set Base” + ghost rendering (fast feedback for authoring).
2) Two-layer runtime (compile + update base + wave together).
3) `scene.gotoWave(sceneId)` + React/Phaser sync event.
4) Collision event scripting (collision enter → Call) + built-in ops (`entity.destroy`, `scene.gotoWave`).
5) Input-driven player + firing (small, explicit ops/actions; keep authored YAML simple).

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
