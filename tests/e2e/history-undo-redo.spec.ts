import { expect, test } from '@playwright/test';
import { dragDropByTestId, getState, gotoStudio, seedSampleScene, triggerRedo, triggerUndo, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
});

test('Undo restores a deleted sprite', async ({ page }) => {
  await page.getByTestId('toggle-group-g-enemies').click();
  await page.getByTestId('group-member-remove-g-enemies-e1').click();
  await expect(page.getByTestId('entity-menu-e1')).toBeVisible();

  await page.getByTestId('entity-menu-e1').click();
  await page.getByTestId('entity-menu-delete-e1').click();
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Boolean(state.scene.entities.e1);
  }).toBe(false);

  await triggerUndo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Boolean(state.scene.entities.e1);
  }).toBe(true);

  await triggerRedo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Boolean(state.scene.entities.e1);
  }).toBe(false);
});

test('Undo restores a dissolved formation', async ({ page }) => {
  await page.getByTestId('group-item-g-enemies').click();
  await page.getByTestId('canvas-dissolve-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, unknown> } }>(page);
    return Boolean(state.scene.groups['g-enemies']);
  }).toBe(false);

  await triggerUndo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, unknown> } }>(page);
    return Boolean(state.scene.groups['g-enemies']);
  }).toBe(true);

  await triggerRedo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, unknown> } }>(page);
    return Boolean(state.scene.groups['g-enemies']);
  }).toBe(false);
});

test('Undo/redo works for scene graph member drag/drop', async ({ page }) => {
  // Expand formation members and remove two members (become ungrouped sprites).
  await page.getByTestId('toggle-group-g-enemies').click();
  await page.getByTestId('group-member-remove-g-enemies-e1').click();
  await page.getByTestId('group-member-remove-g-enemies-e2').click();

  // Multi-select in Sprites list via shift-click.
  await page.getByTestId('ungrouped-entity-e1').click();
  await page.keyboard.down('Shift');
  await page.getByTestId('ungrouped-entity-e2').click();
  await page.keyboard.up('Shift');

  // Drag the selection onto the formation row to add.
  await dragDropByTestId(page, 'ungrouped-entity-e1', 'group-item-g-enemies');

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { members: string[] }> } }>(page);
    const members = state.scene.groups['g-enemies'].members;
    return { hasE1: members.includes('e1'), hasE2: members.includes('e2') };
  }).toEqual({ hasE1: true, hasE2: true });

  await triggerUndo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { members: string[] }> } }>(page);
    const members = state.scene.groups['g-enemies'].members;
    return { hasE1: members.includes('e1'), hasE2: members.includes('e2') };
  }).toEqual({ hasE1: false, hasE2: false });

  await triggerRedo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { members: string[] }> } }>(page);
    const members = state.scene.groups['g-enemies'].members;
    return { hasE1: members.includes('e1'), hasE2: members.includes('e2') };
  }).toEqual({ hasE1: true, hasE2: true });
});

test('Delete key removes selection (power user) and undo restores', async ({ page }) => {
  await page.getByTestId('toggle-group-g-enemies').click();
  await page.getByTestId('group-member-remove-g-enemies-e1').click();

  await page.getByTestId('ungrouped-entity-e1').click();
  await page.keyboard.press('Delete');

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Boolean(state.scene.entities.e1);
  }).toBe(false);

  await triggerUndo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, unknown> } }>(page);
    return Boolean(state.scene.entities.e1);
  }).toBe(true);
});
