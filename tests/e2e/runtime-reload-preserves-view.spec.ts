import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, reloadRuntime, seedSampleScene, worldToClient } from './helpers';

test('runtime reload preserves editor camera view', async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);

  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.panByScreenDelta?.({ x: 140, y: -90 }));
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
    return { scrollX: snapshot.scrollX, scrollY: snapshot.scrollY };
  }).not.toEqual({ scrollX: 0, scrollY: 0 });

  const state = await getState<{ scene?: { world?: { width: number; height: number } } } | null>(page);
  const world = state?.scene?.world ?? { width: 800, height: 600 };
  const anchorWorldPoint = { x: world.width / 2, y: world.height / 2 };

  const before = await worldToClient(page, anchorWorldPoint);
  await reloadRuntime(page);
  const after = await worldToClient(page, anchorWorldPoint);

  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
});

