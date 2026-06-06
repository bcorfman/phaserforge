import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { chromium } from '@playwright/test';

import { getScreenshotsBySource, parseScreenshotManifest } from '../../src/docs/screenshotManifest.ts';
import { dispatchAction, dismissViewHint, getEntityWorldRect, gotoStudio, seedSampleScene, tapWorld } from '../../tests/e2e/helpers.ts';
import { getDefaultApiStubResponse } from '../../tests/support/apiMocks.ts';

const APP_PORT = 4173;
const APP_HOST = '127-0-0-1.nip.io';
const APP_LOCAL_URL = `http://127.0.0.1:${APP_PORT}`;
const APP_CLOUD_URL = `http://${APP_HOST}:${APP_PORT}`;
const APP_HEALTHCHECK_URL = `http://127.0.0.1:${APP_PORT}`;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

async function waitForHttp(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureParentDir(outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
}

async function loadManifest() {
  const manifestPath = path.join(repoRoot, 'scripts', 'docs', 'screenshot-manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  return getScreenshotsBySource(parseScreenshotManifest(JSON.parse(raw)), 'playwright');
}

async function prepareSampleScene(page, capture) {
  console.log(`[docs:screenshots:app] preparing sample scene for ${capture}`);
  await seedSampleScene(page);
  await gotoStudio(page);
  await dismissViewHint(page);

  const r1 = await getEntityWorldRect(page, 'e1');
  const r2 = await getEntityWorldRect(page, 'e2');
  await tapWorld(page, { x: r1.centerX ?? (r1.minX + r1.maxX) / 2, y: r1.centerY ?? (r1.minY + r1.maxY) / 2 });
  await tapWorld(page, { x: r2.centerX ?? (r2.minX + r2.maxX) / 2, y: r2.centerY ?? (r2.minY + r2.maxY) / 2 }, { additive: true });

  if (capture === 'layout-popover') {
    const layoutButton = page.getByTestId('canvas-layout-button');
    await layoutButton.focus();
    await layoutButton.press('Enter');
    await page.getByTestId('layout-units-pixels').click();
    await page.getByTestId('layout-spacing-x').fill('64');
    await page.waitForSelector('[data-testid="canvas-layout-popover"]', { state: 'visible', timeout: 10000 });
  }

  if (capture === 'assets-dock') {
    await page.waitForSelector('[data-testid="assets-dock"]', { state: 'visible', timeout: 10000 });
  }

  if (capture === 'toolbar') {
    await page.waitForSelector('[data-testid="toolbar"]', { state: 'visible', timeout: 10000 });
  }

  if (capture === 'yaml-controls') {
    await page.waitForSelector('[data-testid="yaml-save-as-button"]', { state: 'visible', timeout: 10000 });
  }

  if (capture === 'cloud-publish') {
    await page.context().unroute('**/api/**');
    await installCloudReadyApiStubs(page.context());
    await gotoStudio(page, { forceNavigate: true });
    await dismissViewHint(page);
    await dispatchAction(page, {
      type: 'set-project-metadata',
      title: 'Pattern Demo',
      publishGithubPagesRepo: 'pattern-demo',
    });
    await page.getByTestId('inspector-pane-tab-cloud').click();
    await page.waitForSelector('[data-testid="cloud-publish-pages-button"]', { state: 'visible', timeout: 10000 });
  }
}

async function installCloudReadyApiStubs(context) {
  const json = (body, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await context.route('**/api/**', async (route) => {
    const response = getDefaultApiStubResponse(route.request().url(), route.request().method());
    await route.fulfill(json(response.body, response.status));
  });
  await context.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill(json({ csrfToken: 'docs-csrf' }));
  });
  await context.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill(json({ user: { id: 'u1', email: 'alice@example.com' } }));
  });
  await context.route('**/api/v1/games', async (route) => {
    if (route.request().method().toUpperCase() === 'GET') {
      await route.fulfill(json({ games: [] }));
      return;
    }
    await route.continue();
  });
  await context.route('**/api/v1/publish/github-pages/info', async (route) => {
    await route.fulfill(json({ ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' }));
  });
}

async function captureDocsScreenshots() {
  const manifest = await loadManifest();
  const child = spawn('npx', ['vite', '--config', 'vite/config.dev.mjs', '--host', '0.0.0.0', '--port', String(APP_PORT)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: APP_HOST,
    },
    stdio: 'inherit',
    shell: false,
  });

  try {
    await waitForHttp(APP_HEALTHCHECK_URL);

    const browser = await chromium.launch();
    try {
      for (const entry of manifest) {
        console.log(`[docs:screenshots:app] capturing ${entry.id}`);
        const baseURL = entry.capture === 'cloud-publish' ? APP_CLOUD_URL : APP_LOCAL_URL;
        const context = await browser.newContext({
          baseURL,
          viewport: entry.viewport ?? { width: 1280, height: 900 },
          deviceScaleFactor: 2,
        });
        if (entry.capture === 'cloud-publish') {
          await installCloudReadyApiStubs(context);
        }
        const page = await context.newPage();
        await page.emulateMedia({ reducedMotion: 'reduce' });

        if (entry.scene === 'sample') {
          await prepareSampleScene(page, entry.capture);
        } else {
          await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        }

        const target = page.locator(entry.selector ?? 'body');
        await target.scrollIntoViewIfNeeded();
        const outputPath = path.join(repoRoot, entry.output);
        await ensureParentDir(outputPath);
        await target.screenshot({ path: outputPath });
        console.log(`[docs:screenshots:app] wrote ${entry.output}`);
        await page.close();
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
}

await captureDocsScreenshots();
