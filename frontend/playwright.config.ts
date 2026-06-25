import { defineConfig, devices } from '@playwright/test';

export const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:5173';
export const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:5000';
export const AUTH_STATE_PATH = 'tests/e2e/.auth/state.json';
export const TEST_USER_PATH = 'tests/e2e/.auth/test-user.json';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    storageState: AUTH_STATE_PATH,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: FRONTEND_URL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
