import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, gotoStudio, seedSampleScene } from './helpers';

test('Escape exits play mode back to edit mode', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await dismissViewHint(page);

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('edit');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('EditorScene');
});

