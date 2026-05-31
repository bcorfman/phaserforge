import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { dismissViewHint, dragAssetToCanvas, expectInputValue, getSceneSnapshot, getState, gotoStudio, importImageAssetFromFile, openProjectScope, openSceneScope, panByScreenDelta, seedSampleScene, selectGroupInSceneGraph, waitForEmptyScene, waitForSampleScene, waitForViewportToSettle } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { createEmptyProject } from '../../src/model/emptyProject';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaserforge.testSeeded.v1');
    window.localStorage.removeItem('phaserforge.projectYaml.v1');
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

test('updates startup mode and persists the last YAML-backed scene across reloads @critical', async ({ page }) => {
  await seedSampleScene(page, { once: true });
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await openProjectScope(page);
  await page.getByTestId('project-startup-mode-select').selectOption('reload_last_yaml');
  const zoomBefore = await page.getByTestId('zoom-pill').innerText();
  await page.getByTestId('zoom-in-button').click();
  const zoomAfter = await page.getByTestId('zoom-pill').innerText();
  expect(zoomAfter).not.toBe(zoomBefore);

  const viewBeforePan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  await panByScreenDelta(page, { x: 120, y: 80 });
  await expect.poll(async () => {
    const view = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
    return { scrollX: view.scrollX, scrollY: view.scrollY };
  }).not.toEqual({ scrollX: viewBeforePan.scrollX, scrollY: viewBeforePan.scrollY });
  await waitForViewportToSettle(page);
  const viewAfterPan = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
  const persistedScroll = { scrollX: viewAfterPan.scrollX, scrollY: viewAfterPan.scrollY };

  await openSceneScope(page);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('formation-name-input').fill('Persisted Wing');
  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { name?: string }> } }>(page);
    return state.scene.groups['g-enemies']?.name;
  }).toBe('Persisted Wing');

  await page.reload();
  await gotoStudio(page);
  await waitForSampleScene(page);
  await expect(page.getByTestId('zoom-pill')).toHaveText(zoomAfter);
  await waitForViewportToSettle(page);
  await expect.poll(async () => {
    const view = await getSceneSnapshot<{ scrollX: number; scrollY: number }>(page);
    return Math.max(Math.abs(view.scrollX - persistedScroll.scrollX), Math.abs(view.scrollY - persistedScroll.scrollY));
  }).toBeLessThanOrEqual(8);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectInputValue(page.getByTestId('formation-name-input'), 'Persisted Wing');

  await openProjectScope(page);
  await page.getByTestId('project-startup-mode-select').selectOption('new_empty_scene');
  await page.reload();
  await gotoStudio(page);
  await waitForEmptyScene(page);
});

test('resets zoom and view position when a different project is loaded', async ({ page }) => {
  await page.addInitScript(() => {
    // Force the `<input type=file>` picker path for this test.
    (window as any).showOpenFilePicker = undefined;
  });

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

  // Load a different project (different project id) via the YAML editor.
  await page.getByTestId('yaml-open-button').click();
  await expect(page.getByTestId('yaml-open-file-input')).toHaveCount(1);

  const emptyProject = createEmptyProject();
  (emptyProject as any).id = 'p2';
  const yaml = serializeProjectToYaml(emptyProject);
  const tmpPath = path.join(os.tmpdir(), `phaserforge-project-switch-${Date.now()}-p2.yaml`);
  fs.writeFileSync(tmpPath, yaml, 'utf8');
  await page.setInputFiles('[data-testid="yaml-open-file-input"]', tmpPath);

  await waitForEmptyScene(page);

  // Different project should reset view (should not retain prior view state).
  // Zoom percent can coincidentally match across projects, so assert the full view state diverges.
  await expect.poll(async () => {
    const view = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number }>(page);
    return { zoom: view.zoom, scrollX: view.scrollX, scrollY: view.scrollY };
  }).not.toEqual({ zoom: viewAfterPan.zoom, scrollX: viewAfterPan.scrollX, scrollY: viewAfterPan.scrollY });

  fs.unlinkSync(tmpPath);
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

test('uses medium global sizing scale @critical', async ({ page }) => {
  await gotoStudio(page);

  const uiScale = await page.evaluate(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--ui-scale');
    return Number.parseFloat(raw);
  });
  expect(uiScale).toBeCloseTo(0.95, 3);

  const rootFontSize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(rootFontSize).toBeLessThan(16);
  expect(rootFontSize).toBeGreaterThan(14);
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
