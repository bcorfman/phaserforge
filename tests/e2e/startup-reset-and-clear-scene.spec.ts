import { expect, test } from '@playwright/test';
import { dismissViewHint, openProjectScope, openSceneScope, seedSampleScene, waitForEmptyScene, waitForSampleScene } from './helpers';

test.describe('Project reset + Clear Scene', () => {
  test('resets to a new empty scene from the project manage menu @critical', async ({ page }) => {
    await seedSampleScene(page);
    await waitForSampleScene(page);
    await dismissViewHint(page);

    await openProjectScope(page);
    await expect(page.getByTestId('project-startup-panel')).toHaveCount(0);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-clear').click();
    await waitForEmptyScene(page);
  });

  test('clears a scene via the scene overflow menu @critical', async ({ page }) => {
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
