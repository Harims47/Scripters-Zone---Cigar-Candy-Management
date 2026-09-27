import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Phase 2N E2E Automated Verification.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run systematically to maintain deterministic sequencing and avoid DB locks
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker avoids database race conditions in transactional flows
  timeout: 35000,
  expect: {
    timeout: 8000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 1024, height: 768 },
      },
      testMatch: /.*responsive\.spec\.ts/,
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
      },
      testMatch: /(.*salesman.*|.*responsive.*)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: './backend',
      port: 4000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
