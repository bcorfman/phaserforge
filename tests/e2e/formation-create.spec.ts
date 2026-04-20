import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, seedSampleScene, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaseractions.projectYaml.v1');
    window.localStorage.removeItem('phaseractions.startupMode.v1');
    window.localStorage.removeItem('phaseractions.themeMode.v1');
    window.localStorage.removeItem('phaseractions.uiScale.v1');
    window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
  });
});

test('creates a formation from an arrange preset after prompting for a template sprite', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await expect(page.getByTestId('create-formation-panel')).toBeVisible();
  await page.getByTestId('formation-create-name-input').fill('Enemy Formation');

  await page.getByTestId('formation-arrange-select').selectOption('line');
  await expect(page.getByTestId('formation-member-count-input')).toBeVisible();
  await page.getByTestId('formation-member-count-input').fill('5');

  const before = await getState<{ scene: { entities: Record<string, unknown>; groups: Record<string, unknown> } }>(page);
  const beforeEntityCount = Object.keys(before.scene.entities).length;
  const beforeGroupCount = Object.keys(before.scene.groups).length;

  await page.getByTestId('formation-create-button').click();
  await expect(page.getByTestId('formation-template-picker')).toBeVisible();
  await page.getByTestId('formation-template-pick-e1').click();

  await expect.poll(async () => {
    const state = await getState<{
      scene: { entities: Record<string, unknown>; groups: Record<string, { members?: string[] }> };
      selection?: unknown;
    }>(page);
    const group = state.scene.groups['g-enemy-formation'];
    return {
      entityCount: Object.keys(state.scene.entities).length,
      groupCount: Object.keys(state.scene.groups).length,
      memberCount: group?.members?.length ?? 0,
      selection: state.selection,
    };
  }).toEqual({
    entityCount: beforeEntityCount + 5,
    groupCount: beforeGroupCount + 1,
    memberCount: 5,
    selection: { kind: 'group', id: 'g-enemy-formation' },
  });
});
