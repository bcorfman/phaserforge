# PhaserActions Studio

A browser-based editor for authoring Phaser-friendly 2D scenes: import sprites, arrange formations, attach simple action scripts, preview them instantly, and round-trip the whole project as YAML.

<img src="res/images/mainwindow.png?raw=true" style="width: 800px"/>

## What’s In The Editor Today

- **Multi-scene projects** with a per-scene world size.
- **Sidebar scope tabs**:
  - **Scene**: scene-scoped panels (sprites, trigger zones, formations).
  - **Project**: project-level panels (sprite import, audio library, input maps).
- **Sprite import (Project tab)**: embedded file → data URL, or “asset path” reference, including a spritesheet frame picker and optional auto-hitbox.
- **Canvas editing**: drag sprites and formations, marquee multi-select, group / dissolve, grid snap, undo/redo, pan/zoom, fit/reset view.
- **Formations (groups)** can use declarative arrange layouts (grid, line, circle, arc, etc.) driven by `public/editor-registry.yaml`.
- **Input maps (semantic controls) (Project tab)**: author project-level action bindings (keyboard / mouse / gamepad buttons), choose active/fallback maps per scene, and preview runtime action states in Play mode.
- **Play mode mouse controls**: optional hide OS cursor, and mouse-driven entity motion with independent X/Y axis locks.
- **Collisions + trigger zones (Arcade-style, Phase 7)**: author per-entity collision metadata (body + collision layer), scene collision rules (`block`/`overlap`), and rectangular trigger zones. Play mode exposes enter/stay/exit/click events in the runtime test snapshot.
- **Attached actions (current presets)**: `MoveUntil`, `Wait`, `Call`, plus `Repeat` as a script-level wrapper.
- **`Call` actions require a registered handler**. The Studio preview scene registers a small call registry (for example `drop`); unknown `callId` values will fail during preview compile/run.
- **Inline conditions (current)**: `BoundsHit` and `ElapsedTime` (used by `MoveUntil`).
- **Play mode** compiles the authored scene and runs actions; **Edit mode** is for authoring.

## YAML Round-Trip

- `Export YAML` serializes the current `ProjectSpec` (assets + scenes + `initialSceneId`) and saves it to disk.
- `Load YAML` parses + validates YAML and migrates older scene schemas (legacy `behaviors/actions/conditions`) into `attachments`.
- Startup mode `Reload Last YAML` restores the last exported/loaded YAML from `localStorage` (configurable).

## Controls & Shortcuts

- **Select**: click a sprite / formation. Shift+click adds to multi-select. Drag on empty space to marquee-select (Shift adds).
- **Move**: drag selection; Arrow keys nudge (Shift+Arrow = 10px).
- **Pan / zoom**: mouse wheel zoom; middle-mouse drag or hold Space + drag to pan; use Fit/Reset buttons in the view bar.
- **Shortcuts** (Ctrl on Windows/Linux, Cmd on macOS):
  - Undo / redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y)
  - Toggle Edit/Preview: Tab
  - Toggle grid snap: Ctrl/Cmd+G
  - Group selection: Ctrl/Cmd+Shift+G
  - Dissolve selected formation: Ctrl/Cmd+Shift+U

## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the dev server (defaults to `http://localhost:8080`) |
| `npm run build` | Create a production build in `dist/` |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:all` | Run unit + e2e tests |
| `npm run dev-nolog` | Dev server without anonymous logging (see below) |
| `npm run build-nolog` | Build without anonymous logging (see below) |

> Note: For Playwright tests, you may need to run `npx playwright install` once to install browser binaries.

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
