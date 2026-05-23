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
  panByScreenDelta,
  seedSampleScene,
  selectGroupInSceneGraph,
  worldToClient,
  tapWorld,
  triggerRedo,
  triggerUndo,
  waitForSampleScene,
} from './helpers';

test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);
});

test('selects an entity by clicking it on the canvas @critical @browser', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  await expectSelection(page, { kind: 'entity', id: 'e1' });
  await expect(page.getByTestId('inspector')).toContainText('e1');
});

test('clicking empty canvas clears selection @critical', async ({ page }) => {
  await dismissViewHint(page);

  await tapWorld(page, { x: 220, y: 140 });
  await expectSelection(page, { kind: 'entity', id: 'e1' });

  const emptyPoint = await worldToClient(page, { x: 20, y: 20 });
  await clickCanvasAt(page, emptyPoint);

  await expectSelection(page, { kind: 'none' });
});

test('marquee selects multiple entities by click-dragging empty canvas @critical @browser', async ({ page }) => {
  await dismissViewHint(page);

  const e1 = await page.evaluate(() => (window.__PHASER_FORGE_TEST__?.getEntityWorldRect('e1') ?? null) as any);
  const e2 = await page.evaluate(() => (window.__PHASER_FORGE_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  if (!e1 || !e2) throw new Error('Entity rects unavailable');

  await dragWorld(page, { x: e1.minX - 30, y: e1.minY - 30 }, { x: e2.maxX + 5, y: e2.maxY + 5 });

  await expect.poll(async () => {
    const state = await getState<{ selection?: { kind: string; ids?: string[] } }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
});

test('shift-click additively selects entities on the canvas @critical @browser', async ({ page }) => {
  await dismissViewHint(page);

  await tapWorld(page, { x: 220, y: 140 });
  await expectSelection(page, { kind: 'entity', id: 'e1' });

  const e2 = await page.evaluate(() => (window.__PHASER_FORGE_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  if (!e2) throw new Error('Entity rect unavailable');
  await tapWorld(page, { x: e2.centerX, y: e2.centerY }, { additive: true });

  await expect.poll(async () => {
    const state = await getState<{ selection?: { kind: string; ids?: string[] } }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
});

test('supports undo/redo via viewbar buttons @critical', async ({ page }) => {
  await dragWorld(page, { x: 220, y: 140 }, { x: 260, y: 170 });
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }, { timeout: 5000 }).toEqual({ x: 260, y: 170 });

  await page.getByTestId('undo-button').click({ force: true });
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }, { timeout: 5000 }).toEqual({ x: 220, y: 140 });

  await page.getByTestId('redo-button').click({ force: true });
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }, { timeout: 5000 }).toEqual({ x: 260, y: 170 });
});

test('resizes bounds and supports undo/redo @critical @browser', async ({ page }) => {
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

test('drags a formation on the canvas and restores layout metadata on undo @critical @browser', async ({ page }) => {
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

test('resizes editable bounds from the canvas handle @critical @browser', async ({ page }) => {
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

test('supports zooming and panning once the camera can scroll @critical @browser', async ({ page }) => {
  await dismissViewHint(page);

  const beforeZoom = await getSceneSnapshot<{ zoom: number }>(page);
  await page.getByTestId('zoom-in-button').click();
  await page.getByTestId('zoom-in-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ zoom: number }>(page)).zoom).toBeGreaterThan(beforeZoom.zoom);

  const beforePan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  // Use the test bridge pan hook to avoid flaky middle-mouse + cursor style assertions in CI browsers.
  await panByScreenDelta(page, { x: 80, y: 40 });
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
    return { scrollX: snapshot.scrollX, scrollY: snapshot.scrollY };
  }).not.toEqual({ scrollX: beforePan.scrollX, scrollY: beforePan.scrollY });
});
