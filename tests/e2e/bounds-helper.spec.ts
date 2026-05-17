import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, seedSampleScene, selectGroupInSceneGraph, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('Bounds Helper auto-fills from target and applies computed bounds', async ({ page }) => {
  await page.getByTestId('scene-item-scene-1').click().catch(() => {});
  await selectGroupInSceneGraph(page, 'g-enemies');
  // Open a group-targeted MoveUntil attachment with BoundsHit enabled.
  await page.getByTestId('attachment-open-att-move-right').click();

  const before = await getState<any>(page);
  const b0 = before.scene.attachments['att-move-right']?.condition?.bounds;
  expect(b0).toBeTruthy();

  await page.getByTestId('bounds-helper-auto').click();

  const xSpan = page.getByTestId('bounds-helper-xspan');
  await xSpan.click();
  await xSpan.press('Control+A');
  await xSpan.type('40');
  await xSpan.evaluate((el: HTMLInputElement) => el.blur());

  const ySpan = page.getByTestId('bounds-helper-yspan');
  await ySpan.click();
  await ySpan.press('Control+A');
  await ySpan.type('0');
  await ySpan.evaluate((el: HTMLInputElement) => el.blur());
  await page.getByTestId('bounds-helper-apply').click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const bounds = state.scene.attachments['att-move-right']?.condition?.bounds;
    return bounds ? { minX: bounds.minX, maxX: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY } : null;
  }).not.toEqual({ minX: b0.minX, maxX: b0.maxX, minY: b0.minY, maxY: b0.maxY });
});
