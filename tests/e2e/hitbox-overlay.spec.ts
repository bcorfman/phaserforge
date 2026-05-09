import { expect, test } from '@playwright/test';
import { dismissViewHint, seedSampleScene, gotoStudio, waitForSampleScene, tapWorld } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('shows a labeled hitbox overlay and supports toggling', async ({ page }) => {
  await dismissViewHint(page);

  const e1 = await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e1') ?? null);
  if (!e1) throw new Error('Entity rect unavailable');
  await tapWorld(page, { x: e1.centerX, y: e1.centerY });

  await page.getByTestId('entity-hitbox-enabled-input').check();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getHitboxOverlayInfo?.() ?? null);
  }).toMatchObject({ visible: true });

  const before = await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getHitboxOverlayInfo?.() ?? null);
  if (!before) throw new Error('Hitbox overlay info unavailable');

  await page.getByTestId('entity-hitbox-width-input').fill('10');
  await page.keyboard.press('Enter');

  await expect.poll(async () => {
    const next = await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getHitboxOverlayInfo?.() ?? null);
    return next?.labelX ?? null;
  }).toBeLessThan(before.labelX - 1);

  await page.getByTestId('entity-hitbox-overlay-enabled-input').uncheck();
  await expect.poll(async () => {
    return await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getHitboxOverlayInfo?.() ?? null);
  }).toMatchObject({ visible: false });

  await page.getByTestId('entity-hitbox-overlay-enabled-input').check();
  await expect.poll(async () => {
    return await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getHitboxOverlayInfo?.() ?? null);
  }).toMatchObject({ visible: true });
});

