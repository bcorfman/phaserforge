import { expect, test } from '@playwright/test';
import { dismissViewHint, openProjectScope, openSceneScope, seedSampleScene, waitForEmptyScene, waitForSampleScene } from './helpers';

test.describe('Startup & Reset + Clear Scene', () => {
  test('resets to a new empty scene without reload', async ({ page }) => {
    await seedSampleScene(page);
    await waitForSampleScene(page);
    await dismissViewHint(page);

    await openProjectScope(page);
    await expect(page.getByTestId('project-startup-panel')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('project-reset-now-button').click();
    await waitForEmptyScene(page);
  });

  test('clears a scene via the scene overflow menu', async ({ page }) => {
    await seedSampleScene(page);
    await waitForSampleScene(page);
    await dismissViewHint(page);

    await openSceneScope(page);
    await page.getByTestId('scene-menu-scene-1').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('scene-menu-clear-scene-1').click();
    await waitForEmptyScene(page);
  });
});

