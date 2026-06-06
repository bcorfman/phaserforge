import { expect, test } from '@playwright/test';
import { dismissViewHint, openProjectScope, seedSampleScene, waitForEmptyScene } from './helpers';

test.describe('Project picker', () => {
  test('shows the project picker and can create a new local project @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);

    await expect(page.getByTestId('project-sync-badge')).toHaveText('Online');
    await page.getByTestId('project-sync-badge').click();
    await expect(page.getByTestId('project-sync-badge')).toHaveText('Offline');

    await openProjectScope(page);
    await expect(page.getByTestId('project-picker-panel')).toBeVisible();
    await expect(page.getByTestId('project-picker-search')).toBeVisible();
    await expect(page.getByTestId('project-picker-list')).toContainText('Untitled Project');

    await page.getByRole('button', { name: 'New Project' }).click();
    await waitForEmptyScene(page);
    await expect(page.getByTestId('project-sync-badge')).toHaveText('Online');
  });
});
