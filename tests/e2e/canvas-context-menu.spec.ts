import { expect, test } from '@playwright/test';
import { dismissViewHint, expectSelection, getState, gotoStudio, seedSampleScene, selectGroupInSceneGraph, tapWorld, worldToClient, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('right-click opens a cursor context menu and selects the entity under the cursor', async ({ page }) => {
  await dismissViewHint(page);

  const e2 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  if (!e2) throw new Error('Entity rect unavailable');
  const point = await worldToClient(page, { x: e2.centerX, y: e2.centerY });
  await page.mouse.click(point.x, point.y, { button: 'right' });

  await expectSelection(page, { kind: 'entity', id: 'e2' });
  await expect(page.getByTestId('canvas-context-menu')).toBeVisible();
});

test('context menu routes layout conversion through the inspector (no nested submenu)', async ({ page }) => {
  await dismissViewHint(page);
  await selectGroupInSceneGraph(page, 'g-enemies');

  await page.getByTestId('canvas-selection-menu-button').click();
  await expect(page.getByTestId('canvas-context-menu')).toBeVisible();
  await expect(page.getByTestId('canvas-menu-convert-layout')).toHaveCount(0);
  await page.getByTestId('canvas-menu-open-layout-inspector').click();
  await expect(page.getByTestId('canvas-context-menu')).toBeHidden();

  await expect(page.getByTestId('layout-type-select')).toBeVisible();
});

test('top-right selection actions appear when selection is non-empty', async ({ page }) => {
  await dismissViewHint(page);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expect(page.getByTestId('canvas-selection-actions-top-right')).toBeVisible();
});
