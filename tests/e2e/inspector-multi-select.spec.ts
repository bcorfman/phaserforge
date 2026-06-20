import { expect, test } from '@playwright/test';
import {
  dismissViewHint,
  dragWorld,
  getState,
  gotoStudio,
  seedSampleScene,
  selectGroupInSceneGraph,
  tapWorld,
  waitForSampleScene,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('multi-select inspector disables non-applicable fields and bulk-edits scale @critical', async ({ page }) => {
  await dismissViewHint(page);

  // Ungroup the sample formation so entities become selectable as ungrouped sprites.
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('canvas-dissolve-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene?: { groups?: Record<string, unknown> } }>(page);
    return Boolean(state.scene?.groups?.['g-enemies']);
  }).toBe(false);

  // Clear selection and multi-select two ungrouped entities.
  await tapWorld(page, { x: -9999, y: -9999 });

  const e2 = await page.evaluate(() => (window.__PHASER_FORGE_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  const e1 = await page.evaluate(() => (window.__PHASER_FORGE_TEST__?.getEntityWorldRect('e1') ?? null) as any);
  if (!e1 || !e2) throw new Error('Entity rects unavailable');
  await dragWorld(page, { x: e1.minX - 30, y: e1.minY - 30 }, { x: e2.maxX + 5, y: e2.maxY + 5 });

  await expect.poll(async () => {
    const state = await getState<{ selection?: unknown }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });

  await expect(page.getByTestId('entity-x-input')).toBeDisabled();

  const scaleXInput = page.getByTestId('entity-scale-x-input');
  await scaleXInput.click();
  await scaleXInput.fill('1.25');
  await scaleXInput.press('Enter');

  const scaleYInput = page.getByTestId('entity-scale-y-input');
  await scaleYInput.click();
  await scaleYInput.fill('0.75');
  await scaleYInput.press('Enter');

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { scaleX?: number; scaleY?: number }> } }>(page);
    return {
      e1: state.scene.entities.e1,
      e2: state.scene.entities.e2,
    };
  }).toMatchObject({
    e1: { scaleX: 1.25, scaleY: 0.75 },
    e2: { scaleX: 1.25, scaleY: 0.75 },
  });
});
