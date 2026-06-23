import { expect, test } from '@playwright/test';
import { dismissViewHint, gotoStudio, openProjectScope } from './helpers';

test('refresh during the async persistence window restores the latest head from IndexedDB alone @smoke', async ({ page }) => {
  await gotoStudio(page, { forceNavigate: true });
  await dismissViewHint(page);
  await openProjectScope(page);

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.pauseActiveProjectRecordPersistence?.());

  await page.getByTestId('project-tree-manage-button').click();
  await page.getByTestId('project-manage-rename').click();
  await page.getByTestId('rename-project-input').fill('Snapshot Rescue');
  await page.getByTestId('rename-project-input').press('Enter');
  await expect(page.getByTestId('project-tree-root-button')).toContainText('Snapshot Rescue');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoStudio(page);
  await dismissViewHint(page);

  await expect(page.getByTestId('project-tree-root-button')).toContainText('Snapshot Rescue');
  await expect.poll(async () => {
    return page.evaluate(() => window.localStorage.getItem('phaserforge.projectYaml.v1'));
  }).toBeNull();
});
