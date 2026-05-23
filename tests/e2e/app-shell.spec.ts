import { expect, test } from '@playwright/test';
import { dismissViewHint, dragAssetToCanvas, expectInputValue, getState, gotoStudio, importImageAssetFromFile, importSpritesheetAssetFromFile, openProjectScope, openSceneScope, seedSampleScene, selectGroupInSceneGraph, waitForEmptyScene, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaserforge.testSeeded.v1');
    window.localStorage.removeItem('phaserforge.projectYaml.v1');
    window.localStorage.removeItem('phaserforge.startupMode.v1');
    window.localStorage.removeItem('phaserforge.themeMode.v1');
    window.localStorage.removeItem('phaserforge.uiScale.v1');
    window.localStorage.removeItem('phaserforge.inspectorFoldouts.v1');
  });
});

test('boots empty by default and loads scenes @smoke', async ({ page }) => {
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
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectInputValue(page.getByTestId('formation-name-input'), 'Persisted Wing');

  await openProjectScope(page);
  await page.getByTestId('project-startup-mode-select').selectOption('new_empty_scene');
  await page.reload();
  await gotoStudio(page);
  await waitForEmptyScene(page);
});

test('imports embedded sprites and spritesheets into the scene @critical', async ({ page }) => {
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

  const { assetId: sheetAssetId } = await importSpritesheetAssetFromFile(page, 'res/images/mainwindow.png', { frameWidth: 64, frameHeight: 64 });
  await dragAssetToCanvas(page, 'spritesheet', sheetAssetId);

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { asset?: { imageType: string } }> } }>(page);
    return Object.values(state.scene.entities)
      .filter((entity) => entity.asset?.imageType === 'spritesheet')
      .length;
  }).toBe(1);
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
