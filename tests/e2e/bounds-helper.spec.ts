import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, seedSampleScene, selectGroupInSceneGraph, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('Bounds editor updates BoundsHit bounds @critical', async ({ page }) => {
  await page.getByTestId('scene-item-scene-1').click().catch(() => {});
  await selectGroupInSceneGraph(page, 'g-enemies');
  // Open a group-targeted MoveUntil attachment with BoundsHit enabled.
  await page.getByTestId('attachment-open-att-move-right').click();

  const before = await getState<any>(page);
  const b0 = before.scene.attachments['att-move-right']?.condition?.bounds;
  expect(b0).toBeTruthy();

  const minX = page.getByTestId('attachment-bounds-min-x-input');
  await minX.click();
  await minX.press('Control+A');
  await minX.type(String(Number(b0.minX) + 10));
  await minX.evaluate((el: HTMLInputElement) => el.blur());

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const bounds = state.scene.attachments['att-move-right']?.condition?.bounds;
    return bounds ? { minX: bounds.minX, maxX: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY } : null;
  }).not.toEqual({ minX: b0.minX, maxX: b0.maxX, minY: b0.minY, maxY: b0.maxY });
});
