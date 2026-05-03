import { expect, test } from '@playwright/test';
import { dismissViewHint, gotoStudio, seedSampleScene, selectGroupInSceneGraph, worldToClient, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('right-click does not open a canvas context menu (selection actions are on the selection bar)', async ({ page }) => {
  await dismissViewHint(page);

  const e2 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  if (!e2) throw new Error('Entity rect unavailable');
  const point = await worldToClient(page, { x: e2.centerX, y: e2.centerY });
  await page.mouse.click(point.x, point.y, { button: 'right' });

  await expect(page.getByTestId('canvas-context-menu')).toHaveCount(0);
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

test('top-right selection actions are not shown (selection actions are near-cursor only)', async ({ page }) => {
  await dismissViewHint(page);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expect(page.getByTestId('canvas-selection-actions-top-right')).toHaveCount(0);
});
