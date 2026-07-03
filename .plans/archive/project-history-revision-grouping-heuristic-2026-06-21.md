# Project History Revision Grouping Heuristic

Date: 2026-06-21

Superseded as the long-term primary direction by:
- `.plans/archive/project-history-semantic-events-adr-2026-06-27.md`
- `.plans/archive/project-history-semantic-events-implementation-plan-2026-06-27.md`

This heuristic note is still useful for:
- understanding the current legacy/fallback grouping logic
- supporting migration for revision records that do not yet carry semantic history events

## Why this note exists

Project History quality depends on two separate things:

1. How we summarize a single revision row
2. How we decide what belongs in one revision row at all

This note is about the second problem.

If revision boundaries are too coarse, the history pane can end up hiding unrelated edits under one row even when the summary text is good. If revision boundaries are too fine, the history becomes noisy and hard to scan.

The goal is to make one revision row feel like one coherent editing burst.

## Current implemented heuristic

Implemented in:
- [src/editor/projectTreeHistory.ts](/home/bcorfman/dev/phaserforge/src/editor/projectTreeHistory.ts)

Current behavior applies only when appending a new `autosave` revision.

### What the current heuristic does

When a new autosave arrives, it may replace the latest autosave row instead of creating a new row if all of the following are true:

1. The latest existing row is also an `autosave`
2. The new autosave is within `90s` of the latest autosave
3. The new autosave looks like the same editing burst rather than a domain switch

### How “same editing burst” is currently decided

We build a lightweight change profile for:
- the latest autosave relative to the row before it
- the incoming autosave relative to the latest autosave

That profile currently tracks:
- changed domains
- changed focus keys

Tracked domains today:
- `project-title`
- `audio`
- `music`
- `input-maps`
- `publish`
- `entity`
- `triggers`

Tracked focus keys today include:
- `entity:<sceneId>:<entityId>`
- `trigger:<sceneId>:<triggerId>`
- `audio:<assetId>`
- `music:<sceneId>`
- `input-map:<mapId>`
- `publish:title`
- `publish:repo`

### Coalescing rules today

The new autosave coalesces with the latest autosave if either:

1. The two change profiles overlap on a focus key
2. The combined domains collapse to exactly one domain
3. The combined domains are exactly `audio|music`

If coalescing happens:
- the latest autosave row is replaced by the new autosave row
- the older pre-burst row remains as the comparison baseline

If coalescing does not happen:
- the new autosave becomes a fresh top history row

### What this solves

This current heuristic already helps with:
- repeated edits to the same entity staying in one row
- audio import plus music assignment staying in one row
- switching from audio/music work to publish work creating a new row

### Known limitations of the current heuristic

The current implementation is intentionally conservative and incomplete.

It does not yet understand many meaningful edit areas, including:
- counters
- patterns
- collections
- collision rules
- event blocks
- attachments
- behaviors/actions/conditions
- scene metadata beyond the current summary path
- image/spritesheet/font asset edits at object-level granularity

This means some revisions may still:
- merge when they should split
- split when they should merge
- depend too heavily on a small tracked-domain set

## Proposed stronger heuristic

The longer-term model should treat a revision row as one meaningful editing intention, not merely one autosave event.

### Proposed rule of thumb

One row should feel like:
- one task
- one editing burst
- one coherent intent

Not:
- a random bag of everything that happened before the next autosave

### Proposed grouping signals

Revision formation should consider all of the following:

1. Domain coherence
- Keep edits together when they remain in the same editing area
- Split when the user switches into a clearly different area

2. Object locality
- Keep edits together when they touch the same object or tightly related objects
- Example: add a trigger, rename it, resize it
- Example: name an entity, move it, edit its text

3. Time proximity
- Keep edits together only within a bounded window
- Time should be a soft signal, not the only signal

4. Milestone boundaries
- Force a new revision boundary for explicit high-level operations
- Examples:
  - rename project
  - rename scene
  - restore revision
  - copy revision
  - import asset
  - assign music
  - create/delete scene
  - publish-related metadata edits

5. Heterogeneity guard
- If one pending burst accumulates too many unrelated categories, split it
- Count alone should not decide boundaries, but it should act as a safety brake

### Proposed future implementation shape

Instead of only comparing “latest autosave vs next autosave”, maintain a small pending burst model that tracks:
- burst start time
- last edit time
- touched domains
- touched object keys
- optional dominant domain
- optional dominant object cluster

Then decide on each autosave:
- extend the current burst
- or flush and start a new burst

### Proposed future domain set

The profiler should eventually understand at least:
- project title
- publish metadata
- scenes 
- scene metadata
- entities
- groups
- triggers
- collision rules
- attachments
- event blocks
- behaviors/actions/conditions
- input maps
- counters
- patterns
- collections
- audio assets
- music
- ambience
- image assets
- spritesheets
- fonts

### Proposed future split rules

Start a new row when:
- the dominant domain changes materially
- the dominant object cluster changes materially
- a milestone operation occurs
- the burst becomes too heterogeneous
- the burst exceeds a time budget

Keep in the same row when:
- the user is still editing the same object
- the user is still editing the same subsystem
- the changes are clearly part of one setup flow
- the changes are sequential refinements of the same thing

### Example: should stay together

- add audio asset
- assign it as scene music
- tweak loop/volume

This is one coherent music setup burst.

### Example: should split

- add audio asset
- assign scene music
- edit publish title
- rename project

This is not one coherent burst even if it happened close together.

## Recommended next step if current heuristic proves inadequate

If history rows still feel too broad or too arbitrary, the next improvement should be:

1. Introduce a dedicated pending revision-burst model instead of only pairwise autosave coalescing
2. Expand the tracked domain/object profiler
3. Add explicit milestone boundaries from editor actions, not just from diff inspection
4. Add tests for:
- same-object refinement stays together
- same-subsystem setup stays together
- cross-domain switching splits
- burst heterogeneity forces split
- milestone actions always split

## Current status

As of 2026-06-21:
- summary quality is materially improved
- autosave grouping is better than pure save-by-save rows
- but revision formation is still heuristic and partial

This document should be the place to revisit if history rows still feel incoherent in real editing sessions.
