# Stars Demo Editor Gaps — Step-by-Step Implementation Plan

Status: proposed; all implementation work is unchecked.

References:

- ArcadeActions behavior: `/home/bcorfman/dev/arcadeactions/examples/stars.py` (reference-only)
- Archived workflow assessment: `.plans/archive/stars_demo_workflow.md`
- Current workflow inventory: `.plans/editor-workflows-inventory.md`
- GUI mockups:
  - `.plans/mockups/stars-scatter-formation.svg`
  - `.plans/mockups/stars-scene-and-tint.svg`
  - `.plans/mockups/stars-formation-visual-variations.svg`
  - `.plans/mockups/stars-bounds-event-actions.svg`

## Outcome

After this plan is complete, a user can reproduce the visible and timed behavior of `stars.py` through the editor:

- a `720 × 1280` scene with a solid black background;
- one 3 × 3 white sprite asset expanded into 400 authored members;
- deterministic random placement in `x=[0,720]`, `y=[0,1280]+5`;
- independent per-member random RGB tint with each channel in `[20,255]`;
- five blink groups at 200, 250, 300, 350, and 400 ms;
- the existing parallel `Move Until` plus repeating `Wait`/`Tween Until` velocity sequence;
- a typed Bounds/Wrapped event whose no-code action sequence rerolls the wrapped member's X coordinate in `[0,720]`.

The velocity values in PhaserForge are pixels/second, while `stars.py` sets Arcade velocity in pixels/frame at 60 FPS. The faithful editor values are therefore `-240 px/s` for `-4` and `+840 px/s` for `+14`.

## Current Ground Truth and Gap Decisions

- [ ] Reconfirm the following against tests and implementation immediately before coding, because this plan is allowed to outlive the code it describes.
  - Formation creation already has one primary path and a live canvas draft (`A25`/`A26`), but `computeFormationDraftPositions`, `CreateFormationDraftPanel`, `CreateFormationPanel`, and `createGroupFromArrangeTemplate` cap count at 200.
  - `EntitySpec` has no entity tint, although background image layers already support tint.
  - `GameSceneSpec` has no authored solid background color; edit and play cameras use hard-coded colors.
  - `Move Until` supports continuous per-member wrapping, but the action/event system cannot route a bounds event to the individual member that wrapped or use random values in a following action.
  - The existing action editor can already express the blink timings and velocity phase loop with `Parallel`, `Repeat`, `Wait`, `Tween Until`, and `Move Until`; do not create duplicate action types for those behaviors.
- [ ] Keep these scope decisions unless new ground truth invalidates them.
  - Extend the existing formation draft with a `Scatter` preset; do not add a second “scatter tool” entry point.
  - Store generated positions and tints on entities. Store the seed and scatter/tint settings in the formation's arrange layout so reopening or reapplying the layout remains deterministic.
  - Extend the existing Event Block/action system with a finite typed Bounds event family, event-source target binding, and composable value sources. Do not add one-off `randomizeOnWrap` fields to Move Until.
  - Keep the primary authoring surface no-code: `When Bounds → Wrapped` followed by `Set Property → X → Random Range`. Preserve `Call`/`OpRegistry` as the existing low-code escape hatch for behavior that built-in actions cannot express.
  - Continue using an imported 3 × 3 white image for the star template. A general primitive/solid-color sprite creator is useful but is not required to close this demo gap.
  - Add only the first small reusable value-source vocabulary required here (`Constant`, `Random Range`, and event fields needed for filtering/targeting). Do not build an unrestricted expression language in this increment.

## Existing Event/Callback Foundation

The project is not starting from zero, but the existing pieces do not yet compose into a general bounds-event workflow.

- [ ] Preserve and build on Event Blocks, which already group action sequences under typed triggers (`start`, `update`, input action, visibility, and custom event).
- [ ] Preserve `Emit Event` and the runtime event queue, while upgrading event routing beyond name-only matching.
- [ ] Preserve `Call` plus `OpRegistry` as the low-code extension boundary. Built-in operations can remain no-code forms; a custom Call ID still requires host/runtime code to register the operation.
- [ ] Reuse the boundary engine's existing `onEnter`/`onExit` contact-edge concept, but do not treat it as sufficient: callbacks currently occur before behavior resolution and receive the aggregate runtime target rather than a guaranteed individual wrapped member.
- [ ] Reuse trigger-zone/collision notions such as `instigator`, but consolidate them into one typed runtime event context instead of adding another incompatible callback shape.

## Required Workflow Confirmation Gate

This proposal materially extends existing editor workflows and must be confirmed before implementation under `AGENTS.md`.

- [ ] Obtain user confirmation for these workflow changes:
  - Impacted workflows: `A25 — Start Formation Draft`, `A26 — Edit / Commit Formation Draft`, `A39 — Edit Single Entity Properties`, `A40 — Edit Multi-selection Properties`, `A41 — Edit Formation Properties`, `A42 — Create / Edit Event Blocks`, `A43 — Create / Edit Action Steps`, `A46 — Edit Attachment Details`, and scene inspection within `A61 — Set Scene World Size`.
  - Current primary path: start a formation draft, choose a preset/count/parameters, and commit; configure Move Until bounds in the attachment inspector.
  - Proposed primary path: the same formation and inspector paths, plus the existing Event Block path extended with `Bounds → Wrapped`, event-source targeting, and `Set Property` with `Random Range`.
  - Entry points: none added, removed, or merged.
  - Step impact: 400 entities become one draft-and-commit operation instead of repeated duplication/manual layout; wrap X randomization becomes a reusable event plus action sequence instead of being impossible.
  - Pointer travel: controls stay inside the already-open formation, scene/entity, and attachment inspectors.
  - Style contracts: paired Min/Max and X/Y controls remain side-by-side; new options use existing foldouts, selects, checkboxes, compact buttons, and validated numeric inputs.

## Phase 1 — Lock Contracts with Tests First

- [ ] Add seeded RNG helper tests for identical-seed stability, different-seed divergence, inclusive integer RGB bounds, finite float ranges, reversed-range normalization, and independent named streams.
- [ ] Add scatter layout tests for 400 members, integer-pixel authored positions, world/margin bounds, deterministic output, and no mutation of the template entity.
- [ ] Add formation creation/store tests proving that one history transaction creates 400 uniquely identified members, preserves template properties, assigns deterministic tints, records the scatter layout parameters, and remains undoable/redoable as a single user action.
- [ ] Add serialization, canonicalization, migration, and validation tests for:
  - optional `GameSceneSpec.backgroundColor`;
  - optional `EntitySpec.tint`;
  - scatter layout parameters and seed;
  - typed Bounds event trigger/filter specs, event-source target binding, and reusable action value sources;
  - older YAML with none of the new fields.
- [ ] Add runtime boundary-event tests for upward and downward vertical wrap, horizontal wrap, contact enter/exit, one Wrapped event per crossing, behavior resolution before event dispatch, and the exact member/axis/side in event context.
- [ ] Add compiler/event-router tests showing typed Bounds filters, event-source target binding, event payload/value resolution, and reentrant event policy work independently for group members.
- [ ] Add editor component tests for control visibility, paired-control layout, defaults, validation, disabling, and dispatched patches shown in the three SVG mockups.
- [ ] Add Phaser editor/play scene tests proving scene background and entity tint render consistently and that editor selection styling does not destroy the authored tint.
- [ ] Add a focused E2E stars-authoring test that creates a smaller deterministic fixture through the primary UI—including a Bounds/Wrapped Event Block—then separately seed a 400-member project for play-mode behavior/performance assertions.

## Phase 2 — Deterministic Random Foundation

- [ ] Add a small dependency-free seeded PRNG helper under `src/editor/` or a shared deterministic utility module.
- [ ] Accept a stable string or 32-bit numeric seed and derive named substreams (at minimum `position-x`, `position-y`, `tint-r`, `tint-g`, `tint-b`, and `wrap`) so changing one variation dimension does not reshuffle unrelated dimensions.
- [ ] Add shared normalized range helpers for continuous coordinates and inclusive integer color channels.
- [ ] Generate a seed once when the user starts a scatter draft; never call `Math.random()` during draft recomputation.
- [ ] Add a compact `Reroll` action that changes the seed intentionally, updates the live preview, and creates no project-history entry until the draft commits.
- [ ] Document the deterministic contract in helper comments and tests: the same seed, member identity/index, and parameters produce the same authored result across reloads.

## Phase 3 — Scatter Formation Authoring and 400-Member Support

Mockup: `.plans/mockups/stars-scatter-formation.svg`.

- [ ] Register an implemented `scatter` arrange entry in `public/editor-registry.yaml` with `minX`, `maxX`, `minY`, `maxY`, and `seed` parameters.
- [ ] Add `scatter` to `buildDefaultDraftParams` and default its bounds from the live scene world; allow the star workflow to set `maxY=1285` for the +5 vertical margin.
- [ ] Implement deterministic scatter position generation in `src/editor/formationDraft.ts` or `src/editor/formationLayout.ts`, rounding final authored X/Y values to integer pixels.
- [ ] Extend the existing live formation draft panel with:
  - `Preset: Scatter`;
  - `Count` up to the agreed safe limit (minimum 400);
  - paired X Min/Max and Y Min/Max controls;
  - read-only/editable seed plus `Reroll`;
  - a `Random tint` foldout described in Phase 4.
- [ ] Replace the four duplicated hard-coded `200` caps with one named, tested formation-member limit shared by UI, draft computation, and reducer/store creation.
- [ ] Set the initial limit only after measuring edit/play performance with 400 members; use a clearly explained validation message rather than silently clamping oversized input.
- [ ] Ensure the canvas draft preview stays responsive by batching preview drawing and avoiding React/Phaser object creation for every keystroke where possible.
- [ ] Ensure commit creates one formation with 400 entities, one stable member order, one history transaction, and no persisted “generated count” flag that duplicates the live member list.
- [ ] Ensure selecting, deleting, duplicating, saving, loading, undoing, and redoing the resulting formation do not lose or reorder members.

## Phase 4 — Per-Entity Tint and Scatter Color Variation

Mockups: `.plans/mockups/stars-scatter-formation.svg` and `.plans/mockups/stars-scene-and-tint.svg`.

- [ ] Add optional `tint?: number` to `EntitySpec`, interpreted as `0xRRGGBB`; absence means white/no tint for backward compatibility.
- [ ] Update validation and YAML coercion to accept only finite integer RGB values in `[0x000000,0xFFFFFF]` and reject malformed values with a useful path-specific message.
- [ ] Apply tint in both `EditorScene` and `GameScene` for image, spritesheet, and placeholder sprites; define text tint behavior explicitly or gate the field for text entities.
- [ ] Refactor editor selection visuals to use selection frames/outline effects without replacing authored sprite tint with orange/cyan/white.
- [ ] Add a `Tint` color field plus hex text input to the single-entity Visual inspector, reusing the existing background-layer color parsing pattern.
- [ ] Add tint to the multi-entity common-value/patch flow so a selection can receive one tint or clear tint consistently.
- [ ] Add `Random tint` controls to the Scatter formation draft:
  - disabled by default for general formations;
  - RGB mode for the stars workflow;
  - paired channel Min/Max inputs, defaulting to 20 and 255;
  - deterministic preview and commit using tint-specific PRNG streams.
- [ ] Persist final tints on entities and preserve the seed/settings in the scatter layout parameters only for intentional reapply/reroll; derive member count from `group.members`.
- [ ] Add a `Visual Variations` foldout to the formation inspector for batch random tint after creation, as shown in `.plans/mockups/stars-formation-visual-variations.svg`.
- [ ] Let the formation operation choose all members or the current member selection, RGB channel Min/Max, and a deterministic seed; Preview must be reversible, Apply/Reroll must be one semantic history transaction, and Cancel must restore the exact prior tints.
- [ ] Store final tint values on entities. Keep only the last applied variation recipe when it is needed for intentional Reroll; do not treat that recipe as a replacement for entity tint ground truth.
- [ ] Reuse the same batch command from the multi-selection inspector rather than implementing a second randomization algorithm or requiring hundreds of individual edits.
- [ ] Verify pixel-art texture filtering remains nearest-neighbor after tinting.

## Phase 5 — Authored Scene Background Color

Mockup: `.plans/mockups/stars-scene-and-tint.svg`.

- [ ] Add optional `backgroundColor?: number` to `GameSceneSpec`; default missing values to the current product background so old projects do not visually change.
- [ ] Add validation, YAML round-trip, migration, canonicalization, duplication, history, and cloud/local persistence coverage.
- [ ] Add a `Scene Appearance` foldout to the existing scene inspector with a color picker, paired hex input, and `Use default` action.
- [ ] Apply the color to the main camera in both `EditorScene` and `GameScene` before rendering background layers; layers continue to render above it.
- [ ] Ensure base-scene composition has a documented rule: the active scene's authored camera background wins, falling back to the base/default only when absent.
- [ ] Verify black (`#000000`) survives save/reload and is identical in edit mode, play mode, and published runtime.

## Phase 6 — Typed Bounds Events, Event Context, and Composable Actions

Mockup: `.plans/mockups/stars-bounds-event-actions.svg`.

### 6A — Define a finite event model

- [ ] Introduce a typed runtime event envelope shared by custom events, bounds, collisions, trigger zones, visibility, and future finite event families:
  - stable event family/type;
  - phase/edge and family-specific details;
  - `source`/`instigator` entity when one exists;
  - owning/static target and event-block identity;
  - primitive payload values;
  - deterministic occurrence identity/order for debugging and replay.
- [ ] Add one `bounds` trigger family to `AttachmentTriggerSpec` rather than separate trigger types for every outcome. Its filters should cover:
  - event: contact entered, contact exited, wrapped, bounced, clamped, or stopped;
  - axis: any, X, or Y;
  - side: any, min/left/bottom, or max/right/top as terminology permits.
- [ ] Keep the taxonomy finite and behavior-oriented. New event families require a typed schema and editor metadata; they are not arbitrary string callbacks.
- [ ] Retain custom named events for user-defined coordination, but do not encode engine facts such as wrap into magic event-name strings.

### 6B — Emit correct member-local boundary events

- [ ] Refactor `BoundaryEngine` contact tracking so member scope records contacts per member, not only under an aggregate group target key.
- [ ] Emit structured contact events on edges and structured outcome events after the behavior is applied.
- [ ] For Wrapped, include the exact member, axis, side exited, prior position, and wrapped position; preserve the opposite-edge placement before downstream actions run.
- [ ] Emit at most one outcome event per member/axis crossing and no event while correcting an inward-moving target or remaining in contact.
- [ ] Preserve existing `onEnter`/`onExit` compatibility internally until all callers migrate, then remove duplication only with direct regression coverage.
- [ ] Define and test event ordering when X and Y cross in one tick and when several members cross in the same update.

### 6C — Route event context into Event Blocks

- [ ] Upgrade the compile-scene event queue from name-only matching to typed filter matching while preserving current custom-event behavior.
- [ ] Route only events relevant to the Event Block's owning target/formation unless the trigger explicitly opts into a broader scope.
- [ ] Add an attachment target binding such as `targetMode: 'owner' | 'event-source'`; default to owner for backward compatibility.
- [ ] Resolve `event-source` to the member/instigator carried by the active event, so a group-owned Event Block can modify only the star that wrapped.
- [ ] Make active event context available to every action in the triggered sequence and isolate contexts when multiple events start actions in the same tick.
- [ ] Define reentrancy/overlap semantics explicitly. For bounds events, do not discard a second member's event merely because the first member's action block is active; instantiate per-occurrence action runs or queue them deterministically.
- [ ] Expose event family, source ID, axis, side, and outcome in runtime debug state so failed wiring is inspectable.

### 6D — Add reusable no-code property/value actions

- [ ] Add a generic `Set Property` action rather than `Randomize X On Wrap`.
- [ ] Initially support safe entity properties needed by current editor contracts: X, Y, tint, alpha, visibility, and velocity components; add others only when runtime/editor semantics are clear.
- [ ] Define a small serialized `ValueSourceSpec` union:
  - constant number/color/boolean;
  - seeded random numeric range (continuous or integer as property metadata requires);
  - selected primitive event fields where useful.
- [ ] Use the shared deterministic RNG foundation, with independent per-action/per-event-source streams so hundreds of stars do not receive identical values.
- [ ] Validate property/value type compatibility through registry metadata and model validation; do not rely on runtime coercion.
- [ ] Ensure Set Property X/Y rounds to authored pixel rules only in edit-time authoring; runtime random positions may remain continuous when the action explicitly uses a continuous range.
- [ ] Preserve the existing `Call` action for arbitrary registered operations. Document that choosing Custom Call is low-code and requires host/runtime registration; do not add an in-editor code editor in this plan.

### 6E — Extend the existing Event Block GUI

- [ ] Add `Bounds` to the existing Event Block Trigger selector.
- [ ] Show contextual Event/Axis/Side filters using existing select and two-column patterns; for this demo choose Event `Wrapped`, Axis `Y`, Side `Any`.
- [ ] Add `Event source` to action target/application choices only when the selected trigger supplies an instigator/source.
- [ ] Add `Set Property` to the action library and its existing attachment inspector:
  - Target: Event source;
  - Property: X;
  - Value: Random range;
  - paired Min/Max: 0 and 720;
  - Seed plus Reroll using the same pattern as Scatter.
- [ ] Keep Bounds configuration in Move Until responsible only for detection/behavior. Put consequences in Actions/Events so other outcomes can reuse the same actions without growing the Move Until inspector.
- [ ] Add wiring-map labels that read as a sentence, for example: `When Stars wrap on Y → Set event source X to random 0..720`.
- [ ] Confirm the new workflow does not change canvas bounds gestures, selection semantics, or the existing path for simple Move Until wrapping.

### 6F — Make the no-code/low-code boundary explicit

- [ ] Keep typed engine events and registry-described actions as the default no-code surface shown in steps 1–2 of the mockup.
- [ ] Rename or relabel the existing generic `Call` presentation to clearly communicate “Call Operation” rather than implying that users can write callbacks inside the editor.
- [ ] Present known built-in operations as structured no-code forms with validated fields.
- [ ] Present unknown/custom operation IDs behind an explicit `Custom registered operation…` choice with a visible warning that host/runtime code must register the operation.
- [ ] Allow Custom Call to target the active event source and receive explicitly mapped primitive event fields/arguments; never expose the entire mutable runtime context as JSON.
- [ ] Define missing-operation behavior as an authoring validation warning plus safe runtime no-op/error telemetry; never fail silently or crash play mode.
- [ ] Keep Advanced args JSON as an expert escape hatch for operation arguments only. Do not add arbitrary JavaScript, `eval`, source-code persistence, or an in-editor code editor in this plan.
- [ ] Add registry metadata/versioning tests so plugins or host games can describe custom operations and their argument schemas without modifying the core editor for every operation.

## Phase 7 — Assemble and Prove the Faithful Stars Workflow

- [ ] Create a documented test fixture/project with world `720 × 1280`, background `#000000`, one 3 × 3 white asset, and one 400-member Scatter formation.
- [ ] Set scatter bounds to X `0..720`, Y `5..1285`, seed to a recorded value, and random RGB channel range `20..255`.
- [ ] Divide members into five formations or otherwise use the existing supported grouping workflow so each blink group gets 80 members without introducing a new grouping feature.
- [ ] Apply `Blink Until` at 200, 250, 300, 350, and 400 ms, infinite.
- [ ] Apply the permanent `Move Until` to members with velocity `0,0`, bounds `(0,-5)..(720,1285)`, and Behavior `Wrap`.
- [ ] Add a group-owned Event Block with Trigger `Bounds`, Event `Wrapped`, Axis `Y`, then add `Set Property` targeting `Event source`, Property `X`, Value `Random Range 0..720`, with a recorded seed.
- [ ] In parallel, apply an infinite Repeat sequence to members:
  - Wait 1000 ms at `vy=0`;
  - Tween `vy` to `-240` over 2000 ms with ease-in;
  - Wait 5000 ms;
  - Tween `vy` to `+840` over 500 ms with ease-out;
  - Wait 1500 ms;
  - Tween `vy` to `0` over 2000 ms with ease-out;
  - repeat.
- [ ] Verify the full cycle duration, velocity checkpoints, continuous movement, five independent blink rates, opposite-edge reentry, and X reroll against the reference behavior.
- [ ] Verify no obvious vertical columns emerge over repeated wraps and that all 400 members remain present.
- [ ] Verify save/reload, edit/play toggling, YAML export/import, undo/redo, and scene duplication retain all authored behavior.
- [ ] Measure draft editing, play-mode frame rate, initial compile time, YAML size, and save latency with 400 stars; record acceptable thresholds in tests or a short performance note rather than relying on subjective inspection.

## Phase 8 — Workflow Documentation and Required Verification

- [ ] Update `.plans/editor-workflows-inventory.md` after the confirmed UI ships:
  - extend `A26` with Scatter bounds, seed/reroll, count, and random tint;
  - extend `A39`/`A40` with tint;
  - extend `A41` with batch Visual Variations for formation members;
  - extend scene inspection with background color;
  - extend `A42` with typed Bounds triggers and event filtering;
  - extend `A43`/`A46` with event-source target binding and Set Property value sources.
- [ ] Update `.repo-memory/product-memory.md` only if implementation establishes a durable rule not already covered (likely deterministic authored randomization and authored tint surviving selection styling).
- [ ] Run focused unit/component/integration tests for every touched model, editor helper, compiler, runtime action, and Phaser scene.
- [ ] Run TypeScript/build validation and the repository's standard unit suite.
- [ ] Run required GUI smoke: `npm run test:e2e -- --project=chromium --grep @smoke`.
- [ ] Run the new stars workflow E2E and any directly affected formation, attachment, serialization, play-mode, and persistence specs in Chromium.
- [ ] Inspect each shipped UI state against the SVG mockups at normal and narrow inspector widths, light and dark themes, and supported UI scales.
- [ ] Confirm `playwright.config.ts` still uses the default worker count of 3.
- [ ] Confirm no files under `/home/bcorfman/dev/arcadeactions/` changed.

## Definition of Done

- [ ] Every checkbox above is complete or explicitly moved into a separately approved follow-up plan with rationale.
- [ ] A user can author and persist the complete stars demo without hand-editing YAML or writing runtime code.
- [ ] The primary workflows remain the existing formation draft, inspector, and action attachment paths.
- [ ] Old projects load without visual or behavioral drift.
- [ ] The 400-star fixture meets recorded editor and runtime performance thresholds.
- [ ] Required unit, integration, E2E, and Chromium smoke verification pass.
