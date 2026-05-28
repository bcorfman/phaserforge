# Cloud/Local Workspace Conflict Picker (Timestamps + Summary + Export Both)

## Summary
When the app is running in Cloud mode and the user logs in, if there’s a divergence between the **cloud workspace snapshot** and the **this-device workspace snapshot**, show a conflict picker that lets the user safely choose which workspace becomes active—without losing data.

This plan implements 3 safety features:
1) **Timestamps** (last saved time + source)
2) **Summary counts** (scenes/entities/groups/assets)
3) **Export both as YAML** (non-destructive escape hatch)

## Key Changes
### Conflict detection & trigger
- Trigger point: after successful auth (existing Cloud login flow), run a one-time reconciliation step:
  - Load local snapshot YAML from existing localStorage key (current behavior).
  - Fetch cloud snapshot YAML (new endpoint or reuse existing `games` if a single “workspace” record exists; see Assumptions).
  - If both exist and are not equivalent, open the conflict picker modal.

- Equivalence rule:
  - Parse both YAML texts via existing project YAML parser.
  - Re-serialize to canonical YAML (existing `serializeProjectToYaml`) and compare strings.
  - If either parse fails, treat that side as “unknown” but still allow exporting the raw YAML text.

### Conflict picker UI (modal)
- Modal title: `Choose which workspace to keep`
- Two side-by-side cards: **Cloud** and **This device**
  - Each card shows:
    - **Last saved:** absolute local time (e.g., `May 28, 2026 10:14 AM`)
    - **Summary:** `Scenes: N`, `Entities: N`, `Groups: N`, `Assets: N` (assets = total count across relevant asset categories)
    - **Preview** button: opens a temporary read-only preview mode for that snapshot (see Preview behavior)
    - Primary choose button: `Use Cloud` / `Use This Device`

- Global actions (always visible in the modal):
  - `Export both as YAML…`:
    - Downloads two YAML files, named with source + timestamp (e.g., `phaserforge-cloud-2026-05-28-1014.yaml`, `phaserforge-device-2026-05-28-0952.yaml`).
    - If file-system APIs are available, use the existing export helper; otherwise blob download.

- After user chooses a side:
  - Load the chosen YAML into the editor using the existing `load-yaml-text` action (replaces current workspace immediately).
  - Persist the chosen snapshot to:
    - localStorage autosave (existing effect)
    - cloud autosave (if logged in and cloud sync enabled)
  - Always create a **local backup** of the non-chosen YAML in localStorage (new key, e.g., `phaserforge.workspaceBackup.v1`) and toast: `Backup saved on this device`.

### Preview behavior (read-only)
- Implement preview as a modal overlay that can render:
  - Canvas + entity list at minimum (no editing, no autosave writes).
- Preview uses the parsed ProjectSpec in memory, not the live store:
  - “Close preview” returns to the conflict picker modal.

### Data surfaced in the picker
- Timestamps:
  - Local: store/update a `lastSavedAtMs` alongside the existing `PROJECT_STORAGE_KEY` whenever autosave runs.
  - Cloud: require `updated_at` (already returned for games) or a workspace metadata field; display it.

- Summary counts:
  - Implement a pure helper `summarizeProject(spec)` and `summarizeYamlText(yaml)` that returns `{ scenes, entities, groups, assets }`.
  - Assets count definition: total of all asset entries across asset categories in the ProjectSpec (consistent across local + cloud).

### Cloud autosave model (no project IDs)
- Do not introduce user-visible project IDs.
- Persist a single per-user “workspace” snapshot in cloud storage (server-side); client treats it as “Cloud autosave”.
- When logged out in Cloud mode:
  - Autosave target indicator shows `Autosave: This device (not synced)`.
  - No cloud writes attempted.

## Tests (TDD order; non-flaky)
### Unit tests
- `summarizeProject` correctness for:
  - empty project
  - multi-scene projects
  - projects with groups/entities/assets
- `summarizeYamlText` behavior for:
  - valid YAML
  - invalid YAML (returns `parseError: true` and zero/unknown counts without throwing)

### Integration/store tests
- Conflict detection:
  - same content (no modal)
  - divergence (modal shown)
  - one side missing (no modal; load existing)
  - parse failure on one side (modal still shown with “Unknown” counts but export enabled)

### E2E (Chromium smoke; add `@smoke` where appropriate)
- Scenario: local workspace exists, cloud workspace exists, they differ → login triggers modal
  - Both cards show timestamps + counts
  - `Export both` downloads two files
  - Choosing each side loads correct workspace and closes modal
  - Backup key created in localStorage for the non-chosen YAML
- Ensure tests assert stable invariants (modal presence, text labels, download triggered), not timing.

## Assumptions / Defaults
- Cloud has (or will add) a single “workspace snapshot” API (recommended) rather than requiring selecting from multiple games.
- Canonical YAML serialization is deterministic enough to use “re-serialize then compare” for equivalence.
- “Assets count” uses total entries across the project’s asset collections, not file sizes or deep metadata.

