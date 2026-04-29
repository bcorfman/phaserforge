# Game-Only Web Player (YAML → Play Immediately)

## Summary
- Add a **game-only player page** (`player.html`) that loads a fixed `game.yaml`, boots Phaser, and immediately starts in **play mode** (no editor UI / no `EditorScene`).
- Make runtime **self-contained for scene transitions + wave swapping** (no React “glue” needed).
- Ensure YAML-referenced **assets resolve as web URLs** in a distributable build.
- Add a **user deploy/export flow** so each user can publish demos of the YAML they create (free via their own GitHub Pages, or paid hosting if they choose).

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

## User Demos: “Export Deployable ZIP” + GitHub Pages (Free)

### Goals / Constraints
- Users can **deploy their own games for free** without you hosting their demos.
- Demos are **static** (no runtime server required).
- Users can optionally **pay for hosting** elsewhere (Netlify / S3 / Railway static hosting / etc.), but the default path is GitHub Pages.
- The exported bundle must work from a GitHub Pages subpath (`https://<user>.github.io/<repo>/`) so all URLs must be **relative** (`./...`), not absolute (`/...`).

### Export Bundle Contract (what the studio exports)
Add a studio action: **Export Demo ZIP** that produces a zip with:
- `index.html` (player entry; no editor UI)
- `game.yaml` (the user’s YAML, either self-contained or rewritten to file assets)
- `assets/**` (only when exporting “file assets” mode)
- `player/**` (player runtime JS/CSS; stable filenames, no content hashes)

Two export modes (toggle; default = File assets):
1) **File assets (default)**: convert any `source.kind: embedded` assets into real files under `assets/`, rewrite YAML sources to `source.kind: path` with paths like `assets/<id>.<ext>`.
2) **Self-contained YAML**: keep embedded `dataUrl` assets; ZIP contains only `index.html`, `game.yaml`, and `player/**`.

### Free Hosting: GitHub Pages (doc-driven)
Publish steps the studio links to (no GitHub API automation in v1):
1) Create a new GitHub repo (public recommended for free Pages), e.g. `my-phaseractions-demo`.
2) Unzip the exported demo ZIP and commit the contents to the repo root (or `docs/`).
3) In GitHub repo settings → Pages:
   - Source: “Deploy from a branch”
   - Branch: `main`
   - Folder: `/ (root)` (or `/docs` if using `docs/`)
4) Visit the URL GitHub provides: `https://<user>.github.io/<repo>/`.

### Player entry behavior in exported bundle
The exported `index.html` must:
- Load runtime from `./player/player-runtime.js` (stable name).
- Fetch YAML from `./game.yaml`.
- Resolve any asset `path`s relative to the page: `./assets/...`.

### Why stable filenames matter (no build step for user)
For the export ZIP to be publishable “as-is” (upload/commit only), the player runtime included in the ZIP must use stable filenames.
Implementation approach:
- Add a dedicated “player runtime build” that emits non-hashed filenames into a repo folder (e.g. `public/deploy-template/player/*`).
- The studio’s export uses that template and injects `game.yaml` + optional `assets/**`.

---

## Relationship to Accounts / Cloud Saves
- **Cloud saves (server features)**: authenticated users save YAML online under their account (Postgres backend on Railway).
- **Demos (this plan)**: any YAML (cloud or local) can be exported to a static ZIP and hosted by the user (free via GitHub Pages).

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
- Export unit tests (new):
  - `exportDemoZip(project, { mode })` creates a bundle with the required paths and uses relative URLs.
  - `rewriteYamlAssetSources()` converts `embedded` → `path` when in “file assets” mode.

### E2E (Playwright)
- `player-load.spec.ts`:
  - Route `**/game.yaml` to a seeded YAML (no localStorage dependency).
  - Visit `/player.html`.
  - Assert canvas visible and `getSceneSnapshot().sceneKey === 'GameScene'` and `ready === true`.
- `player-waves.spec.ts`:
  - Seed YAML with `baseSceneId` + at least one wave scene.
  - Trigger `scene.gotoWave` via an attachment `Call`.
  - Assert the active compiled scene id changes to the wave scene (and the runtime stays in `GameScene` without restarting an app shell).
- Export E2E (new):
  - Export a demo ZIP, unzip to a temp dir, serve statically, visit exported `index.html`, assert the game boots and assets load.

---

## Assumptions / Defaults Locked
- Player loads a fixed URL: `/game.yaml` (same origin as `player.html`).
- Player build excludes editor (`EditorScene` + React UI not bundled into player).
- Wave swapping is handled inside the runtime (`scene.gotoWave` directly switches scenes).
- Free demo hosting default: user-managed **GitHub Pages**.
- Export is doc-driven (no GitHub API automation in v1).
