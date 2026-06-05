import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, seedSampleScene, getState } from './helpers';

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

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready).toBe(true);

  const playSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  expect(Math.abs(playSnapshot.zoom - editSnapshot.zoom)).toBeLessThanOrEqual(0.01);
  // The mode switch invariant is the preserved camera state. Screen-space projection has proven brittle
  // under transformed UI scale and headless layout timing even when the underlying camera state is identical.
  expect(Math.abs(playSnapshot.scrollX - editSnapshot.scrollX)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(playSnapshot.scrollY - editSnapshot.scrollY)).toBeLessThanOrEqual(0.01);
});
