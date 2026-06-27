# ADR: Project History Should Be Event-First, Not Revision-First

Date: 2026-06-27

Related plans:
- `.plans/project-history-revision-grouping-heuristic-2026-06-21.md`
- `.plans/project-tree-history-implementation-plan-2026-06-19.md`
- `.plans/project-history-and-asset-dedup-plan-2026-06-05.md`

## Status

Proposed

## Decision

PhaserForge project history should move to an event-first model for user-facing history.

Specifically:
- durable `ProjectRevisionRecord` snapshots/deltas should remain the source of truth for restore/copy/materialization
- user-facing history rows should be derived primarily from durable semantic `ProjectHistoryEvent` records
- grouping/coalescing should be based primarily on explicit burst/session metadata captured at action time, not inferred later from structural diffs
- diff-based summary inference should remain only as a fallback for legacy revisions or for cases where no event metadata exists

## Why this ADR exists

Recent bugs have all had the same underlying shape:

1. The editor knew what the user did at action time.
2. That meaning was only partially stored.
3. Later systems re-inferred meaning from snapshots or diffs.
4. Reload, compaction, coalescing, or rebuild changed the inferred result.

Examples of recurring failures:
- a specific summary such as `Resized scene world` degrading to `Edited scene scene-1` after reload
- two edits occurring in the same visible time window not grouping because the coalescer could not infer shared intent from the diff profile
- new heuristic coverage fixing one domain while leaving the next domain exposed to the same class of bug

The repeated pattern is not “one more missing heuristic.” It is that the current architecture asks multiple layers to rediscover intent independently.

## Current architecture problem

Today the history system spreads meaning across several layers:

### 1. Action-time intent capture

At action time the editor often knows exactly what happened.

Examples:
- `describeEditorAction` in `src/editor/EditorStore.tsx`
- `recordHistoryForAction` in `src/editor/EditorStore.tsx`

This is the highest-fidelity point in the pipeline because it still has:
- the originating editor action
- the active object/scene/project context
- the user interaction semantics

### 2. Revision persistence

Persisted history currently stores:
- full checkpoints or deltas
- reason metadata such as `autosave`
- optional `changeSummary`

But it does not store a stable, typed semantic record of what happened.

### 3. Reload / rebuild normalization

During persistence normalization and revision rebuild, the system may reconstruct revisions from snapshots/deltas.

That means meaning can be rewritten during:
- compaction
- hydration
- retention trimming
- recovery from partial records

### 4. UI summarization

The history UI still derives visible text by diffing one revision against another and ranking heuristics.

That means the final visible sentence depends on:
- what data survived persistence
- how accurately the diff engine detects the changed domain
- whether coalescing merged the “right” revisions

## Why the current revision-first model keeps producing bugs

The current design makes one user action pass through too many interpreters:

- action interpreter
- persistence/rebuild interpreter
- coalescing interpreter
- summary interpreter

Each layer is reasonable locally, but the overall system is brittle because:
- the layers do not share one canonical semantic object
- the later layers often have less information than the earlier ones
- the history UI is forced to explain intent from state shape rather than from actual recorded intent

In short:

State snapshots are good at answering:
- `What can I restore to?`

They are much worse at answering:
- `What happened?`
- `Which edits belong together?`
- `What should this row say after reload?`

## Proposed model

Introduce a new durable semantic layer:

### `ProjectHistoryEvent`

Each meaningful user/project change emits one or more history events at action time.

Suggested shape:

```ts
type ProjectHistoryEvent = {
  id: string;
  revisionId?: string;
  projectId: string;
  occurredAt: string;
  kind: string;
  reason: 'autosave' | 'protective' | 'restore' | 'manual';
  burstId?: string;
  interactionId?: string;
  scope:
    | { kind: 'project' }
    | { kind: 'scene'; sceneId: string }
    | { kind: 'entity'; sceneId: string; entityId: string }
    | { kind: 'asset'; assetId: string; assetType: 'image' | 'audio' | 'font' | 'spritesheet' };
  summary: string;
  details?: string[];
  tags?: string[];
  payload?: Record<string, unknown>;
};
```

Important properties:
- `kind` is typed semantic meaning like `scene.world.resized`
- `summary` is stable user-visible copy captured near the action
- `details` can power expanded revision lists without re-diffing
- `burstId` groups related edits from one interaction burst
- `revisionId` links the semantic event to a restoreable snapshot/delta head

### `ProjectRevisionRecord`

Revision records continue to exist for:
- restore
- copy
- preview
- retention
- asset/reference dedup strategies

But revision records should no longer be the primary source for user-facing history semantics.

## New mental model

Treat the system as two layers:

### Layer A: Restore layer

Answers:
- what project state can be materialized?
- what snapshot/delta chain can be restored?
- what belongs in retention and archival storage?

Primary data:
- `ProjectRevisionRecord`

### Layer B: Narrative layer

Answers:
- what happened?
- what should the row say?
- which edits belong together?
- what bullet list should expand under the row?

Primary data:
- `ProjectHistoryEvent`

These layers are linked, but not conflated.

## Grouping model

Grouping should stop being primarily “same time plus inferred overlapping diff profile.”

Instead:

### Primary grouping signal

Use an explicit `burstId` or `interactionId` assigned at action time.

Examples:
- a resize gesture sequence
- a project rename flow
- a quick sequence of publish metadata edits
- entity move nudges during one manipulation burst

### Secondary grouping signal

If no `burstId` is present, group compatible events by:
- time proximity
- matching scope
- matching semantic family

This becomes the compatibility path, not the ideal path.

### Tertiary fallback

Legacy revisions without events may still use the current diff heuristic path.

## Summarization model

### Rule

If a row is shown to the user, prefer summary text captured at action time over text inferred later from diffs.

### Consequences

- Reload should not change `Resized scene world` into `Edited scene scene-1`
- Expanded bullet lists should come from captured event details whenever possible
- Coalesced rows should aggregate event summaries/details rather than rediffing the merged snapshot and trying to reverse-engineer the original burst

## Migration strategy

This should be incremental, not a flag day rewrite.

### Phase 0

Keep current revisions and current UI behavior.

### Phase 1

Start emitting `ProjectHistoryEvent` for a narrow set of high-value actions:
- project rename
- publish title/repo edits
- scene world resize
- scene rename
- entity rename
- entity move
- scene create/delete/duplicate

Persist events alongside revisions.

### Phase 2

Update the project history UI to prefer event-backed rows for revisions that have events.

Fallback order:
1. event-backed summary/details
2. explicit revision `changeSummary`
3. legacy diff summarizer

### Phase 3

Add burst-aware grouping for event-backed history.

### Phase 4

Reduce heuristic diff usage to legacy support and edge cases only.

## Benefits

### Stability

History rows become stable across:
- reload
- hydration
- compaction
- rebuild
- retention

### Simpler tests

Instead of asserting complex derived text from structural diffs, tests can assert:
- emitted semantic event
- grouping burst id
- rendered summary/details

### Better UX

The history pane becomes closer to:
- a meaningful activity log

and less like:
- a best-effort reconstruction from snapshots

### Better extensibility

New edit areas become easier to support:
- add a new semantic event emitter
- render it

instead of:
- update action summary logic
- update revision coalescing domains
- update summary heuristics
- update rebuild preservation rules

## Costs and tradeoffs

### More stored metadata

This adds a durable semantic event stream in addition to revisions.

This is acceptable because:
- events are small
- revisions already exist
- semantic durability is worth modest metadata growth

### Need for migration logic

The system must handle mixed history:
- legacy revisions without events
- newer revisions with events

This is acceptable and expected.

### Need for burst identity

Some interaction families need a clean way to generate a stable `burstId`.

That requires intentional design in command/edit flows, but it is still less brittle than diff heuristics.

## Explicit non-goals

This ADR does not propose:
- replacing undo/redo with durable history
- introducing branching/merge semantics
- removing revisions/deltas
- designing final copy for every event kind now

## Acceptance signal for adopting this ADR

We should consider this direction validated if it reduces the frequency of bugs where:
- history wording changes after reload
- same-intent edits fail to group
- unrelated edits group together due to heuristic overlap
- each new edit domain needs another custom diff rule to look reasonable

## Recommendation

Adopt this ADR and implement history as:
- event-first for narrative meaning
- revision-backed for restoreable state

The current revision-first heuristic path should become a migration/fallback layer, not the long-term center of the design.
