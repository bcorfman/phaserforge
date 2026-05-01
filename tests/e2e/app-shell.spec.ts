import { expect, test } from '@playwright/test';
import { dismissViewHint, dragAssetToCanvas, expectInputValue, getState, gotoStudio, importImageAssetFromFile, importSpritesheetAssetFromFile, openSceneScope, seedSampleScene, selectGroupInSceneGraph, waitForEmptyScene, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaseractions.testSeeded.v1');
    window.localStorage.removeItem('phaseractions.projectYaml.v1');
    window.localStorage.removeItem('phaseractions.startupMode.v1');
    window.localStorage.removeItem('phaseractions.themeMode.v1');
    window.localStorage.removeItem('phaseractions.uiScale.v1');
    window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
  });
});

test('boots empty by default and loads scenes', async ({ page }) => {
  await gotoStudio(page);
  await expect(page.getByTestId('toolbar')).toBeVisible();
  await expect(page.getByTestId('add-background-button')).toHaveCount(0);
  await expect(page.getByTestId('reset-scene-button')).toHaveCount(0);
  await expect(page.getByTestId('entity-list')).toBeVisible();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByRole('main', { name: 'Viewport' })).toBeVisible();
  await expect(page.getByTestId('entity-list').getByRole('heading', { name: 'Sprites' })).toBeVisible();
  await expect(page.getByTestId('entity-list').getByRole('heading', { name: 'Formations' })).toBeVisible();
  await expect(page.getByTestId('entity-list').getByRole('heading', { name: 'Actions' })).toBeHidden();
  await expect(page.getByTestId('registry-panel')).toHaveCount(0);
  await expect(page.getByText('Pan with middle mouse or Shift + drag. Use zoom controls to inspect sprite spacing and bounds.')).toBeVisible();
  await waitForEmptyScene(page);

  await seedSampleScene(page);
  await page.reload();
  await gotoStudio(page);
  await waitForSampleScene(page);
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectInputValue(page.getByTestId('formation-name-input'), 'Enemy Formation');
});

test('updates startup mode and persists the last YAML-backed scene across reloads', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await page.getByTestId('startup-mode-select').selectOption('reload_last_yaml');
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

  await page.getByTestId('startup-mode-select').selectOption('new_empty_scene');
  await page.reload();
  await gotoStudio(page);
  await waitForEmptyScene(page);
});

test('imports embedded sprites and spritesheets into the scene', async ({ page }) => {
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

test('removes an imported sprite from the scene graph', async ({ page }) => {
  await gotoStudio(page);
  await openSceneScope(page);
  const { assetId } = await importImageAssetFromFile(page, 'res/images/enemy_A.png');
  await dragAssetToCanvas(page, 'image', assetId);

  const entityId = await page.evaluate(() => {
    const state = window.__PHASER_ACTIONS_STUDIO_TEST__?.getState() as { scene: { entities: Record<string, unknown> } } | null;
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

test('uses medium global sizing scale', async ({ page }) => {
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

test('toggles theme modes and persists preference', async ({ page }) => {
  await gotoStudio(page);

  await page.getByTestId('theme-mode-dark').click();
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

  await page.reload();
  await gotoStudio(page);
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

  await page.getByTestId('theme-mode-system').click();
  await expect.poll(async () => page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
});

test('side panes avoid horizontal overflow', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);

  await selectGroupInSceneGraph(page, 'g-enemies');
  await expect(page.getByTestId('inspector-pane')).toBeVisible();

  const results = await page.evaluate(() => {
    const panes = [
      document.querySelector('[data-testid="entity-list-pane"]'),
      document.querySelector('[data-testid="inspector-pane"]'),
    ].filter(Boolean) as HTMLElement[];

    return panes.map((pane) => {
      const body = pane.querySelector('.panel.panel-scroll') as HTMLElement | null;
      const el = body ?? pane;
      return {
        testId: pane.getAttribute('data-testid'),
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      };
    });
  });

  for (const entry of results) {
    expect(entry.scrollWidth, `pane ${entry.testId} scrollWidth`).toBeLessThanOrEqual(entry.clientWidth + 1);
  }
});
