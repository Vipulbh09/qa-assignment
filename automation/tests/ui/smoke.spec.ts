import { test, expect } from '@playwright/test';

test.describe('UI smoke @smoke', () => {
  test('home page renders the product list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('product-list').getByTestId('product-card').first()).toBeVisible();
  });
});
