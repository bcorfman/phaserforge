# Game-Only Web Player (YAML → Play Immediately)

## Summary
- Add a **game-only player page** (`player.html`) that loads a fixed `game.yaml`, boots Phaser, and immediately starts in **play mode** (no editor UI / no `EditorScene`).
- Make runtime **self-contained for scene transitions + wave swapping** (no React “glue” needed).
- Ensure YAML-referenced **assets resolve as web URLs** in a distributable build.

---

## Distribution Platform Requirements (Clear + Concrete)

### Works on static hosting (GitHub Pages / Netlify / S3 / “any static web server”)
This plan is designed so you only need to host static files:
- `player.html` + built JS/CSS (from Vite `dist/`)
- `game.yaml`
- Any referenced assets (images/audio) under the same site (e.g. `assets/...`)

No server-side runtime, containers, or Node process is required. End users just open the hosted URL (e.g. GitHub Pages site URL).

**Static hosting must provide:**
- Ability to serve `*.yaml`, images, audio, and JS/CSS over HTTP(S).
- Correct paths: YAML `source.kind: path` must point to URLs that exist on that host (recommend `assets/...` under `public/assets/...` → `dist/assets/...`).
- If `game.yaml` (or assets) are hosted on a different origin than `player.html`, that origin must send permissive **CORS** headers for browser `fetch()` to work. Default plan assumes same-origin hosting (no CORS needed).

### Only needed if you want “server features” (Railway container, etc.)
A container/hosted backend is only necessary if you add requirements beyond static files, such as:
- authenticated content, dynamic YAML generation, save games / leaderboards, telemetry, asset uploads, etc.

This plan does not require any of that.

---

## Implementation Changes

### 1) Player entry + boot flow (no editor)
- Add `player.html` (new Vite multi-page entry) with:
  - A `#game-container` div and minimal loading/error overlay (DOM).
  - `<script type="module" src="/src/player/main.ts">`.
- Add `src/player/main.ts`:
  - `fetch('/game.yaml')` → `parseProjectYaml` → validate scenes.
  - Start Phaser via `StartPlayerGame("game-container")`.
  - Wait for `current-scene-ready`, then `EventBus.emit('runtime:load-project', project, project.initialSceneId, 'play')`.
  - Show a clear on-screen error if YAML/asset loading fails (include URL + message).

### 2) PlayerBootScene (runtime-only BootScene)
- Add `src/phaser/PlayerBootScene.ts`:
  - Always runs in `'play'` mode; only launches `GameScene`.
  - Registers built-in ops in an `OpRegistry` (shared helper with the studio `BootScene` to avoid drift):
    - `scene.goto` and `scene.gotoWave` switch scenes internally (no React EventBus translation).
    - Keep `audio.play_sfx`, `entity.destroy`, and any other supported ops you want available to shipped games.

### 3) Assets policy for distributable builds
- Support both YAML asset sources:
  - `embedded` (data URLs): fully self-contained; large YAML.
  - `path` (URLs): requires those files exist on the host.
- Default distributable convention:
  - Put assets under `public/assets/...` and reference them from YAML as `assets/...` (relative URL).
  - Keep `base: './'` so GitHub Pages subpaths work.

### 4) Build wiring (multi-page Vite)
- Update `vite/config.dev.mjs` + `vite/config.prod.mjs` to include `player.html` in `build.rollupOptions.input` alongside `index.html`.

### 5) Test bridge compatibility (so Playwright can assert readiness)
- In `src/player/main.ts`, register a minimal test snapshot via `registerAppStateGetter` so existing readiness checks can work against `/player.html` without retooling the harness.

---

## Test Plan (TDD)

### Unit (Vitest)
- Tests for `loadProjectFromUrl('/game.yaml')`:
  - Loads valid YAML → returns `ProjectSpec` with scenes validated.
  - Invalid YAML / schema errors → throws a readable error.
  - Unknown `initialSceneId` / missing scenes → throws.
- If extracting shared “built-in ops registration”, unit-test:
  - `scene.gotoWave` validates target scene existence and invokes scene switching (mock the target function).

### E2E (Playwright)
- `player-load.spec.ts`:
  - Route `**/game.yaml` to a seeded YAML (no localStorage dependency).
  - Visit `/player.html`.
  - Assert canvas visible and `getSceneSnapshot().sceneKey === 'GameScene'` and `ready === true`.
- `player-waves.spec.ts`:
  - Seed YAML with `baseSceneId` + at least one wave scene.
  - Trigger `scene.gotoWave` via an attachment `Call`.
  - Assert the active compiled scene id changes to the wave scene (and the runtime stays in `GameScene` without restarting an app shell).

---

## Assumptions / Defaults Locked
- Player loads a fixed URL: `/game.yaml` (same origin as `player.html`).
- Player build excludes editor (`EditorScene` + React UI not bundled into player).
- Wave swapping is handled inside the runtime (`scene.gotoWave` directly switches scenes).

