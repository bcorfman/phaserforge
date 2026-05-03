import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { sampleProject } from '../../src/model/sampleProject';

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

test('Save As YAML downloads the YAML pane text (download fallback)', async ({ page }) => {
  const expectedYaml = serializeProjectToYaml(sampleProject);
  await page.addInitScript((yaml) => {
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
  }, expectedYaml);

  // Ensure the init script is applied to the loaded document.
  await page.reload();

  await gotoStudio(page);
  await dismissViewHint(page);

  await page.getByTestId('yaml-textarea').fill(expectedYaml);
  await expect.poll(async () => {
    const state = await getState<{ yamlText?: string }>(page);
    return state.yamlText ?? '';
  }).toBe(expectedYaml);
  await page.getByTestId('yaml-save-as-button').click();

  await expect.poll(async () => {
    return page.evaluate(() => (window as any).__YAML_SAVE_AS_TEST__?.saved?.length ?? 0);
  }).toBe(1);
  const saved = await page.evaluate(() => (window as any).__YAML_SAVE_AS_TEST__?.saved?.[0] ?? null);
  expect(saved).toBe(expectedYaml);
});
