import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { dismissViewHint, getState, gotoStudio, seedSampleScene } from './helpers';
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

test('Export YAML populates editor state but has no visible YAML panel', async ({ page }) => {
  await page.addInitScript(() => {
    // Avoid native save dialogs in tests; force download fallback.
    (window as any).showSaveFilePicker = undefined;
  });

  await seedSampleScene(page);
  await gotoStudio(page);
  await dismissViewHint(page);

  const initial = await getState<{ yamlText?: string }>(page);
  expect(initial.yamlText).toBe('');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-yaml-button').click(),
  ]);

  await expect.poll(async () => {
    const state = await getState<{ yamlText?: string }>(page);
    return state.yamlText ?? '';
  }).toBe(serializeProjectToYaml(sampleProject));

  const expectedYaml = serializeProjectToYaml(sampleProject);
  const downloadPath = await download.path();
  if (downloadPath) {
    expect(fs.readFileSync(downloadPath, 'utf8')).toBe(expectedYaml);
  } else {
    const tempPath = path.join(os.tmpdir(), `${Date.now()}-project.yaml`);
    await download.saveAs(tempPath);
    expect(fs.readFileSync(tempPath, 'utf8')).toBe(expectedYaml);
    fs.unlinkSync(tempPath);
  }

  await expect(page.getByTestId('yaml-textarea')).toHaveCount(0);
});
