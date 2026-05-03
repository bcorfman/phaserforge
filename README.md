# PhaserActions Studio

Project docs: [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/bcorfman/phaseractions-studio)

**PhaserActions Studio** helps you build gameplay faster by removing the slowest part of game development: hand-orchestrating behavior in update loops. Instead of scattering timers, flags, and state transitions across your Phaser code, you attach composable actions to entities or groups — then define the conditions that control when those actions stop, repeat, or trigger the next behavior. The editor is the multiplier: live parameter editing lets you tune the behavior while the Phaser runtime is running, while the underlying Action–Condition–Event model keeps the logic reusable, inspectable, and data-driven. The result is not just a nicer editor; it is a faster way to express gameplay itself.

<img src="res/images/mainwindow.png?raw=true" style="width: 800px"/>

## What’s In The Editor Today

- **Multi-scene projects** with per-scene world size (fast scene switching, consistent runtime semantics).
- **Base scene + waves**:
  - Mark a scene as the **Base** (★) in the Scenes list (`project.baseSceneId`) to build “persistent stage + swappable encounters”.
  - **Edit mode**: base scene renders as a **non-interactive ghost** behind the active scene for alignment.
  - **Play mode**: runtime composes **persistent base + active wave**; waves swap via `scene.gotoWave(sceneId)` without resetting the base.
- **Sidebar scope tabs**:
  - **Scene**: everything you need to iterate a scene (tree + assets dock always visible).
  - **Project**: project-level systems (input maps, YAML workflow).
- **Docked Assets panel (Scene tab)**:
  - Import **Images**, **Spritesheets**, **Audio**, and **Fonts** as embedded files or “asset path” references.
  - Assets have **immutable IDs** (stable references) and an **editable display name** (friendly labels).
  - Drag **image/spritesheet assets → canvas** to create sprite entities at the drop point.
  - Drag **image assets → background layers** to add/assign backgrounds.
  - Drag **audio assets → scene music** to assign music.
  - Asset deletion is **blocked when referenced**, preventing broken scenes at runtime.
- **Canvas editing**: drag sprites/formations, marquee multi-select, group/dissolve, grid snap, undo/redo, pan/zoom, fit/reset view.
- **Formations (groups)**: declarative arrange layouts (grid, line, circle, arc, etc.) driven by `public/editor-registry.yaml`—repeatable patterns without hand-placing every entity.
- **Input maps (semantic controls) (Project tab)**: author action bindings (keyboard/mouse/gamepad), choose active/fallback maps per scene, preview runtime action states in Play mode.
- **Play mode mouse controls**: optional hide OS cursor, and mouse-driven entity motion with independent X/Y axis locks.
- **Collisions + trigger zones**:
  - Per-entity collision metadata (body + collision layer), per-scene collision rules (`block`/`overlap`), rectangular trigger zones.
  - Collision rules can run scripts on overlap/block **enter** via `collisionRules[].onEnter` (single call or list of calls) for “gameplay glue” authored in YAML.
  - Play mode exposes trigger + collision enter/stay/exit/click events in the runtime test snapshot.
- **Attached actions (current presets)**: `MoveUntil`, `Wait`, `Call`, `InputDrive` (input → velocity), `InputFire` (spawn projectiles), plus `Repeat` as a wrapper.
- **`Call` actions require a registered handler**. The runtime includes built-in handlers like `scene.goto`, `scene.gotoWave`, `entity.destroy`, and `audio.play_sfx` (plus sample/demo ops like `drop`). Unknown `callId` values will fail during preview compile/run.
- **Inline conditions (current)**: `BoundsHit` and `ElapsedTime` (used by `MoveUntil`).
- **Play mode** compiles the active scene (and base layer when configured) and runs actions; **Edit mode** stays focused on authoring and iteration speed.

## YAML Round-Trip

- YAML lives in the **Scene YAML** pane (right sidebar).
- **Open…** reads YAML from disk into the YAML textarea.
- **Load** parses + validates the YAML textarea and applies it into the editor (including migrations from legacy `behaviors/actions/conditions` → `attachments`).
- **Save / Save As…** write the YAML textarea contents back to disk (Save reuses the last file handle when available).
- Startup mode **Reload Last YAML** is configured in the YAML pane and loads the last YAML stored in `localStorage`.

## Controls & Shortcuts

- **Select**: click a sprite / formation. Shift+click adds to multi-select. Drag on empty space to marquee-select (Shift adds).
- **Move**: drag selection; Arrow keys nudge (Shift+Arrow = 10px).
- **Pan / zoom**: mouse wheel zoom; middle-mouse drag or hold Space + drag to pan; use Fit/Reset buttons in the view bar.
- **Selection actions**: use the on-canvas **selection bar** (no right-click menu).
- **Shortcuts** (Ctrl on Windows/Linux, Cmd on macOS):
  - Undo / redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y)
  - Toggle Edit/Preview: Tab
  - Toggle grid snap: Ctrl/Cmd+G
  - Group selection: Ctrl/Cmd+Shift+G (creates a formation with an auto name)
  - Dissolve selected formation: Ctrl/Cmd+Shift+U

## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the dev server (defaults to `http://localhost:8080`) |
| `npm run dev:cloud` | Start the dev server + local API (Vite proxies `/api/*` to the API) |
| `npm run build` | Create a production build in `dist/` |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:all` | Run unit + e2e tests |
| `npm run dev-nolog` | Dev server without anonymous logging (see below) |
| `npm run build-nolog` | Build without anonymous logging (see below) |

> Note: For Playwright tests, you may need to run `npx playwright install` once to install browser binaries.

### Testing cloud login locally
Run `npm run dev:cloud`, then open `http://localhost:8080/`. The studio calls `/api/*` on the same origin; Vite proxies those requests to the local API (default `http://localhost:8787`). Set `API_PORT` if you change the API port.

## Config Files

- `public/editor-config.yaml` controls editor startup (e.g. `startupMode`).
- `public/editor-registry.yaml` defines which arrange layouts, action presets, and conditions the editor exposes (and which are marked `implemented: true`).

## Repository Layout (High Level)

- `src/editor/`: React UI + editor store/reducer.
- `src/phaser/`: Phaser host + `EditorScene` integration (canvas interactions, selection, history, view).
- `src/model/`: YAML types, validation, and scene migration.
- `src/compiler/`: Compiles scene specs into runtime scripts.
- `src/runtime/`: Action/condition runtime used in Preview mode.

## About `log.js`

`npm run dev` / `npm run build` run `node log.js ...` in the background, which sends a lightweight anonymous GET request (event + Phaser version + package name). If you’d rather not send this, use `npm run dev-nolog` / `npm run build-nolog`.
