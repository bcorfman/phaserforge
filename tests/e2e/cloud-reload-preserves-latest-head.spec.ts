import { expect, test } from '@playwright/test';
import { sampleProject } from '../../src/model/sampleProject';
import { buildStoredProjectRecord } from '../../src/editor/projectPersistence';
import { appendProjectRevision, createProjectRevision } from '../../src/editor/projectTreeHistory';
import { enablePersistenceDebug, expectPersistenceDebugEvents, expectProjectRestoreState, getState, gotoStudio } from './helpers';

test('cloud-backed active project reload restores the latest IndexedDB head and history without legacy localStorage project state @regression', async ({ page }) => {
  await enablePersistenceDebug(page);
  const staleUpdatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const latestUpdatedAt = new Date(Date.now() - 60 * 1000).toISOString();
  const latestProject = structuredClone(sampleProject);
  latestProject.title = 'Pattern Demo';
  latestProject.publishTitle = 'Pattern Demo';
  latestProject.audio.sounds.theme = {
    id: 'theme',
    source: {
      kind: 'embedded',
      dataUrl: 'data:audio/mp3;base64,AAAA',
      originalName: 'pattern-theme.mp3',
      mimeType: 'audio/mpeg',
    },
  };
  latestProject.scenes[latestProject.initialSceneId].music = {
    assetId: 'theme',
    loop: true,
    volume: 0.65,
    fadeMs: 250,
  };

  const staleRevision = createProjectRevision(sampleProject, {
    id: 'rev-stale',
    updatedAt: staleUpdatedAt,
    reason: 'autosave',
  });
  const latestRevision = createProjectRevision(latestProject, {
    id: 'rev-latest',
    updatedAt: latestUpdatedAt,
    reason: 'autosave',
  });
  const latestRecord = {
    ...buildStoredProjectRecord(latestProject, {
      id: 'cloud:g1',
      updatedAt: latestUpdatedAt,
      origin: 'cloud-cache',
      syncStatus: 'cloud',
      cloudProjectId: 'g1',
      revisions: appendProjectRevision([staleRevision], latestRevision),
    }),
    id: 'cloud:g1',
    projectId: latestProject.id,
  };
  const olderProject = structuredClone(sampleProject);
  olderProject.title = 'Older Cloud Game';
  const olderRecord = {
    ...buildStoredProjectRecord(olderProject, {
      id: 'cloud:g-old',
      updatedAt: staleUpdatedAt,
      origin: 'cloud-cache',
      syncStatus: 'cloud',
      cloudProjectId: 'g-old',
    }),
    id: 'cloud:g-old',
    projectId: olderProject.id,
  };

  await page.addInitScript(async ({ record, staleRecord }) => {
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
      tx.objectStore('projects').put(staleRecord);
      tx.objectStore('workspaceState').put({
        activeProjectId: 'cloud:g-old',
        syncMode: 'online',
      }, 'workspace');
      tx.objectStore('workspaceState').put({
        recordId: 'cloud:g1',
        updatedAt: record.updatedAt,
        syncMode: 'online',
        savedAt: record.updatedAt,
      }, 'latestActiveSnapshot');
      tx.objectStore('workspaceState').put('1', 'legacyMigrated');
    });
    window.localStorage.setItem('phaserforge.startupMode.v1', 'new_empty_scene');
  }, { record: latestRecord, staleRecord: olderRecord });

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/games', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ games: [{ id: 'g1', title: 'Pattern Demo', created_at: staleUpdatedAt, updated_at: latestUpdatedAt }] }),
      contentType: 'application/json',
    });
  });

  const assertLatestHead = async () => {
    await expect(page.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');
    await expectProjectRestoreState(page, {
      projectId: latestProject.id,
      title: 'Pattern Demo',
      currentSceneId: latestProject.initialSceneId,
      entityCount: Object.keys(latestProject.scenes[latestProject.initialSceneId]?.entities ?? {}).length,
      groupCount: Object.keys(latestProject.scenes[latestProject.initialSceneId]?.groups ?? {}).length,
    });
    await expect.poll(async () => {
      return page.evaluate(() => window.localStorage.getItem('phaserforge.projectYaml.v1'));
    }).toBeNull();
    await expect.poll(async () => {
      const state = await getState<{
        project?: {
          title?: string;
          publishTitle?: string;
          audio?: { sounds?: Record<string, unknown> };
          scenes?: Record<string, { music?: { assetId?: string } }>;
          initialSceneId?: string;
        };
      } | null>(page);
      const project = state?.project;
      const initialSceneId = project?.initialSceneId ?? latestProject.initialSceneId;
      return {
        title: project?.title ?? null,
        publishTitle: project?.publishTitle ?? null,
        hasTheme: Boolean(project?.audio?.sounds?.theme),
        musicAssetId: project?.scenes?.[initialSceneId]?.music?.assetId ?? null,
      };
    }).toEqual({
      title: 'Pattern Demo',
      publishTitle: 'Pattern Demo',
      hasTheme: true,
      musicAssetId: 'theme',
    });

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();
    const revisionsPane = page.getByTestId('project-revisions-pane');
    await expect(revisionsPane).toBeVisible();
    await expect(revisionsPane).toContainText('Pattern Demo');
    await expect(revisionsPane).toContainText(/Renamed to Pattern Demo|Added audio pattern-theme\.mp3|Music -> pattern-theme\.mp3|Set publish title to Pattern Demo/);
    await expectPersistenceDebugEvents(page, [
      'restore:workspace-state-loaded',
      'restore:latest-active-marker-loaded',
      'restore:active-project-selected',
      'restore:project-dispatched',
      'restore:scene-load-complete',
      'restore:view-state-restored',
      'restore:inspector-entity-list-stable',
    ]);
  };

  await gotoStudio(page, { forceNavigate: true });
  await assertLatestHead();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoStudio(page);
  await assertLatestHead();
});
