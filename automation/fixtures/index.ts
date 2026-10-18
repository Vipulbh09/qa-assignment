import { BrowserContext, test as base } from '@playwright/test';
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
};

export const test = base.extend<Fixtures>({
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
