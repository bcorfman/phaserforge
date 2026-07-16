import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  shouldUseManagedExternalWebServer,
  resolveManagedExternalWebServerOptions,
  startManagedExternalWebServer,
} = require('../scripts/e2e-external-webserver.cjs');

const tempDirs: string[] = [];
const EXPECTED_PREVIEW_TIMEOUT_MS = process.env.CI ? 240000 : 180000;
const EXPECTED_DEV_TIMEOUT_MS = process.env.CI ? 180000 : 120000;

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
  tempDirs.length = 0;
});

describe('managed external E2E web server', () => {
  it('enables managed external server for normal test runs', () => {
    expect(shouldUseManagedExternalWebServer(['test', '--project=chromium'], {})).toBe(true);
  });

  it('skips managed external server for list-only runs', () => {
    expect(shouldUseManagedExternalWebServer(['test', '--list', '--project=chromium'], {})).toBe(false);
  });

  it('respects an explicitly managed external server environment override', () => {
    expect(shouldUseManagedExternalWebServer(['test'], { PW_EXTERNAL_WEBSERVER: '1' })).toBe(false);
  });

  it('defaults normal test runs to the stable preview server path', () => {
    expect(resolveManagedExternalWebServerOptions(['test', '--project=chromium'], {})).toMatchObject({
      mode: 'preview',
      command:
        'VITE_E2E_TEST_BRIDGE=1 npm run build-nolog && VITE_E2E_TEST_BRIDGE=1 npx vite preview --config vite/config.prod.mjs --host 127.0.0.1 --port 4173 --strictPort',
      host: '127.0.0.1',
      port: 4173,
      timeoutMs: EXPECTED_PREVIEW_TIMEOUT_MS,
    });
  });

  it('uses the live dev server for UI debugging runs', () => {
    expect(resolveManagedExternalWebServerOptions(['test', '--ui'], {})).toMatchObject({
      mode: 'dev',
      command: 'npx vite --config vite/config.dev.mjs --host 127.0.0.1 --port 4173',
      timeoutMs: EXPECTED_DEV_TIMEOUT_MS,
    });
  });

  it('records lifecycle logs when the managed server exits before readiness', async () => {
    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phaserforge-e2e-server-test-'));
    tempDirs.push(logDir);
    const scriptDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phaserforge-e2e-server-script-'));
    tempDirs.push(scriptDir);
    const failScriptPath = path.join(scriptDir, 'fail-server.cjs');
    await fs.writeFile(
      failScriptPath,
      "process.stderr.write('boom\\n');\nprocess.exitCode = 7;\n",
      'utf8',
    );
    const nodePath = process.execPath.replace(/\\/g, '/');

    await expect(
      startManagedExternalWebServer({
        command: `"${nodePath}" "${failScriptPath}"`,
        host: '127.0.0.1',
        port: 49173,
        timeoutMs: 2_000,
        logDir,
      }),
    ).rejects.toThrow(/exited before ready/i);

    const metadata = JSON.parse(await fs.readFile(path.join(logDir, 'lifecycle.json'), 'utf8')) as {
      exit?: { code?: number | null };
    };
    const stderr = await fs.readFile(path.join(logDir, 'stderr.log'), 'utf8');

    expect(metadata.exit?.code).toBeTruthy();
    expect(metadata.exit?.code).not.toBe(0);
    expect(stderr).toContain('boom');
  });
});
