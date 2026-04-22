import { expect, test } from '@playwright/test';
import { seedSampleScene } from './helpers';

test('Formation label sits flush to the chevron', async ({ page }) => {
  await seedSampleScene(page);

  const chevron = page.getByTestId('toggle-group-g-enemies');
  const label = page.getByTestId('group-item-g-enemies');
  await expect(chevron).toBeVisible();
  await expect(label).toBeVisible();

  const gap = await page.evaluate(() => {
    const chevronEl = document.querySelector('[data-testid="toggle-group-g-enemies"]') as HTMLElement | null;
    const labelEl = document.querySelector('[data-testid="group-item-g-enemies"]') as HTMLElement | null;
    if (!chevronEl || !labelEl) return null;
    const chevronRect = chevronEl.getBoundingClientRect();
    const labelRect = labelEl.getBoundingClientRect();
    return Math.round((labelRect.left - chevronRect.right) * 10) / 10;
  });

  expect(gap).not.toBeNull();
  expect(gap!).toBeLessThanOrEqual(1);
});
