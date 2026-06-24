import { expect, test } from '@playwright/test';
import { dismissViewHint, openProjectScope, seedSampleScene, waitForEmptyScene } from './helpers';

test.describe('Project picker', () => {
  test('shows project manage actions and opens the picker from the project tree @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);

    await expect(page.getByTestId('project-sync-badge')).toHaveText('Online');
    await page.getByTestId('project-sync-badge').click();
    await expect(page.getByTestId('project-sync-badge')).toHaveText('Offline');

    await openProjectScope(page);
    await page.getByTestId('project-tree-manage-button').click();
    await expect(page.getByTestId('project-manage-create')).toBeVisible();
    await expect(page.getByTestId('project-manage-open')).toBeVisible();
    await expect(page.getByTestId('project-manage-toggle-sync')).toBeVisible();
    await expect(page.getByTestId('project-manage-import-yaml')).toBeVisible();
    await expect(page.getByTestId('project-manage-export-yaml')).toBeVisible();

    await page.getByTestId('project-manage-open').click();
    await expect(page.getByTestId('project-picker-panel')).toBeVisible();
    await expect(page.getByTestId('project-picker-search')).toBeVisible();
    await expect(page.getByTestId('project-picker-list')).toContainText('Untitled Project');
  });

  test('creates a new local project from the project tree manage menu @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-create').click();
    await waitForEmptyScene(page);
    await expect(page.getByTestId('project-sync-badge')).toHaveText('Online');
  });
});
