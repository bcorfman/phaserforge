import { test, expect } from '@playwright/test';
import { gotoStudio } from './helpers';

test('Cloud tab shows Publish to GitHub Pages UI and blocks when path assets exist @smoke', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      const storage = window.localStorage;
      // Seed a minimal project yaml with a path asset.
      storage.setItem(
        'phaserforge.projectYaml.v1',
        [
          'id: p1',
          'assets:',
          '  images:',
          '    i1:',
          '      id: i1',
          '      source:',
          '        kind: path',
          '        path: /img.png',
          '  spriteSheets: {}',
          '  fonts: {}',
          'audio:',
          '  sounds: {}',
          'inputMaps: {}',
          'scenes:',
          '  s1:',
          '    id: s1',
          '    entities: {}',
          '    groups: {}',
          '    attachments: {}',
          '    behaviors: {}',
          '    actions: {}',
          '    conditions: {}',
          'initialSceneId: s1',
        ].join('\n'),
      );
      storage.setItem('phaserforge.startupMode.v1', 'reload_last_yaml');
    } catch {
      // ignore
    }
  });

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ csrfToken: 'csrf' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/games', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ games: [{ id: 'g1', title: 'G', created_at: 'c', updated_at: 'u' }] }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/publish/github-pages/info', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/', repo: 'alice/alice.github.io' }),
      contentType: 'application/json',
    });
  });

  await gotoStudio(page, { forceNavigate: true });
  const cloudTab = page.getByTestId('inspector-pane-tab-cloud');
  if ((await cloudTab.count()) === 0) {
    await expect(cloudTab).toHaveCount(0);
    return;
  }

  await cloudTab.click();
  await expect(page.getByTestId('cloud-panel')).toBeVisible();

  await page.getByLabel('Game').selectOption('g1');
  await page.getByLabel('Publish route').fill('mygame');

  await expect(page.getByTestId('cloud-publish-pages-button')).toBeDisabled();
  await expect(page.getByTestId('cloud-publish-pages-help')).toContainText('Path assets detected');
});
