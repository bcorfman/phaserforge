# Studio workflow: recreate `pattern_demo.py` and Save YAML (updated for new QoL features)

This version assumes the features in `.plans/implementation-plan-qol-text-bounds-duplicate-loops-layout-2026-05-17.md` exist:

- Text entities (labels)
- Bounds Helper calculator
- Duplicate carries behaviors + `Duplicate…` options dialog
- Loop Templates (“Loops” tab in Add Step)
- Layout panel (Align/Distribute/Spacing) accessible from the on-canvas selection bar

## 1. Start a new project/scene

- Set Startup to New Empty Scene (or otherwise reset to an empty scene).
- Use **A22 — Set Scene World Size**: set world `W=800`, `H=600`.

## 2. Import the ship sprite once, then duplicate it

- Use **A20 — Import Asset into Project** to import a ship image (or use any existing sprite asset you already have).
- Use **A21 — Drag Asset to Target**: drag it onto the canvas to create your first ship entity.
- Duplicate until you have 7 ship entities:
  - Fast path: **Alt+Drag** to duplicate and place.
  - Alternative: Entity List `⋯` → **Duplicate** (or **Duplicate…** if you need to change options).
- Name the 7 ships (via **A4 — Rename Item (inline)** in Entity List):
  - `Wave`, `Zigzag`, `Figure-8`, `Orbit`, `Spiral`, `Bounce`, `Patrol`

## 3. Place the ships (with Snap + Layout helpers)

- Turn on Snap if desired (**A10 — Toggle Grid Snap**).
- Place the ships approximately, then:
  - Select the 4 top-row ships → on-canvas selection bar → **Layout…** → **Align → Center Y** (to line them up at `y=450`), then nudge/drag X to exact centers.
  - Select the 3 bottom-row ships → selection bar → **Layout…** → **Align → Center Y** (to `y=200`) → **Spacing → X = 200px** (or equivalent grid cells) to land at `x=200, 400, 600`.
- Exact centers to match the Arcade demo:
  - Top row `y=450`: Wave `x=150`, Zigzag `x=300`, Figure-8 `x=500`, Orbit `x=650`
  - Bottom row `y=200`: Spiral `x=200`, Bounce `x=400`, Patrol `x=600`

## 4. Add text labels (new Text entities)

For each ship, add a text label entity above it (Arcade demo places labels above the sprites).

- Create a Text entity (Scene → Sprites `+ Add` → **Text**).
- Set:
  - Content: `Wave` / `Zigzag` / …
  - Anchor: `center`
  - Color: `#FFFFFF`
  - Font: pick a font asset (if imported) or set `fontFamily` override
- Position each label at:
  - `x = ship.x`
  - `y = ship.y + 80`

Tip: Create one label, then **Alt+Drag** duplicates it (including its text settings). Rename the text content per-copy.

## 5. Attach the 7 movement patterns (run on scene start)

For each ship: select it (**A1 — Select Single**) and use **A35 — Attach / Edit Action Flow** in Events → Handlers. These are “On scene start” handlers (no special trigger needed).

### Wave

Use Loop Templates to avoid manual nesting:

- `+ Add…` → **Loops** → **Intro then Repeat…**
  - Intro step: **Wave** with `amplitude=30`, `length=80`, `velocity=80`, `startProgress=0.75`, `endProgress=1`
  - Repeat step: **Wave** with `amplitude=30`, `length=80`, `velocity=80`, `startProgress=0`, `endProgress=1`

### Zigzag

- Add **Repeat** with two children:
  - **Zigzag**: `width=30`, `height=15`, `velocity=100`, `segments=5`
  - **Zigzag**: `width=-30`, `height=-15`, `velocity=100`, `segments=5`

### Figure-8

- Add **Repeat** with one child:
  - **Figure-8**: `width=80`, `height=60`, `velocity=100`

### Orbit

- Add **Repeat** with one child:
  - **Orbit**: `radius=50`, `velocity=100`, `clockwise=true`, `centerMode=home`
- Note: unlike ArcadeActions, you do not need a pre-step to move the sprite to the orbit edge; Orbit starts on the right edge if centered.

### Spiral

- Add **Repeat** with two children:
  - **Spiral**: `maxRadius=60`, `revolutions=2`, `velocity=80`, `direction=outward`
  - **Spiral**: `maxRadius=60`, `revolutions=2`, `velocity=80`, `direction=inward`

### Bounce

- Add **Bounce**:
  - `axis=both`, `velocityX=2`, `velocityY=1` (Arcade is px/frame; Studio uses px/sec—scale up/down if needed)
- In the Bounds section, enable BoundsHit, then use **Bounds Helper (new)**:
  - Center: auto-fill from selection (`cx=400`, `cy=200` if you matched the layout)
  - Travel span: `±x = 60`, `±y = 40`
  - Sprite size: **Auto from selection**
  - Apply to BoundsHit

### Patrol

- Add **Patrol**:
  - `axis=x`, `velocityX=2` (scale if needed)
- Enable BoundsHit and use **Bounds Helper (new)**:
  - Center: auto-fill from selection (`cx=600`, `cy=200` if you matched the layout)
  - Travel span: `±x = 40`, `±y = 0`
  - Sprite size: **Auto from selection**
  - Apply to BoundsHit, then edit `minY=0`, `maxY=600` (Y doesn’t matter for x-only patrol, but keep it within world bounds)

## 6. Quick sanity check

- Use **A7 — Toggle Edit / Play** (`Tab`) and confirm:
  - all seven ships animate simultaneously
  - labels remain static and readable

## 7. Save YAML

- Use **A25 — Save YAML As…** and save your project YAML wherever you want.
