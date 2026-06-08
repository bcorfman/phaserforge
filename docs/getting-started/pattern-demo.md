# Pattern Demo

This walkthrough recreates the `pattern_demo` scene in PhaserForge. It assumes you already completed [Cloud Account Setup](./cloud-account-setup) and are continuing in the normal signed-in path. It is the recommended first exercise because it touches the main editor loop without requiring custom code.

## What You Will Build

- seven ship sprites arranged in two rows
- a text label above each ship
- one movement pattern attached to each ship
- a project that is ready for the GitHub Pages publish workflow in the next guide

## Before You Start

- Open PhaserForge and sign in if needed.
- If you are continuing from older work, reset to a new empty scene from `Project -> Startup & Reset`.
- Stay in the same signed-in project flow you established during cloud account setup.
- Set the scene world size to `800 x 600` before you begin placing ships.

Success check:
- The canvas is empty and the scene graph does not show leftover sprites or formations.

## 1. Import the Ship Asset and Create the Sprites

Use the Assets Dock on the left side to import one ship image, then drag it to the canvas to create the first sprite. If you are following the original demo closely, use `res/images/ship_sidesA.png`.

![Assets dock close-up](../assets/screenshots/playwright/entity-list-scene-scope.png)

<p align="center"><em>Figure 4. Assets Dock close-up for importing the ship image.</em></p>

After the first sprite exists, duplicate it until you have seven ships total. Alt-drag is the fastest option, but any duplicate command is fine.

If the imported ship looks too large on the canvas, reduce its `Scale X` and `Scale Y` to `0.5` in the Inspector before you duplicate it.

Name the seven ships:

1. `Wave`
2. `Zigzag`
3. `Figure-8`
4. `Orbit`
5. `Spiral`
6. `Bounce`
7. `Patrol`

Rename the sprites in the scene graph as you go so the later pattern steps are easier to follow.

Success check:
- You can see seven separate sprite entities in the scene graph.
- Their names match the list above.

## 2. Position the Ships with Selection Tools and Layout

Rough-place the ships first, then use `Layout…` to clean up spacing. The pattern demo uses two rows:

- top row at `y = 200`: `Spiral`, `Bounce`, `Patrol`
- bottom row at `y = 450`: `Wave`, `Zigzag`, `Figure-8`, `Orbit`

For the top row, select the three ships and use `Layout…` to:

- apply `Spacing X = 200`
- set `Y = 200`
- center the row on the world center

For the bottom row, select all four ships and use `Layout…` to set `Y = 450`, then fine-tune the X positions manually to match the demo. The bottom row is not evenly spaced, so do not use one spacing value for all four. Use Figure 5 to orient yourself to the on-canvas selection bar, then Figure 6 for the layout popover itself.

![Selection bar close-up](../assets/screenshots/playwright/canvas-selection-bar.png)

<p align="center"><em>Figure 5. On-canvas selection bar for multi-selection actions.</em></p>

![Layout popover close-up](../assets/screenshots/playwright/layout-popover.png)

<p align="center"><em>Figure 6. Layout popover for spacing and set-position operations.</em></p>

Exact ship centers for the demo:

- `Wave`: `x = 150`, `y = 450`
- `Zigzag`: `x = 300`, `y = 450`
- `Figure-8`: `x = 500`, `y = 450`
- `Orbit`: `x = 650`, `y = 450`
- `Spiral`: `x = 200`, `y = 200`
- `Bounce`: `x = 400`, `y = 200`
- `Patrol`: `x = 600`, `y = 200`

Success check:
- The three top-row ships are equally spaced and sit on the same baseline.
- The four bottom-row ships sit on the same baseline and match the listed X positions.

## 3. Add the Text Labels

Create one text entity, then edit its content and styling in the Inspector. After the first label looks right, duplicate it and move each copy above the correct ship.

Recommended baseline settings:

- content: ship name
- anchor: `center`
- color: `#FFFFFF`
- font: choose a font asset if you imported one, or set a font-family override
- position: `x = ship.x`, `y = ship.y - 80`

Success check:
- Each ship has one readable label above it.
- Labels stay visually aligned with the ships in Edit mode.

## 4. Attach the Movement Patterns

Select each ship, open `Actions/Events`, and attach the movement pattern that matches its name. Build the patterns one ship at a time in the same scene-start event flow.

This is the slowest step of the tutorial. Work ship by ship rather than trying to author all seven flows at once.

Figure 7 shows the `Actions/Events` panel state you should be working in while building each ship’s handler.

![Actions and events panel](../assets/screenshots/playwright/actions-events-panel.png)

<p align="center"><em>Figure 7. Actions/Events panel for authoring scene-start handlers and action steps.</em></p>

### 4a. Common Setup for Every Ship

For each ship:

1. select the ship on the canvas or in the scene graph
2. open `Actions/Events`
3. create or open that ship's `Scene Start` handler
4. add the action steps described in the matching subsection below

### 4b. Loop Templates You Will Reuse

You will use two loop templates repeatedly in this section:

1. `Intro then Repeat…`
   Use this when the first motion pass needs different values from the repeating loop.
2. `Repeat with Children…`
   Use this when a loop should contain one or more child pattern steps.

When you use `Repeat with Children…`:

1. choose the number of children
2. choose the child type
3. leave `Count` blank if you want the pattern to repeat forever

### 4c. Wave

Use the loop templates so you do not have to hand-build the nesting:

1. click `+ Add…`
2. choose `Loops`
3. choose `Intro then Repeat…`
4. set the intro step to `Wave`
5. set the repeat step to `Wave`

Set the intro `Wave` step to:

- `amplitude = 30`
- `length = 80`
- `velocity = 80`
- `startProgress = 0.75`
- `endProgress = 1`

Set the repeating `Wave` step to:

- `amplitude = 30`
- `length = 80`
- `velocity = 80`
- `startProgress = 0`
- `endProgress = 1`

Figure 8 shows the `Wave` pattern inspector with the progress fields that are easiest to misread when entering the intro step values.

![Wave pattern inspector](../assets/screenshots/playwright/wave-pattern-panel.png)

<p align="center"><em>Figure 8. Wave pattern inspector with intro-step progress parameters.</em></p>

### 4d. Zigzag

1. click `+ Add…`
2. choose `Loops`
3. choose `Repeat with Children…`
4. set `Children = 2`
5. set `Child Type = Zigzag Pattern`
6. leave the repeat `Count` blank so it repeats forever
7. add a `Move By` step before the repeat container

Set `Move By` to:

- `dx = -15`
- `dy = -30`

Set the first `Zigzag Pattern` child to:

- `width = 30`
- `height = -15`
- `velocity = 100`
- `segments = 5`

Set the second `Zigzag Pattern` child to:

- `width = -30`
- `height = 15`
- `velocity = 100`
- `segments = 5`

### 4e. Figure-8

1. add `Repeat with Children…`
2. set `Children = 1`
3. choose `Figure-8 Pattern`
4. leave the repeat `Count` blank

Set the `Figure-8 Pattern` child to:

- `width = 80`
- `height = 60`
- `velocity = 100`

### 4f. Orbit

Add a `Move To` step before the repeat so the ship starts on the orbit path.

Set `Move To` to:

- `x = 700`
- `y = 450`

Then:

1. add `Repeat with Children…`
2. set `Children = 1`
3. choose `Orbit Pattern`
4. leave the repeat `Count` blank

Set the `Orbit Pattern` child to:

- `radius = 50`
- `velocity = 100`
- `clockwise = true`
- `centerMode = home`

### 4g. Spiral

1. add `Repeat with Children…`
2. set `Children = 2`
3. choose `Spiral Pattern`
4. leave the repeat `Count` blank

Set the first `Spiral Pattern` child to:

- `maxRadius = 60`
- `revolutions = 2`
- `velocity = 80`
- `direction = outward`

Set the second `Spiral Pattern` child to:

- `maxRadius = 60`
- `revolutions = 2`
- `velocity = 80`
- `direction = inward`

### 4h. Bounce

Add a `Bounce Pattern` step and set:

- `axis = both`
- `velocityX = 100`
- `velocityY = 60`

Then open the separate `Bounds` panel for the same ship and configure it:

1. confirm `BoundsHit` is enabled
2. switch `Bounds` edit mode to `Center/Span`
3. use the prefilled center values for the selected ship
4. set `± X Span = 50`
5. set `± Y Span = 60`

Figure 9 shows the `Bounce` pattern and its sibling `Bounds` panel in `Center/Span` mode.

![Bounce bounds panel](../assets/screenshots/playwright/bounce-bounds-panel.png)

<p align="center"><em>Figure 9. Bounce pattern with the bounds helper in Center/Span mode.</em></p>

### 4i. Patrol

Add a `Patrol Pattern` step and set:

- `axis = x`
- `velocityX = 80`

Then open the separate `Bounds` panel for the same ship and configure it:

1. confirm `BoundsHit` is enabled
2. switch `Bounds` edit mode to `Center/Span`
3. use the prefilled center values for the selected ship
4. set `± X Span = 40`
5. set `± Y Span = 0`
7. switch back to `Min/Max`
8. set `minY = 400`
9. set `maxY = 500`

Figure 10 shows the `Patrol` pattern after switching back to `Min/Max` so you can enter the final Y bounds.

![Patrol bounds panel](../assets/screenshots/playwright/patrol-bounds-panel.png)

<p align="center"><em>Figure 10. Patrol pattern with the final bounds values visible in Min/Max mode.</em></p>

Practical order if you want the shortest learning path:

1. Finish `Wave`, `Figure-8`, and `Spiral` first because they are the most direct.
2. Add `Zigzag` and `Orbit` next because they need setup steps before the repeating motion.
3. Finish with `Bounce` and `Patrol` because they also need bounds configuration.

Success check:
- Every ship shows a handler/action flow in the editor.
- `Bounce` and `Patrol` have their bounds configured, not just the pattern action itself.

## 5. Run the Demo in Play Mode

Toggle into Play mode with `Tab` or the toolbar button, and let the scene run long enough to verify all seven motions. Figure 11 shows the relevant toolbar area.

![Toolbar close-up](../assets/screenshots/playwright/toolbar-theme-and-scale.png)

<p align="center"><em>Figure 11. Toolbar region with Play/Edit toggle and status controls.</em></p>

Look for these outcomes:

- all seven ships animate simultaneously
- labels remain static
- no ship leaves the scene unexpectedly
- `Bounce` and `Patrol` stay inside their intended travel areas

If a ship is motionless, go back to its handler and confirm the action flow exists and that the pattern settings were applied to the correct ship.

Success check:
- The scene behaves like a motion sampler rather than a static layout.

## 6. Optional Backup: Save YAML

Use the YAML save controls in the view bar if you want an explicit backup or export of the project. This is optional and not required for the normal publish flow. Figure 12 shows the relevant controls.

![YAML controls close-up](../assets/screenshots/playwright/yaml-controls-save.png)

<p align="center"><em>Figure 12. Viewbar YAML controls for optional export/backup.</em></p>

Success check:
- If you chose to export YAML, you have a saved `.yaml` file for the project.
- Whether or not you exported YAML, the project is ready to continue to publish.

## What to Do Next

Continue to [Publish to GitHub Pages](./publish-to-github-pages) to turn the saved demo into a hosted playable page.
