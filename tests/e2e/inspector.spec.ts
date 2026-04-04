import { expect, test } from '@playwright/test';
import { dismissViewHint, expectInputValue, getState, gotoStudio } from './helpers';

test.beforeEach(async ({ page }) => {
  await gotoStudio(page);
  await dismissViewHint(page);
});

test('edits formation details and layout from the inspector', async ({ page }) => {
  await page.getByTestId('group-item-g-enemies').click();
  await expectInputValue(page.getByTestId('formation-name-input'), 'Enemy Formation');

  await page.getByTestId('formation-name-input').fill('Invader Block');
  await page.getByTestId('group-layout-start-x-input').fill('260');
  await page.getByTestId('group-layout-spacing-x-input').fill('60');
  await page.getByTestId('apply-group-layout-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { name?: string; layout?: { type: string; startX?: number; spacingX?: number } }> } }>(page);
    return state.scene.groups['g-enemies'];
  }).toMatchObject({
    name: 'Invader Block',
    layout: { type: 'grid', startX: 260, spacingX: 60 },
  });
});

test('edits move-until and bounds condition values from the inspector', async ({ page }) => {
  await page.getByTestId('action-item-a-move-right').click();

  await page.getByTestId('velocity-x-input').fill('140');
  await page.getByLabel('Min X').fill('120');
  await page.getByLabel('Max Y').fill('700');

  await expect.poll(async () => {
    const state = await getState<{ scene: { actions: Record<string, { velocity: { x: number } }>; conditions: Record<string, { bounds: { minX: number; maxY: number } }> } }>(page);
    return {
      velocityX: state.scene.actions['a-move-right'].velocity.x,
      minX: state.scene.conditions['c-bounds'].bounds.minX,
      maxY: state.scene.conditions['c-bounds'].bounds.maxY,
    };
  }).toEqual({ velocityX: 140, minX: 120, maxY: 700 });
});

test('removes a formation member and keeps the group selected', async ({ page }) => {
  await page.getByTestId('group-item-g-enemies').click();
  await page.getByTestId('group-member-remove-e3').click();

  await expect.poll(async () => {
    const state = await getState<{ selection: { kind: string; id?: string }; scene: { groups: Record<string, { members: string[]; layout?: { type: string } }> } }>(page);
    return {
      selection: state.selection,
      members: state.scene.groups['g-enemies'].members,
      layoutType: state.scene.groups['g-enemies'].layout?.type,
    };
  }).toEqual({
    selection: { kind: 'group', id: 'g-enemies' },
    members: ['e1', 'e2', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e13', 'e14', 'e15'],
    layoutType: 'freeform',
  });
});
