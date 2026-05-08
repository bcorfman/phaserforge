import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, getState, openSceneScope, seedProject } from './helpers';

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

test('creates a formation via the new draft workflow from Formations + Add', async ({ page }) => {
  await seedProject(page, createEmptyProject());
  await dismissViewHint(page);
  await openSceneScope(page);

  await page.getByTestId('assets-dock-import-button').click();
  await page.getByTestId('assets-dock-file-input').setInputFiles('res/images/enemy_A.png');
  await expect(page.getByTestId('assets-dock-item-image-enemy-a')).toBeVisible();

  const before = await getState<{ scene: { entities: Record<string, unknown>; groups: Record<string, unknown> } }>(page);
  const beforeEntityCount = Object.keys(before.scene.entities).length;
  const beforeGroupCount = Object.keys(before.scene.groups).length;

  await page.getByTestId('formations-add-scene-1').click();

  await expect(page.getByTestId('create-formation-draft-panel')).toBeVisible();
  await expect.poll(async () => {
    return await page.getByTestId('create-formation-draft-panel').evaluate((el) => {
      const block = el.querySelector('.inspector-block');
      if (!(block instanceof HTMLElement)) return 1;
      const bg = getComputedStyle(block).backgroundColor;
      const slash = bg.match(/\/\s*([0-9.]+)/);
      if (slash) {
        const alpha = Number(slash[1]);
        return Number.isFinite(alpha) ? alpha : 1;
      }
      const comma = bg.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)/i);
      if (comma) {
        const alpha = Number(comma[1]);
        return Number.isFinite(alpha) ? alpha : 1;
      }
      return 1;
    });
  }).toBeLessThan(1);
  await page.getByTestId('formation-draft-name-input').fill('Enemy Formation');
  await page.getByTestId('formation-draft-grid-rows').fill('2');
  await page.getByTestId('formation-draft-grid-cols').fill('3');
  await page.getByTestId('formation-draft-grid-spacing').fill('24');
  await page.getByTestId('formation-draft-center-x').fill('512');
  await page.getByTestId('formation-draft-center-y').fill('384');

  await page.getByTestId('formation-draft-create').click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const group = state?.scene?.groups?.['g-enemy-formation'];
    return {
      entityCount: Object.keys(state?.scene?.entities ?? {}).length,
      groupCount: Object.keys(state?.scene?.groups ?? {}).length,
      memberCount: group?.members?.length ?? 0,
      selection: state?.selection ?? null,
    };
  }).toEqual({
    entityCount: beforeEntityCount + 6,
    groupCount: beforeGroupCount + 1,
    memberCount: 6,
    selection: { kind: 'group', id: 'g-enemy-formation' },
  });
});

test('assets menu entrypoint opens a formation draft seeded with that asset', async ({ page }) => {
  await seedProject(page, createEmptyProject());
  await dismissViewHint(page);
  await openSceneScope(page);

  await page.getByTestId('assets-dock-import-button').click();
  await page.getByTestId('assets-dock-file-input').setInputFiles('res/images/enemy_A.png');
  await expect(page.getByTestId('assets-dock-item-image-enemy-a')).toBeVisible();

  await page.getByTestId('assets-dock-menu-image-enemy-a').click();
  await expect(page.getByTestId('assets-dock-row-menu')).toBeVisible();
  await page.getByTestId('assets-dock-row-menu-create-formation').click();

  const templateValue = await page.getByTestId('formation-draft-template-select').inputValue();
  expect(templateValue).toBe('asset:image:enemy-a');
  await expect(page.getByTestId('create-formation-draft-panel')).toBeVisible();
  await expect.poll(async () => {
    return await page.getByTestId('create-formation-draft-panel').evaluate((el) => {
      const block = el.querySelector('.inspector-block');
      if (!(block instanceof HTMLElement)) return 1;
      const bg = getComputedStyle(block).backgroundColor;
      const slash = bg.match(/\/\s*([0-9.]+)/);
      if (slash) {
        const alpha = Number(slash[1]);
        return Number.isFinite(alpha) ? alpha : 1;
      }
      const comma = bg.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)/i);
      if (comma) {
        const alpha = Number(comma[1]);
        return Number.isFinite(alpha) ? alpha : 1;
      }
      return 1;
    });
  }).toBeLessThan(1);
  await page.getByTestId('formation-draft-cancel').click();
  await expect(page.getByTestId('create-formation-draft-panel')).toHaveCount(0);
});
