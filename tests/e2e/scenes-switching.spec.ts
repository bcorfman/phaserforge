import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, seedSampleScene } from './helpers';

test('create a second scene, switch scenes, and preserve per-scene edits', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await dismissViewHint(page);

  const state1 = await getState<{ currentSceneId?: string; scene?: { entities?: Record<string, unknown> } }>(page);
  const firstSceneId = state1.currentSceneId ?? 'scene-1';
  const firstCount = Object.keys(state1.scene?.entities ?? {}).length;
  expect(firstCount).toBeGreaterThan(0);

  await page.getByTestId('create-scene-button').click();

  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).not.toBe(firstSceneId);
  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
    return Object.keys(state.scene?.entities ?? {}).length;
  }).toBe(0);
  const secondState = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
  const secondCount = Object.keys(secondState.scene?.entities ?? {}).length;

  expect(firstCount).not.toBe(secondCount);

  await page.getByTestId(`scene-item-${firstSceneId}`).click();
  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).toBe(firstSceneId);
  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
    return Object.keys(state.scene?.entities ?? {}).length;
  }).toBe(firstCount);
});
