import { expect, test } from '@playwright/test';

const OUTPUT_PATH = process.env.PATTERN_DEMO_CLOUD_STORAGE_STATE_OUTPUT?.trim() || 'playwright/.auth/pattern-demo-cloud.json';

test('capture cloud auth storage state for hosted PhaserForge', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 30000 });

  await page.getByTestId('inspector-pane-tab-cloud').click();

  const signedIn = page.locator('.cloud-signed-in');
  const signInCta = page.getByTestId('cloud-publish-signin-cta');

  if (!(await signedIn.isVisible().catch(() => false))) {
    await page.pause();
  }

  await page.getByTestId('inspector-pane-tab-cloud').click();
  await expect(signedIn).toBeVisible({ timeout: 120000 });
  await expect(signInCta).toHaveCount(0);

  await page.context().storageState({ path: OUTPUT_PATH });
  test.info().annotations.push({ type: 'storage-state', description: OUTPUT_PATH });
});
