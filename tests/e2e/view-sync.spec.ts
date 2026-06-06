import { expect, test } from '@playwright/test';
import { dismissViewHint, entityClientCenter, getSceneSnapshot, getState, panByScreenDelta, seedSampleScene, waitForViewportToSettle } from './helpers';

async function normalizedEntityPosition(page: Parameters<typeof entityClientCenter>[0], entityId: string) {
  const canvas = page.locator('#game-container canvas');
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas bounding box unavailable');

  const center = await entityClientCenter(page, entityId);
  return {
    x: (center.x - canvasBox.x) / canvasBox.width,
    y: (center.y - canvasBox.y) / canvasBox.height,
  };
}

test('Edit and Preview preserve camera view state @critical', async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);

  const editBefore = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string }>(page);
  expect(editBefore.sceneKey).toBe('EditorScene');

  // Use the explicit zoom controls (more reliable than wheel events in headless CI).
  await page.getByTestId('zoom-in-button').click();
  await page.getByTestId('zoom-in-button').click();
  await panByScreenDelta(page, { x: 180, y: 110 });
  await waitForViewportToSettle(page, { stableForMs: 150 });

  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string; ready?: boolean }>(page))?.ready).toBe(true);

  const editSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string; ready?: boolean }>(page);
  expect(editSnapshot.sceneKey).toBe('EditorScene');
  expect(editSnapshot.ready).toBe(true);
  expect(editSnapshot.zoom).toBeGreaterThan(editBefore.zoom);
  const editAnchorNormalized = await normalizedEntityPosition(page, 'e1');

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready).toBe(true);

  const playSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  expect(Math.abs(playSnapshot.zoom - editSnapshot.zoom)).toBeLessThanOrEqual(0.01);

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('edit'));
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('edit');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('EditorScene');
  await waitForViewportToSettle(page, { stableForMs: 150 });

  const editRestoredSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; ready?: boolean }>(page);
  expect(editRestoredSnapshot.ready).toBe(true);
  expect(Math.abs(editRestoredSnapshot.zoom - editSnapshot.zoom)).toBeLessThanOrEqual(0.01);
  await expect
    .poll(async () => {
      const restoredAnchorNormalized = await normalizedEntityPosition(page, 'e1');
      const dx = Math.abs(restoredAnchorNormalized.x - editAnchorNormalized.x);
      const dy = Math.abs(restoredAnchorNormalized.y - editAnchorNormalized.y);
      return Math.max(dx, dy);
    })
    .toBeLessThanOrEqual(0.02);
});
