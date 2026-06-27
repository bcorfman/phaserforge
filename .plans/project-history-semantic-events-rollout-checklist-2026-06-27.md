# Project History Semantic Events Rollout Checklist

Date: 2026-06-27

Related:
- `.plans/project-history-semantic-events-implementation-plan-2026-06-27.md`
- `.plans/project-history-semantic-events-adr-2026-06-27.md`

## Completed

- persistence scaffolding for `historyEvents` / `archivedHistoryEvents`
- event-backed revision narrative precedence over legacy diff summaries
- durable revision linkage via `historyEventIds` and `historyBurstIds`
- event-aware coalescing path in revision append/coalescing
- retention lifecycle for linked events during archive/delete

### Action families converted

- project metadata
  - `project.renamed`
  - `publish.title.set`
  - `publish.repo.set`
  - `project.default-input-map.set`

- scene lifecycle
  - `scene.created`
  - `scene.duplicated`
  - `scene.deleted`
  - `scene.renamed`
  - `scene.world.resized`

- entity
  - `entity.renamed`
  - `entity.moved`

- scene systems
  - `scene.music.set`
  - `scene.ambience.set`
  - `scene.input.set`
  - `background.layers.set`
  - `background.layer.updated`
  - `background.layers.reordered`
  - `background.layer.removed`
  - `collision.rule.added`
  - `collision.rule.updated`
  - `collision.rule.removed`
  - `trigger.added`
  - `trigger.updated`
  - `trigger.removed`

- input maps
  - `input.map.created`
  - `input.map.duplicated`
  - `input.map.removed`
  - `input.binding.added`
  - `input.binding.removed`

## Next recommended batch

### Asset library + assignment

- image asset add/remove/rename
- spritesheet asset add/remove/rename
- font asset add/remove/rename
- audio asset add/remove/rename
- entity sprite assignment
- scene music / ambience assignment through asset-target workflows
- background-layer asset assignment

### Scene graph / grouping

- group created / deleted / dissolved / ungrouped
- entity added to group / removed from group
- group layout converted / arranged
- duplicate/import/layout entities
- set entity asset / rasterize text to sprite

### Behavior graph / patterns

- attachment add/update/remove/reorder
- event block add/update/remove
- pattern create/apply
- loop template apply

## Follow-up architecture tasks

- decide whether archived history should become visible in the UI
- consider moving more row aggregation to event-family grouping instead of revision-level fallback
- add shared helper coverage for event-copy consistency by family
- keep legacy diff heuristics fallback-only; avoid adding new heuristics before checking whether an event should exist instead
