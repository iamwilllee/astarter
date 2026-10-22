import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/production',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.STARTER_SMOKE_URL ?? 'https://127.0.0.1:3110',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'production-chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/production', open: 'never' }]],
})
