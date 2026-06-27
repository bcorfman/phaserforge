# Project History Semantic Events Implementation Plan

Date: 2026-06-27

Related:
- `.plans/project-history-semantic-events-adr-2026-06-27.md`
- `.plans/project-history-revision-grouping-heuristic-2026-06-21.md`
- `.plans/project-tree-history-implementation-plan-2026-06-19.md`

## Summary

Implement a semantic history event layer that sits beside `ProjectRevisionRecord` and becomes the preferred source for:
- revision row summaries
- expanded bullet details
- grouping/coalescing decisions

Keep revision snapshots/deltas for restore/copy/materialization.

## Goals

- Stop relying on diff heuristics as the primary source of user-facing history meaning.
- Preserve history wording and grouping across reload/rebuild/compaction.
- Make grouping intentional for burst-style editing flows.
- Migrate incrementally without breaking existing revisions.

## Non-goals

- Do not remove revision snapshots/deltas.
- Do not redesign undo/redo in this plan.
- Do not require every editor action to be converted in the first pass.
- Do not block on backend/cloud schema changes before improving local durability.

## Current architecture touchpoints

These are the main places the new model must eventually connect to:

### Action capture
- `describeEditorAction` in `src/editor/EditorStore.tsx`
- `recordHistoryForAction` in `src/editor/EditorStore.tsx`
- `withProjectChangeSummary` in `src/editor/EditorStore.tsx`

### Revision persistence / normalization
- `buildActiveProjectRecordSnapshot` in `src/editor/EditorStore.tsx`
- `buildStoredProjectRecord` in `src/editor/projectPersistence.ts`
- `normalizeStoredProjectRevisions` in `src/editor/projectPersistence.ts`
- `rebuildProjectRevisions` in `src/editor/projectTreeHistory.ts`

### Revision grouping / summarization
- `buildProjectRevisionDetailItemsInternal` in `src/editor/projectTreeHistory.ts`
- `buildRevisionChangeProfile` in `src/editor/projectTreeHistory.ts`
- `shouldCoalesceAutosaveRevision` in `src/editor/projectTreeHistory.ts`
- `appendProjectRevision` in `src/editor/projectTreeHistory.ts`

### UI rendering
- history list rendering in `src/editor/EntityList.tsx`

## Proposed data model

### New durable type

Add a `ProjectHistoryEvent` type in a history-focused module, likely under:
- `src/editor/projectHistoryEvents.ts`

Suggested v1 shape:

```ts
export type ProjectHistoryEvent = {
  id: string;
  projectId: string;
  revisionId?: string;
  occurredAt: string;
  reason: 'autosave' | 'protective' | 'restore' | 'manual';
  kind:
    | 'project.renamed'
    | 'publish.title.set'
    | 'publish.repo.set'
    | 'scene.world.resized'
    | 'scene.renamed'
    | 'scene.created'
    | 'scene.duplicated'
    | 'scene.deleted'
    | 'entity.renamed'
    | 'entity.moved';
  burstId?: string;
  scope:
    | { kind: 'project' }
    | { kind: 'scene'; sceneId: string }
    | { kind: 'entity'; sceneId: string; entityId: string };
  summary: string;
  details?: string[];
  payload?: Record<string, unknown>;
};
```

### Persistence placement

Add event arrays alongside revisions inside the stored project record, for example:

```ts
type StoredProjectRecord = {
  ...
  revisions?: ProjectRevisionRecord[];
  archivedRevisions?: ProjectRevisionRecord[];
  historyEvents?: ProjectHistoryEvent[];
  archivedHistoryEvents?: ProjectHistoryEvent[];
}
```

This keeps the migration incremental and local-first.

## First event set to implement

These should be the first converted event kinds because they already expose recurring UX/history bugs or are high-value history rows:

1. `project.renamed`
2. `publish.title.set`
3. `publish.repo.set`
4. `scene.world.resized`
5. `scene.renamed`

Second wave:

6. `entity.renamed`
7. `entity.moved`
8. `scene.created`
9. `scene.duplicated`
10. `scene.deleted`

## Event emission strategy

### Rule

Emit semantic events at the same point where the editor still knows the originating action and scope.

Best current candidate:
- `recordHistoryForAction` in `src/editor/EditorStore.tsx`

### Why here

At that point we still have:
- `stateBefore`
- `stateAfter`
- concrete `EditorAction`
- current selection and scene context

This is the highest-fidelity place to create stable semantic history metadata.

### Event emission helper

Introduce a pure helper like:

```ts
buildProjectHistoryEventsForAction(
  stateBefore,
  stateAfter,
  action,
  context,
): ProjectHistoryEvent[]
```

That helper should:
- emit zero or more semantic events
- assign summary/details
- assign scope
- assign `burstId` when appropriate

## Burst identity strategy

This is the most important grouping improvement.

### V1 approach

Introduce a lightweight `burstId` model for actions that naturally cluster:

- repeated scene world updates from one resize interaction
- repeated entity moves from one drag/nudge burst
- grouped metadata edits in one focused dialog flow

### Practical initial rule

For v1:
- command-style one-shot actions can use unique per-action burst ids
- repeated continuous actions can reuse a burst id while the interaction is active

### Example

Scene resize interaction:
- first drag/edit starts burst `resize:scene-1:<interaction token>`
- subsequent `update-scene-world` actions during that interaction reuse the same `burstId`

Then history coalescing can group by `burstId` first instead of trying to infer “probably same burst” from deltas.

## Row rendering strategy

### New helper layer

Add helpers like:

```ts
buildRevisionNarrative(
  revision,
  previousRevision,
  revisionHistory,
  historyEvents,
): {
  summary: string;
  details: string[];
  source: 'events' | 'changeSummary' | 'legacy-diff';
}
```

### Rendering precedence

When rendering a revision row:

1. If event-backed narrative exists for the revision, use it.
2. Else if `changeSummary` exists, use it.
3. Else use the current legacy diff summarizer.

This allows migration without breaking older revisions.

## Coalescing strategy

### Near-term

Keep `appendProjectRevision` and snapshot compaction for restore storage, but stop relying on diff profile alone for history semantics.

### Preferred future shape

Add an event-aware coalescing layer:

- coalesce rows by shared `burstId`
- aggregate event details under the coalesced row
- let the coalesced row keep the latest linked revision id for restore/preview

### Legacy fallback

If no event metadata exists, the existing heuristic path remains active.

## Migration plan

## Phase 1: type + persistence scaffolding

### Changes
- add `ProjectHistoryEvent` type/module
- extend stored project record shape to persist event arrays
- make hydration tolerant of missing event arrays

### Tests first
- persistence helpers preserve `historyEvents`
- hydrate/normalize does not drop events
- empty/missing events remain backward compatible

## Phase 2: emit first event set

### Changes
- add event-emission helper
- emit events for:
  - project rename
  - publish title/repo changes
  - scene world resize
  - scene rename

### Tests first
- store/helper tests for emitted event kind, scope, summary, details
- repeated resize actions share a burst id when expected

## Phase 3: event-backed row rendering

### Changes
- add narrative builder that prefers events
- update `EntityList.tsx` history rendering to use event-backed summaries/details

### Tests first
- event-backed rows render stable summary before and after reload
- expanded bullet list comes from event details
- rows without events still use current legacy behavior

## Phase 4: event-aware grouping

### Changes
- introduce grouping by `burstId`
- make revision row aggregation prefer event grouping over diff-profile grouping

### Tests first
- repeated resize edits in one burst produce one history row
- same-minute unrelated edits with different burst ids do not group
- reload preserves grouping because the burst id is durable

## Phase 5: expand event coverage

### Changes
- add entity rename/move
- add scene create/delete/duplicate
- add more asset/system actions as needed

### Tests first
- one focused test suite per event family

## Phase 6: reduce heuristic centrality

### Changes
- narrow legacy diff summarizer to fallback-only use
- stop adding new domain heuristics unless they are needed for legacy compatibility

### Success condition
- new history behavior work usually means “add event support,” not “patch another diff heuristic”

## TDD strategy

Per AGENTS guidance, the change should be test-driven.

### Store/helper tests

Add focused tests for:
- event emission per action kind
- burst id assignment
- narrative builder precedence
- persistence retention of events

### Integration tests

Add integration coverage for:
- action -> event emission -> saved record
- reload/hydration preserving event-backed summaries
- event-backed grouping surviving rebuild

### E2E tests

Add/adjust Playwright coverage for:
- resize history summary surviving tab close/reopen
- publish/rename summaries surviving reopen
- grouped event-backed rows showing correct expanded details

Prefer stable visible assertions:
- summary text
- row counts
- expanded bullet items

Avoid brittle assertions on:
- exact timing
- internal diff heuristics

## Compatibility rules

The migration must preserve:
- restore/copy behavior
- current revision preview behavior
- older projects without event metadata
- cloud/local history persistence symmetry as much as possible

## Suggested implementation sequence

1. Add event types and stored-record fields.
2. Add persistence tests.
3. Add event emitter for rename/publish/resize.
4. Add narrative builder with precedence rules.
5. Switch row rendering to use narrative builder.
6. Add burst ids for resize.
7. Add event-aware grouping path.
8. Expand event coverage gradually.

## Risks

### Dual-history complexity during migration

For a while we will have:
- revisions
- changeSummary
- legacy diff inference
- semantic events

Mitigation:
- keep clear precedence rules
- document each layer’s role
- add tests specifically for mixed old/new data

### Overfitting burst identity to one interaction family

Mitigation:
- start with resize and one or two other bursts
- keep burst generation explicit and narrow

### Event copy drift

If summary copy is spread too widely, consistency may drift.

Mitigation:
- centralize event construction/copy in one helper module

## Definition of done for the first milestone

The first milestone should be considered complete when:

- rename/publish/scene-resize actions emit durable semantic events
- event metadata survives persistence and reload
- history rows prefer event-backed summaries over diff heuristics
- scene-resize rows no longer degrade after reload
- repeated scene-resize edits can group via durable burst metadata
- legacy revisions still render through fallback summarization

## Recommendation

Implement this as the next history architecture step rather than continuing to extend domain-specific diff heuristics as the primary model.

The heuristics plan from 2026-06-21 remains useful as a fallback policy for legacy revisions, but it should no longer be treated as the long-term center of the system.
