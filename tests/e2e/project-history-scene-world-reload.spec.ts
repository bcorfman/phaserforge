import { expect, test, type Page } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, openProjectScope, seedSampleScene, waitForSampleScene } from './helpers';

async function openProjectHistory(page: Page) {
  await openProjectScope(page);
  const historyMenuItem = page.getByTestId('project-manage-history');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByTestId('project-tree-manage-button').click();
    if (await historyMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyMenuItem.click();
      await expect(page.getByTestId('project-revisions-pane')).toBeVisible();
      return;
    }
    await page.keyboard.press('Escape').catch(() => {});
  }
  await expect(historyMenuItem).toBeVisible();
}

test('scene world resize history preserves summary and grouping after tab reopen @regression', async ({ page }) => {
  await seedSampleScene(page, { once: true });
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await page.getByTestId('world-width-input').fill('1200');
  await page.getByTestId('world-width-input').press('Enter');
  await page.getByTestId('world-width-input').fill('1440');
  await page.getByTestId('world-width-input').press('Enter');
  await expect.poll(async () => {
    const state = await getState<any>(page);
    return state?.scene?.world?.width ?? null;
  }).toBe(1440);

  await openProjectHistory(page);
  const revisionsPane = page.getByTestId('project-revisions-pane');
  await expect(revisionsPane).toContainText('Resized scene world');
  await expect(revisionsPane).not.toContainText('Edited scene scene-1');
  await expect(page.locator('.behavior-block[data-testid^="project-revision-"]')).toHaveCount(2);

  await page.close({ runBeforeUnload: true });

  const reopenedPage = await page.context().newPage();
  try {
    await gotoStudio(reopenedPage, { forceNavigate: true });
    await waitForSampleScene(reopenedPage);
    await dismissViewHint(reopenedPage);

    await openProjectHistory(reopenedPage);
    const reopenedRevisionsPane = reopenedPage.getByTestId('project-revisions-pane');
    await expect(reopenedRevisionsPane).toContainText('Resized scene world');
    await expect(reopenedRevisionsPane).not.toContainText('Edited scene scene-1');
    await expect(reopenedPage.locator('.behavior-block[data-testid^="project-revision-"]')).toHaveCount(2);
  } finally {
    await reopenedPage.close();
  }
});
