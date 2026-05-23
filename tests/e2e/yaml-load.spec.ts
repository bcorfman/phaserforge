import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { dismissViewHint, getState, gotoStudio } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { sampleProject } from '../../src/model/sampleProject';

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

test('Open YAML (viewbar) opens a picker and loads the chosen file, then shows an expiring status label @smoke @browser', async ({ page }) => {
  await page.addInitScript(() => {
    // Force the `<input type=file>` picker path for this test.
    (window as any).showOpenFilePicker = undefined;
  });

  await gotoStudio(page);
  await dismissViewHint(page);

  await page.getByTestId('yaml-open-button').click();
  await expect(page.getByTestId('yaml-open-file-input')).toHaveCount(1);

  const fixtureName = 'fixture.yaml';
  const tmpPath = path.join(os.tmpdir(), `phaserforge-load-${Date.now()}-${fixtureName}`);
  fs.writeFileSync(tmpPath, serializeProjectToYaml(sampleProject), 'utf8');
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
