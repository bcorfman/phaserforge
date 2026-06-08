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

Success check:
- The canvas is empty and the scene graph does not show leftover sprites or formations.

## 1. Import the Ship Asset and Create the Sprites

Use the Assets Dock on the left side to import one ship image, then drag it to the canvas to create the first sprite. If you are following the original demo closely, use `res/images/ship_sidesA.png`.

![Assets dock close-up](../assets/screenshots/playwright/entity-list-scene-scope.png)

<p align="center"><em>Figure 4. Assets Dock close-up for importing the ship image.</em></p>

After the first sprite exists, duplicate it until you have seven ships total. Alt-drag is the fastest option, but any duplicate command is fine.

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

For the bottom row, set the whole row to `Y = 450`, then fine-tune the X positions manually to match the demo. Use Figure 5 to orient yourself to the on-canvas selection bar, then Figure 6 for the layout popover itself.

![Selection bar close-up](../assets/screenshots/playwright/canvas-selection-bar.png)

<p align="center"><em>Figure 5. On-canvas selection bar for multi-selection actions.</em></p>

![Layout popover close-up](../assets/screenshots/playwright/layout-popover.png)

<p align="center"><em>Figure 6. Layout popover for spacing and set-position operations.</em></p>

Exact sprite centers for the demo:

- `Wave`: `x=150`, `y=450`
- `Zigzag`: `x=300`, `y=450`
- `Figure-8`: `x=500`, `y=450`
- `Orbit`: `x=650`, `y=450`
- `Spiral`: `x=200`, `y=200`
- `Bounce`: `x=400`, `y=200`
- `Patrol`: `x=600`, `y=200`

Success check:
- The three top-row ships form an even row.
- The four bottom-row ships sit on the same baseline.

## 3. Add the Text Labels

Create one text entity, then edit its content and styling in the Inspector. After the first label looks right, duplicate it and move each copy above the correct ship.

Recommended baseline settings:

- content: ship name
- anchor: `center`
- color: `#FFFFFF`
- position: `x = ship.x`, `y = ship.y - 80`

Success check:
- Each ship has one readable label above it.
- Labels stay visually aligned with the ships in Edit mode.

## 4. Attach the Movement Patterns

Select each ship, open `Actions/Events`, and attach the movement pattern that matches its name.

The pattern demo uses scene-start handlers and these mappings:

- `Wave` -> Wave pattern
- `Zigzag` -> Zigzag pattern
- `Figure-8` -> Figure-8 pattern
- `Orbit` -> Orbit pattern
- `Spiral` -> Spiral pattern
- `Bounce` -> Bounce pattern with bounds
- `Patrol` -> Patrol pattern with bounds

This is the slowest step of the tutorial. Work ship by ship rather than trying to author all seven flows at once.

Figure 7 shows the `Actions/Events` panel state you should be working in while building each ship’s handler.

![Actions and events panel](../assets/screenshots/playwright/actions-events-panel.png)

<p align="center"><em>Figure 7. Actions/Events panel for authoring scene-start handlers and action steps.</em></p>

Practical order:

1. Finish `Wave`, `Figure-8`, and `Spiral` first because they are the most direct.
2. Add `Zigzag` and `Orbit` next because they need setup steps before the repeating motion.
3. Finish with `Bounce` and `Patrol` because they also need bounds configuration.

Success check:
- Every ship shows a handler/action flow in the editor.
- `Bounce` and `Patrol` have their bounds configured, not just the pattern action itself.

## 5. Run the Demo in Play Mode

Toggle into Play mode with `Tab` or the toolbar button, and let the scene run long enough to verify all seven motions. Figure 8 shows the relevant toolbar area.

![Toolbar close-up](../assets/screenshots/playwright/toolbar-theme-and-scale.png)

<p align="center"><em>Figure 8. Toolbar region with Play/Edit toggle and status controls.</em></p>

Look for these outcomes:

- all seven ships animate simultaneously
- labels remain static
- no ship leaves the scene unexpectedly
- `Bounce` and `Patrol` stay inside their intended travel areas

If a ship is motionless, go back to its handler and confirm the action flow exists and that the pattern settings were applied to the correct ship.

Success check:
- The scene behaves like a motion sampler rather than a static layout.

## 6. Optional Backup: Save YAML

Use the YAML save controls in the view bar if you want an explicit backup or export of the project. This is optional and not required for the normal publish flow. Figure 9 shows the relevant controls.

![YAML controls close-up](../assets/screenshots/playwright/yaml-controls-save.png)

<p align="center"><em>Figure 9. Viewbar YAML controls for optional export/backup.</em></p>

Success check:
- If you chose to export YAML, you have a saved `.yaml` file for the project.
- Whether or not you exported YAML, the project is ready to continue to publish.

## What to Do Next

Continue to [Publish to GitHub Pages](./publish-to-github-pages) to turn the saved demo into a hosted playable page.
