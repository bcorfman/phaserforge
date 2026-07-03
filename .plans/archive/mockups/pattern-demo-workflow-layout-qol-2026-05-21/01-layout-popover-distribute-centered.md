# Mockup 1 — Layout popover: “Distribute X (Centered)” + “Set Y…”

Targets workflow: **W1 — Basic Scene Layout (blocking + spacing)**

## Problems addressed
- Distribute X can space evenly, but can’t also **center** the resulting row.
- There’s no simple **direct set** for Y; users drag/nudge and watch the HUD.

## Proposal
Extend the existing **Layout…** popover (selection bar) with:

1) **Distribute X** that supports a **center target** (or bounding width)
2) A lightweight **Set Position** control for `X` / `Y`

### UI sketch (Layout popover)

```
Layout
────────────────────────────
Align
  [ Center X ]  [ Center Y ]
  [ Left ]      [ Right ]
  [ Top ]       [ Bottom ]

Distribute
  X: [ Distribute ]  (existing)
  X: [ Distribute Centered ▾ ]   (new)
     Mode:
       (•) Around center X: [ 400 ]  [ Use selection center ]
       ( ) Within width:    [ 500 ]  px  [ Use selection width ]

Spacing
  X spacing: [ 200 ] px  [ Apply ]

Set Position (new)
  X: [ 400 ] [ Set ]
  Y: [ 450 ] [ Set ]
  [ Set X+Y ] (applies both if filled)
```

## How it improves Item 3 (pattern demo)

### Top/bottom row placement
- Select 4 ships → **Layout… → Set Position → Y = 450 → Set**
  - No dragging/nudging needed.

### Even spacing + centering
- With the same 4 ships still selected:
  - **Distribute → X → Distribute Centered**
  - Choose `Around center X = 400` (world center in an 800-wide scene)
  - Result: evenly spaced + centered as a row.

## Notes / behavior details
- For “Distribute Centered”, spacing is derived automatically from the current left-to-right order and the chosen mode.
- If selection has 0–2 entities, the centered-distribute control is disabled (or no-op) with helper text.
- “Use selection center” is helpful when users first roughly place the row, then want “even spacing but keep it centered where I put it”.

