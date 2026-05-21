import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, reloadRuntime, seedSampleScene } from './helpers';

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

  const beforeView = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; viewportWidth: number; viewportHeight: number }>(page);
  const worldToViewport = async () => {
    const result = await page.evaluate((worldPoint) => {
      const bridge = window.__PHASER_ACTIONS_STUDIO_TEST__;
      if (!bridge) return null;
      const client = bridge.worldToClient(worldPoint);
      const snapshot = bridge.getSceneSnapshot();
      const canvas = document.querySelector<HTMLCanvasElement>('#game-container canvas');
      if (!client || !snapshot || !canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const scaleX = snapshot.viewportWidth / rect.width;
      const scaleY = snapshot.viewportHeight / rect.height;
      return { x: (client.x - rect.left) * scaleX, y: (client.y - rect.top) * scaleY };
    }, anchorWorldPoint);
    if (!result || typeof (result as any).x !== 'number' || typeof (result as any).y !== 'number') {
      throw new Error(`worldToViewport returned null/invalid for ${JSON.stringify(anchorWorldPoint)}`);
    }
    return { x: Number((result as any).x), y: Number((result as any).y) };
  };

  const before = await worldToViewport();
  await reloadRuntime(page);

  // View-state restore can be async after the runtime re-compiles; wait for the viewport to settle.
  const round = (value: number, places = 2) => {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  };

  const beforeRounded = {
    zoom: round(beforeView.zoom, 3),
    scrollX: round(beforeView.scrollX, 2),
    scrollY: round(beforeView.scrollY, 2),
    viewportWidth: Math.round(beforeView.viewportWidth),
    viewportHeight: Math.round(beforeView.viewportHeight),
  };

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; viewportWidth: number; viewportHeight: number }>(page);
    const current = {
      zoom: round(snap.zoom, 3),
      scrollX: round(snap.scrollX, 2),
      scrollY: round(snap.scrollY, 2),
      viewportWidth: Math.round(snap.viewportWidth),
      viewportHeight: Math.round(snap.viewportHeight),
    };

    const viewportStable = Math.abs(current.viewportWidth - beforeRounded.viewportWidth) <= 2
      && Math.abs(current.viewportHeight - beforeRounded.viewportHeight) <= 2;
    const viewRestored = Math.abs(current.zoom - beforeRounded.zoom) <= 0.005
      && Math.abs(current.scrollX - beforeRounded.scrollX) <= 0.5
      && Math.abs(current.scrollY - beforeRounded.scrollY) <= 0.5;

    return viewportStable && viewRestored;
  }, { timeout: 30000 }).toBe(true);

  await expect
    .poll(
      async () => {
        const after = await worldToViewport();
        const dx = Math.abs(after.x - before.x);
        const dy = Math.abs(after.y - before.y);
        return dx <= 0.5 && dy <= 0.5;
      },
      { timeout: 30000 }
    )
    .toBe(true);
});
