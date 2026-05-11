## Actions-in-a-tree mockups (May 11, 2026)

SVG mockups exploring how to contain all Actions in a tree while supporting:
- parallel execution
- fast add/search as the action catalog grows
- reuse/copy of action subtrees
- composite actions (e.g. Repeat) that contain children

Files:
- `idea-1-scene-tree-actions-subtree.svg` — Actions live as a subtree under each Sprite/Sprite Group in the Scene tree.
- `idea-2-inspector-action-tree-with-palette-and-snippets.svg` — Inspector hosts a compact Action Tree editor with search + Snippets library for reuse.
- `idea-3-split-tree-and-parallel-lanes.svg` — Tree on the left, “parallel lanes” visualization on the right for clarity.
- `idea-4-tracks-model-per-sprite.svg` — Parallelization represented as multiple sequential “tracks” per Sprite (each track is a tree).
- `idea-5-action-blueprint-tabbed-editor.svg` — Actions become a first-class “Blueprint” document tab; Inspector is only properties.

