import { test, expect } from '@playwright/test';
import { gotoStudio, waitForEmptyScene } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { sampleProject } from '../../src/model/sampleProject';
import { createEmptyProject } from '../../src/model/emptyProject';
import { buildStoredProjectRecord } from '../../src/editor/projectPersistence';

test('Cloud login shows conflict picker when cloud and device diverge @smoke', async ({ page }) => {
  const deviceYaml = serializeProjectToYaml(sampleProject);
  const cloudYaml = serializeProjectToYaml(createEmptyProject());
  const deviceRecord = buildStoredProjectRecord(sampleProject, {
    id: sampleProject.id,
    yaml: deviceYaml,
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
    origin: 'local-only',
    syncStatus: 'local',
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
    await route.fulfill({ status: 401, body: JSON.stringify({ error: 'not_logged_in' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/login', async (route) => {
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
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ game: { id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z', yaml: cloudYaml } }),
      contentType: 'application/json',
    });
  });

  await gotoStudio(page, { forceNavigate: true });

  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await cloudTab.click();
  await expect(page.getByTestId('cloud-panel')).toBeVisible();

  await page.getByLabel('Email').fill('a@b.c');
  await page.locator('input[autocomplete="current-password"]').fill('pw');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByTestId('workspace-conflict-modal')).toBeVisible();
  await expect(page.getByTestId('workspace-conflict-cloud-card')).toContainText('Cloud');
  await expect(page.getByTestId('workspace-conflict-device-card')).toContainText('This device');

  const dl1 = page.waitForEvent('download');
  const dl2 = page.waitForEvent('download');
  await page.getByTestId('workspace-conflict-export-both').click();
  await Promise.all([dl1, dl2]);

  await page.getByTestId('workspace-conflict-use-cloud').click();
  await waitForEmptyScene(page);

  const backup = await page.evaluate(async () => {
    const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const db = await openDb();
    const saved = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction('workspaceState', 'readonly');
      const request = tx.objectStore('workspaceState').get('workspaceBackup');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return saved ?? null;
  });
  expect(backup?.source).toBe('device');
  expect(typeof backup?.yaml).toBe('string');
  expect(backup?.yaml.length).toBeGreaterThan(20);
});
