import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntityWorldRect, getState, gotoStudio, seedSampleScene, tapWorld, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('Layout popover applies fixed spacing by centers @critical', async ({ page }) => {
  const r1 = await getEntityWorldRect(page, 'e1');
  const r2 = await getEntityWorldRect(page, 'e2');
  await tapWorld(page, { x: r1.centerX ?? (r1.minX + r1.maxX) / 2, y: r1.centerY ?? (r1.minY + r1.maxY) / 2 });
  await tapWorld(page, { x: r2.centerX ?? (r2.minX + r2.maxX) / 2, y: r2.centerY ?? (r2.minY + r2.maxY) / 2 }, { additive: true });

  const layoutButton = page.getByTestId('canvas-layout-button');
  await layoutButton.focus();
  await layoutButton.press('Enter');
  await page.getByTestId('layout-units-pixels').click();
  await page.getByTestId('layout-spacing-x').fill('64');
  await page.getByTestId('layout-apply-spacing-x').click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const e1 = state.scene?.entities?.e1;
    const e2 = state.scene?.entities?.e2;
    if (!e1 || !e2) return null;
    return Math.round(e2.x - e1.x);
  }).toBe(64);
});

test.describe('Layout popover viewport reachability', () => {
  test.use({ viewport: { width: 820, height: 520 } });

  test('Layout popover stays reachable when near viewport bottom @browser', async ({ page }) => {
    const r1 = await getEntityWorldRect(page, 'e1');
    const r2 = await getEntityWorldRect(page, 'e2');
    await tapWorld(page, { x: r1.centerX ?? (r1.minX + r1.maxX) / 2, y: r1.centerY ?? (r1.minY + r1.maxY) / 2 });
    await tapWorld(page, { x: r2.centerX ?? (r2.minX + r2.maxX) / 2, y: r2.centerY ?? (r2.minY + r2.maxY) / 2 }, { additive: true });

    const layoutButton = page.getByTestId('canvas-layout-button');
    await layoutButton.focus();
    await layoutButton.press('Enter');

    const popover = page.getByTestId('canvas-layout-popover');
    await expect(popover).toBeVisible();

    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(12);
    expect(box!.y + box!.height).toBeLessThanOrEqual((viewportSize!.height) - 12);

    const applySetY = page.getByTestId('layout-apply-set-y');
    await expect(applySetY).toBeVisible();
  });
});
