## ACE editor approaches for 10x iteration (May 11, 2026)

These SVG mockups aim for:
- Fast “happy path” authoring for non-coders
- Growing action/condition catalog via search/palette (no giant button grids)
- Reuse via snippets/macros/templates
- A minimal low-code escape hatch that still feels “editor-native”

Files:
- `approach-1-event-blocks-actions-with-until-builder.svg` — Default no-code path: Event blocks with Actions, each Action has an “Until…” constraint builder (inspired by ArcadeActions’ `*Until` naming).
- `approach-1b-no-code-counters-and-collections.svg` — Variant of Approach 1 that avoids queries: editor-managed Counters/Collections (increment/decrement via events) so “Until: counter == N” is fully no-code.
- `approach-1c-no-code-score-counter.svg` — End-to-end Score example: pickup defines `points`, event payload feeds “Add to Counter(score, +points)”, and goals use “Until: score >= N”.
- `approach-1d-outgoing-events-and-wiring.svg` — Makes ACE direction explicit: actions declare “Emits…” events; a wiring UI connects emitted events to listeners (no-code).
- `approach-1e-event-wiring-map.svg` — Scene-level “Event Map” view: quickly see what emits what, and where events are handled (fast debugging + 10x iteration).
- `approach-1f-named-composite-action-asset.svg` — Named Composite Action as a first-class asset (“Routine/Macro”) with parameters + multi-target bindings; shows Repeat as a composite container inside Event Blocks.
- `approach-1g-snippet-vs-macro.svg` — Side-by-side comparison: lightweight Snippet (copy/paste) vs named Macro (parameterized, reusable, versioned).
- `approach-1h-repeat-composite-in-event-blocks.svg` — Repeat as a composite container in Event Blocks with clear stop semantics (Until inside child actions + optional “Repeat until…” guard).
- `approach-2-conditions-from-scene-queries-and-vars.svg` — Adds a simple Vars/State panel + Query builder (e.g., count tagged objects), keeping conditions no-code.
- `approach-3-custom-predicate-registry-low-code.svg` — Low-code escape hatch: developer registers a predicate with a schema; editor renders it as a normal “Until” condition with inputs.
- `approach-4-command-palette-templates-snippets.svg` — 10x speed tooling: command palette insert, templates, and snippet drag/drop across sprites/groups.
