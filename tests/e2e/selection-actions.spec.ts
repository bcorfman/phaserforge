import { expect, test } from '@playwright/test';
import {
  clickCanvasAt,
  dragOnCanvas,
  dismissViewHint,
  expectSelection,
  getState,
  gotoStudio,
  seedSampleScene,
  selectGroupInSceneGraph,
  waitForSampleScene,
  worldToClient,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('selection bar groups ungrouped entities and can add to an existing group', async ({ page }) => {
  await dismissViewHint(page);

  // Ungroup the sample formation so entities become selectable as ungrouped sprites.
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('canvas-dissolve-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene?: { groups?: Record<string, unknown> } }>(page);
    return Boolean(state.scene?.groups?.['g-enemies']);
  }).toBe(false);

  // Clear selection and multi-select two ungrouped entities.
  const emptyPoint = await worldToClient(page, { x: 20, y: 20 });
  await clickCanvasAt(page, emptyPoint);
  await expectSelection(page, { kind: 'none' });

  const e2 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  const e1 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e1') ?? null) as any);
  if (!e1 || !e2) throw new Error('Entity rects unavailable');
  const start = await worldToClient(page, { x: e1.minX - 30, y: e1.minY - 30 });
  const end = await worldToClient(page, { x: e2.maxX + 5, y: e2.maxY + 5 });
  await dragOnCanvas(page, start, end, 'left');

  await expect.poll(async () => {
    const state = await getState<{ selection?: unknown }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });

  await page.getByTestId('canvas-group-button').click();

  await expect.poll(async () => {
    const state = await getState<{ selection?: { kind: string; id?: string }; scene?: { groups?: Record<string, any> } }>(page);
    if (state.selection?.kind !== 'group' || !state.selection.id) return null;
    const group = state.scene?.groups?.[state.selection.id];
    if (!group) return null;
    if (JSON.stringify(group.members) !== JSON.stringify(['e1', 'e2'])) return null;
    return state.selection.id;
  }).not.toBeNull();

  const stateAfterCreate = await getState<{ selection?: { kind: string; id?: string } }>(page);
  if (stateAfterCreate.selection?.kind !== 'group' || !stateAfterCreate.selection.id) {
    throw new Error('Expected a newly created group selection');
  }
  const createdGroupId = stateAfterCreate.selection.id;

  // Select two more entities, then add them to the group from the selection menu.
  await clickCanvasAt(page, emptyPoint);
  await expectSelection(page, { kind: 'none' });

  const e3 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e3') ?? null) as any);
  if (!e2 || !e3) throw new Error('Entity rects unavailable');
  const startAdd = await worldToClient(page, { x: e2.minX - 30, y: e2.minY - 30 });
  const endAdd = await worldToClient(page, { x: e3.maxX + 5, y: e3.maxY + 5 });
  await dragOnCanvas(page, startAdd, endAdd, 'left');

  await expect.poll(async () => {
    const state = await getState<{ selection?: unknown }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e2', 'e3'] });

  await page.getByTestId('canvas-selection-menu-button').click();
  await page.getByTestId(`canvas-menu-add-to-${createdGroupId}`).click();

  await expect.poll(async () => {
    const state = await getState<{ selection?: { kind: string; id?: string }; scene?: { groups?: Record<string, any> } }>(page);
    if (state.selection?.kind !== 'group' || !state.selection.id) return null;
    const group = state.scene?.groups?.[state.selection.id];
    return group?.members ?? null;
  }).toEqual(['e1', 'e2', 'e3']);
});
