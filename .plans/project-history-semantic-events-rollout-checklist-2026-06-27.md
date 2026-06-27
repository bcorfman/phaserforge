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

- asset library + assignment
  - `asset.image.added`
  - `asset.audio.added`
  - `asset.font.added`
  - `asset.spritesheet.added`
  - `asset.renamed`
  - `asset.removed`
  - `background.layer.asset.set`
  - `entity.asset.set`
  - asset-to-scene music / ambience assignment reuses:
    - `scene.music.set`
    - `scene.ambience.set`

- scene graph / grouping
  - `group.created`
  - `group.deleted`
  - `group.dissolved`
  - `group.members.added`
  - `group.members.removed`
  - `group.layout.changed`
  - `group.arranged`

- entity creation / import / layout / transforms
  - `entity.created`
  - `entity.duplicated`
  - `entity.imported`
  - `entity.layout.applied`
  - `entity.asset.set`
  - `entity.text.rasterized`

- behavior graph / patterns
  - `attachment.created`
  - `attachment.updated`
  - `attachment.removed`
  - `attachment.reordered`
  - `attachment.nested`
  - `attachment.parallelized`
  - `attachment.parallel.ungrouped`
  - `attachment.parallel.moved`
  - `event.block.created`
  - `event.block.updated`
  - `event.block.removed`
  - `pattern.created`
  - `pattern.applied`
  - `loop.template.applied`

## Next recommended batch

### Remaining editor/system actions

- reset / clear / delete-selection / remove-scene-graph-item semantic events
- group update / ungroup / create-from-arrange + formation draft commit parity checks
- bulk patch / movement-bounds / move-group events
- demo-pack import + scene base-scene toggle coverage
- counters / collections if they should participate in project-history UI narratives

## Follow-up architecture tasks

- decide whether archived history should become visible in the UI
- consider moving more row aggregation to event-family grouping instead of revision-level fallback
- add shared helper coverage for event-copy consistency by family
- keep legacy diff heuristics fallback-only; avoid adding new heuristics before checking whether an event should exist instead
