import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry in CI so a flaky pass is visible in the report ("flaky"), not hidden.
  retries: process.env.CI ? 1 : 0,
  // The JSON report feeds the metrics dashboard (dashboard/build.mjs).
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
  ],
  use: {
    baseURL,
    // The frontend tags elements with data-cy (used by its own Cypress suite); reuse them.
    testIdAttribute: 'data-cy',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'ui', testDir: './tests/ui', use: { ...devices['Desktop Chrome'] } },
    // Fault injection flips global flagd flags, so it runs alone, after everything else.
    { name: 'faults', testDir: './tests/faults', dependencies: ['api', 'ui'], fullyParallel: false },
  ],
});
