import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio } from './helpers';
import { serializeSceneToYaml } from '../../src/model/serialization';
import { sampleScene } from '../../src/model/sampleScene';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('phaseractions.sceneYaml.v2');
    window.localStorage.removeItem('phaseractions.sceneYaml.v1');
    window.localStorage.removeItem('phaseractions.startupMode.v1');
    window.localStorage.removeItem('phaseractions.themeMode.v1');
    window.localStorage.removeItem('phaseractions.uiScale.v1');
    window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
  });
});

test('Load/Export YAML share the same picker start directory (startIn handle)', async ({ page }) => {
  const yaml = serializeSceneToYaml(sampleScene);
  await page.addInitScript((sceneYaml) => {
    const openHandle: any = {
      getFile: async () => new File([sceneYaml], 'picked.yaml', { type: 'application/x-yaml' }),
    };

    const saveHandle: any = {
      createWritable: async () => ({
        write: async () => {},
        close: async () => {},
      }),
    };

    (window as any).__YAML_PICKER_TEST__ = {
      openCalls: [] as any[],
      saveCalls: [] as any[],
      openHandle,
      saveHandle,
    };

    (window as any).showOpenFilePicker = async (options: any) => {
      (window as any).__YAML_PICKER_TEST__.openCalls.push(options);
      return [openHandle];
    };

    (window as any).showSaveFilePicker = async (options: any) => {
      (window as any).__YAML_PICKER_TEST__.saveCalls.push(options);
      return saveHandle;
    };
  }, yaml);

  // Ensure the init script is applied to the loaded document.
  await page.reload();

  await gotoStudio(page);
  await dismissViewHint(page);

  await page.getByTestId('load-yaml-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
    return Object.keys(state.scene?.entities ?? {}).length;
  }, { timeout: 10000 }).toBeGreaterThan(0);

  await page.getByTestId('export-yaml-button').click();
  await expect.poll(async () => {
    return page.evaluate(() => (window as any).__YAML_PICKER_TEST__?.saveCalls?.length ?? 0);
  }).toBe(1);

  await page.getByTestId('load-yaml-button').click();
  await expect.poll(async () => {
    return page.evaluate(() => (window as any).__YAML_PICKER_TEST__?.openCalls?.length ?? 0);
  }).toBe(2);

  const matches = await page.evaluate(() => {
    const t = (window as any).__YAML_PICKER_TEST__;
    if (!t) return { saveStartInMatchesOpen: false, secondOpenStartInMatchesSave: false };
    const firstOpenStartIn = t.openCalls?.[0]?.startIn;
    const saveStartIn = t.saveCalls?.[0]?.startIn;
    const secondOpenStartIn = t.openCalls?.[1]?.startIn;
    return {
      saveStartInMatchesOpen: saveStartIn === t.openHandle && firstOpenStartIn === undefined,
      secondOpenStartInMatchesSave: secondOpenStartIn === t.saveHandle,
    };
  });

  expect(matches).toEqual({ saveStartInMatchesOpen: true, secondOpenStartInMatchesSave: true });
});
