import { expect, test } from '@playwright/test';
import {
  clickCanvasAt,
  dragBoundsHandle,
  dismissViewHint,
  dragOnCanvas,
  dragWorld,
  expectSelection,
  getEditableBoundsRect,
  getSceneSnapshot,
  getState,
  gotoStudio,
  seedSampleScene,
  selectGroupInSceneGraph,
  worldToClient,
  tapWorld,
  triggerRedo,
  triggerUndo,
  waitForSampleScene,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('selects an entity by clicking it on the canvas', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  await expectSelection(page, { kind: 'entity', id: 'e1' });
  await expect(page.getByTestId('inspector')).toContainText('e1');
});

test('clicking empty canvas clears selection', async ({ page }) => {
  await dismissViewHint(page);

  await tapWorld(page, { x: 220, y: 140 });
  await expectSelection(page, { kind: 'entity', id: 'e1' });

  const emptyPoint = await worldToClient(page, { x: 20, y: 20 });
  await clickCanvasAt(page, emptyPoint);

  await expectSelection(page, { kind: 'none' });
});

test('marquee selects multiple entities by click-dragging empty canvas', async ({ page }) => {
  await dismissViewHint(page);

  const e1 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e1') ?? null) as any);
  const e2 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  if (!e1 || !e2) throw new Error('Entity rects unavailable');

  const start = await worldToClient(page, { x: e1.minX - 30, y: e1.minY - 30 });
  const end = await worldToClient(page, { x: e2.maxX + 5, y: e2.maxY + 5 });
  await dragOnCanvas(page, start, end, 'left');

  await expect.poll(async () => {
    const state = await getState<{ selection?: { kind: string; ids?: string[] } }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
});

test('shift-click additively selects entities on the canvas', async ({ page }) => {
  await dismissViewHint(page);

  await tapWorld(page, { x: 220, y: 140 });
  await expectSelection(page, { kind: 'entity', id: 'e1' });

  const e2 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  if (!e2) throw new Error('Entity rect unavailable');
  const e2Client = await worldToClient(page, { x: e2.centerX, y: e2.centerY });
  await page.keyboard.down('Shift');
  await clickCanvasAt(page, e2Client);
  await page.keyboard.up('Shift');

  await expect.poll(async () => {
    const state = await getState<{ selection?: { kind: string; ids?: string[] } }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
});

test('grid snapping toggles and snaps small drags', async ({ page }) => {
  await dismissViewHint(page);

  await page.getByTestId('toggle-grid-snap-button').click();

  await dragWorld(page, { x: 220, y: 140 }, { x: 227, y: 140 });

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 230, y: 140 });
});

test('supports undo/redo via viewbar buttons', async ({ page }) => {
  await dismissViewHint(page);

  await dragWorld(page, { x: 220, y: 140 }, { x: 260, y: 170 });
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 260, y: 170 });

  await page.getByTestId('undo-button').click();
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 220, y: 140 });

  await page.getByTestId('redo-button').click();
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 260, y: 170 });
});

test('drags an entity on the canvas and supports keyboard undo/redo', async ({ page }) => {
  await dragWorld(page, { x: 220, y: 140 }, { x: 260, y: 170 });

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 260, y: 170 });

  await triggerUndo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 220, y: 140 });

  await triggerRedo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 260, y: 170 });
});

test('resizes bounds and supports undo/redo', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-open-att-move-right').click();
  await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
    minX: 80,
    minY: 60,
  });

  await dragBoundsHandle(page, 'nw', { x: 20, y: 20 });
  await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
    minX: 100,
    minY: 80,
  });

  await triggerUndo(page);
  await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
    minX: 80,
    minY: 60,
  });

  await triggerRedo(page);
  await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
    minX: 100,
    minY: 80,
  });
});

test('drags a formation on the canvas and restores layout metadata on undo', async ({ page }) => {
  await dragWorld(page, { x: 316, y: 120 }, { x: 346, y: 130 });

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { layout?: { startX?: number; startY?: number } }> } }>(page);
    return state.scene.groups['g-enemies'].layout;
  }).toMatchObject({ startX: 250, startY: 150 });

  await triggerUndo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { layout?: { startX?: number; startY?: number } }> } }>(page);
    return state.scene.groups['g-enemies'].layout;
  }).toMatchObject({ startX: 220, startY: 140 });
});

test('resizes editable bounds from the canvas handle', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-open-att-move-right').click();
  await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
    minX: 80,
    minY: 60,
  });

  await dragBoundsHandle(page, 'nw', { x: 20, y: 20 });

  await expect.poll(async () => {
    const state = await getState<{ scene: { attachments: Record<string, { condition?: { type: string; bounds: { minX: number; minY: number; maxX: number; maxY: number } } }> } }>(page);
    const cond = state.scene.attachments['att-move-right'].condition;
    return cond?.type === 'BoundsHit' ? cond.bounds : null;
  }).toMatchObject({
    minX: 100,
    minY: 80,
  });
});

test('supports wheel zoom and real middle-drag panning once the camera can scroll', async ({ page }) => {
  await dismissViewHint(page);
  const canvas = page.locator('#game-container canvas');
  const zoomAnchorWorld = { x: 512, y: 250 };
  const leftAnchorWorld = { x: 256, y: 250 };
  const rightAnchorWorld = { x: 768, y: 250 };
  const idlePoint = await page.evaluate(
    () => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient({ x: 120, y: 120 })
  );
  if (!idlePoint) throw new Error('Idle world point unavailable');
  const zoomAnchorPoint = await page.evaluate(
    (point) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(point),
    zoomAnchorWorld
  );
  if (!zoomAnchorPoint) throw new Error('Zoom anchor point unavailable');

  await page.mouse.move(idlePoint.x, idlePoint.y);
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor)).toBe('default');

  const before = await getSceneSnapshot<{ zoom: number; scrollX: number }>(page);
  await page.mouse.move(zoomAnchorPoint.x, zoomAnchorPoint.y);
  await page.mouse.wheel(0, -320);
  await expect.poll(async () => (await getSceneSnapshot<{ zoom: number }>(page)).zoom).toBeGreaterThan(before.zoom);
  await expect.poll(async () => {
    const point = await page.evaluate(
      (worldPoint) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(worldPoint),
      zoomAnchorWorld
    );
    if (!point) throw new Error('Zoom anchor point unavailable after wheel');
    return Math.abs(point.x - zoomAnchorPoint.x) <= 2 && Math.abs(point.y - zoomAnchorPoint.y) <= 2;
  }).toBe(true);
  await page.mouse.wheel(0, -320);
  await expect.poll(async () => {
    const point = await page.evaluate(
      (worldPoint) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(worldPoint),
      zoomAnchorWorld
    );
    if (!point) throw new Error('Zoom anchor point unavailable after second wheel');
    return Math.abs(point.x - zoomAnchorPoint.x) <= 2 && Math.abs(point.y - zoomAnchorPoint.y) <= 2;
  }).toBe(true);

  const beforePan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  await page.mouse.move(idlePoint.x, idlePoint.y);
  await page.mouse.down({ button: 'middle' });
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor)).toBe('grabbing');
  await page.mouse.move(idlePoint.x - 80, idlePoint.y - 40, { steps: 12 });
  await page.mouse.up({ button: 'middle' });
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor)).toBe('default');
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
    return { scrollX: snapshot.scrollX, scrollY: snapshot.scrollY };
  }).not.toEqual({ scrollX: beforePan.scrollX, scrollY: beforePan.scrollY });

  await page.getByTestId('reset-zoom-button').click();
  const leftAnchorPoint = await page.evaluate(
    (point) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(point),
    leftAnchorWorld
  );
  if (!leftAnchorPoint) throw new Error('Left zoom anchor point unavailable');
  await page.mouse.move(leftAnchorPoint.x, leftAnchorPoint.y);
  await page.mouse.wheel(0, -320);
  const leftScroll = await getSceneSnapshot<{ scrollX: number }>(page);

  await page.getByTestId('reset-zoom-button').click();
  const rightAnchorPoint = await page.evaluate(
    (point) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(point),
    rightAnchorWorld
  );
  if (!rightAnchorPoint) throw new Error('Right zoom anchor point unavailable');
  await page.mouse.move(rightAnchorPoint.x, rightAnchorPoint.y);
  await page.mouse.wheel(0, -320);
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<{ scrollX: number }>(page);
    return Math.round(snapshot.scrollX - leftScroll.scrollX);
  }).toBeGreaterThan(30);
});
