# Plan — Approach 1: Event Blocks + Actions with “Until…” Builder (+ No-code Counters/Collections + Score)

Source mockups (May 11, 2026):
- `.plans/archive/mockups/ace-10x-editor-approaches-2026-05-11/approach-1-event-blocks-actions-with-until-builder.svg`
- `.plans/archive/mockups/ace-10x-editor-approaches-2026-05-11/approach-1b-no-code-counters-and-collections.svg`
- `.plans/archive/mockups/ace-10x-editor-approaches-2026-05-11/approach-1c-no-code-score-counter.svg`

Constraints (from `AGENTS.md`):
- TDD: store/helper tests → scene-level interaction tests where practical → implementation.
- Completion verification: before reporting **code** changes as done, run `npm run test:e2e` and ensure it passes.
- `arcadeactions/**` is reference-only; do not modify.
- Do not change Playwright default worker count in `playwright.config.ts` (must remain `3`, override only via `PW_WORKERS`).
- Any significant editor workflow/style contract change under `src/editor/**`, `src/App.tsx`, `src/phaser/EditorScene.ts` requires user confirmation before implementation.

## Workflow Checkpoint (confirm before implementation)

Impacted inventory entry:
- `A35 — Attach / Edit Action Flow` (see `.plans/editor-workflows-inventory.md`)

Current primary path:
- Select entity/group → Inspector “Action Flow” → add `MoveUntil/Wait/Call` steps (single Sequence).

Proposed primary path (from mockups):
- Select entity/group → “Events” panel → add Event → add Actions under that Event → each Action has an `Until…` stop condition (preset builder) → optional Parallel branches.

This plan is ready for implementation after you confirm this workflow change.

## Phase 0 — Inventory & guardrails

Goal: ground the implementation in current architecture (attachments/actions/conditions), and avoid rewriting unrelated systems.
- Audit current authoring model:
  - `SceneSpec.attachments` and inline conditions (`ElapsedTime`, `BoundsHit`, `Never`).
  - `src/compiler/compileAttachments.ts` for current compilation patterns (including `Parallel` and action presets).
  - Current UI entrypoint(s) in `src/editor/Inspector.tsx` and `src/editor/ActionFlowEditor.tsx`.
- Decide coexistence strategy:
  - Keep `attachments` as the underlying executable authoring format where practical, or
  - Introduce a new “Event Blocks” spec and compile it into runtime actions (recommended for Approach 1).

Deliverable: a short design note (in this file) clarifying whether Event Blocks are (A) a new first-class spec or (B) represented via tagged attachment groups + conventions.

## Phase 1 — Data model (TDD-first)

Goal: represent the mockups in serialized scene/project data without requiring scripting.

### 1.1 Add Event Blocks spec
Add a new scene-level authoring model for “Event Blocks” that:
- Is separate from legacy `behaviors/actions/conditions` (kept for migration only).
- Coexists with (or replaces as primary) today’s “Action Flow” panel.

Proposed types (names TBD):
- `EventBlockSpec`:
  - `id`, `name?`
  - `target: TargetRef` (entity/group)
  - `trigger: EventTriggerSpec`
  - `steps: EventStepSpec[]`
- `EventTriggerSpec` v1 (aligned with mockups):
  - `OnUpdate`
  - `OnInput` (e.g. Space / action binding)
  - `OnEnabled` / `OnDisabled` (entity/formation)
  - `OnPickupCollected` (tag-based or collection-based; emits payload)
- `EventStepSpec`:
  - `ActionStepSpec` (preset + params + `until`)
  - `ParallelStepSpec` (N branches each a step list)

### 1.2 Add no-code state: Counters + Collections
Approach 1b/1c require scene/global state without a query engine:
- `CollectionSpec`:
  - explicit membership list (drag sprites/groups into it)
  - no dynamic query language
- `CounterSpec`:
  - `id`, `scope: 'global'|'scene'`, `value`
  - optional clamp (`min/max`)
  - derived counter option: `value = collection.members.length`

### 1.3 Validation + migration
- Extend `src/model/validation.ts` to validate:
  - references (targets, collections, counters)
  - `Until` condition shape/params
  - payload references where applicable
- Extend `src/model/migrateScene.ts` to:
  - default any new fields
  - keep backward compatibility for existing YAML scenes

Tests (first):
- Add/extend `tests/editor/**` model validation tests for the new specs.
- Add migration tests ensuring old YAML loads unchanged.

## Phase 2 — Runtime + compile semantics (TDD-first)

Goal: execute Event Blocks reliably, reusing existing action runtime where possible.

### 2.1 Event runtime layer
Add an event dispatch/subscription layer scoped to a scene runtime:
- publish event + payload
- subscribe by trigger type and (where relevant) target/tag

### 2.2 Compile Event Blocks into runtime actions
Compile an Event Block into:
- a trigger subscription handler that starts a compiled action graph:
  - `Sequence` of steps
  - `Parallel` for branches
  - each atomic step is an action preset running “until” a stop condition

### 2.3 Extend “Until” support to match mockups
From mockups:
- `Instant` (0 frames)
- `Time Elapsed (ms)` (maps to existing `ElapsedTime`)
- `Input released`
- `Collision with…`
- `Counter comparison` (`==`, `>=`, `<=`)
- (Optional / decide) `Sprite Count (≤ 0)` for emitter completion

Tests (first):
- `tests/runtime/**`: verify stop semantics for each new Until type.
- `tests/compiler/**`: ensure compilation produces the expected runtime graph and data flow.

## Phase 3 — Editor UI (TDD-first, confirm workflow change before coding)

Goal: deliver the authoring UX shown in the mockups, while preserving editor style contracts unless explicitly agreed otherwise.

### 3.1 Events panel (per-target)
For selected target (entity/formation):
- list events
- `+ Add Event`
- inside each event: `Add Action… (search)` and step list
- support `Parallel (N branches)` steps with per-branch action lists

### 3.2 “Until…” builder UI
Per action step:
- `Until…` button opens picker:
  - searchable presets (`time`, `collision`, `input`, `counter`, …)
  - parameter inputs
  - inserts/updates the stop condition for that step

### 3.3 Counters + Collections editors
Panels (scene/global scope) to manage:
- collections and membership (drag/drop from Entity List)
- counters (create/edit/clamp; derived from collection size)

### 3.4 Event payload authoring (score/pickups)
Approach 1c:
- pickup has “Points: N”
- pickup emits payload: `points = N`, `pickupTag = "Coin"` (example)
- player event handler: `Add to Counter (score, +points)`
- goal: `Until: Counter (score >= 500)`

### 3.5 Snippets (optional but shown in mockups)
Minimal v1:
- “Save selection as Snippet”
- “Insert Snippet…” into the current event/step list
- persisted in editor state/YAML

Tests (first):
- `tests/editor/**` store tests for adding/removing/reordering steps and editing Until params.
- Where practical, scene-level interaction tests for drag/drop membership and event editing.

Documentation (only if workflows materially change):
- Update `.plans/editor-workflows-inventory.md`:
  - add new atomic workflow(s) for “Author Event Block + Actions + Until”
  - adjust references to `A35` if it changes meaning/entrypoint
- Update `.plans/ux-checklist-workflow-simplification.md` only if checklist decisions need revision.

## Phase 4 — E2E (Playwright) + completion criteria

Goal: verify the new workflows end-to-end and meet the repo’s completion bar.

Add Playwright tests to cover:
- Event → action → Until: Time Elapsed
- Collections membership via drag/drop + derived counter
- `Until: Counter == 0` gate example (Approach 1b)
- Score flow (Approach 1c):
  - pickup points payload → player increments `score` counter → goal “You Win” stops/starts at `score >= N`

Completion checks (must pass before calling code “done”):
- `npm run test`
- `npm run test:e2e`

