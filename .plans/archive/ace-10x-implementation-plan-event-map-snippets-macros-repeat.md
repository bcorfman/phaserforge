# Plan: Implement Event Wiring Map + Snippets/Macros + Repeat Composite in Event Blocks (ACE-friendly)

## Summary
Implement three editor capabilities based on the mockups:
1) **Event Wiring Map** (`approach-1e-event-wiring-map.svg`): a scene-level view that visualizes **emitters → events → handlers** and supports quick navigation + wiring creation.
2) **Snippets vs Macros** (`approach-1g-snippet-vs-macro.svg`): reusable libraries for fast iteration—**Snippets** (copy/paste bundles) and **Macros** (named, parameterized composites) stored in **Project YAML**.
3) **Repeat as a true composite container** inside **Event Blocks** (`approach-1h-repeat-composite-in-event-blocks.svg`): Repeat contains child steps (each with its own `Until…`) instead of today’s “Repeat wraps the whole block”.

This is a significant workflow change under `src/editor/**`; before implementation we will do a workflow confirmation checkpoint referencing `.plans/editor-workflows-inventory.md` (primarily **A35 — Attach / Edit Action Flow**, plus the Events workflow that currently lives in `EventsPanel`).

## Key Changes (Decision-complete)

### 1) Add real emitted events + event-triggered Event Blocks (required for Wiring Map)

#### Data model
- Extend `AttachmentTriggerSpec` (`src/model/types.ts`) to add:
  - `type: 'event'`
  - `eventName: string`
- Add a new action preset **`EmitEvent`** (attachment `presetId: 'EmitEvent'`) with:
  - `params: { eventName: string, ...payload }` (payload is a flat record of primitives)
  - `condition: { type: 'Instant' }` (always instant)

#### Runtime/compiler
- Add a lightweight runtime event service to compiled scenes:
  - `emit(eventName, payload, sourceTargetKey, sourceEventId?)`
  - events are queued and drained during `updateTriggers()`
- Update `compileAttachments()` / `compileScene()` so:
  - Scripts with trigger `{type:'event', eventName}` start when a matching runtime event is drained.
  - `EmitEvent` compiles to an Action that calls the runtime event service (instant).
- Default behavior: if a script is already running for the same `(targetKey,eventId)` it does not restart (match current semantics).

#### Editor
- In `EventsPanel`, allow selecting trigger type **“On Event”** and entering/selecting `eventName` (autocomplete from known project events + emitted events discovered in the project).

#### Acceptance
- You can build: Coin Event Block → `CollectUntil(...)` → `EmitEvent('Coin.Collected', {points:50})`, and Player Event Block trigger “On Event: Coin.Collected” → award score.

---

### 2) Implement Event Wiring Map view (approach-1e)

#### UI placement
- Add a new tab within the existing Inspector “Events” foldout:
  - Tabs: `Blocks` (current `EventsPanel` list), `Map` (new)
  - No new primary entrypoint elsewhere (minimize workflow disruption).

#### Map contents
- Build a graph from the current `ProjectSpec` + active `SceneSpec`:
  - **Emitters**: any Event Block containing `EmitEvent` actions (include target label + block name)
  - **Events**: unique `eventName` strings referenced by `EmitEvent` and by triggers of type `'event'`
  - **Handlers**: any Event Block whose trigger is `{type:'event', eventName}`
- Each node is clickable and navigates to:
  - the target in Inspector
  - the Event Block card
  - the specific attachment row (best-effort)

#### Wiring interactions
- “Create wiring” is implemented as:
  - If user selects an emitter’s `eventName`, offer “Create handler…” → creates an Event Block on a chosen target with trigger `{type:'event', eventName}`.
  - Optional v1 convenience: if target already has a matching event block, just jump there.
- This avoids introducing a second “inline wiring UI” (map is primary).

#### Performance
- Graph computation is pure and memoized; no runtime instrumentation required for v1.

#### Acceptance
- The Map answers “what emits Coin.Collected?” and “who handles Coin.Collected?” and allows creating a missing handler block in ≤2 clicks.

---

### 3) Snippet vs Macro library stored in Project YAML (approach-1g)

#### ProjectSpec additions
- Add to `ProjectSpec` (`src/model/types.ts`):
  - `snippets?: Record<Id, SnippetSpec>`
  - `macros?: Record<Id, MacroSpec>`
- Define:
  - `SnippetSpec`: `{ id, name, kind: 'attachments', source?: {sceneId?, targetKind?}, eventBlockTemplate?: {...}, attachmentsTemplate: AttachmentTemplate[] }`
  - `MacroSpec`: `{ id, name, params: ParamSpec[], body: AttachmentTemplate[] }`
  - `AttachmentTemplate`: same shape as `AttachmentSpec` but with:
    - `target` replaced by a **target parameter reference** (for macros) or “apply-to-selected-target” (for snippets)
    - IDs omitted (generated on apply)
    - order preserved relative inside the template

#### Authoring UX (Snippets)
- In `EventsPanel` (Blocks tab):
  - Multi-select rows → button **“Convert selection → Snippet”**
  - Snippet creation flow asks for name (defaults to `Snippet 1`) and saves into `project.snippets`
- Add a “Snippets” section/panel in Events tab:
  - Search + apply snippet to the current target/event block
  - Apply operation:
    - clones template attachments into the current event block (or creates a new event block if snippet includes one), assigns `target` to the current target, generates IDs, appends orders after existing steps.

#### Macro UX (parameterized)
- Provide “Promote Snippet → Macro”:
  - User chooses which fields become parameters:
    - Target params (1..N): `target:leftDoor`, `target:rightDoor`
    - Primitive params: `durationMs`, `distance`, etc.
  - Macro application prompts for bindings, then instantiates attachments with substitutions.
- v1 constraint (keep simple): macro parameters can bind:
  - `target` fields (which sprite/group to operate on)
  - numeric/string/bool params inside `params` and `condition` only

#### Acceptance
- Snippet: create once, apply to another sprite/group with no manual rebuilding.
- Macro: create `OpenGate(left,right,durationMs)` and apply to any gate pair by binding two targets + number.

---

### 4) Repeat composite as a real container inside Event Blocks (approach-1h)

#### Problem today
- `Repeat` attachment is currently treated as a script-level wrapper in `compileAttachments` (one Repeat wraps all steps), which prevents nesting/containment UI.

#### Data model change
- Update `AttachmentSpec` (`src/model/types.ts`) to support nesting:
  - `parentAttachmentId?: Id` (undefined for root steps in an Event Block)
  - `children?: Id[]` (only for composite presets like `Repeat` initially)
- Update validation to ensure:
  - no cycles
  - children exist and share same `(target,eventId)` as the parent
  - ordering among siblings uses `order`

#### Compiler/runtime
- Update `compileAttachments`:
  - Determine root steps as those with `parentAttachmentId` undefined.
  - Compile recursively:
    - `Repeat` compiles by compiling its child list into `Sequence(children)` then wrapping in `Repeat(sequence, count)`
    - Non-composite steps compile as today.
  - Keep existing Parallel grouping (tag-based) working inside children for v1, or migrate Parallel to be composite later (not required here).

#### Editor UX
- In `EventsPanel`:
  - Render `Repeat` as an expandable row containing its child attachments (indentation + collapse affordance).
  - Provide actions:
    - “Add child action” inside Repeat
    - Move child up/down within Repeat
    - Drag selected steps into Repeat (optional v1; if too risky, provide “Move into Repeat” action button)
- Preserve existing “Add” button row patterns; no right-click menus introduced.

#### Migration
- For existing scenes where Repeat is used as wrapper:
  - On migrate, convert “wrapper Repeat + all other steps” into a Repeat composite with children = all steps (excluding Repeat), preserving step order.

#### Acceptance
- A Repeat block can contain multiple actions with their own Until conditions, and the compiled runtime behavior matches the on-screen structure.

## Test Plan (TDD + E2E required)

### Unit tests (first)
- Model/validation:
  - nesting rules for `AttachmentSpec.parentAttachmentId/children`
  - migration wrapper-repeat → composite repeat
- Compiler:
  - `compileAttachments` produces correct action graph for nested Repeat
  - new trigger `{type:'event'}` starts scripts when event is emitted
  - `EmitEvent` produces events with payload

### Editor interaction tests (where practical)
- `EventsPanel`:
  - creating an “On Event” event block
  - converting selection to snippet and applying to another target
  - expanding/collapsing Repeat and editing children

### E2E (required before declaring code changes complete)
- Run `npm run test:e2e` and ensure it passes.
- Add at least one new Playwright spec covering:
  - emitted event → handler triggers (observable effect)
  - Repeat composite structure reflected in runtime behavior (e.g., repeating a visible toggle or counter increment)

## Workflow confirmation checkpoint (required before code changes)
Impacted workflows:
- **A35 — Attach / Edit Action Flow** (and the current “Events” foldout workflow that supersedes it for attachments)

Current primary path (today):
- Select sprite/group → Inspector → Events foldout → add Event Block → add attachments → reorder/parallelize

Proposed primary path (after):
- Same, plus:
  - Events foldout gains **Map** tab
  - Repeat becomes a **container** (expand/collapse + child editing)
  - Snippet/Macro library adds “convert selection” + “apply” affordances

Entry points added:
- `Events` foldout tabs: `Map`
- Buttons: `Convert selection → Snippet`, `Promote Snippet → Macro`, `Apply Snippet/Macro`

We will confirm this is acceptable before implementation because it adds new surfaces and changes how Repeat works.

## Assumptions (locked)
- Use **explicit `EmitEvent` + `OnEvent` trigger** (not inference-only).
- Store Snippets/Macros **in Project YAML** (shareable/versionable).
- Implement Repeat as a **nested composite** in the attachment model (not tag-only).

