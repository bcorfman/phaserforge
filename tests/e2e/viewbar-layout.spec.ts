import { expect, test } from '@playwright/test';
import { dismissViewHint, seedSampleScene } from './helpers';

test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);
});

test('viewport controls sit above the viewport heading copy', async ({ page }) => {
  const zoomOutButton = page.getByTestId('zoom-out-button');
  const viewportHeading = page.locator('#viewport-heading');

  await expect(zoomOutButton).toBeVisible();
  await expect(viewportHeading).toBeVisible();

  const [zoomOutBox, headingBox] = await Promise.all([zoomOutButton.boundingBox(), viewportHeading.boundingBox()]);
  if (!zoomOutBox || !headingBox) throw new Error('Expected both viewbar controls and heading to have layout boxes');

  expect(zoomOutBox.y).toBeLessThan(headingBox.y);
});

