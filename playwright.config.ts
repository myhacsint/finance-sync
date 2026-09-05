import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:18083', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined } },
  webServer: { command: 'node --experimental-sqlite scripts/qa-server.mjs', url: 'http://127.0.0.1:18083', reuseExistingServer: false },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } }
  ]
});
