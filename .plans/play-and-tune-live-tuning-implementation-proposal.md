# Play & Tune Live-Tuning Implementation Proposal

Status: Future proposal; not approved for implementation

## Summary

PhaserForge should not make the full editor writable while a game is running. Broad live editing would let authored state, runtime state, and partially executing ACE behavior drift apart in ways that are difficult for users to predict or undo.

Instead, add an explicit **Tune session** within Play Mode. A Tune session exposes a curated set of gameplay parameters, classifies how each change takes effect, stores experiments as reversible overrides, and lets the user review and keep only the changes they want.

The intended product promise is:

> Tune supported gameplay parameters during Play Mode, with clear live, next-use, and restart-required behavior. Review and keep the changes you want.

This proposal treats rapid iteration as the goal and unrestricted editing as a non-goal.

## Current Baseline

The shipped editor currently has two modes:

- Edit Mode owns authoring gestures and most project editing.
- Play Mode runs the dedicated `GameScene` runtime.

Some single-selection inspector paths remain writable in Play Mode, while scene settings, trigger zones, multi-selection editing, project structure, assets, input maps, canvas manipulation, and history controls are disabled.

When an allowed authored value changes, `App.tsx` emits the whole project through `runtime:load-project`. `BootScene` reloads the active runtime scene, and `GameScene.loadSceneSpec()` recompiles and starts it. This provides immediate feedback, but it is a full or partial runtime rebuild rather than a state-preserving hot patch.

The README currently describes this more broadly as changing values while the game is running. Until this proposal is implemented, product copy should call the shipped behavior **rapid preview** rather than unrestricted live tuning.

## Goals

- Make repeated calibration of gameplay values substantially faster.
- Keep Play Mode trustworthy as a clean test of authored project state.
- Give every tunable field explicit and predictable runtime semantics.
- Prevent experiments from silently becoming persisted project edits.
- Preserve a single authoritative authored project and normal history behavior.
- Focus the first implementation on high-value ACE parameters.
- Make restart behavior visible and batch restart-required changes.
- Support deterministic tests for classification, patching, review, keep, and revert.

## Non-Goals

- Keeping the full editor writable during Play Mode.
- Hot-swapping arbitrary project diffs.
- Changing ACE graph topology while actions are executing.
- Treating current runtime transforms as authored starting transforms.
- Capturing arbitrary runtime state into the project.
- Preserving every transient runtime value through a scene recompile.
- Making all existing fields tunable in the first release.

## Recommended Product Model

Keep **Edit** and **Play** as the primary modes. Add **Tune** as an explicit sub-session of Play Mode rather than as an unrestricted third editor mode.

Conceptually:

```text
Edit
  |
  +-- Play (clean authored project)
        |
        +-- Tune session (authored project + reversible overrides)
```

Entering Tune captures a baseline revision and opens a constrained tuning inspector. The scene graph remains available for inspection and selection, but structural commands remain unavailable. Leaving Tune or Play with overrides opens a review step with **Keep changes**, **Revert changes**, and **Continue tuning**.

Tune session changes must not be added to normal project history until the user chooses Keep. Keeping a session creates one coherent history entry instead of one entry per experimental adjustment.

## Parameter Effect Classifications

Every field exposed during Tune must declare one of these classifications:

| Classification | Runtime behavior | Typical examples |
|---|---|---|
| `live` | Patch existing runtime objects immediately without restarting the scene. | Volume, tint, opacity, current movement speed where supported |
| `next-use` | Update runtime configuration; current executions finish with their captured values and future executions use the override. | Cooldowns, durations, delays, spawn parameters, repeat counts |
| `restart-required` | Stage the override and apply it on an explicit preview restart. | Initial transforms, hitbox shape, scene audio configuration, input configuration |
| `edit-only` | Do not expose an editable control during Tune. | Add/remove/reorder actions, target changes, asset structure, scene hierarchy |

The classification must be visible next to the control through a compact badge, icon, or tooltip. Disabled controls must explain why they are unavailable and how to edit them.

Classification is property-specific, not component-wide. For example, changing a condition's numeric threshold may be `next-use`, while changing the condition type is `edit-only`.

## Initial ACE Scope

The first useful release should concentrate on scalar ACE calibration.

### Candidate `live` parameters

- Audio volume for an already playing managed sound.
- Display tint, opacity, or similarly reversible visual values.
- Movement speed or velocity only for action implementations with an explicit runtime patch adapter.
- Camera/effect intensity only when the running effect supports safe mutation.

### Candidate `next-use` parameters

- Action delays and durations.
- Cooldowns and debounce windows.
- Pattern amplitude, frequency, speed, and easing.
- Loop counts.
- Condition thresholds and probabilities.
- Future-spawn template values.
- Parameters for future invocations of service-backed calls where safe.

### Candidate `restart-required` parameters

- Authored starting position, rotation, size, and scale.
- Hitbox geometry and collision topology.
- Initial counter and collection contents.
- Scene music and ambience selection.
- Active input maps.
- Background and scene configuration.

### `edit-only` structure

- Action, condition, or event type.
- Target entity or formation.
- Add, remove, reorder, nest, group, or ungroup actions.
- Parallel-action topology.
- Scene transitions and scene hierarchy.
- Entity, formation, trigger-zone, asset, counter, collection, and input-map structure.
- Asset replacement and spritesheet configuration.

The allowlist should begin small. A parameter becomes tunable only after its semantics and patch behavior are covered by tests.

## Runtime Semantics

### Current versus future executions

ACE actions should capture the configuration needed for one execution when that execution starts. A `next-use` override updates the configuration source but does not mutate an action already in progress.

The Tune inspector may offer **Restart selected action** for action types that can be safely cancelled and restarted. The operation must use the same cancellation and cleanup path as normal runtime interruption.

### Authored versus runtime transforms

The editor must distinguish:

- Authored starting transform.
- Current runtime transform.
- Optional tuning override for the next preview start.

Physics movement must never be copied back into the authored starting transform automatically. Runtime transform values may be displayed read-only for diagnosis. A future **Capture runtime state** feature would require a separate proposal and explicit user action.

### Spawned instances

Template overrides apply to instances spawned after the change. Existing instances are not mutated unless the property has a dedicated `live` adapter and the UI clearly offers an **Existing instances / Future instances** scope.

The first release should support future instances only.

### Layered scenes

Each override key must include enough identity to distinguish the project, authored scene/layer, target, action or condition, and property path. Base-scene and active-wave targets must not collide.

If a runtime transition leaves the authored target's scene, retain the session override but show it as inactive until that scene is active again.

### Restart behavior

Changing a `restart-required` field marks the Tune session as needing restart. Do not automatically rebuild on each keystroke.

The toolbar should show **Restart Preview (N)**, where `N` is the number of staged restart-required changes. One restart applies the batch while preserving the editor camera when practical. Runtime gameplay state, counters, action progress, spawned instances, and physics state reset unless a later feature explicitly defines checkpoint restoration.

## Source-of-Truth Architecture

Maintain three distinct layers:

```text
Authored ProjectSpec
        +
TuneSession overrides
        =
Effective runtime configuration
```

The authored `ProjectSpec` remains unchanged during experimentation. The runtime receives an effective configuration or targeted patches derived from the authored project plus overrides.

Suggested model shape:

```ts
type TuneEffect = 'live' | 'next-use' | 'restart-required' | 'edit-only';

type TuneTarget = {
  projectId: Id;
  sceneId: Id;
  layer: 'base' | 'active';
  targetKind: 'entity' | 'group' | 'attachment' | 'condition' | 'scene';
  targetId: Id;
  propertyPath: string;
};

type TuneOverride = {
  target: TuneTarget;
  effect: Exclude<TuneEffect, 'edit-only'>;
  authoredValue: unknown;
  tunedValue: unknown;
  status: 'applied' | 'pending-next-use' | 'pending-restart' | 'error';
  error?: string;
};

type TuneSession = {
  baselineProjectRevision: string;
  overrides: TuneOverride[];
  startedAtMs: number;
};
```

The final implementation may use normalized maps rather than arrays, but target identity and authored/tuned separation are required.

### Tuning registry

Do not infer hot-patch behavior from arbitrary object diffs. Add a tuning registry in which each supported property declares:

- Stable property identity.
- Effect classification.
- Value type, range, validation, and display metadata.
- How to read the authored value.
- How to apply a runtime patch or update future configuration.
- How to revert a live patch.
- Whether the action can be restarted.
- Instance scope.
- Compatibility with base/active layered scenes.

Registry entries should live near the operation or behavior implementation when practical, while shared inspector rendering consumes normalized metadata.

### Runtime patch protocol

Introduce explicit runtime events or commands rather than reusing `runtime:load-project` for `live` and `next-use` changes. A possible command surface is:

```ts
type RuntimeTuneCommand =
  | { type: 'apply-live'; override: TuneOverride }
  | { type: 'set-next-use'; override: TuneOverride }
  | { type: 'restart-with-overrides'; overrides: TuneOverride[] }
  | { type: 'revert-live'; override: TuneOverride }
  | { type: 'restart-action'; target: TuneTarget };
```

Commands must return an acknowledgement or error so the UI never claims an override is active when the runtime rejected it.

## Tune Inspector UX

During a Tune session, the inspector should prioritize supported controls and runtime context:

- Selected target name and active scene/layer.
- Tunable fields grouped as they are in Edit Mode where possible.
- Effect indicator for each field.
- Authored value and tuned value when they differ.
- Read-only current runtime value when meaningful.
- Per-field reset-to-authored action.
- Restart selected action when supported.
- Session-level Reset, Review, Keep, and Revert actions.

Edit-only fields may either be hidden behind **Show unavailable fields** or shown disabled with a concise explanation. The default should minimize gray, unusable controls.

The scene graph should allow selection and inspection in Tune but continue to block rename, drag/drop, add/remove, reorder, and overflow mutations.

## Session Review and Persistence

The review surface should group overrides by scene, target, and ACE block. Each row shows:

- Property label.
- Authored value.
- Tuned value.
- Effect classification.
- Validation or runtime errors.
- Checkbox controlling whether the change will be kept.

**Keep changes** applies selected overrides to the latest authored project through one reducer command and one semantic history entry. It must detect baseline drift before applying.

If the authored project changed outside the session, show a conflict for any property whose current authored value no longer equals the recorded baseline. Do not silently overwrite it.

**Revert changes** removes all overrides. Live patches must be reversed or the preview must restart from authored state before the session closes.

Tune overrides are ephemeral and must not be included in autosave, YAML export, cloud sync, or project revisions until kept. An unexpected reload may discard the session initially; if so, the UI should warn before navigation when overrides exist. Persisting draft Tune sessions can be considered later.

## Workflow Impact and Required Confirmation

This proposal materially extends **A7 — Toggle Edit / Play** from `.plans/editor-workflows-inventory.md`. Repository policy requires user confirmation before implementation.

Current primary path:

1. Click `Play Mode` or press `Tab`.
2. Return to Edit Mode to change values.
3. Re-enter Play Mode to retest.

Proposed paths:

- Clean playtest: unchanged; click `Play Mode` or press `Tab`.
- Tune: enter Play, then click a nearby **Tune** action; optionally add `Shift+Tab` as a direct Tune entry after shortcut review.
- Finish tuning: click **Review**, then Keep or Revert; leaving Play with changes opens the same review.

Entry-point changes:

- Add one Tune entry point adjacent to the existing Play/Edit control.
- Add Review/Keep/Revert within the Tune session.
- Remove no existing Play or Edit entry point.

Expected workflow impact:

- Clean playtesting gains zero steps.
- Starting a Tune session gains one explicit step.
- Repeated parameter iteration removes most Edit/Play cycles.
- Pointer travel stays local to the existing canvas mode controls and inspector.

Style contract affected:

- Mode-level actions currently live in the canvas toolbar.
- Tune session state and restart status should remain there.
- Parameter controls remain in the inspector.
- Confirmation/review follows the editor's existing modal or review-panel conventions.

Before implementation, confirm this workflow and update the current workflow inventory only when the feature ships.

## Implementation Phases

All phases follow repository TDD policy: store/helper tests first, scene/integration tests where practical, then implementation. GUI phases require the local Chromium smoke suite.

### Phase 0 — Align current product language

- Change README language from broad live tuning to rapid preview or document the current limitations.
- Add concise Play Mode help text explaining which current changes restart the preview.
- Do not imply that arbitrary values hot-patch runtime state.

Verification:

- Documentation link and terminology review.
- Existing unit and smoke tests if UI help text changes.

### Phase 1 — Tune session state and review, using restart semantics

Deliver a useful, predictable session before implementing hot patches.

- Add `TuneSession` and override reducer helpers.
- Enter Tune from Play with a captured baseline revision.
- Build an allowlisted ACE tuning registry initially classified as `restart-required` or `next-use-via-restart`.
- Keep the authored project unchanged while editing overrides.
- Add Review, Keep, Revert, and baseline-conflict handling.
- Apply restart-required overrides only through explicit Restart Preview.
- Record kept overrides as one semantic project-history entry.

Tests:

- Override add/update/reset behavior.
- Authored project remains unchanged until Keep.
- Keep applies selected overrides once and creates one history entry.
- Revert restores authored runtime configuration.
- Baseline drift produces a conflict instead of overwriting.
- E2E primary path: Play -> Tune -> change -> restart -> review -> keep.
- E2E revert path and navigation warning.

### Phase 2 — Explicit `next-use` runtime configuration

- Add runtime tuning commands and acknowledgements.
- Let supported ACE operations read new configuration for future executions.
- Ensure already-running actions retain captured execution values.
- Show pending/applied/error state in the inspector.
- Add Restart selected action only for operations with safe cancellation.

Tests:

- Current execution is unchanged.
- Next execution uses the override.
- Failed runtime application is visible and does not report success.
- Action restart performs cleanup and starts with the tuned value.
- Layered-scene target identity remains correct.

### Phase 3 — Small `live` patch allowlist

- Add reversible patch adapters for a small set of visual, audio, and movement properties.
- Require runtime acknowledgement.
- Revert patches when a field resets or the session is discarded.
- Avoid generalized project-diff patching.

Tests:

- Patch reaches the intended runtime target only.
- Revert restores the authored value.
- Existing and future instance scope matches registry metadata.
- Destroyed or transitioned targets return a handled error.
- No scene recompile occurs for a successful live patch.

### Phase 4 — Expand coverage based on measured value

- Instrument local, privacy-safe counts of tuning classifications and restarts only if consistent with project telemetry policy.
- Prioritize commonly adjusted ACE parameters.
- Add physics tuning only after deterministic adapter tests exist.
- Consider checkpoint/replay separately if full restarts remain the dominant bottleneck.

Do not expand the registry merely to increase the percentage of enabled fields.

## Verification Requirements

For each implementation phase:

- Run targeted Vitest suites for store, registry, compiler, and runtime adapters.
- Add integration coverage for command acknowledgement and effect timing.
- Run `npm run test:e2e -- --project=chromium --grep @smoke` for editor UI changes.
- Run targeted Playwright specs for Tune session workflows.
- Verify YAML round-trip and autosave exclude unkept overrides.
- Verify Keep produces the intended semantic history narrative.
- Verify layered base/wave scenes do not cross-apply overrides.
- Verify ordinary Play Mode remains a clean authored-state test.

## Acceptance Criteria for the First Release

- Tune is an explicit Play sub-session; normal Play behavior remains available.
- Only registry-backed properties are editable.
- Every editable property shows its effect classification.
- The authored project, autosave, YAML, and cloud state remain unchanged until Keep.
- Restart-required changes are batched behind one explicit restart action.
- Users can review, selectively keep, or revert all changes.
- Keeping produces one coherent history entry.
- Exiting with pending changes cannot discard or persist them silently.
- ACE actions already in progress have documented, tested behavior.
- Product documentation describes the shipped scope accurately.

## Risks and Mitigations

### Runtime and authored state diverge

Mitigation: immutable authored baseline, explicit override layer, effect badges, and review before persistence.

### Hidden resets make tuning frustrating

Mitigation: no automatic restart for staged fields; show pending restart count and document what resets.

### A generalized patch engine becomes fragile

Mitigation: property registry with operation-owned adapters and an allowlist.

### Tune changes pollute project history or cloud saves

Mitigation: overrides remain outside `ProjectSpec`; Keep is the sole reducer boundary into authored state.

### ACE actions change semantics mid-execution

Mitigation: capture execution configuration at start; default action parameters to `next-use` rather than `live`.

### The UI remains mostly gray

Mitigation: Tune inspector defaults to supported properties and places unavailable authoring fields behind progressive disclosure.

### Three apparent modes confuse users

Mitigation: present Tune as a Play session/tool, not a peer authoring environment; keep the existing Play entry path intact.

## Open Decisions Before Implementation

- Confirm the proposed A7 workflow extension and toolbar placement.
- Choose whether direct Tune entry receives a shortcut in the first release.
- Decide whether leaving Tune returns to clean Play or always opens Review when no overrides exist.
- Select the first 5-10 ACE properties for the registry based on current demos and user pain.
- Decide whether Phase 1 calls `next-use-via-restart` fields restart-required in the UI until true next-use support ships.
- Choose the baseline revision identifier used for conflict detection.
- Define the semantic history label for a kept Tune session.

## Success Measures

- Fewer Edit/Play transitions while calibrating supported behaviors.
- Fewer full scene restarts per accepted tuned value after Phase 2/3.
- Low rate of discarded-session surprises or baseline conflicts.
- No increase in corrupted project state, serialization drift, or unclear history entries.
- Users can correctly predict whether a field applies live, on next use, or after restart.

