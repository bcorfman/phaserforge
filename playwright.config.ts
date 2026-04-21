import { defineConfig, devices } from '@playwright/test';

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
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 180000 : 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
