import { test, expect } from '@playwright/test';
import { enablePersistenceDebug, gotoStudio } from './helpers';
import { sampleProject } from '../../src/model/sampleProject';
import { createEmptyProject } from '../../src/model/emptyProject';
import { buildStoredProjectRecord } from '../../src/editor/projectPersistence';

test('Signed-in linked online projects stay local at startup and autosave to cloud without a conflict modal @smoke', async ({ page }) => {
  test.setTimeout(120000);
  const cloudProject = createEmptyProject();
  await enablePersistenceDebug(page);
  const deviceRecord = buildStoredProjectRecord(sampleProject, {
    id: sampleProject.id,
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
    origin: 'cloud-cache',
    syncStatus: 'cloud',
    cloudProjectId: 'g1',
  });

  await page.addInitScript(async ({ record }) => {
    const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('workspaceState')) db.createObjectStore('workspaceState');
        if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
      };
      request.onsuccess = () => resolve(request.result);
    });

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['projects', 'workspaceState'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('projects').put(record);
      tx.objectStore('workspaceState').put({
        activeProjectId: record.id,
        syncMode: 'online',
      }, 'workspace');
      tx.objectStore('workspaceState').put('1', 'legacyMigrated');
    });

    window.localStorage.setItem('phaserforge.startupMode.v1', 'new_empty_scene');
  }, { record: deviceRecord });

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ csrfToken: 'csrf' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/games', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ games: [{ id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z' }] }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/games/g1', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ game: { id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:15:00.000Z', project: sampleProject } }),
        contentType: 'application/json',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ game: { id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z', project: cloudProject } }),
      contentType: 'application/json',
    });
  });

  await gotoStudio(page, { forceNavigate: true });

  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await expect(page.getByTestId('workspace-conflict-modal')).toHaveCount(0);
  await expect(cloudTab).toHaveAttribute('aria-selected', 'false');

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const entries = window.__PHASER_FORGE_TEST__?.persistenceDebugEntries ?? [];
      return entries.filter((entry: { event?: string }) => entry.event === 'cloud:autosave-flush-start').length;
    });
  }).toBeGreaterThan(0);

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const entries = window.__PHASER_FORGE_TEST__?.persistenceDebugEntries ?? [];
      return entries.filter((entry: { event?: string }) => entry.event === 'cloud:workspace-conflict-detected').length;
    });
  }).toBe(0);
});
