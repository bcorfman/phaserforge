import { expect, test } from '@playwright/test';

const docsBaseUrl = process.env.DOCS_BASE_URL ?? 'http://127.0.0.1:4174/phaserforge/docs';

test('docs lists keep visible markers after hydration @browser', async ({ page }) => {
  await page.goto(`${docsBaseUrl}/getting-started/cloud-account-setup`);
  await page.waitForLoadState('networkidle');

  const orderedMarker = await page.locator('.vp-doc ol > li').first().evaluate((item) => {
    return window.getComputedStyle(item, '::before').content;
  });
  const unorderedMarker = await page.locator('.vp-doc ul > li').first().evaluate((item) => {
    return window.getComputedStyle(item, '::before').content;
  });

  expect(orderedMarker).not.toMatch(/^(none|normal)$/);
  expect(unorderedMarker).toBe('"•"');
});
