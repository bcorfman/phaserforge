# Project History Archive Workflow Proposal

Date: 2026-07-03

Related mockups:
- `.plans/mockups/project-history-archive-first-2026-07-03.svg`
- `.plans/mockups/project-history-archived-view-2026-07-03.svg`

## Goal

Reduce clutter in the visible Project History list while staying close to the current History revisions UX.

This proposal intentionally avoids introducing a new admin-style surface or a new visual language for history rows.

It does introduce a bulk-archive path, because archiving one row at a time is not sufficient for the actual cleanup use case.

## UX constraint

The proposal should feel like an extension of the current `Project Revisions` pane:

- same `Project Tree -> Manage -> History` entry
- same `PROJECT REVISIONS` pane framing
- same `Past 7 / 14 / 30` compact filter controls
- same revision card pattern
  - row button previews the revision
  - teaser/details expansion remains the same
  - action buttons stay on the card
- same dialog style already used for restore/copy/retention prompts

## Recommendation

Use a two-state model inside the existing History pane:

1. Main History
   - shows the current visible revision narrative
   - keeps existing `Restore...` and `Copy...`
   - uses a pane-level `Archive...` action as the cleanup entrypoint
   - does not expose permanent delete

2. Archived History
   - is a sibling state of the same pane, not a separate product area
   - renders archived rows using the same revision card pattern
   - keeps `Restore...` and `Copy...`
   - adds `Delete...` only here

## Why this is the better fit

The previous draft drifted too far from the current UX because it introduced:

- selection mode
- bulk-first cleanup controls
- a more “management console” feeling

That is not how the current history pane behaves today.

The tighter fit is:

- same card layout
- one additional pane state
- one explicit archive-selection mode inside the same pane
- dialogs that look like the ones already in the sidebar/history flows

## Proposed workflows

### Workflow A: Archive from the main History list

Primary path:

1. Open `Project Tree -> Manage -> History`
2. Click `Archive…`
3. Select one or more visible revision rows
4. Click `Archive Selected`
5. Confirm in an archive dialog

Result:

- the selected revisions disappear from the default visible History list
- they become available in Archived History
- the main list gets less noisy without destroying recoverability

### Workflow B: Switch to Archived History

Primary path:

1. Open `Project Tree -> Manage -> History`
2. Click `Archived`

Result:

- the same pane switches from active-history rows to archived-history rows
- the same card design remains in place
- the user stays inside the same mental model and layout

### Workflow C: Delete from Archived History

Primary path:

1. Open `Archived` inside the History pane
2. Use the same archive-selection pattern if deleting several rows, or `Delete...` on a single row
3. Confirm in a permanent delete dialog

Result:

- destructive cleanup remains possible
- but only after the user intentionally entered the archived state

## Proposed UI changes

### Main History pane

Keep:

- back button
- `PROJECT REVISIONS` title
- `Past 7 / 14 / 30` filters
- revision card layout
- row click to preview
- teaser/details expansion
- `Restore...`
- `Copy...`

Add:

- compact `Archived` switch near the existing date filters
- compact `Archive…` entry action that switches the pane into archive-selection mode
- archive-selection affordance on each visible revision card
- sticky footer actions while archive-selection mode is active:
  - `Cancel`
  - `Archive Selected`

Do not add:

- per-row archive buttons on the main list
- inline delete on the main list
- a separate archive-management toolbar

### Archived History pane state

Keep:

- same pane shell
- same revision card design
- same row preview affordance
- same detail teaser/expansion pattern

Change:

- title or sublabel clarifies the archived state
- card actions become `Restore...`, `Copy...`, `Delete...`
- archived bulk maintenance may reuse the same selection-mode pattern when needed

## Proposed labels

Main History:

- `Archived`
- `Archive…`
- `Archive Selected`
- `Keep in History`
- `Cancel`

Archived History:

- `Back to History`
- `Restore...`
- `Copy...`
- `Delete...`
- `Delete Permanently`

Avoid in the main list:

- `Delete`
- `Remove`
- `Clear`

## Dialog behavior

### Archive dialog

Tone:

- thoughtful but not severe

Suggested message shape:

- “Archive this revision from the main History list?”
- “The selected revisions will still be available in Archived History for restore or copy.”

Actions:

- `Cancel`
- `Archive`

### Delete dialog

Tone:

- explicit and irreversible

Suggested message shape:

- “Delete this archived revision permanently?”
- “This cannot be undone.”
- “Restore or Copy are safer if you are unsure.”

Actions:

- `Cancel`
- `Restore Instead` optional if desired
- `Delete Permanently`

## Relationship to current retention

This proposal complements the existing retention dialog rather than replacing it.

Current retention behavior already handles:

- stale revisions by age
- archive/delete decisions at History entry time

This proposal adds:

- user-driven archive for clutter reduction on still-visible rows
- a concrete archived-state UI for rows that were archived intentionally or by retention flows

## Data/behavior expectations

Archive should:

- remove the selected rows from default visible History
- preserve restore/copy behavior
- preserve summary/detail semantics
- preserve grouping semantics for grouped revisions

Delete should:

- only be reachable from Archived History
- remove the archived row from storage and recovery paths
- avoid dangling revision/event references

## Tests to prefer

Unit/integration:

- entering archive-selection mode does not change the normal row-preview behavior until a row is explicitly toggled for selection
- archiving visible rows removes them from main History visibility
- archived rows appear in the archived History view model
- archived rows still support restore/copy
- delete is not exposed in main History view model
- delete removes archived rows only after confirmation
- grouped rows can be archived in one action without breaking event/revision linkage

E2E:

- main History shows archive-selection mode and not delete
- multiple visible rows can be archived in one pass
- switching to `Archived` keeps the same pane feel and shows archived rows
- archived rows can be restored/copied
- delete is available only in Archived History

## Bottom line

The best fit for the current UX is not a new cleanup system.

It is a minimal extension of the existing revision-card workflow:

- `Archive…` enters a same-pane selection mode for bulk cleanup
- `Archived` as a sibling pane state
- `Delete...` only on archived cards

That accommodates the real bulk-archive use case without turning the history pane into a one-off GUI.
