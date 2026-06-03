import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, seedSampleScene } from './helpers';

test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);
});

test('after resizing the world, zoom can increase until the world frame nearly fills the viewport @browser', async ({ page }) => {
  await page.getByTestId('world-width-input').fill('200');
  await page.getByTestId('world-width-input').press('Enter');
  await page.getByTestId('world-height-input').fill('150');
  await page.getByTestId('world-height-input').press('Enter');

  await expect.poll(async () => {
    const state = await getState<{ project?: { scenes?: Record<string, any> }; currentSceneId?: string }>(page);
    const scene = state?.project?.scenes?.[state.currentSceneId ?? ''];
    const world = scene?.world;
    return world ? { width: world.width, height: world.height } : null;
  }).toEqual({ width: 200, height: 150 });

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ ready: boolean }>(page);
    return snap.ready;
  }).toBe(true);

  const beforeZoom = await getSceneSnapshot<{ zoom: number; maxZoom?: number }>(page);
  const zoomSteps = Math.max(1, Math.ceil(((beforeZoom.maxZoom ?? beforeZoom.zoom) - beforeZoom.zoom) / 0.2) + 1);

  // Drive the zoom-in button only as far as needed to reach the quantized max clamp.
  for (let i = 0; i < zoomSteps; i += 1) {
    await page.getByTestId('zoom-in-button').click();
  }

  const final = await getSceneSnapshot<{ zoom: number; maxZoom?: number; viewportWidth: number; viewportHeight: number; worldWidth?: number; worldHeight?: number }>(page);
  const viewportFillZoom = Math.min(final.viewportWidth / 200, final.viewportHeight / 150);
  const minExpectedZoom = viewportFillZoom - 0.15;
  expect(final.zoom).toBeCloseTo(final.maxZoom ?? final.zoom, 2);
  if (final.zoom < minExpectedZoom) {
    throw new Error(
      [
        'Zoom did not reach expected fill threshold.',
        `zoom=${final.zoom}`,
        `minExpectedZoom=${minExpectedZoom}`,
        `fillZoom=${viewportFillZoom}`,
        `maxZoom=${final.maxZoom ?? 'n/a'}`,
        `viewport=${final.viewportWidth}x${final.viewportHeight}`,
        `world=${final.worldWidth ?? 'n/a'}x${final.worldHeight ?? 'n/a'}`,
      ].join(' ')
    );
  }
});
