import { expect, test } from '@playwright/test';
import { dismissViewHint, expectInputValue, getEntityWorldRect, getGroupWorldBounds, getState, getSceneSnapshot, gotoStudio, replaceJson } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.removeItem('phaseractions.sceneSpec.v1'));
  await gotoStudio(page);
});

test('boots the editor shell and supports JSON load/reset flows', async ({ page }) => {
  await expect(page.getByTestId('toolbar')).toBeVisible();
  await expect(page.getByTestId('entity-list')).toBeVisible();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('json-panel')).toBeVisible();

  await page.getByTestId('export-json-button').click();
  await expect(page.getByTestId('json-textarea')).toContainText('"Enemy Formation"');

  await replaceJson(page, (json) => json.replace('"Enemy Formation"', '"Patrol Wing"'));
  await page.getByTestId('load-json-button').click();
  await page.getByTestId('group-item-g-enemies').click();
  await expectInputValue(page.getByTestId('formation-name-input'), 'Patrol Wing');

  await page.getByTestId('json-textarea').fill('{');
  await page.getByTestId('load-json-button').click();
  await expect(page.getByTestId('toolbar-error')).toContainText('JSON');

  await page.getByTestId('reset-scene-button').click();
  await page.getByTestId('group-item-g-enemies').click();
  await expectInputValue(page.getByTestId('formation-name-input'), 'Enemy Formation');
});

test('updates world controls, syncs enemy formation bounds, and persists scene state across reloads', async ({ page }) => {
  await dismissViewHint(page);

  const worldWidthInput = page.getByTestId('world-width-input');
  const worldHeightInput = page.getByTestId('world-height-input');

  await worldWidthInput.fill('1400');
  await worldWidthInput.press('Enter');
  await worldHeightInput.fill('900');
  await worldHeightInput.press('Enter');

  await expect(page.getByTestId('dirty-badge')).toBeVisible();
  await expect.poll(async () => {
    const state = await getState<{ scene: { world: { width: number; height: number }; conditions: Record<string, { bounds: { minX: number; maxX: number; minY: number; maxY: number } }> } }>(page);
    return {
      world: state.scene.world,
      bounds: state.scene.conditions['c-bounds'].bounds,
    };
  }).toEqual({
    world: { width: 1400, height: 900 },
    bounds: { minX: 80, maxX: 1320, minY: 60, maxY: 852 },
  });

  await page.reload();
  await dismissViewHint(page);

  await expectInputValue(worldWidthInput, '1400');
  await expectInputValue(worldHeightInput, '900');
});

test('resizing the world keeps the formation patrol bounded by the resized limits in play mode', async ({ page }) => {
  await dismissViewHint(page);

  await page.getByTestId('world-width-input').fill('800');
  await page.getByTestId('world-width-input').press('Enter');
  await page.getByTestId('world-height-input').fill('600');
  await page.getByTestId('world-height-input').press('Enter');

  await expect.poll(async () => {
    const state = await getState<{ scene: { conditions: Record<string, { bounds: { minX: number; maxX: number; minY: number; maxY: number } }> } }>(page);
    return state.scene.conditions['c-bounds'].bounds;
  }).toEqual({ minX: 80, maxX: 720, minY: 60, maxY: 552 });

  await page.getByTestId('toggle-mode-button').click();

  await expect.poll(async () => {
    const bounds = await getGroupWorldBounds(page, 'g-enemies');
    return bounds.maxX >= 700 && bounds.maxX <= 720 && Math.round(bounds.minY) >= 130;
  }, { timeout: 15000 }).toBe(true);

  await expect.poll(async () => {
    const bounds = await getGroupWorldBounds(page, 'g-enemies');
    return Math.round(bounds.minY) >= 154 && bounds.maxX <= 720;
  }, { timeout: 15000 }).toBe(true);
});

test('drives zoom controls and play mode from the toolbar', async ({ page }) => {
  await dismissViewHint(page);

  await expect(page.getByTestId('reset-zoom-button')).toHaveText('Reset');

  const before = await getSceneSnapshot<{ zoom: number }>(page);
  await page.getByTestId('zoom-in-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ zoom: number }>(page)).zoom).toBeGreaterThan(before.zoom);

  await page.getByTestId('reset-zoom-button').click();
  await expect(page.getByTestId('zoom-pill')).toHaveText('100%');

  const beforePlay = await getState<{ scene: { entities: Record<string, { x: number }> } }>(page);
  await page.getByTestId('toggle-mode-button').click();
  await expect(page.getByTestId('toggle-mode-button')).toContainText('Edit');
  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    return rect.centerX;
  }).not.toBe(beforePlay.scene.entities.e1.x);
});
