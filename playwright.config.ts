import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the real local stack. Start first (see README):
 *  1. Firebase emulators (Firestore 8080, Auth 9099) from `dard-board-backend`
 *  2. Java backend `gradlew quarkusDev` (port 5001)
 * The Angular dev server is started automatically.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    locale: 'de-DE',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start -- --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
