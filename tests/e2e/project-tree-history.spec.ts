import { expect, test } from '@playwright/test';
import { dismissViewHint, seedSampleScene } from './helpers';

test.describe('Project tree + history', () => {
  test('supports manage actions, restore, and copy flows @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);

    await expect(page.getByTestId('project-tree-root-button')).toContainText('Untitled Project');

    await page.getByTestId('project-tree-manage-button').click();
    await expect(page.getByTestId('project-manage-create')).toBeVisible();
    await expect(page.getByTestId('project-manage-open')).toBeVisible();
    await expect(page.getByTestId('project-manage-toggle-sync')).toBeVisible();
    await expect(page.getByTestId('project-manage-import-yaml')).toBeVisible();
    await expect(page.getByTestId('project-manage-export-yaml')).toBeVisible();
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
    const revisionsPane = page.getByTestId('project-revisions-pane');
    await expect(revisionsPane).toBeVisible();
    const revisionCards = page.locator('.behavior-block[data-testid^="project-revision-"]');
    await expect(revisionCards.nth(1)).toBeVisible();
    await expect(revisionCards.first()).toContainText('Renamed to History Demo');
    await expect(revisionsPane).toContainText(/(Initial snapshot|entity added|entities added|scene added|scenes added|Minor edits)/);
    await expect(revisionsPane).not.toContainText('Autosave checkpoint');
    await expect(revisionsPane).not.toContainText('Start:');

    await page.getByTestId(/project-revision-restore-/).nth(1).click();
    await expect(page.getByTestId('restore-revision-dialog')).toBeVisible();
    await page.getByTestId('restore-revision-confirm-button').click();
    await expect(page.getByTestId('project-tree-root-button')).toContainText('Untitled Project');

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();
    await expect(revisionsPane).toBeVisible();
    const firstRevisionCard = page.locator('.behavior-block[data-testid^="project-revision-"]').first();
    await expect(firstRevisionCard).toBeVisible();
    const firstCopyButton = firstRevisionCard.getByRole('button', { name: 'Copy...' });
    await expect(firstCopyButton).toBeVisible();
    await firstCopyButton.scrollIntoViewIfNeeded();
    await firstCopyButton.click();
    await expect(page.getByTestId('copy-revision-dialog')).toBeVisible();
    await page.getByTestId('copy-revision-name-input').fill('History Fork');
    await page.getByTestId('copy-revision-confirm-button').click();
    await expect(page.getByTestId('project-tree-root-button')).toContainText('History Fork');
  });
});
