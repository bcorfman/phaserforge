# Plan — Migrate Snippets/Macros → Parameterized Patterns (ArcadeActions-aligned)

Date: 2026-05-15

This plan migrates the editor’s current “Snippets” + “Macros” feature set to a single concept: **Patterns** (named, reusable action patterns with parameters), aligned with ArcadeActions terminology and expectations.

Mockup reference: `.plans/mockups/patterns-migration-2026-05-15/events-patterns-redesign.png`

## Goals

- Replace “Snippet”/“Macro” terminology in the editor with **Pattern** terminology.
- Make Patterns behave like higher-level reusable functions: **named + parameterized**, applied to an Event’s steps.
- Perform a **full YAML migration** so projects serialize using a canonical `patterns` key.
- Preserve backwards compatibility: old YAML using `snippets` and/or `macros` still loads.
- Maintain TDD discipline and keep Playwright worker count unchanged.

## Current State (as of 2026-05-15)

- `ProjectSpec` contains:
  - `snippets?: Record<Id, SnippetSpec>` (`SnippetSpec` is “attachmentsTemplate” only; no params)
  - `macros?: Record<Id, MacroSpec>` (`MacroSpec` includes `params: ParamSpec[]`, but apply is expansion-only today)
- YAML parsing currently reads `snippets` and `macros` keys (`src/model/serialization.ts`).
- Editor operations exist as store actions:
  - create/apply snippet + create/apply macro.

## Proposed Model (Canonical)

### New type: `PatternSpec`

Add a new canonical type and storage key:

- `ProjectSpec.patterns?: Record<Id, PatternSpec>` (canonical)
- `PatternSpec`:
  - `id: Id`
  - `name: string`
  - `params: ParamSpec[]` (reuse existing `ParamSpec`)
  - `body: AttachmentTemplate[]`
  - `source?: { sceneId?: Id; targetKind?: 'entity' | 'group' }` (optional metadata carried forward)

### Back-compat

- Keep reading `snippets` and `macros` on load for older YAML.
- Do not write `snippets`/`macros` in new YAML after migration.

## Parameter Binding + Substitution (v1)

Patterns are applied by binding `params` then expanding `body` templates into attachments.

### Placeholder syntax

- String fields can include placeholders: `{{paramId}}`

### Substitution locations

Apply substitution to:

- `AttachmentTemplate.name` (string)
- `AttachmentTemplate.params` values (string fields only)
- `AttachmentTemplate.tag` (string)

Do **not** attempt substitution in nested objects beyond these fields in v1.

### Type rules

- `number`: user input must parse as a finite number; store as number when possible.
- `boolean`: accept `true/false` toggle.
- `string`: pass as string.
- `target`: v1 supports only string substitution into params (no special target binding object).

### Failure mode

- If any required param is missing/invalid, Pattern apply fails with a user-visible validation error and does not modify the scene.

## Editor UX (Events)

### Terminology

- Replace all “Snippet(s)” and “Macro(s)” labels with **Pattern(s)**.
- Remove any UI language implying copy/paste (“snippet”) and prefer “Pattern” semantics.

### Event card add flow

Per-event card, a single `+ Add…` control opens:

1) `New Action…` → opens the Action Library drawer (drawer contains search)
2) `Pattern →` → submenu/list of patterns; selecting prompts for params if any, then applies

### Applying a Pattern

If the Pattern has params:

- Show an anchored in-panel prompt:
  - Title: `Apply Pattern: <Pattern Name>`
  - Field per param (typed input)
  - Buttons: `Apply`, `Cancel`
  - Inline validation; disable `Apply` until valid

### Creating a Pattern from selected steps

Replace “Convert → Snippet/Macro” with:

- `Convert → Pattern`
- Prompt:
  - Pattern name (default: `Pattern N`)
  - Optional “Add parameters” flow (v1: simple list editor; see staged plan below)

## YAML Migration Policy (Full)

### Write policy (after migration)

- Serialize only:
  - `patterns` (canonical)
- Omit:
  - `snippets`
  - `macros`

### Read policy (during migration window)

On load:

1) If `patterns` exists: use it.
2) Else:
   - Create `patterns` from legacy keys:
     - `snippets` → patterns with `params: []`, `body = attachmentsTemplate`
     - `macros` → patterns with `params = macro.params`, `body = macro.body`

### Collision policy (must be deterministic)

If IDs collide between imported legacy `snippets` and `macros`:

- Prefer the macro-derived entry as the canonical Pattern for that ID.
- Rename the other to a new ID with suffix `-imported2` (repeat with `-imported3` as needed).
- Preserve its display `name` but suffix with ` (Imported)` if it already conflicts by name in the UI list.

## Staged Implementation Plan (TDD-driven)

### Stage 0 — Inventory + baselines

- Add/confirm workflow entries in `.plans/editor-workflows-inventory.md` for:
  - “Apply Pattern to Event”
  - “Create Pattern from selected steps”
- Add a small mockup set under `.plans/mockups/` for:
  - `Handlers/Wiring` tabs
  - `+ Add…` menu
  - Apply Pattern param prompt

### Stage 1 — Data model + serialization (patterns-only write, legacy read)

Tests first:

- `tests/model/project-serialization.test.ts`:
  - loading legacy YAML with `snippets` and `macros` yields `patterns`
  - serializing yields only `patterns` key

Implementation:

- Add `PatternSpec` + `ProjectSpec.patterns`.
- Update serialization:
  - read `patterns`
  - else map `snippets`+`macros` into `patterns`
  - write `patterns` only

### Stage 2 — Core commands (create/apply patterns, with param binding)

Tests first:

- New unit tests (or extend existing snippets+macros tests) for:
  - create pattern from attachments
  - apply pattern (no params)
  - apply pattern (with params + substitution)
  - invalid params fails without mutating scene

Implementation:

- Introduce `patternCommands.ts` (or evolve existing snippet/macro commands) with:
  - `createPatternFromAttachments`
  - `applyPatternToTargetAndEvent(scene, target, eventId, pattern, bindings)`

### Stage 3 — Store actions + UI wiring (Patterns in Events)

Tests first:

- Update existing EventsPanel tests to:
  - use `Pattern` terminology
  - ensure `+ Add…` flow exposes Pattern list
  - ensure apply prompt appears for param patterns (jsdom test)

Implementation:

- Replace store actions:
  - create/apply snippet + macro → create/apply pattern
- Events UI:
  - `+ Add…` menu includes:
    - `New Action…`
    - `Pattern →`
  - Add apply prompt with typed controls.

### Stage 4 — Cleanup + compatibility removal (optional later)

After sufficient stability:

- Remove legacy UI strings, deprecated actions, and internal code paths that exclusively support `snippets/macros` (keep legacy YAML read mapping as long as desired).

## Test Plan / Verification

Required before calling code changes “done”:

- `npm run test:unit`
- `npm run test:e2e`

Key scenarios:

- Legacy YAML containing `snippets` and `macros` loads successfully and Patterns appear.
- Create a Pattern from selected steps, define params, apply it to another event block, fill params, verify expanded steps appear.
- Save YAML produces `patterns` key and does not include legacy keys.

## Open Questions (if decisions change)

- Do we want `target` params to support richer binding (entity/group pickers) in v1, or keep as string substitution only?
- Should Pattern params support defaults + required flags in the UI editor for pattern creation?
