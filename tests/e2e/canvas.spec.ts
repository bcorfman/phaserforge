import { expect, test } from '@playwright/test';
import {
  dragBoundsHandle,
  dragWorld,
  expectSelection,
  getEditableBoundsRect,
  getEntityWorldRect,
  getSceneSnapshot,
  getState,
  gotoStudio,
  panByScreenDelta,
  tapWorld,
  triggerRedo,
  triggerUndo,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await gotoStudio(page);
});

test('selects an entity by clicking it on the canvas', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  await expectSelection(page, { kind: 'entity', id: 'e1' });
  await expect(page.getByTestId('inspector')).toContainText('e1');
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
  await page.getByTestId('action-item-a-move-right').click();
  await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
    minX: 80,
    minY: 60,
  });

  await dragBoundsHandle(page, 'nw', { x: 20, y: 20 });

  await expect.poll(async () => {
    const state = await getState<{ scene: { conditions: Record<string, { bounds: { minX: number; minY: number; maxX: number; maxY: number } }> } }>(page);
    return state.scene.conditions['c-bounds'].bounds;
  }).toMatchObject({
    minX: 100,
    minY: 80,
  });
});

test('supports wheel zoom and space-drag panning in the canvas viewport', async ({ page }) => {
  const canvas = page.locator('#game-container canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box unavailable');

  const before = await getSceneSnapshot<{ zoom: number; scrollX: number }>(page);
  await canvas.hover();
  await page.mouse.wheel(0, -320);
  await expect.poll(async () => (await getSceneSnapshot<{ zoom: number }>(page)).zoom).toBeGreaterThan(before.zoom);

  const beforePan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  await panByScreenDelta(page, { x: -80, y: -40 });
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
    return { scrollX: snapshot.scrollX, scrollY: snapshot.scrollY };
  }).not.toEqual({ scrollX: beforePan.scrollX, scrollY: beforePan.scrollY });
});
