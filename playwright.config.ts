import { defineConfig, devices } from '@playwright/test';

const includeAllBrowsers = Boolean(process.env.CI) || process.env.PW_ALL_BROWSERS === '1';
const includeEdge = includeAllBrowsers || process.env.PW_INCLUDE_EDGE === '1';

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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(includeAllBrowsers
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
    ...(includeEdge
      ? [
          {
            name: 'edge',
            use: { ...devices['Desktop Edge'], channel: 'msedge' as const },
          },
        ]
      : []),
  ],
});
