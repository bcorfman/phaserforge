import { expect, test } from '@playwright/test';

let server: { close: (callback: (error?: Error) => void) => void; listen: (port: number, host: string, callback: () => void) => void; address: () => string | { port: number } | null } | null = null;
let docsBaseUrl = '';
let repoRoot = '';
let docsDistRoot = '';
let createServerFn: typeof import('node:http').createServer;
let execFileSyncFn: typeof import('node:child_process').execFileSync;
let fsMod: typeof import('node:fs');
let pathMod: typeof import('node:path');

function contentTypeFor(filePath: string): string {
  const ext = pathMod.extname(filePath).toLowerCase();
  switch (ext) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.woff2':
      return 'font/woff2';
    case '.html':
    default:
      return 'text/html; charset=utf-8';
  }
}

function resolveDocsFile(urlPathname: string): string | null {
  const docsPrefix = '/phaserforge/docs/';
  if (!urlPathname.startsWith(docsPrefix)) return null;

  const relativePath = decodeURIComponent(urlPathname.slice(docsPrefix.length));
  const candidate = pathMod.normalize(pathMod.join(docsDistRoot, relativePath));
  if (!candidate.startsWith(docsDistRoot)) return null;

  if (fsMod.existsSync(candidate) && fsMod.statSync(candidate).isFile()) return candidate;

  const htmlCandidate = `${candidate}.html`;
  if (fsMod.existsSync(htmlCandidate) && fsMod.statSync(htmlCandidate).isFile()) return htmlCandidate;

  const indexCandidate = pathMod.join(candidate, 'index.html');
  if (fsMod.existsSync(indexCandidate) && fsMod.statSync(indexCandidate).isFile()) return indexCandidate;

  return null;
}

test.beforeAll(async () => {
  const [{ createServer }, { execFileSync }, fs, path] = await Promise.all([
    import('node:http'),
    import('node:child_process'),
    import('node:fs'),
    import('node:path'),
  ]);
  createServerFn = createServer;
  execFileSyncFn = execFileSync;
  fsMod = fs;
  pathMod = path;
  repoRoot = process.cwd();
  docsDistRoot = pathMod.join(repoRoot, 'docs', '.vitepress', 'dist');

  execFileSyncFn('npm', ['run', 'docs:build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  server = createServerFn((req, res) => {
    const pathname = req.url ? new URL(req.url, 'http://127.0.0.1').pathname : '/';
    const filePath = resolveDocsFile(pathname);
    if (!filePath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentTypeFor(filePath));
    res.end(fsMod.readFileSync(filePath));
  });

  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to start docs test server');
  docsBaseUrl = `http://127.0.0.1:${address.port}/phaserforge/docs`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server = null;
});

test('docs lists keep visible markers after hydration @browser', async ({ page }) => {
  await page.goto(`${docsBaseUrl}/getting-started/cloud-account-setup`);
  await page.waitForLoadState('networkidle');

  const orderedMarker = await page.locator('.vp-doc ol > li').first().evaluate((item) => {
    return window.getComputedStyle(item, '::before').content;
  });
  const unorderedMarker = await page.locator('.vp-doc ul > li').first().evaluate((item) => {
    return window.getComputedStyle(item, '::before').content;
  });

  expect(orderedMarker).not.toMatch(/^(none|normal)$/);
  expect(unorderedMarker).toBe('"•"');
});
