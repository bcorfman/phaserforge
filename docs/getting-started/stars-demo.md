# Stars Demo

This walkthrough creates a starfield demo in PhaserForge. It uses five Scatter formations, independent blinking, a shared movement cycle, and a typed Bounds event that rerolls each wrapped star's X position.

It assumes you already completed [Cloud Account Setup](./cloud-account-setup) and are continuing in the normal signed-in path.

## What You Will Build

- a `720 x 1280` scene with a solid black background
- one imported `3 x 3` white star image
- five formations of 80 stars each, for 400 authored stars total
- deterministic random placement and bright random RGB tint for every star
- blink periods of `200`, `250`, `300`, `350`, and `400` ms
- a repeating vertical velocity cycle matching `stars.py`
- vertical wrapping with a new random X position for each wrapped star

## Before You Start

- Open PhaserForge and sign in if needed.
- If you have other work going, reset to a new empty scene from the Project Tree: click `Manage -> Create New`.
- Open `Manage -> Project Settings...` and leave `Pixels per Unit` at `2`, then click `Save` or `Cancel`.
- Set the scene world size to `720 x 1280`. Use `Fit` to recenter the viewport.

Success check:

- The canvas is empty.
- The World Size fields show `720` by `1280`.

## Set the Scene Appearance

1. Click an empty part of the canvas so the scene itself is selected.
2. In the Inspector, open `Scene Appearance`.
3. Set `Background` or `Hex` to `#000000`.

Success check: the canvas background is black and the Inspector summary reads `#000000`.

## Import the Star Image

The formation workflow needs an image asset to use as its template. Use a white `3 x 3` PNG. You can create one outside PhaserForge, or use an existing white 3 x 3 image.

1. In the Assets Dock, click `+ Add`.
2. Choose `From device...` and select the white `3 x 3` PNG.
3. Confirm that the image appears under `Images`.

If the image is larger than `3 x 3`, the formation will still work, but the result will not have the tiny-star appearance of the reference demo.

## Create the Five Star Formations

Create each formation from the same image. The five seeds keep the layouts deterministic while producing different member positions and tints.

For each row in the table, repeat the steps below.

| Formation name | Scatter seed | Blink period | Wrap X seed |
| --- | --- | ---: | --- |
| `Stars Blink 1` | `stars-1` | `200 ms` | `wrap-1` |
| `Stars Blink 2` | `stars-2` | `250 ms` | `wrap-2` |
| `Stars Blink 3` | `stars-3` | `300 ms` | `wrap-3` |
| `Stars Blink 4` | `stars-4` | `350 ms` | `wrap-4` |
| `Stars Blink 5` | `stars-5` | `400 ms` | `wrap-5` |

1. In the Scene Graph, click `Formations -> + Add`.
2. In the formation draft panel, choose the imported star image as `Template`.
3. Set `Name` to the formation name from the table.
4. Set the preset to `Scatter` and `Count` to `80`.
5. Enter these Scatter bounds:
   - `Min X = 0`, `Max X = 720`
   - `Min Y = 5`, `Max Y = 1285`
6. Enter the row's Scatter seed.
7. Enable `Random tint` and set every RGB channel range to `20..255`:
   - `Min R = 20`, `Max R = 255`
   - `Min G = 20`, `Max G = 255`
   - `Min B = 20`, `Max B = 255`
8. Click `Create`.
9. Repeat for the remaining four rows.

The generated positions and tints are authored onto the individual members. The formation stores the Scatter settings so you can intentionally reroll or reapply them later.

Success check:

- The Scene Graph contains `Stars Blink 1` through `Stars Blink 5`.
- Expanding each formation shows 80 members.
- The five formations contain 400 distinct members in total.
- The stars are spread across the full viewport and have varied bright tints.

## Add the Blink Actions

Attach one `Blink Until` action to each formation. Select the formation row in the Scene Graph before authoring its actions.

1. Select `Stars Blink 1`.
2. In Inspector, open `Actions/Events` and click `+ Add Action` in the normal scene-start action flow.
3. In the Action Library, choose `Blink Until`.
4. In the action inspector, set `Apply To = Members` and `Seconds Until Change = 0.20`.
5. Leave `Start Visible` enabled and leave `Stop After` disabled, so the action runs forever.
6. Repeat for formations 2–5 with `0.25`, `0.30`, `0.35`, and `0.40` seconds.

Success check: each formation has one infinite `Blink Until` action, with the periods shown in the table.

## Add Movement and Wrapping

Each formation needs a permanent `Move Until` action. This action translates members using their current velocity and detects the bounds outcome; the next section adds the consequence of a wrap.

For each formation:

1. With the formation selected, open `Actions/Events` and click `+ Add Action`.
2. In the Action Library, choose `Move Until`.
3. Set `Apply To = Members`, `Velocity X = 0`, and `Velocity Y = 0`.
4. In the `Until` section, choose `Bounds Hit`.
5. Set the bounds to `Min X = 0`, `Min Y = -5`, `Max X = 720`, `Max Y = 1285`.
6. Set `Behavior = Wrap` and leave the action enabled indefinitely.

Do not add a randomization consequence inside `Move Until`. Bounds detection and behavior belong here; the reusable consequence is authored as an Event Block in the next section.

## Reroll X When a Star Wraps

This is the no-code equivalent of the respawn-X part of `stars.py`.

For each formation:

1. In `Actions/Events`, click `+ Add Event Block`.
2. Set the trigger to `Bounds`.
3. Choose `Event = Wrapped`, `Axis = Y`, and `Side = Any`.
4. Rename the block to something recognizable, such as `When Stars Wrap`.
5. In that event block's action list, click `+ Add Action` and choose `Set Property`.
6. In the action inspector, set:
   - `Target = Event source`
   - `Property = X`
   - `Value = Random range`
   - `Min = 0`, `Max = 720`
   - `Seed` to the row's Wrap X seed (`wrap-1` through `wrap-5`)
7. Leave the action attached to the Bounds event block.

The wiring summary should read like: `When Stars wrap on Y -> Set event source X to random 0..720`.

Success check: each formation has one Bounds/Wrapped event block and one `Set Property` action targeting `Event source`, not the formation owner. This distinction is what gives each individual wrapped star a new X position.

## Add the Shared Velocity Cycle

The reference uses Arcade velocity values per frame. PhaserForge authors velocity in pixels per second, so use `-240` instead of `-4`, and `840` instead of `14`.

Create one infinite `Repeat` action on each formation, with `Apply To = Members`. Leave its `Count` blank. Add these six actions as children of the Repeat, in this order:

| Child | Action and values |
| ---: | --- |
| 1 | `Wait`, `Duration = 1000 ms` |
| 2 | `Tween Until`, `Property = vy`, `From = Current value`, `End value = -240`, `Duration = 2000 ms`, `Easing = ease-in` |
| 3 | `Wait`, `Duration = 5000 ms` |
| 4 | `Tween Until`, `Property = vy`, `From = Current value`, `End value = 840`, `Duration = 500 ms`, `Easing = ease-out` |
| 5 | `Wait`, `Duration = 1500 ms` |
| 6 | `Tween Until`, `Property = vy`, `From = Current value`, `End value = 0`, `Duration = 2000 ms`, `Easing = ease-out` |

To build the tree, add `Repeat` first, then use its `...` menu and `Add Action as Child` for each child. Open each child row to edit its values, then use `Back to Actions/Events` to return to the tree. Keep `Blink Until`, `Move Until`, and `Repeat` as parallel top-level actions; they must all run at the same time.

Repeat the same six-child sequence for all five formations. The complete cycle is 12 seconds.

Success check:

- Each formation has three parallel top-level behaviors: Blink, Move, and Repeat.
- The velocity is `0` for the first second, eases to `-240` over two seconds, holds for five seconds, eases to `840` over 500 ms, holds for 1.5 seconds, then eases back to `0` over two seconds.

## Verify the Finished Starfield

1. Save the project and toggle `Play Mode` with the toolbar button or `Tab`.
2. Let it run for at least 12 seconds.
3. Watch for:
   - 400 stars remaining present;
   - five visibly different blink rates;
   - stars moving continuously rather than only at phase boundaries;
   - stars leaving through one vertical edge and re-entering at the opposite edge;
   - wrapped stars returning at varied X positions instead of forming vertical columns;
   - the black background remaining unchanged.
4. Toggle back to `Edit Mode`.

For a persistence check, reload the project and confirm the five formations, their member counts, their tint variation, the five event blocks, and the nested velocity sequences are still present. You can also use `Manage -> Export as YAML`, then import that YAML into a temporary project and confirm the same structure.

## What to Do Next

Continue to [Publish to GitHub Pages](./publish-to-github-pages) when the starfield behaves as expected.
