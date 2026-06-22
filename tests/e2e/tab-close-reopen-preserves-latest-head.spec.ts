import { expect, test } from '@playwright/test';
import { dismissViewHint, gotoStudio, openProjectScope, seedSampleScene, waitForSampleScene } from './helpers';

test('tab close and reopen restores the latest active project head and history @regression', async ({ page }) => {
  await seedSampleScene(page, { once: true });
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await page.getByTestId('project-tree-manage-button').click();
  await page.getByTestId('project-manage-rename').click();
  await page.getByTestId('rename-project-input').fill('Pattern Demo');
  await page.getByTestId('rename-project-input').press('Enter');
  await expect(page.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');

  await page.getByTestId('project-tree-manage-button').click();
  await page.getByTestId('project-manage-history').click();
  const revisionsPane = page.getByTestId('project-revisions-pane');
  await expect(revisionsPane).toBeVisible();
  await expect(revisionsPane).toContainText('Renamed to Pattern Demo');

  await page.close({ runBeforeUnload: true });

  const reopenedPage = await page.context().newPage();
  try {
    await gotoStudio(reopenedPage, { forceNavigate: true });
    await waitForSampleScene(reopenedPage);
    await dismissViewHint(reopenedPage);

    await expect(reopenedPage.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');
    await openProjectScope(reopenedPage);
    await reopenedPage.getByTestId('project-tree-manage-button').click();
    await reopenedPage.getByTestId('project-manage-history').click();
    await expect(reopenedPage.getByTestId('project-revisions-pane')).toContainText('Renamed to Pattern Demo');
  } finally {
    await reopenedPage.close();
  }
});
