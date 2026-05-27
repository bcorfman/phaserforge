# Studio workflow: attempt to recreate `stars.py` (ArcadeActions starfield) — current blockers

Reference: `/home/bcorfman/dev/arcadeactions/examples/stars.py`

This document is written in the same “do-this-in-Studio” style as `.plans/pattern_demo_workflow.md`, but `stars.py` cannot currently be duplicated faithfully in Studio without missing/extra product capabilities (listed in **Why this can’t be duplicated (yet)**).

## Target behavior (what `stars.py` does)

- Scene size: `W=720`, `H=1280` with a solid black background.
- ~`400` tiny square “star” sprites:
  - Spawned at random `x∈[0..W]`, `y∈[0..H]` (with a small vertical margin).
  - Each star has a random bright-ish color.
- 5 blinking groups with different blink rates (~0.2s → ~0.4s).
- A repeating velocity “phase loop” affecting *all* stars’ vertical speed:
  - 1s stopped → 2s accelerate down (ease-in) → 5s hold down speed
  - 0.5s accelerate up (ease-out) → 1.5s hold up speed
  - 2s ease back to stopped → repeat forever
- When a star wraps vertically, it re-enters on the opposite side *with a new random X* (to avoid vertical columns).

## What you can build in Studio today (approximation)

If you are willing to accept visible differences vs `stars.py`, you can approximate a “starfield” as follows.

### 1. Start a new project/scene

- Set Startup to New Empty Scene (or otherwise reset to an empty scene).
- Set Scene World Size to `W=720`, `H=1280`.
- Set scene background color to black.

### 2. Create/import a star sprite asset

Studio currently can’t create `SpriteSolidColor` programmatically the way Arcade does, so you’ll need an asset.

- Import a tiny square image (e.g. `3x3` or `4x4`) as a sprite asset.
  - Use white by default (you won’t be able to randomize per-star tint yet).

### 3. Create “star” entities (manual placement only)

- Drag the star sprite onto the canvas to create a `Star` entity.
- Duplicate it many times (Alt+Drag / Duplicate in Entity List).
- Roughly distribute the stars across the full world.

Optional organization (recommended if you do this manually):

- Put stars into 5 groups (e.g. `StarsBlink1` … `StarsBlink5`) so you can apply different blink rates.

### 4. Add blinking (per group)

For each blink group:

- Select the group and attach **Blink Until**.
- Set **Seconds Until Change** to values spanning ~`0.2` to `0.4` seconds (example: `0.20`, `0.25`, `0.30`, `0.35`, `0.40`).
- Leave “Stop After” disabled (infinite blinking).

### 5. Add movement with wrapping (per group)

For each star group:

- Attach **Move Until**.
- Set `Velocity X = 0`.
- Set `Velocity Y` to a constant speed (pick either downward or upward).
- Enable **Bounds** and set:
  - Behavior: **Wrap**
  - Bounds to the full world (optionally add a small ±Y margin).

This yields a continuous scrolling starfield with wrap, but:

- Stars will wrap keeping their original X (creating “columns” over time).
- Speed won’t follow the phase/tween schedule from `stars.py`.

### 6. (Now possible) Add a smooth “velocity phase loop” using Tween Until (optional)

Studio now has **Tween Until**, which can animate a numeric property (including `vy`) with easing.

To make the starfield speed ramp up/down smoothly, you can run two attachments in parallel on the same target:

- Attachment A (runs forever): **Move Until** with **Bounds → Wrap** enabled
  - Set `Velocity X = 0`, `Velocity Y = 0`
  - Bounds Behavior: **Wrap**
  - This attachment is responsible for translating entities every update tick (it reads `vx/vy` each frame).
- Attachment B (loops forever): **Repeat** wrapping a sequence of **Tween Until** + **Wait** steps that updates `vy`
  - Use **Tween Until** with:
    - Property: `vy`
    - From: `Current value`
    - Duration: set per phase
    - Easing: `easeIn` / `easeOut` / `easeInOut` / `linear`

Note: you still won’t match `stars.py` perfectly until you can respawn with a new random X on wrap, but the easing/phase feel can now be reproduced without scripting.

## Why this can’t be duplicated (yet)

`stars.py` still relies on capabilities that Studio does not currently expose as authorable workflow steps:

1. **Per-instance randomization (color + wrap respawn X)**
   - `stars.py` assigns each star a random RGB color at creation time.
   - On vertical wrap, it repositions the star to the opposite edge *and picks a new random X*.
   - Studio’s **Bounds → Wrap** behavior wraps deterministically (no “on wrap” hook/callback to randomize X).
 
Because of (1), even a manual “400 stars” setup will still diverge visually from `stars.py` (especially the lack of random X re-roll on wrap, and lack of per-star random tint).

## Minimal product additions that would make a faithful workflow possible

If/when these exist, a Studio workflow for `stars.py` becomes straightforward:

- A “Scatter / Randomize Placement” authoring tool (randomize selected entities inside bounds, with seed + distribution options).
- A per-entity RNG helper usable in steps (random float/int, random color, etc.).
- A “Callback / On Bounds Wrap” hook (or “Move Until: wrap callback”) to re-seed X on vertical wrap.
