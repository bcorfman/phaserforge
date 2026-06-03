import { defineConfig, devices } from '@playwright/test';

type E2EProjectName = 'chromium' | 'firefox' | 'webkit' | 'msedge';
type EnvLike = Record<string, string | undefined>;

export function resolveE2EWebServerConfig(env: EnvLike): { command: string; port: number; reuseExistingServer: boolean; timeout: number } | undefined {
  if (env.PW_EXTERNAL_WEBSERVER === '1') return undefined;
  return {
    command: 'npx vite --config vite/config.dev.mjs --host 127.0.0.1 --port 4173',
    port: 4173,
    // Reusing an existing dev server across runs can leave Playwright attached to a stale/bad state,
    // which shows up as intermittent "app never boots" timeouts. Prefer a fresh server per run.
    reuseExistingServer: false,
    timeout: env.CI ? 180000 : 120000,
  };
}

export function resolveE2EProjectNames(env: EnvLike): E2EProjectName[] {
  const explicitProjects = env.PW_PROJECTS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) as E2EProjectName[] | undefined;
  if (explicitProjects?.length) return explicitProjects;

  const includeAllBrowsers = env.PW_ALL_BROWSERS === '1';
  if (includeAllBrowsers) {
    return ['chromium', 'firefox', 'webkit', 'msedge'];
  }

  const isGitHubActions = env.GITHUB_ACTIONS === 'true';
  const includeEdge = env.PW_INCLUDE_EDGE === '1' || (!isGitHubActions && env.PW_EXCLUDE_EDGE !== '1');

  if (isGitHubActions) {
    // CI defaults to Chromium-only. Cross-browser runs should opt in via PW_PROJECTS or PW_ALL_BROWSERS.
    return ['chromium'];
  }

  return includeEdge ? ['chromium', 'msedge'] : ['chromium'];
}

const projectNames = resolveE2EProjectNames(process.env);
// Opt-in only: using a real Edge channel requires a locally-installed Edge build.
const edgeChannel = process.env.PW_EDGE_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: process.env.CI ? 120000 : 60000,
  expect: {
    timeout: process.env.CI ? 30000 : 10000,
  },
  fullyParallel: false,
  // When running all browsers locally, the combined resource load can cause an occasional
  // "browser has been closed" startup flake. Allow a small retry budget in that mode.
  retries: process.env.CI ? 2 : projectNames.length > 1 ? 1 : 0,
  // The editor boots a shared Vite dev server and uses localStorage-backed scene seeding.
  // Running multiple browser workers against that single server has proven flaky in practice.
  workers: process.env.PW_WORKERS ? parseInt(process.env.PW_WORKERS) : 3,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  ...(resolveE2EWebServerConfig(process.env) ? { webServer: resolveE2EWebServerConfig(process.env) } : {}),
  projects: projectNames.map((name) => {
    switch (name) {
      case 'chromium':
        return {
          name,
          use: { ...devices['Desktop Chrome'] },
        };
      case 'firefox':
        return {
          name,
          use: { ...devices['Desktop Firefox'] },
        };
      case 'webkit':
        return {
          name,
          use: { ...devices['Desktop Safari'] },
        };
      case 'msedge':
        return {
          name,
          use: {
            ...devices['Desktop Edge'],
            ...(edgeChannel ? { channel: edgeChannel as 'msedge' | 'msedge-beta' | 'msedge-dev' | 'msedge-canary' } : {}),
          },
        };
    }
  }),
});
