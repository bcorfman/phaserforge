import { expect, test } from '@playwright/test';
import { dismissViewHint, entityClientCenter, getSceneSnapshot, seedSampleScene, getState } from './helpers';

test('Edit and Preview preserve camera view state @critical', async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);

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
  const canvas = page.locator('#game-container canvas');
  await expect(canvas).toBeVisible();
  const editCanvasBox = await canvas.boundingBox();
  if (!editCanvasBox) throw new Error('Canvas bounding box unavailable');
  const editAnchor = await entityClientCenter(page, 'e1');
  const editAnchorNormalized = {
    x: (editAnchor.x - editCanvasBox.x) / editCanvasBox.width,
    y: (editAnchor.y - editCanvasBox.y) / editCanvasBox.height,
  };

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready).toBe(true);

  const playSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  expect(Math.abs(playSnapshot.zoom - editSnapshot.zoom)).toBeLessThanOrEqual(0.01);
  await expect
    .poll(async () => {
      const playCanvasBox = await canvas.boundingBox();
      if (!playCanvasBox) return Number.POSITIVE_INFINITY;
      const playAnchor = await entityClientCenter(page, 'e1');
      const playAnchorNormalized = {
        x: (playAnchor.x - playCanvasBox.x) / playCanvasBox.width,
        y: (playAnchor.y - playCanvasBox.y) / playCanvasBox.height,
      };
      const dx = Math.abs(playAnchorNormalized.x - editAnchorNormalized.x);
      const dy = Math.abs(playAnchorNormalized.y - editAnchorNormalized.y);
      return Math.max(dx, dy);
    })
    .toBeLessThanOrEqual(0.02);
});
