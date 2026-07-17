# Stable / Dev GitHub Pages Deployment Plan

Status: proposed plan; implementation not started.

Current editor URL:

- `https://bcorfman.github.io/phaserforge/`

Target editor URLs:

- Stable: `https://bcorfman.github.io/phaserforge/stable/`
- Dev: `https://bcorfman.github.io/phaserforge/dev/`
- Root: `https://bcorfman.github.io/phaserforge/` must not host an editor build.

## Durable Rule

The public editor should deploy only to explicit stable and development channels. `/stable/` serves the user-safe release build. `/dev/` can track active development. The root `/phaserforge/` must not host an editor build; it may only redirect to `/stable/` or show a minimal channel chooser. No additional preview, release, or per-branch URL scheme is required for this increment.

## Non-Goals

- Do not change the existing game publish method.
- Do not add per-PR preview deployments.
- Do not introduce a release archive beyond `/stable/` and `/dev/`.
- Do not require users to understand Git branches or build IDs.

## Proposed Channel Semantics

- `/dev/` updates from `main` after CI passes.
- `/stable/` updates only from an explicit stable promotion action.
- The root `/phaserforge/` should either redirect to `/stable/` or show a tiny channel chooser, with `/stable/` preferred as the default user-safe destination. It must not contain a runnable editor bundle.
- Both channel builds should use relative asset paths or channel-aware Vite base paths so direct reloads work under their subdirectories.
- Persistence should use a hybrid channel model: `/stable/` keeps the existing production persistence namespace so saves from the former root URL carry forward automatically, while `/dev/` uses a separate development namespace unless an explicit compatibility gate says sharing is safe.

## Phase 1 — Deployment Inventory

- [ ] Inventory the current GitHub Pages workflow in `.github/workflows/deploy-frontend-pages.yml`.
- [ ] Confirm how `dist/`, docs staging, and asset paths behave under nested `/stable/` and `/dev/` paths.
- [ ] Confirm whether docs remain at `/docs/` or move under one editor channel.
- [ ] Identify any hard-coded `/phaserforge/` or root-relative asset URLs that would break under channel subpaths.

## Phase 2 — Build and Stage Channels

- [ ] Build the editor once for `/dev/` and stage it under `dist/dev/`.
- [ ] Build or copy the stable editor artifact under `dist/stable/`.
- [ ] Add a root `index.html` redirect or chooser pointing users to `/stable/`, without staging editor JS/CSS/assets at the root.
- [ ] Preserve existing docs staging without interfering with `/stable/` and `/dev/`.

## Phase 3 — Stable Promotion

- [ ] Add an explicit workflow dispatch input or separate workflow for promoting stable.
- [ ] Decide whether stable is promoted from:
  - the current `main` SHA after validation;
  - a Git tag;
  - a named stable branch.
- [ ] Ensure stable promotion does not happen automatically on every `main` push.
- [ ] Record the promoted commit SHA in the Pages artifact, a small `stable/version.json`, or workflow summary.

## Phase 4 — Dev Deployment

- [ ] Keep automatic deployment from CI-passing `main` to `/dev/`.
- [ ] Make `/dev/` visibly identify itself as the development channel somewhere low-friction, without adding a disruptive workflow.
- [ ] Keep `/stable/` on the current production IndexedDB/localStorage namespace so existing root saves migrate by continuity.
- [ ] Move `/dev/` local persistence to a separate development namespace, or require an explicit schema compatibility gate before `/dev/` can write the shared production namespace.
- [ ] Ensure cloud persistence cannot let `/dev/` corrupt `/stable/` projects without clear schema compatibility rules.

## Phase 5 — Verification

- [ ] Add a workflow-level smoke or artifact check that `dist/stable/index.html` and `dist/dev/index.html` exist.
- [ ] Add an artifact check proving the root does not contain the editor bundle entrypoints.
- [ ] Run a deployed-path smoke test locally, serving the staged `dist` and visiting `/stable/` and `/dev/`.
- [ ] Confirm deep reloads work on both channel URLs.
- [ ] Confirm published games still use the existing publish path unchanged.

## Open Decisions

- Should stable promotion use tags, a stable branch, or manual workflow input selecting a commit SHA?
- Should the root `/phaserforge/` redirect immediately to `/stable/`, or show a two-link channel chooser?
- Should docs stay at `/docs/`, or should docs be considered part of the stable channel?
