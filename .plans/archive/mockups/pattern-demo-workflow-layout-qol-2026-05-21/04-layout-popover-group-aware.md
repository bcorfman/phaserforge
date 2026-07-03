# Mockup 4 — Redesign `Layout…`: group-aware + non-destructive by default

Goal: make `Layout…` intuitive for multi-select by ensuring operations are **mutually exclusive where needed** and **additive where expected** (e.g., “space evenly, then align the row as a group” should not collapse items).

Targets workflow: **W1 — Basic Scene Layout (blocking + spacing)**

## SVG
- `./04-layout-popover-group-aware.svg`

## Core principle
For multi-select (2+):

- **Positioning** operations act on the *selection as a whole* (selection bounds), preserving internal spacing.
- **Arrangement** operations act on the *items inside* the selection, changing relative spacing/order.
- “Stacking / overlap” is a separate, explicitly named operation (rare on purpose).

This prevents the common pitfall:
> Distribute X → Align Center Y (items collapse to same Y / undo spacing)

Instead, the default meaning becomes:
> Distribute X (arrange items) → Align Center Y (move the arranged row as a group)

## Proposed UI shape
Single `Layout…` popover, split into two clearly-labeled sections that communicate scope:

```
Layout
────────────────────────────────
Arrange Items (changes spacing)
  X: [ Distribute Evenly ]
  X: [ Fixed Spacing: 200 ] [ Apply ]
  Y: [ Distribute Evenly ]
  Y: [ Fixed Spacing: 120 ] [ Apply ]

Position Selection (moves group; preserves spacing)
  Set:
    X: [ 400 ] [ Set ]
    Y: [ 450 ] [ Set ]
    [ Set X+Y ]
  Align:
    X: [ Left ] [ Center ] [ Right ]
    Y: [ Top ]  [ Center ] [ Bottom ]

Advanced (rare)
  [ Stack X Centers ]  [ Stack Y Centers ]
  [ Match Left Edges ] [ Match Top Edges ]
```

### The key copy change
- “Align” becomes **Align Selection**, not “Align Items”.
- “Distribute” becomes **Arrange Items** (explicitly changes spacing).

## Behavior rules (intuitive defaults)

### 1) Multi-select Align does not stack items
For selection size ≥ 2:
- `Align X Left/Center/Right` moves the *selection bounds* to the target, **preserving each item’s relative X offset**.
- `Align Y Top/Center/Bottom` moves the *selection bounds* to the target, **preserving each item’s relative Y offset**.

Stacking is only possible via **Advanced → Stack…**.

### 2) Single selection still behaves as expected
For selection size = 1:
- `Align` effectively sets that single entity’s X/Y (no difference between “item” vs “selection”).
- The UI can remain identical; it just feels natural.

### 3) “Arrange Items” never moves the selection center unless asked
Distribute/spacing operates around the current selection bounds:
- Default “Distribute Evenly” uses current min/max extents along that axis.
- The selection’s center stays where it is unless the user uses `Position Selection`.

### 4) Order is deterministic and visible
Distribute uses a stable order (e.g., current X sort ascending for X distribution).
- Optional tiny affordance: “Order: X→ (left→right)” (read-only label, not a new control).

## How this fixes the pattern-demo pain points

### Center distributed sprites
1) Select ships
2) `Arrange Items → X: Distribute Evenly`
3) `Position Selection → Align X: Center` (to world center, or via `Set X=400`)

No accidental collapse because Align no longer modifies relative item positions.

### Directly set Y
- `Position Selection → Set Y = 450 → Set`

## Optional: target selection-space vs world-space
If you want world centering to be obvious without extra controls:
- The “Align X Center” button can have a small caption: “to World” (since world is the only meaningful global reference in this editor).
- Alternatively, `Set X` is the explicit path for non-world anchors.
