import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, panByScreenDelta, seedProject } from './helpers';

test('runtime reload preserves editor camera view @regression', async ({ page }) => {
  await seedProject(page, {
    id: 'project-runtime-reload',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 1024, height: 768 },
        entities: {
          e1: { id: 'e1', x: 512, y: 384, width: 32, height: 32 },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
      },
    },
    initialSceneId: 'scene-1',
  });
  await dismissViewHint(page);

  await panByScreenDelta(page, { x: 140, y: -90 });

  const anchorWorldPoint = { x: 512, y: 384 };
  const beforeView = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  const beforeAnchor = await page.evaluate((worldPoint) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(worldPoint), anchorWorldPoint);
  if (!beforeAnchor) throw new Error('Before anchor point unavailable');

  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.reloadRuntime?.());

  // Keep this bounded: runtime reload should be fast for a minimal scene (no assets to decode).
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready, { timeout: 5000 }).toBe(true);

  const afterView = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  expect(Math.abs(afterView.zoom - beforeView.zoom)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(afterView.scrollX - beforeView.scrollX)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterView.scrollY - beforeView.scrollY)).toBeLessThanOrEqual(1);

  const afterAnchor = await page.evaluate((worldPoint) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(worldPoint), anchorWorldPoint);
  if (!afterAnchor) throw new Error('After anchor point unavailable');
  // Allow small pixel-rounding differences across reloads/drivers (headless rendering can land on different subpixels).
  expect(Math.abs(afterAnchor.x - beforeAnchor.x)).toBeLessThanOrEqual(6);
  expect(Math.abs(afterAnchor.y - beforeAnchor.y)).toBeLessThanOrEqual(6);
});
