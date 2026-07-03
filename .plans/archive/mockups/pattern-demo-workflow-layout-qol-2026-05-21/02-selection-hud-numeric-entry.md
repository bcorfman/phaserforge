# Mockup 2 — Selection HUD: inline numeric X/Y during drag + “Set Y”

Targets workflow: **W1 — Basic Scene Layout (blocking + spacing)**

## Problems addressed
- The drag HUD is read-only; you can’t “just type Y=450”.
- When you stop moving (but keep mouse down), the HUD can be hard to use as a reference.

## Proposal
Upgrade the near-cursor selection HUD into a small **read/edit** widget while dragging (and while mouse is down).

### UI sketch (near the selection, not in a side pane)

```
┌──────────────────────────┐
│ Selection (4)            │
│ X:  150   Y: 450         │
│ [Type…]  [Set Y]         │
│ Distribute X: [Apply]    │
└──────────────────────────┘
```

### Interaction
- When dragging a selection:
  - HUD shows **current center** of the selection (or “primary” entity) as today.
  - Clicking `X` or `Y` turns that field into an input.
  - `Enter` applies immediately (while still holding mouse, or after release).
  - `Esc` cancels edit.
- Quick action buttons:
  - **Set Y**: focuses `Y` and preselects the value (fast type-over).
  - **Distribute X**: one-click applies even spacing to the current selection order.

## How it improves Item 3 (pattern demo)

### Direct Y set while dragging
- Select 4 ships → start dragging roughly to the bottom half →
  - Click `Y` in HUD → type `450` → `Enter`

### Even spacing then center
Add a one-step “Center row” affordance next to Distribute (either here or in Layout…):

```
Distribute X: [Apply]  [Center Row]
```

Where “Center Row” recenters the *current selection bounds* to world center (or exposes a small `X=` target).

## Notes / behavior details
- For multi-select, define displayed/edited position as:
  - `X/Y` = selection bounding box center (predictable for “row centering”).
- This avoids a “second place” UI: it keeps the workflow on-canvas, near the cursor, during the exact moment the user is positioning.

