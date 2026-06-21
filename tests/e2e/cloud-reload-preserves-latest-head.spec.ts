import { expect, test } from '@playwright/test';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { sampleProject } from '../../src/model/sampleProject';
import { buildStoredProjectRecord } from '../../src/editor/projectPersistence';
import { createProjectRevision } from '../../src/editor/projectTreeHistory';
import { getState, gotoStudio, waitForSceneReady } from './helpers';

test('cloud-backed active project reload restores the latest persisted head and history @regression', async ({ page }) => {
  const staleProject = structuredClone(sampleProject);
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

  const staleYaml = serializeProjectToYaml(staleProject);
  const latestYaml = serializeProjectToYaml(latestProject);
  const staleRecord = {
    ...buildStoredProjectRecord(staleProject, {
      id: 'cloud:g1',
      yaml: staleYaml,
      updatedAt: '2026-06-20T20:00:00.000Z',
      origin: 'cloud-cache',
      syncStatus: 'cloud',
      cloudProjectId: 'g1',
      revisions: [createProjectRevision(staleProject, {
        id: 'rev-stale',
        updatedAt: '2026-06-20T20:00:00.000Z',
        reason: 'autosave',
      })],
    }),
    id: 'cloud:g1',
    projectId: staleProject.id,
  };

  await page.addInitScript(async ({ record, latestProjectYaml }) => {
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
        activeProjectId: 'cloud:g1',
        syncMode: 'online',
      }, 'workspace');
      tx.objectStore('workspaceState').put('1', 'legacyMigrated');
    });

    window.localStorage.setItem('phaserforge.projectYaml.v1', latestProjectYaml);
    window.localStorage.setItem('phaserforge.projectLastSavedAtMs.v1', String(Date.parse('2026-06-20T20:05:00.000Z')));
    window.localStorage.setItem('phaserforge.startupMode.v1', 'new_empty_scene');
    window.localStorage.setItem('phaserforge.cloud.project_game_id_map_v1', JSON.stringify({ 'project-1': 'g1' }));
  }, { record: staleRecord, latestProjectYaml: latestYaml });

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
      body: JSON.stringify({ games: [{ id: 'g1', title: 'Pattern Demo', created_at: '2026-06-20T20:00:00.000Z', updated_at: '2026-06-20T20:05:00.000Z' }] }),
      contentType: 'application/json',
    });
  });

  const assertLatestHead = async () => {
    await expect(page.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');
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
  };

  await gotoStudio(page, { forceNavigate: true });
  await assertLatestHead();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForSceneReady(page);
  await assertLatestHead();
});
