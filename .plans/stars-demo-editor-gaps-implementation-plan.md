# Stars Demo Editor Gaps — Step-by-Step Implementation Plan

Status: user-reviewed proposal; implementation is not authorized until the user reviews this revision.

Reviewed decisions (2026-07-16):

- use five Scatter formations of 80 stars rather than one 400-member formation or a new partitioning workflow;
- implement the complete finite Bounds event family, not only Wrapped;
- approved the proposed Scatter, tint/variation, scene appearance, and no-code Bounds/Set Property workflows;
- change plan and mockups only; do not begin implementation yet.

References:

- ArcadeActions behavior: `/home/bcorfman/dev/arcadeactions/examples/stars.py` (reference-only)
- Archived workflow assessment: `.plans/archive/stars_demo_workflow.md`
- Current workflow inventory: `.plans/editor-workflows-inventory.md`
- GUI mockups:
  - `.plans/mockups/stars-scatter-formation.svg`
  - `.plans/mockups/stars-scene-and-tint.svg`
  - `.plans/mockups/stars-formation-visual-variations.svg`
  - `.plans/mockups/stars-bounds-event-no-code-actions.svg`
  - `.plans/mockups/stars-bounds-event-family.svg`

## Outcome

After this plan is complete, a user can reproduce the visible and timed behavior of `stars.py` through the editor:

- a `720 × 1280` scene with a solid black background;
- one 3 × 3 white sprite asset expanded into five 80-member Scatter formations (400 authored stars total);
- deterministic random placement in `x=[0,720]`, `y=[0,1280]+5`;
- independent per-member random RGB tint with each channel in `[20,255]`;
- five blink groups at 200, 250, 300, 350, and 400 ms;
- the existing parallel `Move Until` plus repeating `Wait`/`Tween Until` velocity sequence;
- a typed Bounds/Wrapped event whose no-code action sequence rerolls the wrapped member's X coordinate in `[0,720]`.

The velocity values in PhaserForge are pixels/second, while `stars.py` sets Arcade velocity in pixels/frame at 60 FPS. The faithful editor values are therefore `-240 px/s` for `-4` and `+840 px/s` for `+14`.

## Current Ground Truth and Gap Decisions

- [x] Reconfirm the following against tests and implementation immediately before coding, because this plan is allowed to outlive the code it describes.
  - Formation creation already has one primary path and a live canvas draft (`A25`/`A26`); its current 200-member per-formation cap is sufficient for five 80-member blink formations.
  - `EntitySpec` has no entity tint, although background image layers already support tint.
  - `GameSceneSpec` has no authored solid background color; edit and play cameras use hard-coded colors.
  - `Move Until` supports continuous per-member wrapping, but the action/event system cannot route a bounds event to the individual member that wrapped or use random values in a following action.
  - The existing action editor can already express the blink timings and velocity phase loop with `Parallel`, `Repeat`, `Wait`, `Tween Until`, and `Move Until`; do not create duplicate action types for those behaviors.
- [ ] Keep these scope decisions unless new ground truth invalidates them.
  - Extend the existing formation draft with a `Scatter` preset; do not add a second “scatter tool” entry point.
  - Author five Scatter formations of 80 members. Do not add formation partitioning, overlapping formations, or collection-targeted actions for this demo.
  - Store generated positions and tints on entities. Store the seed and scatter/tint settings in the formation's arrange layout so reopening or reapplying the layout remains deterministic.
  - Extend the existing Event Block/action system with a finite typed Bounds event family, event-source target binding, and constrained value sources. Do not add one-off `randomizeOnWrap` fields to Move Until.
  - Keep this proposal entirely no-code: `When Bounds → Wrapped` followed by `Set Property → X → Random Range`.
  - Continue using an imported 3 × 3 white image for the star template. A general primitive/solid-color sprite creator is useful but is not required to close this demo gap.
  - Implement the whole finite Bounds outcome family: Contact Entered, Contact Exited, Wrapped, Bounced, Clamped, and Stopped, with axis and side filters.
  - Add only the first small reusable value-source vocabulary required here (`Constant`, `Random Range`, and event fields needed for filtering/targeting). Do not build an unrestricted expression language in this increment.

## Existing Event Foundation and Explicit Non-Goal

The project is not starting from zero, but the existing pieces do not yet compose into a general bounds-event workflow.

- [ ] Preserve and build on Event Blocks, which already group action sequences under typed triggers (`start`, `update`, input action, visibility, and custom event).
- [ ] Preserve `Emit Event` and the runtime event queue, while upgrading event routing beyond name-only matching.
- [ ] Leave the existing `Call` plus `OpRegistry` behavior unchanged and out of scope. The stars workflow does not require it, and this plan must not use it to justify a script editor or broader low-code initiative.
- [ ] Reuse the boundary engine's existing `onEnter`/`onExit` contact-edge concept, but do not treat it as sufficient: callbacks currently occur before behavior resolution and receive the aggregate runtime target rather than a guaranteed individual wrapped member.
- [ ] Reuse trigger-zone/collision notions such as `instigator`, but consolidate them into one typed runtime event context instead of adding another incompatible callback shape.
- [ ] Treat `.plans/archive/mockups/stars-demo-needed-features-2026-05-26/03-moveuntil-wrap-callback-reroll-x.svg` as explicitly superseded. Its `Script` line is not an implementation specification and must not be copied into product UI.

## No-Code Action-System Boundary

This plan does not claim that a no-code editor can express every possible game. It adopts a narrower, achievable goal: a relatively complete grammar for common 2D arcade/action games, with explicit non-goals instead of an endless list of gameplay-specific actions.

### Separate primitives from recipes

- [ ] Classify registry entries as either semantic primitives or recipes/presets. A primitive adds a capability the runtime could not otherwise express; a recipe gives a common name and friendly form to a composition of existing primitives.
- [ ] Do not add a new primitive for a named gameplay behavior if it can be expressed clearly as a short composition. Blink, patrol, bounce, fade, scale, Move X/Y, and named motion patterns should be evaluated as recipes/templates rather than evidence that the core needs a separate action type for every verb.
- [ ] Require every proposed core action to answer: “What new state transition or engine service becomes possible?” Reject additions whose only answer is a game-specific name.
- [ ] Let recipes/macros provide discoverability and tuned fields while compiling to the stable primitive model. Serialized projects should not require a new runtime class for every recipe.

### Target a modest core grammar

- [ ] Treat the following as the candidate completeness boundary; confirm it in a separate action-system audit before expanding the registry:
  - Flow: Sequence, Parallel, Wait, Repeat, conditional branch, and stop/cancel an active action block.
  - Targeting: owner/self, event source/instigator, explicit entity/formation, collection members, and scene.
  - Values: typed constant, seeded random range/choice, selected event field, counter/state value, and selected readable property—without free-form expressions.
  - Entity properties: Set and Change an allowlisted typed property; Tween an allowlisted numeric property.
  - Motion/physics: set velocity, move/translate, apply impulse/force where supported, and configure/enable body or collision state.
  - Lifecycle: spawn from an authored template/pool, destroy/despawn, enable/disable, and reset to authored state.
  - State: set/add/clamp counters or variables; add/remove collection or tag membership.
  - Presentation: play/stop animation, choose frame, set visibility/tint/alpha, and play/stop audio.
  - Coordination: emit a typed/custom event and change scene with an authored transition.
- [ ] Prefer one parameterized action family over Cartesian products such as Set X, Set Y, Randomize X, Randomize Y, Set Tint, and Randomize Tint.
- [ ] Keep typed property and value metadata finite and discoverable. Adding an allowlisted property or value adapter is smaller and safer than adding another action family.

### Define honest completeness and escape policy

- [ ] Define PhaserForge's supported no-code game envelope explicitly—initially common 2D arcade/action mechanics—not “all games.”
- [ ] Build a representative capability suite (movement, platform hazard, pickup/counter, projectile spawn/despawn, enemy wave, animation/audio response, scene transition, and this stars demo) and require the core grammar to express each without custom code.
- [ ] When a real project cannot be expressed, classify the gap before acting:
  - missing core primitive used broadly across genres;
  - missing recipe/preset over existing primitives;
  - missing engine subsystem;
  - genuinely game-specific behavior outside the supported envelope.
- [ ] Add a primitive only for the first category, add a recipe for the second, plan the subsystem independently for the third, and record the fourth as unsupported rather than growing the core opportunistically.
- [ ] Do not promise arbitrary-game completeness without an extension model. If a future extension model becomes necessary, evaluate typed plugin-defined actions separately from in-editor scripting; neither belongs in this stars plan.

## Required Workflow Confirmation Gate

This proposal materially extends existing editor workflows and required confirmation under `AGENTS.md`. The user approved the workflow direction and four initial mockups on 2026-07-16; the revised full Bounds-family mockup remains subject to review before implementation begins.

- [x] Obtain user confirmation for these workflow changes:
  - Impacted workflows: `A25 — Start Formation Draft`, `A26 — Edit / Commit Formation Draft`, `A39 — Edit Single Entity Properties`, `A40 — Edit Multi-selection Properties`, `A41 — Edit Formation Properties`, `A42 — Create / Edit Event Blocks`, `A43 — Create / Edit Action Steps`, `A46 — Edit Attachment Details`, and scene inspection within `A61 — Set Scene World Size`.
  - Current primary path: start a formation draft, choose a preset/count/parameters, and commit; configure Move Until bounds in the attachment inspector.
  - Proposed primary path: the same formation and inspector paths, plus the existing Event Block path extended with `Bounds → Wrapped`, event-source targeting, and `Set Property` with `Random Range`.
  - Entry points: none added, removed, or merged.
  - Step impact: 400 entities become one draft-and-commit operation instead of repeated duplication/manual layout; wrap X randomization becomes a reusable event plus action sequence instead of being impossible.
  - Pointer travel: controls stay inside the already-open formation, scene/entity, and attachment inspectors.
  - Style contracts: paired Min/Max and X/Y controls remain side-by-side; new options use existing foldouts, selects, checkboxes, compact buttons, and validated numeric inputs.

## Phase 1 — Lock Contracts with Tests First

- [x] Add seeded RNG helper tests for identical-seed stability, different-seed divergence, inclusive integer RGB bounds, finite float ranges, reversed-range normalization, and independent named streams.
- [x] Add scatter layout tests for 400 members, integer-pixel authored positions, world/margin bounds, deterministic output, and no mutation of the template entity.
- [x] Add formation creation/store tests proving that one history transaction creates 80 uniquely identified members, preserves template properties, assigns deterministic tints, records the scatter layout parameters, and remains undoable/redoable as a single user action.
- [x] Add serialization, canonicalization, migration, and validation tests for:
  - [x] optional `GameSceneSpec.backgroundColor`;
  - [x] optional `EntitySpec.tint`;
  - [x] scatter layout parameters and seed;
  - [x] typed Bounds event trigger/filter specs, event-source target binding, and reusable action value sources;
  - [x] older YAML with none of the new fields.
- [x] Add runtime boundary-event tests for upward and downward vertical wrap, horizontal wrap, contact enter/exit, one Wrapped event per crossing, behavior resolution before event dispatch, and the exact member/axis/side in event context.
- [x] Add compiler/event-router tests showing typed Bounds filters, event-source target binding, event payload/value resolution, and reentrant event policy work independently for group members.
- [x] Add editor component tests for control visibility, paired-control layout, defaults, validation, disabling, and dispatched patches shown in the five SVG mockups.
- [x] Add Phaser editor/play scene tests proving scene background and entity tint render consistently and that editor selection styling does not destroy the authored tint.
- [x] Add a focused E2E stars-authoring test that creates a smaller deterministic fixture through the primary UI—including a Bounds/Wrapped Event Block—then separately seed the five-formation, 400-star project for play-mode behavior/performance assertions.
- [x] Add a command-level stars demo integration test, following the `docs/getting-started/pattern-demo.md` / `tests/e2e/pattern-demo-persistence.spec.ts` style, that builds the faithful `stars.py` project through underlying editor commands/project-builder helpers rather than Playwright GUI clicks, then runs the resulting project and verifies the end behavior.

## Phase 2 — Deterministic Random Foundation

- [x] Add a small dependency-free seeded PRNG helper under `src/editor/` or a shared deterministic utility module.
- [x] Accept a stable string or 32-bit numeric seed and derive named substreams (at minimum `position-x`, `position-y`, `tint-r`, `tint-g`, `tint-b`, and `wrap`) so changing one variation dimension does not reshuffle unrelated dimensions.
- [x] Add shared normalized range helpers for continuous coordinates and inclusive integer color channels.
- [x] Generate a seed once when the user starts a scatter draft; never call `Math.random()` during draft recomputation.
- [x] Add a compact `Reroll` action that changes the seed intentionally, updates the live preview, and creates no project-history entry until the draft commits.
- [ ] Document the deterministic contract in helper comments and tests: the same seed, member identity/index, and parameters produce the same authored result across reloads.

## Phase 3 — Scatter Formation Authoring

Mockup: `.plans/mockups/stars-scatter-formation.svg`.

- [x] Register an implemented `scatter` arrange entry in `public/editor-registry.yaml` with `minX`, `maxX`, `minY`, `maxY`, and `seed` parameters.
- [x] Add `scatter` to `buildDefaultDraftParams` and default its bounds from the live scene world; allow the star workflow to set `maxY=1285` for the +5 vertical margin.
- [x] Implement deterministic scatter position generation in `src/editor/formationDraft.ts` or `src/editor/formationLayout.ts`, rounding final authored X/Y values to integer pixels.
- [x] Extend the existing live formation draft panel with:
  - `Preset: Scatter`;
  - `Count` within the existing supported formation limit (80 for each stars formation);
  - paired X Min/Max and Y Min/Max controls;
  - read-only/editable seed plus `Reroll`;
  - a `Random tint` foldout described in Phase 4.
- [x] Keep the existing 200-member per-formation limit unchanged in this plan; do not expand scope merely because the scene contains 400 stars across five formations.
- [ ] Ensure the canvas draft preview stays responsive by batching preview drawing and avoiding React/Phaser object creation for every keystroke where possible.
- [x] Ensure each commit creates one formation with 80 entities, one stable member order, one history transaction, and no persisted “generated count” flag that duplicates the live member list.
- [ ] Ensure selecting, deleting, duplicating, saving, loading, undoing, and redoing the resulting formation do not lose or reorder members.

## Phase 4 — Per-Entity Tint and Scatter Color Variation

Mockups: `.plans/mockups/stars-scatter-formation.svg` and `.plans/mockups/stars-scene-and-tint.svg`.

- [x] Add optional `tint?: number` to `EntitySpec`, interpreted as `0xRRGGBB`; absence means white/no tint for backward compatibility.
- [x] Update validation and YAML coercion to accept only finite integer RGB values in `[0x000000,0xFFFFFF]` and reject malformed values with a useful path-specific message.
- [x] Apply tint in both `EditorScene` and `GameScene` for image, spritesheet, and placeholder sprites; define text tint behavior explicitly or gate the field for text entities.
- [x] Refactor editor selection visuals to use selection frames/outline effects without replacing authored sprite tint with orange/cyan/white.
- [x] Add a `Tint` color field plus hex text input to the single-entity Visual inspector, reusing the existing background-layer color parsing pattern.
- [x] Add tint to the multi-entity common-value/patch flow so a selection can receive one tint or clear tint consistently.
- [x] Add `Random tint` controls to the Scatter formation draft:
  - disabled by default for general formations;
  - RGB mode for the stars workflow;
  - paired channel Min/Max inputs, defaulting to 20 and 255;
  - deterministic preview and commit using tint-specific PRNG streams.
- [x] Persist final tints on entities and preserve the seed/settings in the scatter layout parameters only for intentional reapply/reroll; derive member count from `group.members`.
- [x] Add a `Visual Variations` foldout to the formation inspector for batch random tint after creation, as shown in `.plans/mockups/stars-formation-visual-variations.svg`.
- [x] Let the formation operation choose all members or the current member selection, RGB channel Min/Max, and a deterministic seed; Preview must be reversible, Apply/Reroll must be one semantic history transaction, and Cancel must restore the exact prior tints.
- [ ] Store final tint values on entities. Keep only the last applied variation recipe when it is needed for intentional Reroll; do not treat that recipe as a replacement for entity tint ground truth.
- [ ] Reuse the same batch command from the multi-selection inspector rather than implementing a second randomization algorithm or requiring hundreds of individual edits.
- [ ] Verify pixel-art texture filtering remains nearest-neighbor after tinting.

## Phase 5 — Authored Scene Background Color

Mockup: `.plans/mockups/stars-scene-and-tint.svg`.

- [x] Add optional `backgroundColor?: number` to `GameSceneSpec`; default missing values to the current product background so old projects do not visually change.
- [x] Add validation, YAML round-trip, migration, canonicalization, duplication, history, and cloud/local persistence coverage.
- [x] Add a `Scene Appearance` foldout to the existing scene inspector with a color picker, paired hex input, and `Use default` action.
- [x] Apply the color to the main camera in both `EditorScene` and `GameScene` before rendering background layers; layers continue to render above it.
- [ ] Ensure base-scene composition has a documented rule: the active scene's authored camera background wins, falling back to the base/default only when absent.
- [ ] Verify black (`#000000`) survives save/reload and is identical in edit mode, play mode, and published runtime.

## Phase 6 — Complete Typed Bounds Event Family, Event Context, and Composable Actions

Mockups: `.plans/mockups/stars-bounds-event-no-code-actions.svg` and `.plans/mockups/stars-bounds-event-family.svg`.

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
- [ ] Give each outcome one stable, user-facing meaning:
  - Contact Entered: the source begins touching/crossing a configured boundary on an axis, before the configured behavior consequence is reported;
  - Contact Exited: a previously active boundary contact ends, including the deterministic contact exit following a wrap relocation;
  - Wrapped: Wrap relocated the source to the opposite boundary;
  - Bounced: Bounce inverted the source velocity on the affected axis;
  - Clamped: Clamp at Edge corrected the source position and prevented outward movement;
  - Stopped: Stop corrected the source position, zeroed affected velocity, and completed/stopped the relevant movement action according to existing semantics.
- [ ] Expose only outcomes compatible with the selected Bounds behavior when the editor can determine it; otherwise show the full family with clear compatibility hints rather than silently creating an event that can never fire.
- [ ] Keep the taxonomy finite and behavior-oriented. New event families require a typed schema and editor metadata; they are not arbitrary string callbacks.
- [ ] Retain custom named events for user-defined coordination, but do not encode engine facts such as wrap into magic event-name strings.

### 6B — Emit correct member-local boundary events

- [ ] Refactor `BoundaryEngine` contact tracking so member scope records contacts per member, not only under an aggregate group target key.
- [ ] Emit structured contact events on edges and structured outcome events after the behavior is applied.
- [ ] For each crossing, order events deterministically: Contact Entered first, then the applied outcome (Wrapped/Bounced/Clamped/Stopped), with Contact Exited emitted only when contact state actually clears.
- [ ] For Wrapped, include the exact member, axis, side exited, prior position, and wrapped position; preserve the opposite-edge placement before downstream actions run.
- [ ] Emit at most one outcome event per member/axis crossing and no event while correcting an inward-moving target or remaining in contact.
- [ ] Preserve existing `onEnter`/`onExit` compatibility internally until all callers migrate, then remove duplication only with direct regression coverage.
- [ ] Define and test event ordering when X and Y cross in one tick and when several members cross in the same update.
- [ ] Use stable member order, then X before Y, as the tie-breaker for simultaneous events unless current runtime ordering provides a stronger invariant; document the final invariant in tests.

### 6C — Route event context into Event Blocks

- [ ] Upgrade the compile-scene event queue from name-only matching to typed filter matching while preserving current custom-event behavior.
- [ ] Route only events relevant to the Event Block's owning target/formation unless the trigger explicitly opts into a broader scope.
- [ ] Add an attachment target binding such as `targetMode: 'owner' | 'event-source'`; default to owner for backward compatibility.
- [ ] Resolve `event-source` to the member/instigator carried by the active event, so a group-owned Event Block can modify only the star that wrapped.
- [ ] Make active event context available to every action in the triggered sequence and isolate contexts when multiple events start actions in the same tick.
- [ ] Define reentrancy/overlap semantics explicitly. For bounds events, do not discard a second member's event merely because the first member's action block is active; instantiate per-occurrence action runs or queue them deterministically.
- [ ] Expose event family, source ID, axis, side, and outcome in runtime debug state so failed wiring is inspectable.

### 6D — Add reusable no-code property/value actions

- [x] Add a generic `Set Property` action rather than `Randomize X On Wrap`.
- [x] Initially support safe entity properties needed by current editor contracts: X, Y, tint, alpha, visibility, and velocity components; add others only when runtime/editor semantics are clear.
- [ ] Define a small serialized `ValueSourceSpec` union:
  - constant number/color/boolean;
  - seeded random numeric range (continuous or integer as property metadata requires);
  - selected primitive event fields where useful.
- [ ] Use the shared deterministic RNG foundation, with independent per-action/per-event-source streams so hundreds of stars do not receive identical values.
- [x] Validate property/value type compatibility through registry metadata and model validation; do not rely on runtime coercion.
- [ ] Ensure Set Property X/Y rounds to authored pixel rules only in edit-time authoring; runtime random positions may remain continuous when the action explicitly uses a continuous range.
- [x] Do not route this workflow through `Call`, custom operation IDs, argument JSON, or host-registered callbacks; the constrained built-in action must be sufficient by itself.

### 6E — Extend the existing Event Block GUI

- [ ] Add `Bounds` to the existing Event Block Trigger selector.
- [ ] Show the complete Event selector—Contact Entered, Contact Exited, Wrapped, Bounced, Clamped, and Stopped—plus contextual Axis/Side filters using existing select and two-column patterns; for this demo choose Event `Wrapped`, Axis `Y`, Side `Any`.
- [ ] Show a short outcome description and compatible behavior badge beneath the selector, as specified in `.plans/mockups/stars-bounds-event-family.svg`.
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

### 6F — Enforce the no-code boundary

- [ ] Do not add a Script, Expression, Formula, Callback Body, TypeScript, or JavaScript field anywhere in this workflow.
- [ ] Do not introduce implicit identifiers such as `bounds`, `exitSide`, or `self`; every available target, property, filter, and value source must be discoverable through labeled controls.
- [ ] Do not introduce callable functions such as `rand(...)`; Random Range is a typed value-source option with visible Min, Max, and Seed fields.
- [x] Keep the Set Property property list allowlisted and registry-described. Users cannot type arbitrary object paths such as `bounds.minX` or mutate unknown runtime state.
- [ ] Keep event fields available only through labeled selectors and compatible controls; do not expose an untyped event object or JSON expression context.
- [ ] Require a separate user-approved product proposal before any future in-editor scripting initiative. That proposal would need to define language choice, API/reference discovery, types, editor tooling, sandbox/security model, determinism, debugging, persistence/versioning, publishing, and migration independently of this demo.

## Phase 7 — Assemble and Prove the Faithful Stars Workflow

- [ ] Create a documented test fixture/project with world `720 × 1280`, background `#000000`, one 3 × 3 white asset, and five 80-member Scatter formations named `Stars Blink 1` through `Stars Blink 5`.
- [ ] Add a `stars.py` parity integration spec that constructs that fixture via editor reducer actions or shared project-step builders, analogous to the Pattern Demo command-driven persistence/runtime tests:
  - do not exercise manual GUI authoring with Playwright clicks for this parity test;
  - call the same underlying editor commands used by the UI where possible (`update-scene-world`, asset import/create, begin/update/commit formation draft, create/update Event Blocks and attachments, set scene appearance);
  - after each major build step, assert the persisted project shape matches the expected scene, group, member, attachment, and event-block state;
  - compile/run the final project and verify the visible/timed `stars.py` behavior: 400 present members, five blink periods, velocity timeline checkpoints, wrap relocation, event-source X reroll, no vertical-column drift after repeated wraps, and black background;
  - include save/reload and YAML export/import assertions for the finished fixture, using direct project load/snapshot helpers rather than GUI flows.
- [ ] Set each formation's scatter bounds to X `0..720`, Y `5..1285`, random RGB channel range `20..255`, and a distinct recorded seed so the five formations do not overlap deterministically.
- [ ] Apply `Blink Until` to the five formations at 200, 250, 300, 350, and 400 ms respectively, infinite.
- [ ] Apply the same permanent `Move Until` recipe/pattern to each formation's members with velocity `0,0`, bounds `(0,-5)..(720,1285)`, and Behavior `Wrap`.
- [ ] Add the same group-owned Event Block to each formation with Trigger `Bounds`, Event `Wrapped`, Axis `Y`, then add `Set Property` targeting `Event source`, Property `X`, Value `Random Range 0..720`; give each formation a distinct recorded wrap seed.
- [ ] In parallel on each formation, apply the same infinite Repeat velocity sequence:
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
- [ ] Measure draft editing with 80 members and total-scene play-mode frame rate, initial compile time, YAML size, and save latency with all 400 stars; record acceptable thresholds in tests or a short performance note rather than relying on subjective inspection.

## Phase 8 — Workflow Documentation and Required Verification

- [ ] Update `.plans/editor-workflows-inventory.md` after the confirmed UI ships:
  - extend `A26` with Scatter bounds, seed/reroll, count, and random tint;
  - extend `A39`/`A40` with tint;
  - extend `A41` with batch Visual Variations for formation members;
  - extend scene inspection with background color;
  - extend `A42` with the complete typed Bounds event family and event filtering;
  - extend `A43`/`A46` with event-source target binding and Set Property value sources.
- [x] Update `.repo-memory/product-memory.md` only if implementation establishes a durable rule not already covered (likely deterministic authored randomization and authored tint surviving selection styling).
- [x] Run focused unit/component/integration tests for every touched model, editor helper, compiler, runtime action, and Phaser scene.
- [ ] Run TypeScript/build validation and the repository's standard unit suite.
- [x] Run required GUI smoke: `npm run test:e2e -- --project=chromium --grep @smoke`.
- [ ] Run the new stars workflow E2E and any directly affected formation, attachment, serialization, play-mode, and persistence specs in Chromium.
- [ ] Inspect each shipped UI state against the five SVG mockups at normal and narrow inspector widths, light and dark themes, and supported UI scales.
- [x] Confirm `playwright.config.ts` still uses the default worker count of 3.
- [x] Confirm no files under `/home/bcorfman/dev/arcadeactions/` changed.

## Definition of Done

- [ ] Every checkbox above is complete or explicitly moved into a separately approved follow-up plan with rationale.
- [ ] A user can author and persist the complete stars demo without hand-editing YAML or writing runtime code.
- [ ] The primary workflows remain the existing formation draft, inspector, and action attachment paths.
- [ ] Old projects load without visual or behavioral drift.
- [ ] The five-formation, 400-star fixture meets recorded editor and runtime performance thresholds.
- [ ] Required unit, integration, E2E, and Chromium smoke verification pass.
