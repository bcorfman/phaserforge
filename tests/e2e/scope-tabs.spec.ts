import { expect, test } from '@playwright/test';
import { dismissViewHint, gotoStudio, seedSampleScene, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaseractions.projectYaml.v1');
    window.localStorage.removeItem('phaseractions.startupMode.v1');
    window.localStorage.removeItem('phaseractions.themeMode.v1');
    window.localStorage.removeItem('phaseractions.uiScale.v1');
    window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
  });
});

test('sidebar scope tabs switch between scene and project panels', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await expect(page.getByTestId('sidebar-scope-tab-scene')).toBeVisible();
  await expect(page.getByTestId('sidebar-scope-tab-project')).toBeVisible();

  // Default: Scene tab shows scene graph sections.
  await expect(page.getByTestId('sprites-dropzone')).toBeVisible();

  // Project tab shows project-scoped tools (sprite import).
  await page.getByTestId('sidebar-scope-tab-project').click();
  await expect(page.getByTestId('sprite-file-input')).toBeVisible();
  await expect(page.getByTestId('sprites-dropzone')).toHaveCount(0);

  // Switching back restores scene graph sections.
  await page.getByTestId('sidebar-scope-tab-scene').click();
  await expect(page.getByTestId('sprites-dropzone')).toBeVisible();
});

