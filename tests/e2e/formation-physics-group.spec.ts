import { expect, test } from '@playwright/test';
import { getFormationPhysicsGroupInfo, getSceneSnapshot, getState, seedSampleScene } from './helpers';

test('Preview/play mode builds Arcade Physics groups for formations', async ({ page }) => {
  await seedSampleScene(page);

  const beforeScene = await getSceneSnapshot<{ sceneKey?: string }>(page);
  expect(beforeScene?.sceneKey).toBe('EditorScene');

  const before = await getFormationPhysicsGroupInfo(page, 'g-enemies');
  expect(before).toBeNull();

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => {
    const state = await getState<{ mode?: string }>(page);
    return state?.mode;
  }).toBe('play');

  const playScene = await getSceneSnapshot<{ sceneKey?: string }>(page);
  expect(playScene?.sceneKey).toBe('GameScene');

  const info = await getFormationPhysicsGroupInfo(page, 'g-enemies');
  expect(info).toEqual({ memberCount: 15 });

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => {
    const state = await getState<{ mode?: string }>(page);
    return state?.mode;
  }).toBe('edit');

  const afterScene = await getSceneSnapshot<{ sceneKey?: string }>(page);
  expect(afterScene?.sceneKey).toBe('EditorScene');

  const after = await getFormationPhysicsGroupInfo(page, 'g-enemies');
  expect(after).toBeNull();
});
