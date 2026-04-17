import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
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

test('Load YAML opens a picker and loads the chosen file, then shows an expiring status label', async ({ page }) => {
  await page.addInitScript(() => {
    // Force the `<input type=file>` picker path for this test.
    (window as any).showOpenFilePicker = undefined;
  });

  await gotoStudio(page);
  await dismissViewHint(page);

  await page.getByTestId('load-yaml-button').click();
  await expect(page.getByTestId('yaml-open-file-input')).toHaveCount(1);

  const fixtureName = 'fixture.yaml';
  const tmpPath = path.join(os.tmpdir(), `phaseractions-load-${Date.now()}-${fixtureName}`);
  fs.writeFileSync(tmpPath, serializeSceneToYaml(sampleScene), 'utf8');
  await page.setInputFiles('[data-testid="yaml-open-file-input"]', tmpPath);

  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
    return Object.keys(state.scene?.entities ?? {}).length;
  }, { timeout: 10000 }).toBeGreaterThan(0);

  await expect(page.getByTestId('toolbar-status')).toContainText(fixtureName);

  // Status label should expire shortly after being shown.
  await expect.poll(async () => page.getByTestId('toolbar-status').count(), { timeout: 8000 }).toBe(0);

  fs.unlinkSync(tmpPath);
});
