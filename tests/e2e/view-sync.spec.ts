import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, gotoStudio, seedSampleScene, worldToClient, getState } from './helpers';

test('Edit and Preview preserve camera view state', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await dismissViewHint(page);

  const anchorWorld = { x: 512, y: 384 };
  const editBefore = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string }>(page);
  expect(editBefore.sceneKey).toBe('EditorScene');

  // Use the explicit zoom controls (more reliable than wheel events in headless CI).
  await page.getByTestId('zoom-in-button').click();
  await page.getByTestId('zoom-in-button').click();

  const editSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string }>(page);
  expect(editSnapshot.sceneKey).toBe('EditorScene');
  expect(editSnapshot.zoom).toBeGreaterThan(editBefore.zoom);

  const editPoint = await worldToClient(page, anchorWorld);
  if (!editPoint) throw new Error('Anchor point unavailable after zoom in edit mode');

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  const playSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  expect(Math.abs(playSnapshot.zoom - editSnapshot.zoom)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(playSnapshot.scrollX - editSnapshot.scrollX)).toBeLessThanOrEqual(1);
  expect(Math.abs(playSnapshot.scrollY - editSnapshot.scrollY)).toBeLessThanOrEqual(1);

  const playPoint = await worldToClient(page, anchorWorld);
  if (!playPoint) throw new Error('Anchor point unavailable in preview mode');
  expect(Math.abs(playPoint.x - editPoint.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(playPoint.y - editPoint.y)).toBeLessThanOrEqual(2);
});
