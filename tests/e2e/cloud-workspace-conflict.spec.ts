import { test, expect } from '@playwright/test';
import { gotoStudio, waitForEmptyScene, waitForSampleScene } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { sampleProject } from '../../src/model/sampleProject';
import { createEmptyProject } from '../../src/model/emptyProject';

test('Cloud login shows conflict picker when cloud and device diverge @smoke', async ({ page }) => {
  const deviceYaml = serializeProjectToYaml(sampleProject);
  const cloudYaml = serializeProjectToYaml(createEmptyProject());

  await page.addInitScript((yaml) => {
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      return;
    }
    storage.setItem('phaserforge.projectYaml.v1', yaml);
    storage.setItem('phaserforge.projectLastSavedAtMs.v1', String(Date.now() - 60_000));
    storage.setItem('phaserforge.startupMode.v1', 'reload_last_yaml');
  }, deviceYaml);

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ csrfToken: 'csrf' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 401, body: JSON.stringify({ error: 'not_logged_in' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/games', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ games: [{ id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z' }] }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/games/g1', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ game: { id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z', yaml: cloudYaml } }),
      contentType: 'application/json',
    });
  });

  await gotoStudio(page, { forceNavigate: true });
  await waitForSampleScene(page);

  await page.getByTestId('inspector-pane-tab-cloud').click();
  await expect(page.getByTestId('cloud-panel')).toBeVisible();

  await page.getByLabel('Email').fill('a@b.c');
  await page.locator('input[autocomplete="current-password"]').fill('pw');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByTestId('workspace-conflict-modal')).toBeVisible();
  await expect(page.getByTestId('workspace-conflict-cloud-card')).toContainText('Cloud');
  await expect(page.getByTestId('workspace-conflict-device-card')).toContainText('This device');

  const dl1 = page.waitForEvent('download');
  const dl2 = page.waitForEvent('download');
  await page.getByTestId('workspace-conflict-export-both').click();
  await Promise.all([dl1, dl2]);

  await page.getByTestId('workspace-conflict-use-cloud').click();
  await waitForEmptyScene(page);

  const backup = await page.evaluate(() => window.localStorage.getItem('phaserforge.workspaceBackupYaml.v1'));
  expect(typeof backup).toBe('string');
  expect(backup?.length).toBeGreaterThan(20);
});
