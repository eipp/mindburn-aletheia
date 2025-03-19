import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './test/visual',
  timeout: 30000,
  retries: 2,
  workers: 4,
  use: {
    baseURL: process.env.TEST_APP_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Chrome Desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
        ...iPhone11,
      },
    },
  ],
  reporter: [
    ['html', { outputFolder: 'reports/playwright' }],
    ['junit', { outputFile: 'reports/playwright/results.xml' }],
  ],
  snapshotDir: './test/visual/__snapshots__',
  updateSnapshots: process.env.UPDATE_SNAPSHOTS ? 'all' : 'none',
};

export default config;
