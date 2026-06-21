import { expect, test } from '@playwright/test';
import { dismissViewHint, dispatchAction, dragAssetToCanvas, expectInputValue, getSceneSnapshot, getState, gotoStudio, importImageAssetFromFile, openProjectScope, openSceneScope, panByScreenDelta, seedSampleScene, selectGroupInSceneGraph, waitForEmptyScene, waitForSampleScene } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { createEmptyProject } from '../../src/model/emptyProject';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const onceKey = 'phaserforge.testAppShellResetOnce.v1';
    if (window.sessionStorage.getItem(onceKey)) return;
    window.sessionStorage.setItem(onceKey, '1');
    window.localStorage.removeItem('phaserforge.testSeeded.v1');
    window.localStorage.removeItem('phaserforge.startupMode.v1');
    window.localStorage.removeItem('phaserforge.themeMode.v1');
    window.localStorage.removeItem('phaserforge.uiScale.v1');
    window.localStorage.removeItem('phaserforge.inspectorFoldouts.v1');
    window.localStorage.removeItem('phaserforge.viewState.v1');
  });
});

test('boots empty by default and loads scenes @smoke', async ({ page }) => {
  test.setTimeout(120000);
  await gotoStudio(page);
  await expect(page.getByTestId('toolbar')).toBeVisible();
  await expect(page.getByTestId('add-background-button')).toHaveCount(0);
  await expect(page.getByTestId('reset-scene-button')).toHaveCount(0);
  await expect(page.getByTestId('entity-list')).toBeVisible();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByRole('main', { name: 'Viewport' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('entity-list').getByRole('heading', { name: 'Sprites' })).toBeVisible();
  await expect(page.getByTestId('entity-list').getByRole('heading', { name: 'Formations' })).toBeVisible();
  await expect(page.getByTestId('entity-list').getByRole('heading', { name: 'Actions' })).toBeHidden();
  await expect(page.getByTestId('registry-panel')).toHaveCount(0);
  await expect(page.getByText('Pan with middle mouse or Space + drag. Use zoom controls to inspect sprite spacing and bounds.')).toBeVisible();
  await waitForEmptyScene(page);

  await seedSampleScene(page);
  await page.reload();
  await gotoStudio(page);
  await waitForSampleScene(page);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectInputValue(page.getByTestId('formation-name-input'), 'Enemy Formation');
});

test('persists the last active project across reloads without a startup mode control @critical', async ({ page }) => {
  await seedSampleScene(page, { once: true });
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await openProjectScope(page);
  await expect(page.getByTestId('project-startup-panel')).toHaveCount(0);
  await expect(page.getByTestId('project-startup-mode-select')).toHaveCount(0);

  await openSceneScope(page);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('formation-name-input').fill('Persisted Wing');
  await expect.poll(async () => {
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
      if (!workspace?.activeProjectId) return null;
      const project = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').get(workspace.activeProjectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return project?.yaml ?? null;
    });
  }).toContain('Persisted Wing');
  await expect.poll(async () => {
    return page.evaluate(() => window.localStorage.getItem('phaserforge.projectYaml.v1'));
  }).toBeNull();
  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { name?: string }> } }>(page);
    return state.scene.groups['g-enemies']?.name;
  }).toBe('Persisted Wing');

  await page.reload();
  await gotoStudio(page);
  await waitForSampleScene(page);
  await openProjectScope(page);
  await expect(page.getByTestId('project-startup-mode-select')).toHaveCount(0);
  await openSceneScope(page);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectInputValue(page.getByTestId('formation-name-input'), 'Persisted Wing');
});

test('resets zoom and view position when a different project is loaded', async ({ page }) => {
  await seedSampleScene(page, { once: true });
  await gotoStudio(page);
  await waitForSampleScene(page);

  const zoomBefore = await page.getByTestId('zoom-pill').innerText();
  await page.getByTestId('zoom-in-button').click();
  const zoomAfter = await page.getByTestId('zoom-pill').innerText();
  expect(zoomAfter).not.toBe(zoomBefore);

  const viewBeforePan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  await panByScreenDelta(page, { x: 160, y: 100 });
  await expect.poll(async () => {
    const view = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
    return { scrollX: view.scrollX, scrollY: view.scrollY };
  }).not.toEqual({ scrollX: viewBeforePan.scrollX, scrollY: viewBeforePan.scrollY });
  const viewAfterPan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);

  // Load a different project id through the same reducer path, leaving picker wiring to the dedicated YAML smoke test.
  const emptyProject = createEmptyProject();
  (emptyProject as any).id = 'p2';
  const yaml = serializeProjectToYaml(emptyProject);
  await dispatchAction(page, { type: 'load-yaml-text', text: yaml, sourceLabel: 'project-switch.yaml' });

  await waitForEmptyScene(page);

  // Different project should reset view (should not retain prior view state).
  // Zoom percent can coincidentally match across projects, so assert the full view state diverges.
  await expect.poll(async () => {
    const view = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
    return { zoom: view.zoom, scrollX: view.scrollX, scrollY: view.scrollY };
  }).not.toEqual({ zoom: viewAfterPan.zoom, scrollX: viewAfterPan.scrollX, scrollY: viewAfterPan.scrollY });
});

test('imports embedded sprites into the scene @critical', async ({ page }) => {
  await gotoStudio(page);
  await openSceneScope(page);

  const { assetId: imageAssetId } = await importImageAssetFromFile(page, 'res/images/enemy_A.png');
  await dragAssetToCanvas(page, 'image', imageAssetId);

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { asset?: { imageType: string; source?: { kind?: string; assetId?: string } } }> } }>(page);
    const imported = Object.values(state.scene.entities);
    return {
      count: imported.length,
      imageType: imported[0]?.asset?.imageType,
      sourceKind: imported[0]?.asset?.source?.kind,
    };
  }).toEqual({ count: 1, imageType: 'image', sourceKind: 'asset' });

  const { assetId: secondImageAssetId } = await importImageAssetFromFile(page, 'res/images/mainwindow.png');
  // Drop at a different position so we don't replace the first sprite.
  await dragAssetToCanvas(page, 'image', secondImageAssetId, { targetPosition: { x: 320, y: 220 } });

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { asset?: { imageType: string } }> } }>(page);
    return Object.values(state.scene.entities).length;
  }).toBe(2);
});

test('removes an imported sprite from the scene graph @critical', async ({ page }) => {
  await gotoStudio(page);
  await openSceneScope(page);
  const { assetId } = await importImageAssetFromFile(page, 'res/images/enemy_A.png');
  await dragAssetToCanvas(page, 'image', assetId);

  const entityId = await page.evaluate(() => {
    const state = window.__PHASER_FORGE_TEST__?.getState() as { scene: { entities: Record<string, unknown> } } | null;
    return state ? Object.keys(state.scene.entities)[0] : null;
  });
  if (!entityId) throw new Error('Imported entity id unavailable');

  await openSceneScope(page);
  await page.getByTestId(`entity-menu-${entityId}`).click();
  await page.getByTestId(`entity-menu-delete-${entityId}`).click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Object.keys(state.scene.entities);
  }).toEqual([]);
});

test('toggles theme modes and persists preference @critical', async ({ page }) => {
  await gotoStudio(page);

  await page.getByTestId('theme-mode-dark').click();
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

  await page.reload();
  await gotoStudio(page);
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

  await page.getByTestId('theme-mode-system').click();
  await expect.poll(async () => page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
});

test('side panes avoid horizontal overflow @critical', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);

  await selectGroupInSceneGraph(page, 'g-enemies');
  await expect(page.getByTestId('inspector-pane')).toBeVisible();

  await expect
    .poll(async () => page.evaluate(() => {
      const panes = [
        document.querySelector('[data-testid="entity-list-pane"]'),
        document.querySelector('[data-testid="inspector-pane"]'),
      ].filter(Boolean) as HTMLElement[];

      const results = panes.map((pane) => {
        const body = pane.querySelector('.panel.panel-scroll') as HTMLElement | null;
        const el = body ?? pane;
        return {
          testId: pane.getAttribute('data-testid'),
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
        };
      });

      const worst = results.reduce<{ testId: string | null; delta: number }>(
        (acc, cur) => {
          const delta = cur.scrollWidth - cur.clientWidth;
          return delta > acc.delta ? { testId: cur.testId, delta } : acc;
        },
        { testId: null, delta: -Infinity }
      );

      const ok = results.every((entry) => entry.scrollWidth <= entry.clientWidth + 1);
      return { ok, worst, results };
    }), { timeout: 15000 })
    .toMatchObject({ ok: true });
});
