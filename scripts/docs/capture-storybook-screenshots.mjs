import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { chromium } from '@playwright/test';

import { getScreenshotsBySource, parseScreenshotManifest } from '../../src/docs/screenshotManifest.ts';

const STORYBOOK_PORT = 6006;
const STORYBOOK_URL = `http://127.0.0.1:${STORYBOOK_PORT}`;

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
  return getScreenshotsBySource(parseScreenshotManifest(JSON.parse(raw)), 'storybook');
}

async function captureStorybookScreenshots() {
  const manifest = await loadManifest();
  const child = spawn('npm', ['run', 'storybook', '--', '--host', '127.0.0.1', '--port', String(STORYBOOK_PORT), '--ci', '--quiet'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  try {
    await waitForHttp(STORYBOOK_URL);

    const browser = await chromium.launch();
    try {
      for (const entry of manifest) {
        const page = await browser.newPage({
          viewport: entry.viewport ?? { width: 1280, height: 900 },
          deviceScaleFactor: 1,
        });
        const storyUrl = `${STORYBOOK_URL}/iframe.html?id=${encodeURIComponent(entry.storyId)}&viewMode=story`;
        await page.goto(storyUrl, { waitUntil: 'networkidle', timeout: 120000 });
        const readySelector = entry.readySelector ?? entry.selector ?? '#storybook-root';
        await page.waitForSelector(readySelector, { state: 'visible', timeout: 30000 });
        await page.emulateMedia({ reducedMotion: 'reduce' });

        const target = page.locator(entry.selector ?? '#storybook-root');
        await target.scrollIntoViewIfNeeded();
        const outputPath = path.join(repoRoot, entry.output);
        await ensureParentDir(outputPath);
        await target.screenshot({ path: outputPath });
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
}

await captureStorybookScreenshots();
