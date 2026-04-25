import { expect, test } from '@playwright/test';
import { dragDropByTestId, getState, gotoStudio, seedSampleScene, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('Scene Graph: multi-select sprites and drag into a formation to add members', async ({ page }) => {
  // Expand formation members and remove two members (become ungrouped sprites).
  await page.getByTestId('toggle-group-g-enemies').click();
  await page.getByTestId('group-member-remove-g-enemies-e1').click();
  await page.getByTestId('group-member-remove-g-enemies-e2').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { members: string[] }>; entities: Record<string, unknown> } }>(page);
    return {
      groupHasE1: state.scene.groups['g-enemies'].members.includes('e1'),
      groupHasE2: state.scene.groups['g-enemies'].members.includes('e2'),
      hasUngroupedE1: Boolean(state.scene.entities.e1),
      hasUngroupedE2: Boolean(state.scene.entities.e2),
    };
  }).toEqual({
    groupHasE1: false,
    groupHasE2: false,
    hasUngroupedE1: true,
    hasUngroupedE2: true,
  });

  const beforeState = await getState<{ scene: { groups: Record<string, { members: string[] }> } }>(page);
  const beforeMembers = beforeState.scene.groups['g-enemies'].members;

  // Multi-select in Sprites list via shift-click.
  await page.getByTestId('ungrouped-entity-e1').click();
  await page.keyboard.down('Shift');
  await page.getByTestId('ungrouped-entity-e2').click();
  await page.keyboard.up('Shift');

  await expect.poll(async () => {
    const state = await getState<{ selection: any }>(page);
    return state.selection;
  }).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });

  // Drag onto the member list (not just the formation label) to insert at that location.
  await dragDropByTestId(page, 'ungrouped-entity-e1', 'group-member-row-g-enemies-e4', { targetYFraction: 0.75 });
  const targetIndex = beforeMembers.indexOf('e4');

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { members: string[] }> } }>(page);
    const members = state.scene.groups['g-enemies'].members;
    return {
      hasE1: members.includes('e1'),
      hasE2: members.includes('e2'),
      e1Index: members.indexOf('e1'),
      e2Index: members.indexOf('e2'),
      e4Index: members.indexOf('e4'),
    };
  }).toEqual({
    hasE1: true,
    hasE2: true,
    e1Index: targetIndex + 1,
    e2Index: targetIndex + 2,
    e4Index: targetIndex,
  });
});

test('Scene Graph: drag formation member into Sprites dropzone to remove from group', async ({ page }) => {
  await page.getByTestId('toggle-group-g-enemies').click();
  await expect(page.getByTestId('group-member-g-enemies-e3')).toBeVisible();

  await dragDropByTestId(page, 'group-member-g-enemies-e3', 'sprites-dropzone');

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { members: string[] }> } }>(page);
    return state.scene.groups['g-enemies'].members.includes('e3');
  }).toBe(false);
});
