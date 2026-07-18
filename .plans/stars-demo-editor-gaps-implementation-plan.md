# Stars Demo Editor Gaps — Step-by-Step Implementation Plan

Status: user-reviewed proposal with phases 1–6D implemented; continue using this file as the active checklist for remaining stars-demo work.

Reviewed decisions (2026-07-16):

- use five Scatter formations of 80 stars rather than one 400-member formation or a new partitioning workflow;
- implement the complete finite Bounds event family, not only Wrapped;
- approved the proposed Scatter, tint/variation, scene appearance, and no-code Bounds/Set Property workflows.

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

## Implemented Baseline

Phases 1–6D are implemented and covered by tests. Use this summary plus `docs/reference/project-data.md` for the current contract; tests remain the exact behavior source.

- Formation draft has a `Scatter` preset with deterministic X/Y bounds, seed/reroll, 200-member cap, stable member order, and optional deterministic random RGB tint.
- `EntitySpec.tint?: number` and `GameSceneSpec.backgroundColor?: number` are optional RGB integers and round-trip through project data/YAML.
- Final generated positions and tints live on entities; scatter/tint params and seeds live on the formation layout only for intentional reapply/reroll.
- `Move Until` owns bounds detection/behavior. Consequences belong in Event Blocks/actions, not one-off fields such as `randomizeOnWrap`.
- Bounds events are typed and finite: `contact-entered`, `contact-exited`, `wrapped`, `bounced`, `clamped`, `stopped`, with `axis` and `side` filters.
- Runtime Bounds events carry member-local source, owner/event block, occurrence id/order, axis/side, prior position, and resolved position.
- Event Blocks route typed Bounds events by filter and owner scope, preserve custom event-name behavior, and can bind action targets to `event-source`.
- `Set Property` is the no-code primitive for `x`, `y`, `tint`, `alpha`, `visible`, `vx`, and `vy`.
- `ValueSourceSpec` is finite: `constant`, seeded `randomRange`, and compatible labeled `eventField` values. Runtime random X/Y may remain continuous.

## Remaining Guardrails

- Keep the primary paths in `A25/A26`, `A39/A40/A41`, `A42/A43/A46`, and Scene Appearance; no new scatter tool or Move Until consequence panel.
- Keep the stars workflow no-code: `When Bounds -> Wrapped` followed by `Set Property -> Event source -> X -> Random Range`.
- Do not add Script, Expression, Formula, Callback Body, TypeScript, JavaScript, callable `rand(...)`, arbitrary object paths, or untyped event JSON.
- Keep `Call` plus `OpRegistry` unchanged and out of scope.
- Continue using an imported 3 x 3 white image for the star template.
- If expanding the action system, add finite primitives or recipes only after classifying the gap; do not claim arbitrary-game completeness.

## Remaining Work

Mockups: `.plans/mockups/stars-bounds-event-no-code-actions.svg` and `.plans/mockups/stars-bounds-event-family.svg`.

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

- [x] Update `.plans/editor-workflows-inventory.md` after the confirmed UI ships:
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
