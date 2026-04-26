# Interactive Play Mode Runtime Mockups

Lightweight SVG wireframes for `.plans/interactive-playmode-runtime.md`.

- `phase3-background-layers.svg`: background layer authoring (inspector) + edit/play rendering parity (✅ implemented)
- `phase4-call-scene-goto.svg`: Call attachment UI with structured args for `scene.goto` (✅ implemented)
- `phase5-audio.svg`: project audio library + per-scene music/ambience authoring (✅ implemented)
- `phase6-input-maps.svg`: input maps authoring (project) + scene selection (keyboard/mouse/gamepad) (✅ implemented)
  - Project: create/duplicate/remove maps, set project default input map, bind actions (keyboard + mouse capture)
  - Scene: choose active/fallback input maps + preview merged action bindings
  - Runtime: semantic `pressed/held/released` action states + pointer position/deltas in Play mode test snapshots
- `phase6b-mouse-gamepad.svg`: Play-mode mouse cursor + left-click behavior, plus gamepad *button* binding capture (mockup for next Phase 6 follow-up)
- `phase7-collisions-triggers.svg`: collision rules authoring + trigger zone authoring + runtime enter/exit snapshots (mockup)
- `phase7b-trigger-scripts.svg`: trigger scripts executing service calls (audio.play_sfx / scene.goto / entity.destroy) + runtime event log (mockup)
- `phase7c-trigger-call-presets.svg`: structured trigger call editor presets (mockup)
