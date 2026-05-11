## ACE visual models (May 11, 2026)

Recasts the prior Pattern A–D mockups into UI models that map cleanly to an **Action–Condition–Event (ACE)** structure:

- Events are **entry points** (roots/headers).
- Conditions are **run constraints** (“until” constraints; no While. “While X” is expressed as “Until not X”. No Else).
- Actions are **effects** (leaves/clips/steps).

Files:
- `ace-a-behavior-tree-events-and-conditions.svg` — BT-like: Events as sections; Conditions as “Until …” decorators on nodes/branches.
- `ace-b-event-ledger-with-guards-and-actions.svg` — Non-timeline “ledger”: Event blocks with “Run until…” rows and Action stacks; parallel as branches inside an Event.
- `ace-c-graph-event-guards-actions.svg` — Node graph: Event entry node → “Until …” constraint nodes → Action nodes; parallel via Split/Join.
- `ace-d-event-sheet-conditions-as-columns.svg` — Event sheet: Events as groups; “Until …” constraints as columns; Actions as rows; parallel as action groups.
