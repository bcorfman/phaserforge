# localStorage / IndexedDB cleanup audit

Date: 2026-06-21

## Goal

Document what browser storage remains after moving active project persistence, cloud linkage, and conflict backups to IndexedDB, and decide what should:

1. stay in `localStorage` or `sessionStorage`
2. move to IndexedDB later
3. be removed once legacy compatibility is no longer needed

## Current recommendation

### Keep in IndexedDB as the durable workspace source of truth

These are already on the right side of the boundary and should stay there:

- active project records in `phaserforge.persistence.v1/projects`
- active workspace selection + sync mode in `workspaceState/workspace`
- workspace conflict backups in `workspaceState/workspaceBackup`
- persisted `cloudProjectId` on each stored project record
- project revision history on stored project records

### Keep in localStorage

These are lightweight preferences or convenience values where synchronous browser storage is acceptable and even desirable:

- `phaserforge.startupMode.v1`
  - user preference, tiny, read during startup
- `phaserforge.themeMode.v1`
  - user preference, tiny, should remain simple
- `phaserforge.uiScale.v1`
  - user preference, tiny
- `phaserforge.showHitboxOverlay.v1`
  - user preference, tiny
- `phaserforge.viewState.v1`
  - per-project viewport memory; useful as lightweight UI state rather than durable content
- `phaserforge.debugViewRestore.v1`
  - debug-only switch
- `phaserforge.leftPaneWidth.v1`
  - UI layout preference
- `phaserforge.rightPaneWidth.v1`
  - UI layout preference
- `phaserforge.assetsDockHeight.v1`
  - UI layout preference
- `phaserforge.assetsDockShowThumbnails.v1`
  - UI presentation preference
- `phaserforge.inspectorFoldouts.v1`
  - UI expand/collapse memory
- `phaserforge.pinnedActionTypes.v1`
  - user preference / convenience
- `phaserforge.pinnedPatternIds.v1`
  - user preference / convenience
- `phaserforge.cloud.last_github_pages_publish_v1`
  - convenience metadata, not required for correctness
- `phaserforge.cloud.account_created_v1`
  - convenience hint for default auth mode

### Keep in sessionStorage

These are intentionally ephemeral and should stay session-scoped:

- `phaserforge.cloud.return_to_cloud_after_auth`
  - one-session return intent after auth redirect
- E2E/test-only session sentinels such as:
  - `phaserforge.testAppShellResetOnce.v1`

### Keep only as legacy migration input for now

These should no longer be used by normal runtime behavior, only by migration/bootstrap compatibility and older tests:

- `phaserforge.projectYaml.v1`
- `phaserforge.projectLastSavedAtMs.v1`

These should be deleted entirely after the removal conditions below are met.

### Remove from product runtime

These should no longer be part of the live persistence path:

- `phaserforge.cloud.project_game_id_map_v1`
  - replaced by persisted `cloudProjectId` on project records
- `phaserforge.workspaceBackupYaml.v1`
  - replaced by IndexedDB workspace backup record

## Migration backlog

### Phase 1: test + helper cleanup

Update tests and helpers that still seed old project keys directly:

- `tests/e2e/background-layers.spec.ts`
- `tests/e2e/text-entities.spec.ts`
- `tests/e2e/yaml-load.spec.ts`
- `tests/e2e/helpers.ts`
- any remaining unit/storybook fixtures that assume `projectYaml.v1`

Recommended replacement:

- seed via editor actions when the test is about user flows
- seed IndexedDB directly when the test is explicitly about reload/bootstrap state

### Phase 2: remove legacy project-key exports from EditorStore

Once the remaining tests/helpers stop depending on them:

- remove `PROJECT_STORAGE_KEY`
- remove `PROJECT_LAST_SAVED_AT_STORAGE_KEY`
- remove `WORKSPACE_BACKUP_STORAGE_KEY`

from `src/editor/EditorStore.tsx`

### Phase 3: remove legacy merge/bootstrap compatibility

After all active browsers/users have crossed the migration window and we no longer need to import pre-IndexedDB state:

- remove `LEGACY_PROJECT_STORAGE_KEY`
- remove `LEGACY_PROJECT_LAST_SAVED_AT_KEY`
- remove `fallbackProjectFromLegacyYaml()`
- remove `mergeSnapshotWithLegacyActiveProject()`
- remove `migrateLegacyStorage()` behavior that imports legacy project YAML

This should happen only after we are comfortable dropping reload continuity for users whose only saved state lives in the old browser keys.

## Optional future consolidation candidates

These do not need to move, but could be moved if we later want “all editor preferences in one IndexedDB preferences record”:

- pane widths / dock height
- inspector foldouts
- thumbnail toggle
- pinned actions / pinned patterns
- view state

Current recommendation: do not migrate them unless we have a concrete product reason, because they are small, low-risk, and simpler in `localStorage`.

## Removal conditions

We can fully delete the legacy project YAML keys only when all of the following are true:

1. No runtime code depends on `phaserforge.projectYaml.v1` or `phaserforge.projectLastSavedAtMs.v1` for recovery.
2. Reload/bootstrap tests seed IndexedDB or user actions instead of legacy project keys.
3. We accept that users returning from a very old pre-migration local browser state will no longer be auto-imported.
4. We either ship a one-time migration release and allow enough time for it to run, or explicitly choose a breaking cleanup.

## Bottom line

The remaining browser storage is mostly fine.

The important cleanup still worth doing is:

1. finish removing old project-YAML seeding from tests/helpers
2. then delete the legacy runtime exports/constants
3. later, remove the one-time legacy import path when compatibility is no longer needed

Everything else can stay in `localStorage` or `sessionStorage` unless we want a deliberate “preferences unification” project.
