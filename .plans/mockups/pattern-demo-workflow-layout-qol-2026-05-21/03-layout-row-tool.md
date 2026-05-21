# Mockup 3 — “Row / Grid Tool”: distribute + center + set Y in one flow

Targets workflow: **W1 — Basic Scene Layout (blocking + spacing)**

## Problems addressed
- Users want a *row* operation: “make these a neat centered row at Y=…”
- Today it’s spread across: drag/nudge + Layout… distribute + separate align steps.

## Proposal
Add a focused on-canvas tool reachable from the selection bar:

`Layout…` → **Row / Grid…** (new)

It’s a small popover that combines:
- **Row Y** (direct numeric set)
- **Row center X** (target value or “world center”)
- **Distribution** (even spacing, optionally with fixed spacing)

### UI sketch (Row / Grid popover)

```
Row / Grid
────────────────────────────
Row (selection ≥ 2)
  Y: [ 450 ]  [ Set ]
  Center X: (•) World (400)
            ( ) Value: [ 400 ]
  Spacing X:
    (•) Evenly distribute across current span
    ( ) Fixed: [ 150 ] px

  [ Apply Row ]   [ Apply + Close ]
```

## How it improves Item 3 (pattern demo)

### Top/bottom row placement, centered and evenly spaced
- Select 4 ships →
  - **Row / Grid…**
  - `Y = 450`
  - `Center X = World`
  - `Spacing X = Evenly distribute across current span`
  - `Apply Row`

If the goal is exact Arcade X’s, users can still nudge a single ship or type fixed spacing, but the *primary* workflow becomes: “row tool → apply”.

## Notes / behavior details
- “Evenly distribute across current span” preserves the row’s current approximate width; “Center X” then recenters that span.
- If users want deterministic placement from scratch, “Fixed spacing” + “Center X = World” yields a predictable layout (especially for 3/4 items).
- This is a *task-specific* wrapper around existing align/distribute primitives, so it stays conceptually simple for pattern-demo style authoring.

