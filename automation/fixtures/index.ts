import { BrowserContext, test as base } from '@playwright/test';
import { allure } from 'allure-playwright';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFECTS } from '../helpers/data';
import { FlagdApi, ShopApi } from '../api';
import { Pages } from '../pages';

type Fixtures = {
  /** The storefront's page objects, bound to this test's browser page. */
  pages: Pages;
  /** Open another tab in the same browser: same localStorage, so the same shopper. */
  newTab: () => Promise<Pages>;
  /** Open an isolated browser context: its own localStorage, so a different shopper. Closed after the test. */
  newSession: () => Promise<Pages>;
  /** A fresh shopper for the API (own cart, unique user ID). */
  shop: ShopApi;
  /** More shoppers, for tests that need two at once. */
  newShopper: () => ShopApi;
  /** Feature-flag control. Every flag the test changed is put back when the test ends. */
  flags: FlagdApi;
  /** Automatic: labels the test API or UI for the Allure report. */
  layer: void;
};

export const test = base.extend<Fixtures>({
  // Tells the Allure report which layer a test belongs to, from its folder (tests/api or tests/ui), so the report
  // groups API and UI separately. Playwright's own project names would split the serial fault specs into a third group.
  layer: [
    async ({}, use, testInfo) => {
      const layer = testInfo.file.includes('/tests/ui/') ? 'UI' : 'API';
      await allure.parentSuite(layer);
      await use();
    },
    { auto: true },
  ],

  pages: async ({ page }, use) => {
    await use(new Pages(page));
  },

  newTab: async ({ context }, use) => {
    await use(async () => new Pages(await context.newPage()));
  },

  newSession: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      return new Pages(await context.newPage());
    });
    await Promise.all(contexts.map(context => context.close()));
  },

  shop: async ({ request }, use) => {
    await use(new ShopApi(request));
  },

  newShopper: async ({ request }, use) => {
    await use(() => new ShopApi(request));
  },

  flags: async ({ request }, use) => {
    const flags = new FlagdApi(request);
    try {
      await use(flags);
    } finally {
      await flags.restore();
    }
  },
});

export { expect } from '@playwright/test';

const BUGS_DIR = join(__dirname, '../../bugs');
const BUGS_URL = 'https://github.com/Vipulbh09/qa-assignment/blob/main/bugs';

/**
 * Marks the running test as covering a known product defect. Call it first thing in the test.
 * The test still asserts the CORRECT behaviour, so while the bug exists it FAILS, for real, and shows up red in
 * every report with the DEF id and a link to its bug report. `scripts/gate.mjs` accepts those failures, and turns
 * red if such a test starts passing (the bug is fixed: remove the call).
 */
export function knownDefect(id: keyof typeof DEFECTS) {
  const report = readdirSync(BUGS_DIR).find(f => f.startsWith(`${id}-`));
  const annotations = test.info().annotations;
  annotations.push({ type: 'defect', description: id });
  annotations.push({ type: '@allure.label.tag', description: 'known-defect' });
  annotations.push({ type: 'description', description: `Known defect ${id}: ${DEFECTS[id]}. The test asserts the correct behaviour, so it fails until the bug is fixed.` });
  if (report) annotations.push({ type: 'issue', description: `${BUGS_URL}/${report}` });
}
