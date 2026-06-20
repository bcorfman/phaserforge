import { expect, test } from '@playwright/test';
import { dismissViewHint, seedSampleScene } from './helpers';

test.describe('Project tree + history', () => {
  test('supports manage actions, restore, and copy flows @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);

    await expect(page.getByTestId('project-tree-root-button')).toContainText('Untitled Project');

    await page.getByTestId('project-tree-manage-button').click();
    await expect(page.getByTestId('project-manage-rename')).toBeVisible();
    await expect(page.getByTestId('project-manage-history')).toBeVisible();
    await expect(page.getByTestId('project-manage-clear')).toBeVisible();

    await page.getByTestId('project-manage-rename').click();
    await expect(page.getByTestId('rename-project-input')).toBeVisible();
    await page.getByTestId('rename-project-input').fill('History Demo');
    await page.getByTestId('rename-project-input').press('Enter');
    await expect(page.getByTestId('project-tree-root-button')).toContainText('History Demo');

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();
    await expect(page.getByTestId('project-revisions-pane')).toBeVisible();
    await expect(page.getByTestId(/project-revision-/).nth(1)).toBeVisible();

    await page.getByTestId(/project-revision-restore-/).nth(1).click();
    await expect(page.getByTestId('restore-revision-dialog')).toBeVisible();
    await page.getByTestId('restore-revision-confirm-button').click();
    await expect(page.getByTestId('project-tree-root-button')).toContainText('Untitled Project');

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();
    await page.getByTestId(/project-revision-copy-/).first().click();
    await expect(page.getByTestId('copy-revision-dialog')).toBeVisible();
    await page.getByTestId('copy-revision-name-input').fill('History Fork');
    await page.getByTestId('copy-revision-confirm-button').click();
    await expect(page.getByTestId('project-tree-root-button')).toContainText('History Fork');
  });
});
