# ArcadeActions Stop Semantics + Missing Laser Gates Actions (Plan)

## Summary

Implement ArcadeActions-equivalent stop semantics in the Studio runtime (stop removes effects and immediately deactivates actions), then add Studio equivalents for the missing `laser_gates` action capabilities (excluding `arrange_grid`): `BlinkUntil`, `CallbackUntil`, `MoveXUntil`, `MoveYUntil`, and `cycle_textures_until` (Studio: `CycleFramesUntil`), plus behavior-level `Parallel` and an `infinite`-style condition (Studio: `Never`).

This plan is TDD-driven: unit/store/helper tests first, then integration tests, then implementation, then `npm run test:e2e` must pass before reporting completion of code changes.

## Key Changes

### 1) Stop semantics parity with ArcadeActions

- **Add `stop()` to actions**
  - Update `src/runtime/Action.ts` so the `Action` interface includes `stop(): void`.
  - Update `ActionBase`:
    - Add a protected `removeEffect(): void` hook (no-op by default).
    - Implement `stop()` to:
      - Be idempotent (safe to call multiple times).
      - Mark the action done/complete and ensure it no longer mutates state on subsequent `update()` calls.
      - Call `removeEffect()` exactly once (this is the ArcadeActions-style “remove effect on stop”).
  - Keep `cancel()` only if needed for backward compatibility; otherwise route `cancel()` to `stop()` so “stopping” semantics are consistent regardless of entrypoint.

- **Composite actions must cascade stop**
  - Update `src/runtime/actions/Sequence.ts` to implement `stop()` that stops:
    - The currently active child.
    - Any remaining children that may have been started (and/or stop all children for determinism).
  - Update `src/runtime/actions/Parallel.ts` to implement `stop()` that stops all children (and keep `cancel()` as an alias if needed).

- **ActionManager must stop, not drop**
  - Update `src/runtime/ActionManager.ts`:
    - `clear()` becomes “stop all” (calls `stop()` on every active action and empties the list).
    - Add helpers mirroring ArcadeActions management patterns:
      - `stopAll()` alias for `clear()`.
      - `getActionsForTarget(targetKey, tag?)` for inspection/debug/testing.
      - `stopActionsForTarget(targetKey, tag?)` to stop per-target (and optionally per-tag) actions.
    - Store metadata alongside each action: `{ targetKey?: string; tag?: string }`.

- **Plumb `targetKey` + `tag` into runtime action registration**
  - In compilation / runtime setup:
    - Use the same stable target key used in `src/compiler/compileAttachments.ts` (`stableTargetKey(...)`).
    - Preserve `AttachmentSpec.tag` and associate it with the compiled script that gets registered in the `ActionManager`.
  - Update `src/compiler/compileScene.ts` so `startAll()` registers each compiled script with metadata `{ targetKey, tag }`.
  - Ensure `reset()` uses the new stopping semantics (`actionManager.clear()` stops all actions).

### 2) Missing `laser_gates` capabilities (except `arrange_grid`)

#### Conditions: “infinite” equivalent

- Add a `Never` condition type to the model and compiler:
  - Update `src/model/types.ts` `ConditionSpec` to include `{ type: 'Never' }`.
  - Update `src/compiler/compileBehaviors.ts` condition instantiation to return `new Never()` for `Never`.
  - Add `Never` to `public/editor-registry.yaml` under `conditions:` with `implemented: true`.

#### Behavior graph: `Parallel`

- Add behavior graph support for `Parallel` actions:
  - Update `src/model/types.ts` `ActionSpec` to include `ParallelActionSpec` with `children: Id[]`.
  - Update `src/compiler/compileBehaviors.ts` to handle `case 'Parallel'` and return `new Parallel(children)`.
  - Update `src/model/validation.ts` to validate `Parallel` children references and include them in cycle detection.
  - Add `Parallel` to `public/editor-registry.yaml` under `actions:` with `implemented: true`.

#### Actions: `MoveXUntil`, `MoveYUntil`

- Add `src/runtime/actions/MoveXUntil.ts` and `src/runtime/actions/MoveYUntil.ts`:
  - Semantics: axis-specialized move-until actions that only apply velocity on one axis (x or y).
  - `stop()` must remove effect by zeroing velocity on the relevant axis (`vx=0` or `vy=0`) on all target members (entity or group).
- Add editor exposure:
  - Add `MoveXUntil` and `MoveYUntil` entries to `public/editor-registry.yaml`.
  - Extend `src/compiler/compileAttachments.ts` `compileAtomicAttachment` to compile these presets from attachment params + inline or referenced conditions.

#### Action: `BlinkUntil`

- Add `src/runtime/actions/BlinkUntil.ts`:
  - Params:
    - `targets`
    - `secondsUntilChange`
    - `startVisible` (default `true`)
    - `condition`
    - Optional callbacks for “enter” and “exit” transitions (implemented via existing `Call` / opRegistry invocation wiring).
  - Behavior: toggle `visible` each interval until condition met.
  - `stop()` cleanup: restore `visible` to `startVisible` (deterministic removal of effect).
- Add editor exposure and compilation:
  - Add a `BlinkUntil` entry to `public/editor-registry.yaml`.
  - Extend `src/compiler/compileAttachments.ts` to compile it from attachment params.

#### Action: `CallbackUntil`

- Add `src/runtime/actions/CallbackUntil.ts`:
  - Params:
    - `secondsBetweenCalls`
    - `condition`
    - callback handler (opRegistry-based, like `Call`)
  - Behavior: invoke callback on interval until condition met.
  - Implementation detail: allow catch-up for large `dt`, but cap max invocations per update to avoid runaway loops.
  - `stop()` cleanup: prevent further callbacks (no other state to undo).
- Add editor exposure and compilation:
  - Add `CallbackUntil` entry to `public/editor-registry.yaml`.
  - Extend `src/compiler/compileAttachments.ts` to compile it from attachment params.

#### Action: `cycle_textures_until` (Studio: `CycleFramesUntil`)

- Add `src/runtime/actions/CycleFramesUntil.ts`:
  - Supports BOTH configuration forms:
    - Range: `startFrame`, `endFrame`, `fps`, `direction`
    - List: `framesCsv`, `fps`, `direction`
  - Behavior: update the entity’s current sprite frame at the given FPS until condition met.
  - `stop()` cleanup: no special cleanup; frame remains where it is.
- Renderer integration:
  - Add a runtime display override field (recommended: `RuntimeEntity.frame?: string | number`).
  - Update `src/phaser/GameScene.ts` and `src/phaser/EditorScene.ts` so when rendering spritesheets they prefer `entity.frame` (if present) over the asset’s default frame when calling `sprite.setFrame(...)`.
- Editor exposure and compilation:
  - Add `CycleFramesUntil` entry to `public/editor-registry.yaml`.
  - Extend `src/compiler/compileAttachments.ts` to compile it from attachment params.

## Test Plan (TDD + Verification)

### Unit tests (runtime / compiler)

- Add unit tests proving ArcadeActions-style stop semantics:
  - `ActionManager.clear()` stops all actions (calls `stop()`), not just removes references.
  - `stopActionsForTarget(targetKey, tag)` stops only matching actions.
  - Stopped actions do not mutate state on subsequent updates.
- Action-specific tests:
  - `MoveXUntil` / `MoveYUntil` stop zeros the correct axis velocity.
  - `BlinkUntil` toggles visibility at cadence and stop restores `startVisible`.
  - `CallbackUntil` calls at expected cadence and stop prevents further calls.
  - `CycleFramesUntil` advances frames correctly for both range and CSV list forms (including direction and wrap-around).
- Compiler/model tests:
  - `ParallelActionSpec` compiles and completes when all children complete.
  - `Never` condition compiles and never reports met.

### E2E (required)

- Run `npm run test:e2e` and confirm it passes before reporting any implementation work as complete.
- Do not change Playwright’s default worker count (`3`) in `playwright.config.ts`.

## Assumptions / Defaults

- “Same semantics as ArcadeActions” means:
  - Stopping an action removes its effects (`removeEffect` equivalent), marks it done, and prevents future mutation.
  - Stopping all actions or stopping by target+tag uses the same `stop()` behavior; no “drop without cleanup” paths remain for normal runtime control.
- `CycleFramesUntil` targets spritesheet-backed sprites; for non-spritesheet assets it should no-op safely (and remain stop-safe).

