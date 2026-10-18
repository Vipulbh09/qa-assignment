import { test, expect } from '../../fixtures';

test.describe('UI smoke @smoke', () => {
  test('home page renders the product list', async ({ pages }) => {
    await pages.home.open();

    await expect(pages.home.root).toBeVisible();
    await expect(pages.home.productCards.first()).toBeVisible();
  });
});
