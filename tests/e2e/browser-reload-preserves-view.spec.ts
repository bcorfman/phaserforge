import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, gotoStudio, panByScreenDelta, seedProject, waitForViewportToSettle } from './helpers';

function getCameraCenterWorld(snapshot: {
  scrollX: number;
  scrollY: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}, originX = 0.5, originY = 0.5) {
  const offsetX = snapshot.viewportWidth * originX * (1 - 1 / snapshot.zoom);
  const offsetY = snapshot.viewportHeight * originY * (1 - 1 / snapshot.zoom);
  return {
    x: snapshot.scrollX + offsetX + snapshot.viewportWidth / (2 * snapshot.zoom),
    y: snapshot.scrollY + offsetY + snapshot.viewportHeight / (2 * snapshot.zoom),
  };
}

test('browser reload preserves editor camera view @smoke @regression', async ({ page }) => {
  await seedProject(page, {
    id: 'project-browser-reload-view',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 800, height: 600 },
        entities: {
          e1: { id: 'e1', x: 400, y: 300, width: 32, height: 32 },
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
  await waitForViewportToSettle(page);

  const initialView = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
  for (let i = 0; i < 4; i += 1) {
    await page.getByTestId('zoom-in-button').click();
  }
  await panByScreenDelta(page, { x: 120, y: -80 });
  await waitForViewportToSettle(page);

  const beforeView = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; viewportWidth: number; viewportHeight: number }>(page);
  expect(beforeView.zoom).toBeGreaterThan(1.1);
  const initialCenter = getCameraCenterWorld(initialView);
  const beforeCenter = getCameraCenterWorld(beforeView);
  const beforeDistanceFromInitial = Math.hypot(beforeCenter.x - initialCenter.x, beforeCenter.y - initialCenter.y);
  expect(beforeDistanceFromInitial).toBeGreaterThan(20);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoStudio(page);
  await waitForViewportToSettle(page);

  const afterView = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; viewportWidth: number; viewportHeight: number }>(page);
  expect(Math.abs(afterView.zoom - beforeView.zoom)).toBeLessThanOrEqual(0.01);
  const afterCenter = getCameraCenterWorld(afterView);
  expect(Math.abs(afterCenter.x - beforeCenter.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterCenter.y - beforeCenter.y)).toBeLessThanOrEqual(1);
});
