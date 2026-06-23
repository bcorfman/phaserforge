import { expect, test } from '@playwright/test';
import { dismissViewHint, enablePersistenceDebug, expectPersistenceDebugEvents, expectProjectRestoreState, gotoStudio, openProjectScope } from './helpers';

test('refresh during the async persistence window restores the latest head from IndexedDB alone @smoke', async ({ page }) => {
  await enablePersistenceDebug(page);
  await gotoStudio(page, { forceNavigate: true });
  await dismissViewHint(page);
  await openProjectScope(page);
  const initialProjectId = await page.evaluate(async () => {
    const state = await window.__PHASER_FORGE_TEST__?.getState?.();
    return state?.project?.id ?? null;
  });

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
  await expectProjectRestoreState(page, {
    projectId: initialProjectId,
    title: 'Snapshot Rescue',
    currentSceneId: 'scene-1',
    entityCount: 0,
    groupCount: 0,
  });
  await expectPersistenceDebugEvents(page, [
    'restore:workspace-state-loaded',
    'restore:active-project-selected',
    'restore:project-dispatched',
    'restore:scene-load-complete',
    'restore:inspector-entity-list-stable',
  ]);
  await expect.poll(async () => {
    return page.evaluate(() => window.localStorage.getItem('phaserforge.projectYaml.v1'));
  }).toBeNull();
});
