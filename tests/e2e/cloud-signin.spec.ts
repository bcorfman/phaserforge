import { test, expect } from '@playwright/test';
import { gotoStudio } from './helpers';

test('Cloud tab email login shows signed-in state and GitHub connect prompt @smoke', async ({ page }) => {
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
    await route.fulfill({ status: 200, body: JSON.stringify({ games: [] }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/publish/github-pages/info', async (route) => {
    await route.fulfill({ status: 400, body: JSON.stringify({ error: 'github_not_linked' }), contentType: 'application/json' });
  });

  await gotoStudio(page, { forceNavigate: true });
  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await cloudTab.click();
  await page.getByLabel('Email').fill('a@b.c');
  await page.locator('input[autocomplete="current-password"]').fill('pw');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByTestId('cloud-account-section')).toContainText('Signed in');
  await expect(page.getByTestId('cloud-account-section')).toContainText('a@b.c');
  await expect(page.getByTestId('cloud-github-connection')).toContainText('not connected');
  await expect(page.getByRole('button', { name: 'Connect GitHub' })).toBeVisible();
});

test('Cloud tab hides GitHub login until signed in, and shows helper copy @smoke', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ csrfToken: 'csrf' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 401, body: JSON.stringify({ error: 'not_logged_in' }), contentType: 'application/json' });
  });

  await gotoStudio(page, { forceNavigate: true });
  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await cloudTab.click();
  await expect(page.getByRole('button', { name: 'Connect GitHub' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Switch GitHub account' })).toHaveCount(0);
  await expect(page.getByText('Create an account (email + password + invite code), then connect GitHub')).toBeVisible();
});

test('Cloud GitHub connect link uses path-only returnTo (no absolute URL) @smoke', async ({ page }) => {
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
    await route.fulfill({ status: 200, body: JSON.stringify({ games: [] }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/publish/github-pages/info', async (route) => {
    await route.fulfill({ status: 400, body: JSON.stringify({ error: 'github_not_linked' }), contentType: 'application/json' });
  });

  await gotoStudio(page, { forceNavigate: true });
  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await cloudTab.click();
  await page.getByLabel('Email').fill('a@b.c');
  await page.locator('input[autocomplete="current-password"]').fill('pw');
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.getByRole('button', { name: 'Connect GitHub' }).click();
  await expect(page.getByTestId('github-connect-modal')).toBeVisible();
  const link = page.getByTestId('github-connect-confirm');
  const href = (await link.getAttribute('href')) ?? '';
  expect(href).toContain('/api/v1/auth/github/start?returnTo=');
  const url = new URL(href, 'https://example.test');
  const returnTo = url.searchParams.get('returnTo') ?? '';
  expect(returnTo.startsWith('/')).toBe(true);
  expect(returnTo.startsWith('http://') || returnTo.startsWith('https://')).toBe(false);
});
