# Cloud-First Persistence Tiers + Project Picker Plan

## Summary
Shift PhaserForge toward a cloud-first persistence model while preserving a low-friction anonymous/offline path.

Recommended shape:
- Cloud Postgres becomes the canonical persistence layer for signed-in users.
- IndexedDB becomes the universal local cache/offline/anonymous layer.
- YAML remains the explicit import/export/portable-snapshot/backup format.
- The existing `Project` tab becomes the place to open, switch, duplicate, and manage projects.

This plan intentionally avoids a local Postgres fallback. For a browser editor, IndexedDB is the simpler and more appropriate local tier.

History/versioning details are intentionally out of scope here. See [project-history-and-asset-dedup-plan-2026-06-05.md](/home/bcorfman/dev/phaserforge/.plans/project-history-and-asset-dedup-plan-2026-06-05.md) for the dedicated plan covering `Manage` → `History`, checkpoint policy, and asset dedupe/separation.

## Goals
- Survive browser tab refreshes and ordinary Menlo session churn better than `localStorage` / `sessionStorage`.
- Keep game/project content separate from user preferences and editor-local workspace state.
- Support signed-in cloud-first usage without blocking anonymous “try the editor” or offline debugging.
- Add an explicit project-switching workflow before making cloud persistence the primary user path.
- Keep YAML as a first-class interchange and recovery tool without using it as the live preferences container.

## Non-goals
- No local Postgres install/runtime path for normal users.
- No attempt to make GitHub Pages publish the canonical editable persistence format.
- No removal of YAML import/export in this phase.
- No detailed collaboration/version history design in this document beyond storage primitives that could support it later.

## Recommended Tier Model
### Tier 1: In-memory active document
- Holds the currently open editable project plus ephemeral interaction state needed for the active session.
- Fastest path; no persistence guarantees.
- The editor runtime, selection state, and interaction feedback should continue reading from this layer.

### Tier 2: IndexedDB local cache
- Required for:
  - anonymous local projects
  - offline edits to cloud-backed projects
  - local autosave snapshots
  - per-device workspace state
  - per-device preferences
  - optional sync queue for cloud writes
- Replaces current reliance on `localStorage` for durable browser persistence.
- Should be treated as:
  - the source of truth for anonymous/offline sessions
  - a cache + recovery layer for signed-in cloud sessions

### Tier 3: Cloud Postgres persistence
- Canonical for signed-in users.
- Stores:
  - project records
  - project metadata
  - publish metadata
  - ownership/account linkage
  - optionally synced preferences across devices later
- Project switching should primarily target this tier for signed-in users.

### Tier 4: YAML import/export
- Explicit file-based interchange, inspection, and recovery path.
- Used for:
  - import from disk
  - export/manual backup
  - portable snapshot capture
  - support/reproduction
  - manual inspection and diffing
  - migration between environments
- Not part of day-to-day autosave persistence.
- Not the live persistence tier for preferences or workspace chrome.

## Storage Separation
Keep three logical buckets distinct even if they share some infrastructure.

### A. Project document
- Canonical editable game content.
- Includes:
  - scenes
  - entities
  - groups
  - actions / behaviors / conditions
  - project metadata relevant to the game itself
- Serialized to YAML for interchange and publish.
- Stored in:
  - Tier 1 in memory
  - Tier 2 IndexedDB cache
  - Tier 3 Postgres canonical record
- YAML is an explicit import/export representation of this document, not the normal local persistence layer.

### B. Editor workspace state
- Per-device/per-user working context, not part of the game file.
- Includes:
  - last opened project ID
  - view/camera state
  - conflict backups
  - unsynced local draft metadata
  - maybe last active scene, if intentionally device-local
- Stored in:
  - Tier 2 IndexedDB
  - optionally Tier 3 later if cross-device restore is desired

### C. User preferences
- Per-user UI/editor preferences.
- Includes:
  - theme
  - UI scale
  - pane widths
  - assets dock height
  - thumbnail toggle
  - inspector foldouts
  - pinned actions/patterns
  - startup mode
- Stored in:
  - Tier 2 IndexedDB by default
  - optionally mirrored to Tier 3 for signed-in cross-device sync
- Explicitly excluded from the YAML project document.

## Recommendation on Local Postgres Fallback
### Recommendation
Do not build a local Postgres fallback for normal browser use.

### Why not
- Too much install/runtime friction for “try the editor” and offline debugging.
- Adds service management, schema lifecycle, and local-account semantics that do not match a browser-first product.
- Solves a broader platform problem than the actual user need, which is local draft durability and later sync.

### Better alternative
Use IndexedDB as the local persistence layer for:
- anonymous use
- offline use
- cloud outage fallback
- cloud sync staging
- Keep YAML only as explicit import/export and manual backup.

### When a local Postgres path would make sense
Only if PhaserForge later becomes:
- a desktop app
- a self-hosted team product
- or a local-server product with broader backend features beyond persistence

## Project Switching: Product Requirement
If cloud persistence becomes primary, project switching must become a first-class workflow.

The current cloud path is save/publish-oriented, not a full project browser. Before leaning harder on cloud persistence, add a real project picker in the existing `Project` tab.

## Project Tab Direction
### Ownership of the Project tab
The `Project` tab should own:
- open project
- switch project
- create project
- duplicate project
- archive/delete project
- import/export YAML
- local/offline/cloud project state visibility

The `Cloud` tab should keep owning:
- account/auth
- cloud status
- publish to GitHub Pages

### High-level Project tab sections
1. `Projects`
   - tabs or filters: `Recent`, `Cloud`, `Local`, `Templates`
   - search box
   - `New Project`, `Import`, `Refresh`
2. `Recent Projects`
   - unified list with badges:
     - `Cloud`
     - `Local`
     - `Unsynced`
     - `Current`
3. `Active Project Summary`
   - open, duplicate, export YAML, work offline, archive
4. `Startup & Reset`
   - existing controls retained below the picker

### Global sync-state control
- The main editor shell should show a clickable project sync-state badge, replacing the current `Unsaved` badge.
- Badge states:
  - `Online`
  - `Offline`
- Clicking the badge toggles the project between normal cloud-sync behavior and local-only/offline behavior.
- This control must remain visible outside the `Project` tab so users can understand and change sync mode from anywhere in the editor.

### Why the Project tab is the right place
- It preserves the existing editor information architecture instead of moving project management into the Cloud tab.
- It keeps “document management” distinct from “account/publish”.
- It gives the app a clear primary workflow for selecting what the user is editing.

## Project Record Model
### Cloud project record
- `id`
- `ownerUserId`
- `title`
- `yaml` or equivalent canonical project blob
- `createdAt`
- `updatedAt`
- publish metadata
- optional flags:
  - archived
  - template

### IndexedDB local project record
- `localProjectId`
- `origin`
  - `anonymous`
  - `cloud-cache`
  - `offline-fork`
- optional `cloudProjectId`
- `title`
- canonical project payload
- `updatedAt`
- `syncStatus`
  - `synced`
  - `pending`
  - `conflict`
  - `local-only`

### IndexedDB workspace store
- `lastOpenedProjectRef`
- view state keyed by project
- conflict backups
- local recovery snapshots
- maybe recent-project ordering

### IndexedDB preferences store
- theme
- ui scale
- pane sizing
- foldouts
- pins
- startup mode
- other per-device editor preferences

## Core Workflows
### Anonymous “try the editor”
1. User opens the app without logging in.
2. App creates or restores an anonymous IndexedDB-backed local project.
3. Project tab shows local drafts only.
4. Autosave writes to IndexedDB.
5. User can later sign in and choose to sync/import that draft into cloud.

### Signed-in normal workflow
1. User signs in.
2. App loads project list from cloud and local IndexedDB cache.
3. Project tab shows recent cloud projects plus local projects and any cloud-backed projects that currently need sync retry.
4. User opens a cloud project.
5. App loads it into Tier 1, caches it in IndexedDB, and begins cloud autosave.

### Offline debug workflow
1. User opens an existing project and chooses `Work Offline`.
2. App creates a local fork or local editable cache marker.
3. Autosave continues into IndexedDB only.
4. When connectivity/auth returns, app offers:
   - sync back to cloud
   - duplicate as a new cloud project
   - export YAML instead

### Unsaved switch workflow
1. User attempts to switch projects from the Project tab.
2. If the active project has unsynced or unpublished local changes, show a dialog:
   - `Save / Sync and Switch`
   - `Keep Local Draft and Switch`
   - `Cancel`
3. Switching then loads the selected project and updates `lastOpenedProjectRef`.

## Autosave Strategy
### Project autosave
- Move project autosave from `localStorage` to IndexedDB.
- Add debounced autosave for project document writes.
- Prefer `requestIdleCallback` or equivalent idle scheduling where practical.
- For signed-in users:
  - write locally first
  - schedule cloud sync second

### Preferences autosave
- Write to a separate IndexedDB preferences store.
- Do not serialize preferences into the YAML project snapshot.
- Optional later enhancement:
  - cloud-sync selected preferences for signed-in users

### Recovery guarantee
- On normal refresh/reload:
  - recover from IndexedDB
- On browser storage wipe:
  - recover from cloud if signed in
- On full offline/no-login:
  - recover from IndexedDB only
- On total browser-storage destruction plus no cloud:
  - YAML export remains the manual escape hatch

## User-Facing Terminology
- Use `Local` in the UI instead of `This device`.
- Use `Cloud` for server-backed projects.
- Use `Unsynced` only when a cloud-backed project has pending local changes that could not be uploaded yet.
- Do not use `Unsynced` for signed-out or intentionally local-only projects; those should read as `Local`.
- Optional transient status: `Syncing…` while cloud upload is in flight.
- Use `Online` / `Offline` for the global clickable sync-mode badge in the main editor shell.
- Reserve `Import YAML` / `Export YAML` for explicit file actions.
- Do not imply that YAML is part of the normal persistence flow after this migration.

## Menlo / Browser-Isolation Implications
### What IndexedDB helps with
- Survives ordinary tab refreshes and loss of `sessionStorage`.
- Better fit than `localStorage` for larger project snapshots.
- Cleaner basis for local draft caching and conflict management.

### What IndexedDB does not guarantee
- If Menlo or the browser isolation layer wipes all origin storage, IndexedDB may also be lost.
- That means cloud persistence remains the real durable layer for signed-in users.

### Product implication
If cloud-first is acceptable, the app should increasingly treat IndexedDB as:
- a resilience cache
- an offline layer
- an anonymous trial layer

not the sole durable store for important signed-in work.

## Responsiveness Guidance
### Expectations
- Moving from `localStorage` to IndexedDB may modestly reduce main-thread blocking for persistence.
- It should not be treated as the primary fix for choppy Play Mode rendering.

### Practical recommendation
- Still do the migration because it improves durability and architecture.
- Also debounce project autosaves and keep writes off the hot path.
- Do not assume this fixes Menlo/GPU-driven render stutter.

## API / Server Implications
### Minimum server additions
- `GET /api/v1/games`
- `POST /api/v1/games`
- `GET /api/v1/games/:id`
- `PUT /api/v1/games/:id`
- `DELETE /api/v1/games/:id`

### Optional but recommended additions
- project metadata optimized for list views
- archived flag / archive endpoint
- duplicate endpoint or client-level duplicate save flow
- recent-project ordering support
- sync conflict metadata

## Phased Implementation Plan
### Phase 1: Persistence abstraction
- Introduce a browser persistence layer abstraction.
- Separate stores:
  - `projects`
  - `workspaceState`
  - `preferences`
- Migrate existing `localStorage` keys into IndexedDB on first boot.
- Keep reads tolerant during migration.

### Phase 2: Local project cache + anonymous mode
- Add IndexedDB-backed local project records.
- Restore last anonymous/local draft on startup.
- Add sync status metadata.
- Keep YAML import/export unchanged as explicit file operations only.

### Phase 3: Cloud canonical project flow
- Formalize cloud project CRUD as canonical for signed-in users.
- Cache opened cloud projects locally in IndexedDB.
- Add local-first then cloud-sync autosave sequence.
- Add cloud/local conflict handling per project instead of a single latest-workspace heuristic.

### Phase 4: Project tab picker
- Add project picker UI in the existing `Project` tab.
- Add:
  - recent list
  - search/filter
  - open/switch
  - duplicate
  - archive/delete
  - work offline
- Keep `Startup & Reset` below the new picker surface.

### Phase 5: Unsynced draft and conflict UX
- Add explicit unsynced badges and switch guards.
- Add local fork / reconnect flow.
- Make local/cloud conflict resolution project-scoped rather than global-workspace-scoped.

### Phase 6: Optional cloud preference sync
- After core project flows stabilize, choose which preferences should sync across devices.
- Keep some preferences device-local if they are workstation-specific.

## TDD / Verification
### Unit tests
- IndexedDB storage adapters:
  - create/read/update/delete project records
  - preferences store
  - workspace state store
  - migration from current `localStorage` keys
- sync-status helpers
- project-picker list filtering/sorting

### Integration tests
- anonymous startup restores local draft
- signed-in startup prefers last cloud project but restores local cache first
- switch-project flow guards unsynced changes
- offline fork can later sync back to cloud
- preferences stay separate from YAML project payload

### E2E
- Chromium smoke for Project-tab picker once implemented
- open cloud project
- open local draft
- switch between projects
- offline local draft recovery
- sign-in and sync local draft to cloud
- conflict path remains non-flaky and asserts stable UI invariants

## Concrete Recommendations
- Make cloud Postgres the canonical persistence layer for signed-in users.
- Use IndexedDB, not local Postgres, as the local/anonymous/offline fallback.
- Keep YAML import/export as an explicit backup, portable snapshot, and support/reproduction tool, not a day-to-day persistence tier.
- Put the project picker in the existing `Project` tab, not the `Cloud` tab.
- Keep `Cloud` focused on auth, sync status, and GitHub Pages publishing.
- Separate project document, workspace state, and user preferences into distinct stores.
- Add debounced local autosave and then cloud sync, rather than synchronous save-first behavior.
- Treat IndexedDB as a resilience cache and offline tier, not the only durable store for signed-in work.
- Treat `Unsynced` as an exception state for interrupted cloud sync, not the default label for ordinary local editing.
