import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, gotoStudio, seedSampleScene, worldToClient, getState } from './helpers';

test('Edit and Preview preserve camera view state @critical', async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);

  const anchorWorld = { x: 512, y: 384 };
  const editBefore = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string }>(page);
  expect(editBefore.sceneKey).toBe('EditorScene');

  // Use the explicit zoom controls (more reliable than wheel events in headless CI).
  await page.getByTestId('zoom-in-button').click();
  await page.getByTestId('zoom-in-button').click();

  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string; ready?: boolean }>(page))?.ready).toBe(true);

  const editSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string; ready?: boolean }>(page);
  expect(editSnapshot.sceneKey).toBe('EditorScene');
  expect(editSnapshot.ready).toBe(true);
  expect(editSnapshot.zoom).toBeGreaterThan(editBefore.zoom);
  const editPoint = await worldToClient(page, anchorWorld);
  expect(editPoint).toBeTruthy();
  const canvas = page.locator('#game-container canvas');
  await expect(canvas).toBeVisible();
  const editCanvasBox = await canvas.boundingBox();
  if (!editCanvasBox) throw new Error('Canvas bounding box unavailable');
  const editPointInCanvas = { x: editPoint.x - editCanvasBox.x, y: editPoint.y - editCanvasBox.y };

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready).toBe(true);

  const playSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  expect(Math.abs(playSnapshot.zoom - editSnapshot.zoom)).toBeLessThanOrEqual(0.01);

  // Validate the user-visible invariant: the same world point stays in (nearly) the same screen location.
  // Minor pixel drift can occur due to per-scene pixel-rounding / device scale differences, especially under load.
  // Compare relative to the canvas origin so layout shifts between edit/play modes don't cause false failures.
  const maxPixelDelta = 5;
  await expect
    .poll(async () => {
      const playPoint = await worldToClient(page, anchorWorld);
      if (!playPoint) return Number.POSITIVE_INFINITY;
      const playCanvasBox = await canvas.boundingBox();
      if (!playCanvasBox) return Number.POSITIVE_INFINITY;
      const playPointInCanvas = { x: playPoint.x - playCanvasBox.x, y: playPoint.y - playCanvasBox.y };
      const dx = Math.abs(playPointInCanvas.x - editPointInCanvas.x);
      const dy = Math.abs(playPointInCanvas.y - editPointInCanvas.y);
      return Math.max(dx, dy);
    })
    .toBeLessThanOrEqual(maxPixelDelta);
});
