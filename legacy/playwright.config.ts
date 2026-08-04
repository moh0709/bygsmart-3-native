import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.E2E_PORT || 4174);
const defaultBaseURL = `http://127.0.0.1:${e2ePort}`;
const baseURL = process.env.BASE_URL || defaultBaseURL;
const runFullE2E = process.env.E2E_FULL === '1';
const useLocalServer = !process.env.BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: useLocalServer
    ? {
        command: `npm run build && npx vite preview --host 127.0.0.1 --port ${e2ePort} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
