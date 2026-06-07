# Studio workflow: recreate `pattern_demo.py` and Save YAML (updated for new QoL features)

## 1. Start a new project/scene

- Use **A59 — Configure Startup / Reset** to start from a new empty scene, or otherwise reset the current project to an empty scene.
- Use **A61 — Set Scene World Size** to set world `W=800`, `H=600`.

## 2. Import the ship sprite once, then duplicate it

- Use **A36 — Import Assets** to import a ship image (or use any existing sprite asset you already have).
  NOTE: In the res/images directory, there is a ship_sidesA.png that I use.
- Use **A37 — Drag Asset to a Target** to drag it onto the canvas and create your first ship entity.
  NOTE: You may want to use the Scale X and Scale Y feature in the Inspector to reduce the sprite size to 0.5 if it's too large.
- Duplicate the sprite until you have 7 separate sprite entities:
  - Fast path: **A14 — Duplicate by Alt-drag**.
  - Alternative: **A15 — Duplicate via Scene Graph Dialog**.
- Name the 7 ships with **A4 — Rename Item Inline** in the scene graph:
  - `Wave`, `Zigzag`, `Figure-8`, `Orbit`, `Spiral`, `Bounce`, `Patrol`

## 3. Place the ships (with Snap + Layout helpers)

- Turn on Snap if desired with **A11 — Toggle Grid Snap**.
- Place the ships approximately, then:
  - Select the 4 bottom-row ships → on-canvas selection bar → **Layout…** (**A18 — Open Layout Popover**) →
    - **Position selection → Set Y = 450 → Set Y** (snaps the whole row to the correct Y without collapsing spacing)
    - Use **A19 — Apply Layout Operations** for the Set Y action
    - Nudge/drag X to the exact centers (these four X positions are not evenly spaced in the Arcade demo).
  - Select the 3 top-row ships → selection bar → **Layout…** (**A18 — Open Layout Popover**) →
    - **Arrange items → Spacing X = 200px → Apply Spacing X** (or equivalent grid cells)
    - Use **A19 — Apply Layout Operations** for Spacing X and Center X
    - **Position selection → Set Y = 200 → Set Y**
    - **Align selection → Center X** (centers the row on world center)
- Exact centers to match the Arcade demo:
  - Bottom row `y=450`: Wave `x=150`, Zigzag `x=300`, Figure-8 `x=500`, Orbit `x=650`
  - Top row `y=200`: Spiral `x=200`, Bounce `x=400`, Patrol `x=600`

## 4. Add text labels (new Text entities)

For each ship, add a text label entity above it (Arcade demo places labels above the sprites).

- Create a Text entity with **A33 — Create Text Entity**.
- Set:
  - Content: `Wave` / `Zigzag` / …
  - Anchor: `center`
  - Color: `#FFFFFF`
  - Font: pick a font asset (if imported) or set `fontFamily` override
- Position each label at:
  - `x = ship.x`
  - `y = ship.y - 80`

Tip: Create one label, then **Alt+Drag** duplicates it (including its text settings). Rename the text content per-copy.

## 5. Attach the 7 movement patterns (run on scene start)

For each ship:

- select it with **A1 — Select Single**
- use **A42 — Create / Edit Event Blocks** to create or open the scene-start handler
- use **A43 — Create / Edit Action Steps** to add the pattern actions
- use **A45 — Create / Apply Patterns and Loop Templates** when the workflow below calls for a loop template

### Wave

Use Loop Templates to avoid manual nesting:

- `+ Add…` → **Loops** → **Intro then Repeat…**
  - Intro step: **Wave** with `amplitude=30`, `length=80`, `velocity=80`, `startProgress=0.75`, `endProgress=1`
  - Repeat step: **Wave** with `amplitude=30`, `length=80`, `velocity=80`, `startProgress=0`, `endProgress=1`

### How to build “Repeat with N children”

Several patterns below say “Add **Repeat** with X children”. Use the Loop Template that scaffolds a Repeat container with a chosen number of child steps:

- `+ Add…` → **Loops** → **Repeat with Children…**
  - Choose **Children** = N
  - Choose **Child Type** (you can edit each child afterwards)
  - Leave Repeat **Count** blank for an infinite loop 

### Zigzag

- `+ Add…` → **Loops** → **Repeat with Children…**
  - Children = `2`
  - Child Type = **Zigzag Pattern**
- Configure the two Zigzag children:
  - Child 1: `width=30`, `height=-15`, `velocity=100`, `segments=5` (Phaser Y+ is down; negative height moves up, matching Arcade demo)
  - Child 2: `width=-30`, `height=15`, `velocity=100`, `segments=5`
- Add a **Move By** step *before* the Repeat 
  - **Move By**: `dx=-15`, `dy=-30`

### Figure-8

- Add **Repeat** with one child:
  - **Figure-8**: `width=80`, `height=60`, `velocity=100`

### Orbit

- Add a **Move To** step *before* the Repeat to place the sprite on the orbit path (matches `pattern_demo.py`’s instant reposition):
  - **Move To**: `x = (homeX + radius)`, `y = homeY`
  - For the demo’s default Orbit ship placement (`homeX=650`, `homeY=450`, `radius=50`): set `x=700`, `y=450`.
- Add **Repeat** with one child:
  - **Orbit**: `radius=50`, `velocity=100`, `clockwise=true`, `centerMode=home`

### Spiral

- Add **Repeat** with two children:
  - **Spiral**: `maxRadius=60`, `revolutions=2`, `velocity=80`, `direction=outward`
  - **Spiral**: `maxRadius=60`, `revolutions=2`, `velocity=80`, `direction=inward`

### Bounce

- Add **Bounce**:
  - `axis = both`, `velocityX = 100`, `velocityY = 60` 
- In the separate **Bounds** panel (sibling to “Bounce Pattern”), confirm **BoundsHit** is enabled (it defaults to the sprite bounds).
- In **Bounds → Edit mode**, switch to **Center/Span**.
- Use **Auto from selection** to fill center (and pull sprite size).
- Set travel span:
  - `± X Span = 50`
  - `± Y Span = 60`
- Click **Apply** (writes the computed values into Bounds Min/Max).

### Patrol

- Add **Patrol**:
  - `axis=x`, `velocityX=80` 
- In the separate **Bounds** panel (sibling to “Patrol Pattern”), confirm **BoundsHit** is enabled (it defaults to the sprite bounds).
- In **Bounds → Edit mode**, switch to **Center/Span**.
- Use **Auto from selection** to fill center (and pull sprite size).
- Set travel span:
  - `± X Span = 40`
  - `± Y Span = 0`
- Click **Apply** (writes the computed values into Bounds Min/Max).
- Switch back to **Min/Max** and set `minY=400`, `maxY=500` (Y doesn’t matter for x-only patrol, but keep it within world bounds).

## 6. Quick sanity check

- Use **A7 — Toggle Edit / Play** (`Tab`) and confirm:
  - all seven ships animate simultaneously
  - labels remain static and readable

## 7. Save YAML

- Use **A60 — Open / Save YAML from the Viewbar** and choose **Save YAML As…**.
