import { expect, test } from '@playwright/test';
import {
  dismissViewHint,
  getState,
  gotoStudio,
  seedSampleScene,
  waitForSampleScene,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('clicking an already-selected item enters rename mode', async ({ page }) => {
  await page.getByTestId('toggle-group-g-enemies').click();
  await page.getByTestId('group-member-g-enemies-e1').click();
  await page.getByTestId('group-member-g-enemies-e1').click();
  await expect(page.getByTestId('rename-entity-input-e1')).toBeVisible();
  await page.getByTestId('rename-entity-input-e1').fill('Copy Target');
  await page.getByTestId('rename-entity-input-e1').press('Enter');

  await page.getByTestId('group-item-g-enemies').click();
  await page.getByTestId('group-item-g-enemies').click();
  await expect(page.getByTestId('rename-group-input-g-enemies')).toBeVisible();
  await page.getByTestId('rename-group-input-g-enemies').fill('Invaders');
  await page.getByTestId('rename-group-input-g-enemies').press('Enter');

  await page.getByTestId('scene-item-scene-1').click();
  await expect(page.getByTestId('rename-scene-input-scene-1')).toBeVisible();
  await page.getByTestId('rename-scene-input-scene-1').fill('scene-renamed');
  await page.getByTestId('rename-scene-input-scene-1').press('Enter');

  await expect.poll(async () => {
    const state = await getState<{
      currentSceneId: string;
      project: { scenes: Record<string, { id: string; entities: Record<string, { name?: string }> ; groups: Record<string, { name?: string }> }> };
    }>(page);
    const active = state.project.scenes[state.currentSceneId];
    return {
      currentSceneId: state.currentSceneId,
      hasRenamedScene: Boolean(state.project.scenes['scene-renamed']),
      entityName: active.entities.e1?.name ?? null,
      groupName: active.groups['g-enemies']?.name ?? null,
    };
  }).toEqual({
    currentSceneId: 'scene-renamed',
    hasRenamedScene: true,
    entityName: 'Copy Target',
    groupName: 'Invaders',
  });
});
