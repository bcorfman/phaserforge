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

  const beforeView = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  const before = await worldToClient(page, anchorWorldPoint);
  await reloadRuntime(page);

  // View-state restore can be async after the runtime re-compiles; wait for it to settle.
  const round = (value: number, places = 2) => {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  };

  await expect
    .poll(
      async () => {
        const snap = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
        return { zoom: round(snap.zoom, 3), scrollX: round(snap.scrollX, 2), scrollY: round(snap.scrollY, 2) };
      },
      { timeout: 30000 }
    )
    .toEqual({ zoom: round(beforeView.zoom, 3), scrollX: round(beforeView.scrollX, 2), scrollY: round(beforeView.scrollY, 2) });

  await expect
    .poll(
      async () => {
        const after = await worldToClient(page, anchorWorldPoint);
        const dx = Math.abs(after.x - before.x);
        const dy = Math.abs(after.y - before.y);
        return dx <= 1 && dy <= 1;
      },
      { timeout: 30000 }
    )
    .toBe(true);
});
