import { expect, test } from '@playwright/test';
import { dismissViewHint, gotoStudio, openProjectScope } from './helpers';

async function readPersistenceTitles(page: Parameters<typeof gotoStudio>[0]) {
  return page.evaluate(async () => {
    const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const db = await openDb();
    const workspace = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction('workspaceState', 'readonly');
      const request = tx.objectStore('workspaceState').get('workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const activeProjectId = workspace?.activeProjectId ?? null;
    const latestSnapshot = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction('workspaceState', 'readonly');
      const request = tx.objectStore('workspaceState').get('latestActiveSnapshot');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const activeProject = activeProjectId
      ? await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').get(activeProjectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
      : null;
    return {
      snapshotRecordId: latestSnapshot?.recordId ?? null,
      projectTitle: activeProject?.title ?? null,
    };
  });
}

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

  await expect.poll(async () => readPersistenceTitles(page)).toMatchObject({
    snapshotRecordId: expect.any(String),
    projectTitle: 'Snapshot Rescue',
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoStudio(page);
  await dismissViewHint(page);

  await expect(page.getByTestId('project-tree-root-button')).toContainText('Snapshot Rescue');
  await expect.poll(async () => {
    return page.evaluate(() => window.localStorage.getItem('phaserforge.projectYaml.v1'));
  }).toBeNull();
});
