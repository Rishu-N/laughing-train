import { defineConfig, devices } from '@playwright/test';

/**
 * E2E harness for the OS.
 *
 * Chromium is preinstalled in this environment at PLAYWRIGHT_BROWSERS_PATH,
 * so there is no `playwright install` step.
 *
 *   npm run test:e2e
 *
 * The webServer block builds and serves the app automatically; reuse is on
 * locally so repeat runs are fast.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // The OS is stateful (localStorage); keep runs deterministic.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
