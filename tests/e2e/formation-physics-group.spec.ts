import { expect, test } from '@playwright/test';
import { getFormationPhysicsGroupInfo, getState, seedSampleScene } from './helpers';

test.setTimeout(120000);
test.describe.configure({ retries: process.env.CI ? 2 : 1 });

test('Preview/play mode builds Arcade Physics groups for formations @slow', async ({ page }) => {
  await seedSampleScene(page);

  const before = await getFormationPhysicsGroupInfo(page, 'g-enemies');
  expect(before).toBeNull();

  // This spec covers formation physics lifecycle. Mode-button interaction is covered by
  // mode-toggle-stability.spec.ts; use the state-driven bridge to avoid WebKit click flakes.
  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => {
    const state = await getState<{ mode?: string }>(page);
    return state?.mode;
  }).toBe('play');

  // The store can flip to `play` before the Phaser scene bridge swaps/updates in some engines.
  // Verify play-mode readiness by waiting for the physics group to materialize instead of asserting a specific scene key.
  await expect
    .poll(async () => getFormationPhysicsGroupInfo(page, 'g-enemies'), { timeout: 20000 })
    .toEqual({ memberCount: 15 });

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('edit'));
  await expect.poll(async () => {
    const state = await getState<{ mode?: string }>(page);
    return state?.mode;
  }).toBe('edit');

  // Mode can flip back to `edit` before the scene swap / teardown fully completes in some engines.
  await expect.poll(async () => getFormationPhysicsGroupInfo(page, 'g-enemies'), { timeout: 20000 }).toBeNull();
});
