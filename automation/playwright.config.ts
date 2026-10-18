import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // The demo stack is heavy (20 containers). On a laptop, 4 browser workers on top of it starve the
  // stack's own services and cause 504s and timeouts, so run 2 locally. CI uses Playwright's default.
  workers: process.env.CI ? undefined : 2,
  forbidOnly: !!process.env.CI,
  // One retry in CI so a flaky pass is visible in the report ("flaky"), not hidden.
  retries: process.env.CI ? 1 : 0,
  // The JSON report feeds the metrics dashboard (dashboard/build.mjs).
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    // Allure results (raw), turned into a report by `npm run allure:generate`. Needs no Java (Allure 3).
    ['allure-playwright', { resultsDir: 'allure-results', detail: true, suiteTitle: false }],
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
  ],
  // Pages and API calls on a busy laptop can take longer than the 5 s default; a real failure still fails.
  expect: { timeout: 10_000 },
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
