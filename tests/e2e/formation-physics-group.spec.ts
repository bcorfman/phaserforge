import { expect, test } from '@playwright/test';
import { getFormationPhysicsGroupInfo, getState, seedSampleScene } from './helpers';

test.setTimeout(120000);
test.describe.configure({ retries: process.env.CI ? 2 : 1 });

test('Preview/play mode builds Arcade Physics groups for formations', async ({ page }) => {
  await seedSampleScene(page);

  const before = await getFormationPhysicsGroupInfo(page, 'g-enemies');
  expect(before).toBeNull();

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => {
    const state = await getState<{ mode?: string }>(page);
    return state?.mode;
  }).toBe('play');

  // The store can flip to `play` before the Phaser scene bridge swaps/updates in some engines.
  // Verify play-mode readiness by waiting for the physics group to materialize instead of asserting a specific scene key.
  await expect
    .poll(async () => getFormationPhysicsGroupInfo(page, 'g-enemies'), { timeout: 20000 })
    .toEqual({ memberCount: 15 });

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => {
    const state = await getState<{ mode?: string }>(page);
    return state?.mode;
  }).toBe('edit');

  const after = await getFormationPhysicsGroupInfo(page, 'g-enemies');
  expect(after).toBeNull();
});
