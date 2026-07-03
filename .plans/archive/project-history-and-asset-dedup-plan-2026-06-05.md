# Project History + Asset Deduplication Plan

## Summary
Add durable project history for cloud-backed PhaserForge projects without exploding storage costs from embedded assets.

This plan pairs two ideas:
- a user-facing `History` workflow reachable from the Project tab `Manage` menu
- a backend storage model that separates immutable asset payloads from versioned project documents

Without the storage change, revision history for full games with embedded assets becomes too expensive to retain densely.

## Problem
PhaserForge projects currently behave like self-contained project payloads with embedded assets. That is good for portability, but expensive for revision history if every checkpoint stores a full project snapshot.

If a full project snapshot includes unchanged embedded images/audio/fonts every time:
- each revision can be tens or hundreds of MB
- automatic checkpoints become prohibitively expensive
- per-user storage can grow into GBs quickly

So project history should not be implemented as naive “store the whole project again on every checkpoint.”

## Goals
- Give users durable project history beyond session-only undo/redo.
- Make `History` accessible from the Project tab `Manage` menu.
- Support rollback, preview, and restore-as-copy flows.
- Keep storage costs manageable for full games.
- Preserve YAML import/export as an explicit portable snapshot format.

## Non-goals
- No git-style branching/merging workflow in this phase.
- No attempt to make undo/redo itself the durable history system.
- No requirement to expose raw asset/blob storage details to users.

## User-Facing History Model
### Entry point
- Project row primary action: `Open`
- Project row secondary action: `Manage`
- `Manage` menu includes:
  - `History`
  - `Rename`
  - `Duplicate`
  - `Export YAML`
  - `Archive`

### History panel contents
Each history entry should show:
- timestamp
- revision type
  - `Autosave checkpoint`
  - `Named version`
  - `Before publish`
  - `Imported from YAML`
  - `Before switch`
- optional user label
- lightweight summary
  - scenes count
  - entity count
  - maybe changed scene names or project title

### History actions
- `Preview`
- `Restore`
- `Restore as copy`
- `Export YAML`

### Why this is not undo/redo
Undo/redo is:
- session-scoped
- linear
- optimized for immediate editing gestures

History is:
- durable
- cross-session
- cross-device for cloud projects
- intended for recovery and milestone restore

## Revision Creation Policy
Use both automatic checkpoints and explicit named versions.

### Automatic checkpoints
System-created, on meaningful boundaries:
- after import
- before publish
- before switching projects
- after burst-of-edits + idle
- every N minutes while dirty
- before destructive operations
- before conflict resolution

### Manual named versions
User-created milestones:
- `Before enemy wave refactor`
- `Playable review build`
- `Post audio pass`

### Retention policy
- Keep named versions until deleted.
- Keep autosave checkpoints with tiered retention:
  - dense for recent history
  - sparse for older history

Example:
- frequent checkpoints for 24 hours
- hourly for 7 days
- daily for 30 days

## Storage Architecture
## Core principle
Store assets once. Version project documents separately.

### A. Asset store
Immutable binary payload store for:
- images
- sprite sheets
- fonts
- audio

Each asset should have:
- `asset_id`
- content hash
- metadata
- binary/blob location

If two revisions reference the same asset bytes, they should reference the same stored asset record.

### B. Project document store
Versionable structured project document that references assets by stable IDs instead of duplicating full asset payloads into every revision.

Each project revision stores:
- project metadata
- scene/entity/action structure
- references to asset IDs
- revision metadata

### C. Revision metadata store
Per revision:
- `revision_id`
- `project_id`
- created timestamp
- revision kind
- optional user label
- author/source
- summary fields for list display

## Recommended data model
### Tables / logical records
- `projects`
  - current canonical head
- `project_revisions`
  - immutable revision records
- `assets`
  - immutable deduped asset blobs/metadata
- `project_revision_assets`
  - join/reference table if needed

### Asset dedupe key
Use content hash for dedupe:
- identical uploaded/embedded asset bytes should map to one stored asset object

### Revision payload strategy
Preferred:
- each revision stores full project structure referencing asset IDs

Optional later optimization:
- diffs between revisions for project structure only

Do not start with:
- binary diffs for asset blobs
- naive full copies of all embedded bytes per revision

## Storage Cost Estimates
### Naive full-snapshot approach
If every revision duplicates embedded assets:
- light full game project: `25-50 MB` per revision
- medium/heavy project: `50-150 MB` per revision
- audio-heavy project: `150 MB+` per revision

Implication:
- `10` revisions: `250 MB - 1.5 GB`
- `25` revisions: `625 MB - 3.75 GB`
- `50` revisions: `1.25 GB - 7.5 GB+`

This is too expensive for dense checkpoint retention.

### Deduped asset + separate project document approach
If assets are stored once and revisions mostly store project structure:
- many revisions may be closer to `100 KB - 2 MB` each
- `100` revisions could be roughly `10 MB - 200 MB` plus one-time asset storage

This is much more manageable.

## YAML role under this model
YAML remains:
- import format
- export format
- portable snapshot
- support/reproduction artifact

YAML is not:
- the day-to-day cloud persistence mechanism
- the internal per-revision storage format if that duplicates embedded blobs unnecessarily

You may still export a revision as YAML on demand.

## UX Flow
### Open history
1. User clicks `Manage`
2. User clicks `History`
3. History drawer/modal opens with newest-first revisions

### Restore in place
1. User previews or selects a revision
2. User chooses `Restore`
3. Current project head updates to that revision content
4. Previous head can optionally be checkpointed first

### Restore as copy
1. User selects a revision
2. User chooses `Restore as copy`
3. New project is created from that revision
4. Original project remains unchanged

### Export YAML from history
1. User selects a revision
2. User chooses `Export YAML`
3. App generates a portable project snapshot file

## Interaction with local/cloud sync
### Cloud-backed projects
- history is durable in backend storage
- local cache can keep a small recent revision subset for faster preview if useful

### Local-only projects
- optional lightweight local history can exist in IndexedDB
- but dense durable history should primarily be a cloud feature unless local storage budget is carefully bounded

### Sync issues
- if offline, local edits continue normally
- when sync resumes, backend may create a checkpoint before reconciling or promoting the latest local state

## Recommended implementation sequence
### Phase 1: History UI contract
- Add `History` to the Project row `Manage` menu
- Define revision list metadata and actions
- No backend retention yet beyond basic revision records if needed

### Phase 2: Asset/reference model
- Introduce asset identity separate from project revision storage
- Refactor project serialization/storage model so revisions reference assets instead of duplicating them

### Phase 3: Backend revision records
- Add revision creation on automatic checkpoint boundaries
- Add manual named versions
- Add retention policy for automatic checkpoints

### Phase 4: Restore flows
- Implement `Preview`
- Implement `Restore`
- Implement `Restore as copy`
- Implement `Export YAML` from any revision

### Phase 5: Local/offline compatibility
- Optionally add bounded local revision cache in IndexedDB
- Keep cloud as canonical durable history for signed-in users

## Risks
- Asset model migration may be non-trivial if current project format assumes inline embedded data everywhere.
- Revision summaries must be fast to compute or cached, otherwise history lists become slow.
- Restore flows need clear guardrails to avoid accidental destructive rollback.

## Recommendation
- Do add durable `History`.
- Do surface it from `Manage`.
- Do not implement it as naive full-project snapshot retention while assets remain duplicated in each revision.
- Prioritize asset dedupe/separation first or in parallel with revision storage design.
