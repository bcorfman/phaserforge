import { expect, test } from '@playwright/test';
import { dismissViewHint, enablePersistenceDebug, expectPersistenceDebugEvents, expectProjectRestoreState, gotoStudio, openProjectScope } from './helpers';

async function expectStoredProjectTitle(page: Parameters<typeof test>[0]['page'], projectId: string, title: string): Promise<void> {
  await expect.poll(async () => {
    return page.evaluate(async (currentProjectId) => {
      const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const db = await openDb();
      const project = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').get(currentProjectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return project?.title ?? null;
    }, projectId);
  }).toBe(title);
}

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
  await expectStoredProjectTitle(page, initialProjectId, 'Snapshot Rescue');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoStudio(page);
  await dismissViewHint(page);

  await expectProjectRestoreState(page, {
    projectId: initialProjectId,
    title: 'Snapshot Rescue',
    currentSceneId: 'scene-1',
    entityCount: 0,
    groupCount: 0,
  });
  await expect(page.getByTestId('project-tree-root-button')).toContainText('Snapshot Rescue');
  await expectPersistenceDebugEvents(page, [
    'restore:workspace-state-loaded',
    'restore:latest-active-marker-loaded',
    'restore:active-project-selected',
    'restore:project-dispatched',
    'restore:scene-load-complete',
    'restore:inspector-entity-list-stable',
  ]);
  await expect.poll(async () => {
    return page.evaluate(() => window.localStorage.getItem('phaserforge.projectYaml.v1'));
  }).toBeNull();
});
