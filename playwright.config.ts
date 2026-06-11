import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test configuration for LDO-2 EDMS.
 * Tests run against the Vite dev server with mock API enabled.
 */
export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    actionTimeout: 10000,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    baseURL: 'http://localhost:5173',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm --filter @workspace/edms dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_ENABLE_DEV_MOCK_API: 'true',
    },
  },
});
