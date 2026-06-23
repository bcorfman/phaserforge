import { expect, test } from '@playwright/test';
import { sampleProject } from '../../src/model/sampleProject';
import { buildStoredProjectRecord } from '../../src/editor/projectPersistence';
import { dismissViewHint, gotoStudio, waitForSampleScene } from './helpers';

async function readStoredActiveProject(page: Parameters<typeof test>[0]['page']) {
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
    const project = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const request = tx.objectStore('projects').get(workspace?.activeProjectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return {
      activeProjectId: workspace?.activeProjectId ?? null,
      hasProjectPayload: Boolean(project?.project),
      revisions: Array.isArray(project?.revisions)
        ? project.revisions.map((revision: any) => ({
          id: revision?.id ?? null,
          title: revision?.title ?? null,
          kind: revision?.kind ?? null,
        }))
        : [],
    };
  });
}

test('rename + publish repo + history + close/reopen persists latest head locally and to cloud @regression', async ({ page }) => {
  test.fail(true, 'Cloud autosave does not yet persist the rename + publish repo flow in this repro.');
  const cloudProject = structuredClone(sampleProject);
  const record = {
    ...buildStoredProjectRecord(cloudProject, {
      id: cloudProject.id,
      updatedAt: '2026-06-21T21:00:00.000Z',
      origin: 'local-only',
      syncStatus: 'local',
    }),
    id: cloudProject.id,
    projectId: cloudProject.id,
  };
  const cloudSaves: Array<{ title?: string; project?: typeof cloudProject }> = [];

  await page.addInitScript(async ({ seededRecord }) => {
    window.localStorage.setItem('phaserforge.debugPersistence.v1', '1');
    window.sessionStorage.setItem('phaserforge.testForceCloudEnabled.v1', '1');
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
      tx.objectStore('projects').put(seededRecord);
      tx.objectStore('workspaceState').put({
        activeProjectId: seededRecord.id,
        syncMode: 'online',
      }, 'workspace');
      tx.objectStore('workspaceState').put('1', 'legacyMigrated');
    });
  }, { seededRecord: record });

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ csrfToken: 'csrf-token' }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/publish/github-pages/info', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, login: 'bcorfman', pagesBaseUrl: 'https://bcorfman.github.io/' }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/games', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          games: [],
        }),
        contentType: 'application/json',
      });
      return;
    }

    const patch = route.request().postDataJSON() as { title?: string; project?: typeof cloudProject };
    cloudSaves.push(patch);
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        game: { id: 'g1', title: patch.title ?? 'Untitled Project', created_at: '2026-06-21T21:00:00.000Z', updated_at: '2026-06-21T21:05:00.000Z' },
      }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/games/g1', async (route) => {
    const patch = route.request().postDataJSON() as { title?: string; project?: typeof cloudProject };
    cloudSaves.push(patch);
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ updated_at: '2026-06-21T21:06:00.000Z' }),
      contentType: 'application/json',
    });
  });

  await gotoStudio(page, { forceNavigate: true });
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await page.getByTestId('inspector-pane-tab-cloud').click();
  const repoInput = page.getByLabel('Publish repository');
  await expect(repoInput).toBeVisible();

  await page.getByTestId('project-tree-manage-button').click();
  await page.getByTestId('project-manage-rename').click();
  await page.getByTestId('rename-project-input').fill('Pattern Demo');
  await page.getByTestId('rename-project-input').press('Enter');
  await expect(page.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');

  await repoInput.fill('zoof');
  await repoInput.blur();

  await page.getByTestId('project-tree-manage-button').click();
  await page.getByTestId('project-manage-history').click();
  const revisionsPane = page.getByTestId('project-revisions-pane');
  await expect(revisionsPane).toBeVisible();
  await expect(revisionsPane).toContainText('Renamed to Pattern Demo');
  await expect(page.locator('.behavior-block[data-testid^="project-revision-"]')).toHaveCount(3);
  await page.getByTestId('project-revisions-back-button').click();
  await expect(page.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');

  await expect.poll(async () => {
    const active = await readStoredActiveProject(page);
    return {
      hasProjectPayload: active.hasProjectPayload,
      revisionCount: active.revisions.length,
      revisionKinds: active.revisions.slice(0, 3).map((revision) => revision.kind),
    };
  }).toEqual({
    hasProjectPayload: false,
    revisionCount: 3,
    revisionKinds: expect.arrayContaining(['delta']),
  });

  await expect.poll(() => cloudSaves.at(-1) ?? null, { timeout: 15000 }).toMatchObject({
    title: 'Pattern Demo',
    project: expect.objectContaining({
      title: 'Pattern Demo',
      publishGithubPagesRepo: 'zoof',
    }),
  });
  expect(cloudSaves.at(-1)?.project?.title).toBe('Pattern Demo');

  await expect.poll(async () => {
    return page.evaluate(() => (window.__PHASER_FORGE_PERSISTENCE_DEBUG__?.read() ?? []).map((entry) => entry.event));
  }).toEqual(expect.not.arrayContaining([
    'project-persistence:save-active-project-record-error',
    'editor-store:save-active-error',
    'cloud:autosave-flush-error',
  ]));

  await page.close({ runBeforeUnload: true });

  const reopenedPage = await page.context().newPage();
  try {
    await gotoStudio(reopenedPage, { forceNavigate: true });
    await waitForSampleScene(reopenedPage);
    await dismissViewHint(reopenedPage);

    await expect(reopenedPage.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');
    await reopenedPage.getByTestId('inspector-pane-tab-cloud').click();
    await expect(reopenedPage.getByLabel('Publish repository')).toHaveValue('zoof');

    await reopenedPage.getByTestId('project-tree-manage-button').click();
    await reopenedPage.getByTestId('project-manage-history').click();
    await expect(reopenedPage.getByTestId('project-revisions-pane')).toContainText('Renamed to Pattern Demo');
    await expect(reopenedPage.locator('.behavior-block[data-testid^="project-revision-"]')).toHaveCount(3);

    await expect.poll(async () => {
      const active = await readStoredActiveProject(reopenedPage);
      return {
        hasProjectPayload: active.hasProjectPayload,
        revisionCount: active.revisions.length,
      };
    }).toEqual({
      hasProjectPayload: false,
      revisionCount: 3,
    });
  } finally {
    await reopenedPage.close();
  }
});
