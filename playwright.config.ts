import { defineConfig, devices } from '@playwright/test';

type E2EProjectName = 'chromium' | 'firefox' | 'webkit' | 'edge';
type EnvLike = Record<string, string | undefined>;

export function resolveE2EProjectNames(env: EnvLike): E2EProjectName[] {
  const includeAllBrowsers = env.PW_ALL_BROWSERS === '1';
  if (includeAllBrowsers) {
    return ['chromium', 'firefox', 'webkit', 'edge'];
  }

  const isGitHubActions = env.GITHUB_ACTIONS === 'true';
  const includeEdge = env.PW_INCLUDE_EDGE === '1' || (!isGitHubActions && env.PW_EXCLUDE_EDGE !== '1');

  if (isGitHubActions) {
    return includeEdge ? ['firefox', 'webkit', 'edge'] : ['firefox', 'webkit'];
  }

  return includeEdge ? ['chromium', 'edge'] : ['chromium'];
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
  retries: process.env.CI ? 2 : 0,
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
  webServer: {
    command: 'npx vite --config vite/config.dev.mjs --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    // Reusing an existing dev server across runs can leave Playwright attached to a stale/bad state,
    // which shows up as intermittent "app never boots" timeouts. Prefer a fresh server per run.
    reuseExistingServer: false,
    timeout: process.env.CI ? 180000 : 120000,
  },
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
      case 'edge':
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
