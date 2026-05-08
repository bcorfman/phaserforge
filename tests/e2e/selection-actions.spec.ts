import { expect, test } from '@playwright/test';
import {
  tapWorld,
  dragWorld,
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
  await tapWorld(page, { x: -9999, y: -9999 });
  await expectSelection(page, { kind: 'none' });

  const e2 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e2') ?? null) as any);
  const e1 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e1') ?? null) as any);
  if (!e1 || !e2) throw new Error('Entity rects unavailable');
  await dragWorld(page, { x: e1.minX - 30, y: e1.minY - 30 }, { x: e2.maxX + 5, y: e2.maxY + 5 });

  await expect.poll(async () => {
    const state = await getState<{ selection?: unknown }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });

  await page.getByTestId('canvas-group-button').click();
  await expect(page.getByTestId('canvas-group-prompt')).toBeVisible();
  const promptBox = await page.getByTestId('canvas-group-prompt').boundingBox();
  const nameLabelBox = await page.getByTestId('canvas-group-prompt').getByText('Name').boundingBox();
  const nameInputBox = await page.getByTestId('group-name-input').boundingBox();
  if (!promptBox || !nameLabelBox || !nameInputBox) throw new Error('Group prompt bounds unavailable');
  expect(nameInputBox.width).toBeGreaterThanOrEqual(160);
  expect(nameInputBox.x - (nameLabelBox.x + nameLabelBox.width)).toBeLessThanOrEqual(24);
  const viewport = page.viewportSize();
  if (!promptBox || !viewport) throw new Error('Viewport or prompt bounds unavailable');
  const inputRightDelta = (nameInputBox.x + nameInputBox.width) - (promptBox.x + promptBox.width);
  expect(inputRightDelta).toBeLessThanOrEqual(-4);
  expect(inputRightDelta).toBeGreaterThanOrEqual(-18);
  expect(promptBox.x).toBeGreaterThanOrEqual(0);
  expect(promptBox.y).toBeGreaterThanOrEqual(0);
  expect(promptBox.x + promptBox.width).toBeLessThanOrEqual(viewport.width);
  expect(promptBox.y + promptBox.height).toBeLessThanOrEqual(viewport.height);
  await page.getByTestId('group-prompt-confirm').click();

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
  await tapWorld(page, { x: -9999, y: -9999 });
  await expectSelection(page, { kind: 'none' });

  const e3 = await page.evaluate(() => (window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e3') ?? null) as any);
  if (!e2 || !e3) throw new Error('Entity rects unavailable');
  await dragWorld(page, { x: e2.minX - 30, y: e2.minY - 30 }, { x: e3.maxX + 5, y: e3.maxY + 5 });

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
