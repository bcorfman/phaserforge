import { expect, test } from '@playwright/test';
import { dismissViewHint, expectInputValue, getState, gotoStudio, replaceYaml, seedSampleScene, selectGroupInSceneGraph, waitForEmptyScene, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaseractions.sceneYaml.v1');
    window.localStorage.removeItem('phaseractions.startupMode.v1');
  });
});

test('boots empty by default and supports YAML load/reset flows', async ({ page }) => {
  await gotoStudio(page);
  await expect(page.getByTestId('toolbar')).toBeVisible();
  await expect(page.getByTestId('entity-list')).toBeVisible();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('json-panel')).toBeVisible();
  await expect(page.getByRole('main', { name: 'Viewport' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Scene Graph' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inspector' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Scene YAML' })).toBeVisible();
  await expect(page.getByText('Move entities on the canvas, tune formations in the inspector, and round-trip YAML without leaving the editor.')).toBeVisible();
  await expect(page.getByText('Pan with middle mouse or Shift + drag. Use zoom controls to inspect sprite spacing and bounds.')).toBeVisible();
  await waitForEmptyScene(page);

  await seedSampleScene(page);
  await page.reload();
  await gotoStudio(page);
  await waitForSampleScene(page);
  await page.getByTestId('export-yaml-button').click();
  await expect(page.getByTestId('yaml-textarea')).toContainText('Enemy Formation');

  await replaceYaml(page, (yaml) => yaml.replace('Enemy Formation', 'Patrol Wing'));
  await page.getByTestId('load-yaml-button').click();
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectInputValue(page.getByTestId('formation-name-input'), 'Patrol Wing');

  await page.getByTestId('yaml-textarea').fill('{');
  await page.getByTestId('load-yaml-button').click();
  await expect(page.getByTestId('toolbar-error')).toBeVisible();

  await page.getByTestId('reset-scene-button').click();
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Object.keys(state.scene.entities).length;
  }).toBe(0);
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
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/enemy_A.png');
  await expect(page.getByTestId('sprite-import-meta')).toContainText('enemy_A.png');
  await page.getByTestId('import-sprites-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { asset?: { imageType: string } }> } }>(page);
    const imported = Object.values(state.scene.entities);
    return { count: imported.length, imageType: imported[0]?.asset?.imageType };
  }).toEqual({ count: 1, imageType: 'image' });

  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/mainwindow.png');
  await page.getByTestId('sprite-import-mode-select').selectOption('spritesheet');
  await page.getByTestId('spritesheet-frame-width-input').fill('64');
  await page.getByTestId('spritesheet-frame-height-input').fill('64');
  await page.getByTestId('spritesheet-frame-1').click();
  await page.getByTestId('import-sprites-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { asset?: { imageType: string; frame?: { frameIndex?: number } } }> } }>(page);
    return Object.values(state.scene.entities)
      .filter((entity) => entity.asset?.imageType === 'spritesheet')
      .length;
  }).toBeGreaterThan(1);

  await page.getByTestId('export-yaml-button').click();
  await expect(page.getByTestId('yaml-textarea')).toContainText('imageType: spritesheet');
});

test('removes an imported sprite from the scene graph', async ({ page }) => {
  await gotoStudio(page);
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/enemy_A.png');
  await page.getByTestId('import-sprites-button').click();

  const entityId = await page.evaluate(() => {
    const state = window.__PHASER_ACTIONS_STUDIO_TEST__?.getState() as { scene: { entities: Record<string, unknown> } } | null;
    return state ? Object.keys(state.scene.entities)[0] : null;
  });
  if (!entityId) throw new Error('Imported entity id unavailable');

  await page.getByTestId(`remove-entity-${entityId}`).click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Object.keys(state.scene.entities);
  }).toEqual([]);
});
