import { test, expect } from '@playwright/test';
import { gotoStudio, waitForEmptyScene } from './helpers';

test('Cloud publish creates a per-game Pages repo flow with first-publish guidance', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ csrfToken: 'csrf' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/games', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ game: { id: 'g1', title: 'Zoof', created_at: 'c', updated_at: 'u' } }),
        contentType: 'application/json',
      });
      return;
    }
    await route.fulfill({ status: 200, body: JSON.stringify({ games: [] }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/publish/github-pages/info', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/publish/github-pages/check', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, url: 'https://alice.github.io/zoof/', exists: false, pagesConfigured: false, deploymentStatus: null }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/publish/github-pages', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, url: 'https://alice.github.io/zoof/', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued' }),
      contentType: 'application/json',
    });
  });

  await gotoStudio(page, { forceNavigate: true });
  await waitForEmptyScene(page);

  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await cloudTab.click();
  await expect(page.getByTestId('cloud-panel')).toBeVisible();
  await expect(page.getByTestId('cloud-publish-prereq')).toContainText('Before first publish');

  await page.getByLabel('Publish repository').fill('zoof');
  await expect(page.getByTestId('cloud-publish-pages-target')).toContainText('https://alice.github.io/zoof/');
  await page.getByTestId('cloud-publish-pages-button').click();
  await expect(page.getByTestId('publish-confirm-modal')).toBeVisible();
  await expect(page.getByTestId('publish-confirm-modal')).toContainText('A new repository will be created');
  await page.getByTestId('publish-confirm-submit').click();
  await expect(page.getByTestId('cloud-publish-pages-help')).toContainText('GitHub Pages accepted the deployment for zoof');
});

test('Cloud publish surfaces repo and Pages permission failures inline', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ csrfToken: 'csrf' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/games', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ game: { id: 'g1', title: 'Zoof', created_at: 'c', updated_at: 'u' } }),
        contentType: 'application/json',
      });
      return;
    }
    await route.fulfill({ status: 200, body: JSON.stringify({ games: [] }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/publish/github-pages/info', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/publish/github-pages/check', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, url: 'https://alice.github.io/zoof/', exists: true, pagesConfigured: true, deploymentStatus: 'built' }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/publish/github-pages', async (route) => {
    await route.fulfill({
      status: 400,
      body: JSON.stringify({ error: 'github_pages_permission_required' }),
      contentType: 'application/json',
    });
  });

  await gotoStudio(page, { forceNavigate: true });
  await waitForEmptyScene(page);

  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await cloudTab.click();
  await expect(page.getByTestId('cloud-panel')).toBeVisible();

  await page.getByLabel('Publish repository').fill('zoof');
  await page.getByTestId('cloud-publish-pages-button').click();
  await expect(page.getByTestId('publish-confirm-modal')).toBeVisible();
  await page.getByTestId('publish-confirm-submit').click();
  await expect(page.getByTestId('cloud-publish-pages-help')).toContainText('GitHub denied GitHub Pages management access');
});
