import { test, expect } from '@playwright/test';
import { gotoStudio } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { createEmptyProject } from '../../src/model/emptyProject';

test('Cloud Launch opens play-only runtime view @smoke', async ({ page }) => {
  const cloudYaml = serializeProjectToYaml(createEmptyProject());

  // Install the game fetch stub at the context level so the popup inherits it without races.
  await page.context().route('**/api/v1/games/g1', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        game: { id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z', yaml: cloudYaml },
      }),
      contentType: 'application/json',
    });
  });

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
      body: JSON.stringify({
        games: [{ id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z' }],
      }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/games/g1', async (route) => {
    // Page-level stub is redundant but harmless; keep for clarity.
    await route.fulfill({ status: 200, body: JSON.stringify({ game: { id: 'g1', title: 'Workspace', created_at: '2026-05-28T10:00:00.000Z', updated_at: '2026-05-28T10:14:00.000Z', yaml: cloudYaml } }), contentType: 'application/json' });
  });

  await gotoStudio(page, { forceNavigate: true });
  await page.getByTestId('inspector-pane-tab-cloud').click();
  await page.getByLabel('Email').fill('a@b.c');
  await page.locator('input[autocomplete="current-password"]').fill('pw');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByTestId('cloud-panel')).toBeVisible();
  await page.getByLabel('Game').selectOption('g1');

  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('cloud-launch-button').click();
  const popup = await popupPromise;

  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.getByTestId('play-root')).toBeVisible();
  await expect(popup.getByTestId('app-root')).toHaveCount(0);
  await expect(popup.getByTestId('play-frame')).toBeVisible();
  await expect(popup.locator('#game-container canvas')).toBeVisible();
});
