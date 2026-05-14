# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: canvas.spec.ts >> supports wheel zoom and real middle-drag panning once the camera can scroll
- Location: tests/e2e/canvas.spec.ts:197:5

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0.5
Received:   0.5

Call Log:
- Timeout 10000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - paragraph [ref=e6]: Browser Editor
      - heading "PhaserActions Studio" [level=1] [ref=e8]
      - paragraph [ref=e9]: Move entities on the canvas, tune formations in the inspector, and round-trip YAML without leaving the editor.
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]: Startup
        - combobox "Startup mode" [ref=e14]:
          - option "Reload Last YAML" [selected]
          - option "New Empty Scene"
      - generic [ref=e15]:
        - generic [ref=e16]: UI Scale
        - generic [ref=e17]:
          - slider "UI Scale" [ref=e18]: "0.95"
          - generic [ref=e19]: 95%
      - group "Theme" [ref=e20]:
        - button "Use system theme" [pressed] [ref=e21] [cursor=pointer]:
          - img [ref=e22]
        - button "Use light theme" [ref=e24] [cursor=pointer]:
          - img [ref=e25]
        - button "Use dark theme" [ref=e31] [cursor=pointer]:
          - img [ref=e32]
  - generic [ref=e34]:
    - complementary [ref=e35]:
      - generic [ref=e36]:
        - tablist "Sidebar Scope" [ref=e37]:
          - tab "Scene" [selected] [ref=e38] [cursor=pointer]
          - tab "Project" [ref=e39] [cursor=pointer]
        - generic [ref=e40]:
          - region "Scenes" [ref=e42]:
            - generic [ref=e43]:
              - heading "Scenes" [level=3] [ref=e44]
              - button "+ Add" [ref=e45] [cursor=pointer]
            - generic [ref=e47]:
              - generic [ref=e48]:
                - button "Toggle scene scene-1" [ref=e49] [cursor=pointer]: ▾
                - button "scene-1" [ref=e50] [cursor=pointer]:
                  - generic [ref=e51]: scene-1
                - button "More options for scene scene-1" [ref=e52] [cursor=pointer]: ⋯
              - generic [ref=e53]:
                - generic [ref=e54]:
                  - heading "Sprites" [level=4] [ref=e55]
                  - button "+ Add" [ref=e56] [cursor=pointer]
                - generic [ref=e58]: No ungrouped sprites.
                - generic [ref=e59]:
                  - heading "Formations" [level=4] [ref=e60]
                  - button "+ Add" [ref=e61] [cursor=pointer]
                - generic [ref=e63]:
                  - button "Toggle formation Enemy Formation" [ref=e64] [cursor=pointer]: ▸
                  - button "Enemy Formation 7" [ref=e65] [cursor=pointer]:
                    - text: Enemy Formation
                    - generic [ref=e66]: "7"
                  - button "More options for formation Enemy Formation" [ref=e67] [cursor=pointer]: ⋯
                - generic [ref=e68]:
                  - heading "Trigger Zones" [level=4] [ref=e69]
                  - button "+ Add" [ref=e70] [cursor=pointer]
                - generic [ref=e71]: No trigger zones.
          - separator [ref=e72]:
            - generic [ref=e73]: ⋮⋮⋮
          - generic [ref=e75]:
            - generic [ref=e76]:
              - generic [ref=e77]: Assets
              - button "+ Import" [ref=e78] [cursor=pointer]
            - generic [ref=e79]:
              - textbox "Search assets" [ref=e80]:
                - /placeholder: Search…
              - tablist "Asset type" [ref=e81]:
                - tab "Images" [selected] [ref=e82] [cursor=pointer]
                - tab "Audio" [ref=e83] [cursor=pointer]
                - tab "Fonts" [ref=e84] [cursor=pointer]
            - generic [ref=e85]:
              - checkbox "Show thumbnails" [checked] [ref=e86]
              - generic [ref=e87]: Show thumbnails
            - list [ref=e88]:
              - generic [ref=e89]: No assets.
    - separator [ref=e90]
    - main "Viewport" [ref=e91]:
      - generic [ref=e92]:
        - generic [ref=e93]:
          - paragraph [ref=e94]: Canvas
          - heading "Viewport" [level=2] [ref=e95]
          - paragraph [ref=e96]: Pan with middle mouse or Space + drag. Use zoom controls to inspect sprite spacing and bounds.
        - generic [ref=e97]:
          - generic [ref=e98]:
            - button "Fit view" [ref=e99] [cursor=pointer]: Fit
            - button "Reset zoom" [ref=e100] [cursor=pointer]: Reset
            - button "Zoom out" [ref=e101] [cursor=pointer]: "-"
            - generic [ref=e102]: 50%
            - button "Zoom in" [ref=e103] [cursor=pointer]: +
          - toolbar "YAML file actions" [ref=e104]:
            - generic [ref=e105]:
              - button "Open YAML…" [ref=e106] [cursor=pointer]
              - button "Save YAML" [ref=e107] [cursor=pointer]
              - button "Save YAML As…" [ref=e108] [cursor=pointer]
          - generic [ref=e109]:
            - generic [ref=e110]:
              - paragraph [ref=e111]: Scene Bounds
              - heading "World Size" [level=3] [ref=e112]
            - generic [ref=e113]:
              - generic [ref=e114]:
                - generic [ref=e115]: W
                - textbox "World width" [ref=e116]: "1024"
              - generic [ref=e117]:
                - generic [ref=e118]: H
                - textbox "World height" [ref=e119]: "768"
      - generic [ref=e121]:
        - button "Undo" [disabled] [ref=e122]
        - button "Redo" [disabled] [ref=e123]
        - button "Toggle grid snapping" [ref=e124] [cursor=pointer]: "Snap: Off"
        - button "Toggle play mode" [ref=e125] [cursor=pointer]: Play Mode
    - complementary [ref=e128]:
      - tablist "Inspector Pane Tabs" [ref=e129]:
        - tab "Inspector" [selected] [ref=e130] [cursor=pointer]
        - tab "Cloud" [ref=e131] [cursor=pointer]
      - generic [ref=e132]:
        - generic [ref=e133]:
          - paragraph [ref=e134]: Selection
          - heading "Inspector" [level=2] [ref=e135]
          - paragraph [ref=e136]: Adjust authored values for the current selection and review the active scene registry.
        - generic [ref=e137]:
          - checkbox "Pin selection while dragging" [ref=e138]
          - generic [ref=e139]: Pin selection while dragging
        - generic [ref=e140]:
          - generic [ref=e141]:
            - generic [ref=e142]: "Scene: scene-1"
            - generic [ref=e143]:
              - button "Expand All" [ref=e144] [cursor=pointer]
              - button "Collapse All" [ref=e145] [cursor=pointer]
          - generic [ref=e146]:
            - generic [ref=e147]:
              - button "Collapse Background Layers" [ref=e148] [cursor=pointer]: ▾
              - generic [ref=e149]: Background Layers
              - generic [ref=e150]: 0 layers
            - generic [ref=e152]:
              - generic [ref=e153]: No background layers yet. Drag an image from the docked Assets panel to add one.
              - button "+ Add Layer" [ref=e155] [cursor=pointer]
          - generic [ref=e157]:
            - button "Expand Audio" [ref=e158] [cursor=pointer]: ▸
            - generic [ref=e159]: Audio
            - generic [ref=e160]: "Music: (none) · Ambience: 0"
          - generic [ref=e162]:
            - button "Expand Input" [ref=e163] [cursor=pointer]: ▸
            - generic [ref=e164]: Input
            - generic [ref=e165]: "Active: (none) · Fallback: (none)"
          - generic [ref=e167]:
            - button "Expand Collisions" [ref=e168] [cursor=pointer]: ▸
            - generic [ref=e169]: Collisions
            - generic [ref=e170]: 0 rules
          - generic [ref=e172]:
            - button "Expand State" [ref=e173] [cursor=pointer]: ▸
            - generic [ref=e174]: State
            - generic [ref=e175]: 0 counters · 0 collections
```

# Test source

```ts
  124 |     const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
  125 |     return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  126 |   }).toEqual({ x: 220, y: 140 });
  127 | 
  128 |   await triggerRedo(page);
  129 |   await expect.poll(async () => {
  130 |     const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
  131 |     return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  132 |   }).toEqual({ x: 260, y: 170 });
  133 | });
  134 | 
  135 | test('resizes bounds and supports undo/redo', async ({ page }) => {
  136 |   await selectGroupInSceneGraph(page, 'g-enemies');
  137 |   await page.getByTestId('attachment-open-att-move-right').click();
  138 |   await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
  139 |     minX: 80,
  140 |     minY: 60,
  141 |   });
  142 | 
  143 |   await dragBoundsHandle(page, 'nw', { x: 20, y: 20 });
  144 |   await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
  145 |     minX: 100,
  146 |     minY: 80,
  147 |   });
  148 | 
  149 |   await triggerUndo(page);
  150 |   await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
  151 |     minX: 80,
  152 |     minY: 60,
  153 |   });
  154 | 
  155 |   await triggerRedo(page);
  156 |   await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
  157 |     minX: 100,
  158 |     minY: 80,
  159 |   });
  160 | });
  161 | 
  162 | test('drags a formation on the canvas and restores layout metadata on undo', async ({ page }) => {
  163 |   await dragWorld(page, { x: 316, y: 120 }, { x: 346, y: 130 });
  164 | 
  165 |   await expect.poll(async () => {
  166 |     const state = await getState<{ scene: { groups: Record<string, { layout?: { startX?: number; startY?: number } }> } }>(page);
  167 |     return state.scene.groups['g-enemies'].layout;
  168 |   }).toMatchObject({ startX: 250, startY: 150 });
  169 | 
  170 |   await triggerUndo(page);
  171 |   await expect.poll(async () => {
  172 |     const state = await getState<{ scene: { groups: Record<string, { layout?: { startX?: number; startY?: number } }> } }>(page);
  173 |     return state.scene.groups['g-enemies'].layout;
  174 |   }).toMatchObject({ startX: 220, startY: 140 });
  175 | });
  176 | 
  177 | test('resizes editable bounds from the canvas handle', async ({ page }) => {
  178 |   await selectGroupInSceneGraph(page, 'g-enemies');
  179 |   await page.getByTestId('attachment-open-att-move-right').click();
  180 |   await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
  181 |     minX: 80,
  182 |     minY: 60,
  183 |   });
  184 | 
  185 |   await dragBoundsHandle(page, 'nw', { x: 20, y: 20 });
  186 | 
  187 |   await expect.poll(async () => {
  188 |     const state = await getState<{ scene: { attachments: Record<string, { condition?: { type: string; bounds: { minX: number; minY: number; maxX: number; maxY: number } } }> } }>(page);
  189 |     const cond = state.scene.attachments['att-move-right'].condition;
  190 |     return cond?.type === 'BoundsHit' ? cond.bounds : null;
  191 |   }).toMatchObject({
  192 |     minX: 100,
  193 |     minY: 80,
  194 |   });
  195 | });
  196 | 
  197 | test('supports wheel zoom and real middle-drag panning once the camera can scroll', async ({ page }) => {
  198 |   await dismissViewHint(page);
  199 |   const canvas = page.locator('#game-container canvas');
  200 |   const zoomAnchorWorld = { x: 512, y: 250 };
  201 |   const leftAnchorWorld = { x: 256, y: 250 };
  202 |   const rightAnchorWorld = { x: 768, y: 250 };
  203 |   const idlePoint = await page.evaluate(
  204 |     () => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient({ x: 120, y: 120 })
  205 |   );
  206 |   if (!idlePoint) throw new Error('Idle world point unavailable');
  207 |   const zoomAnchorPoint = await page.evaluate(
  208 |     (point) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(point),
  209 |     zoomAnchorWorld
  210 |   );
  211 |   if (!zoomAnchorPoint) throw new Error('Zoom anchor point unavailable');
  212 | 
  213 |   await page.mouse.move(idlePoint.x, idlePoint.y);
  214 |   // Cursor styles differ across engines (some report `pointer` as the base cursor here).
  215 |   // We only care that we are *not* already in the pan-grab state before middle dragging.
  216 |   await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor)).not.toBe('grabbing');
  217 | 
  218 |   const before = await getSceneSnapshot<{ zoom: number; scrollX: number }>(page);
  219 |   await page.mouse.move(zoomAnchorPoint.x, zoomAnchorPoint.y);
  220 |   await canvas.click({ position: { x: 10, y: 10 } });
  221 |   // Give the browser a beat to deliver the pointermove before wheel zooming (headless can be racy).
  222 |   await page.waitForTimeout(50);
  223 |   await page.mouse.wheel(0, -320);
> 224 |   await expect.poll(async () => (await getSceneSnapshot<{ zoom: number }>(page)).zoom).toBeGreaterThan(before.zoom);
      |   ^ Error: expect(received).toBeGreaterThan(expected)
  225 |   await page.mouse.wheel(0, -320);
  226 |   await expect.poll(async () => (await getSceneSnapshot<{ zoom: number }>(page)).zoom).toBeGreaterThan(before.zoom);
  227 | 
  228 |   const beforePan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  229 |   await page.mouse.move(idlePoint.x, idlePoint.y);
  230 |   await page.mouse.down({ button: 'middle' });
  231 |   await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor)).toBe('grabbing');
  232 |   await page.mouse.move(idlePoint.x - 80, idlePoint.y - 40, { steps: 12 });
  233 |   await page.mouse.up({ button: 'middle' });
  234 |   await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor)).not.toBe('grabbing');
  235 |   await expect.poll(async () => {
  236 |     const snapshot = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  237 |     return { scrollX: snapshot.scrollX, scrollY: snapshot.scrollY };
  238 |   }).not.toEqual({ scrollX: beforePan.scrollX, scrollY: beforePan.scrollY });
  239 | 
  240 |   await page.getByTestId('reset-zoom-button').click();
  241 |   const leftAnchorPoint = await page.evaluate(
  242 |     (point) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(point),
  243 |     leftAnchorWorld
  244 |   );
  245 |   if (!leftAnchorPoint) throw new Error('Left zoom anchor point unavailable');
  246 |   await page.mouse.move(leftAnchorPoint.x, leftAnchorPoint.y);
  247 |   await page.mouse.wheel(0, -320);
  248 |   const leftScroll = await getSceneSnapshot<{ scrollX: number }>(page);
  249 | 
  250 |   await page.getByTestId('reset-zoom-button').click();
  251 |   const rightAnchorPoint = await page.evaluate(
  252 |     (point) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(point),
  253 |     rightAnchorWorld
  254 |   );
  255 |   if (!rightAnchorPoint) throw new Error('Right zoom anchor point unavailable');
  256 |   await page.mouse.move(rightAnchorPoint.x, rightAnchorPoint.y);
  257 |   await page.mouse.wheel(0, -320);
  258 |   await expect.poll(async () => {
  259 |     const snapshot = await getSceneSnapshot<{ scrollX: number }>(page);
  260 |     return Math.round(snapshot.scrollX - leftScroll.scrollX);
  261 |   }).toBeGreaterThan(15);
  262 | });
  263 | 
```