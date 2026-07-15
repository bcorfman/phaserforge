import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, seedSampleScene, waitForSampleScene } from './helpers';

test('Play mode: runtime scene bridge targets the active game scene @browser', async ({ page }) => {
  await seedSampleScene(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string; ready?: boolean }>(page))?.ready).toBe(true);
  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{
      sceneKey?: string;
      worldWidth?: number;
      worldHeight?: number;
    }>(page);
    return {
      sceneKey: snap?.sceneKey ?? null,
      worldWidth: snap?.worldWidth ?? null,
      worldHeight: snap?.worldHeight ?? null,
    };
  }).toEqual({
    sceneKey: 'GameScene',
    worldWidth: 1024,
    worldHeight: 768,
  });
});
