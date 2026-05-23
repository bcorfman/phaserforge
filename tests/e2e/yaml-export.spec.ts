import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaserforge.projectYaml.v1');
    window.localStorage.removeItem('phaserforge.startupMode.v1');
    window.localStorage.removeItem('phaserforge.themeMode.v1');
    window.localStorage.removeItem('phaserforge.uiScale.v1');
    window.localStorage.removeItem('phaserforge.inspectorFoldouts.v1');
  });
});

test('Save As YAML writes the current project YAML (download fallback) @smoke @browser', async ({ page }) => {
  await page.addInitScript(() => {
    const saved: any[] = [];
    (window as any).__YAML_SAVE_AS_TEST__ = { saved };

    (window as any).showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (text: string) => saved.push(text),
        close: async () => {},
      }),
    });
    // Ensure this test never triggers a browser download.
    (window as any).URL.createObjectURL = () => 'blob:yaml-save-as-test';
    (window as any).URL.revokeObjectURL = () => {};
  });

  // Ensure the init script is applied to the loaded document.
  await page.reload();

  await gotoStudio(page);
  await dismissViewHint(page);

  // Make a deterministic change so the toolbar shows "Unsaved", then ensure saving clears it.
  await page.evaluate(() => {
    (window as any).__PHASER_FORGE_TEST__?.dispatch?.({ type: 'create-text-entity' });
  });
  await expect.poll(async () => (await getState<{ dirty: boolean }>(page)).dirty).toBe(true);
  await expect(page.getByTestId('dirty-badge')).toBeVisible();

  const expectedYaml = serializeProjectToYaml((await getState<{ project: any }>(page)).project);
  await page.getByTestId('yaml-save-as-button').click();

  await expect.poll(async () => {
    return page.evaluate(() => (window as any).__YAML_SAVE_AS_TEST__?.saved?.length ?? 0);
  }).toBe(1);
  const saved = await page.evaluate(() => (window as any).__YAML_SAVE_AS_TEST__?.saved?.[0] ?? null);
  expect(saved).toBe(expectedYaml);

  await expect.poll(async () => (await getState<{ dirty: boolean }>(page)).dirty).toBe(false);
  await expect(page.getByTestId('dirty-badge')).toBeHidden();
});
