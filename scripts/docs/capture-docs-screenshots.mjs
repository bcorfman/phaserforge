import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { chromium } from '@playwright/test';

import { getScreenshotsBySource, parseScreenshotManifest } from '../../src/docs/screenshotManifest.ts';
import { dismissViewHint, getEntityWorldRect, gotoStudio, seedSampleScene, tapWorld } from '../../tests/e2e/helpers.ts';

const APP_PORT = 4173;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;

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
}

async function captureDocsScreenshots() {
  const manifest = await loadManifest();
  const child = spawn('npx', ['vite', '--config', 'vite/config.dev.mjs', '--host', '127.0.0.1', '--port', String(APP_PORT)], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  try {
    await waitForHttp(APP_URL);

    const browser = await chromium.launch();
    try {
      for (const entry of manifest) {
        const context = await browser.newContext({
          baseURL: APP_URL,
          viewport: entry.viewport ?? { width: 1280, height: 900 },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.emulateMedia({ reducedMotion: 'reduce' });

        if (entry.scene === 'sample') {
          await prepareSampleScene(page, entry.capture);
        } else {
          await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        }

        const target = page.locator(entry.selector ?? 'body');
        await target.scrollIntoViewIfNeeded();
        const outputPath = path.join(repoRoot, entry.output);
        await ensureParentDir(outputPath);
        await target.screenshot({ path: outputPath });
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
