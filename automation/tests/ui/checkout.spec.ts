import { test, expect } from '@playwright/test';
import { PRODUCTS } from '../../helpers/data';

test.describe('TC-CHK-01 happy path order (UI)', () => {
  test('browse, add 2, check totals, place order, cart emptied', async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.imager.id}`);
    await page.getByTestId('product-quantity').selectOption('2');
    await page.getByTestId('product-add-to-cart').click();
    await page.waitForURL('**/cart');

    // 2 x $175.00 + 2 x $8.99 shipping
    await expect(page.getByText('$ 17.98')).toBeVisible();
    await expect(page.getByText('$ 367.98')).toBeVisible();

    await page.getByTestId('checkout-place-order').click();
    await page.waitForURL('**/cart/checkout/**');
    await expect(page.getByText('Your order is complete!')).toBeVisible();
    // The confirmation page has no data-cy hooks, so assert on what the shopper reads.
    await expect(page.getByText(/^Order ID:/)).toBeVisible();
    await expect(page.getByText(PRODUCTS.imager.name).first()).toBeVisible();
    await expect(page.getByText('Quantity: 2')).toBeVisible();
    await expect(page.getByText('$ 350.00')).toBeVisible();
    await expect(page.getByText('$ 17.98')).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByText('Your shopping cart is empty!')).toBeVisible();
  });
});

test.describe('TC-CHK-03 currency switch (UI)', () => {
  test('switching to EUR re-prices the whole catalogue', async ({ page }) => {
    await page.goto('/');
    const cards = page.getByTestId('product-list').getByTestId('product-card');
    await expect(cards).toHaveCount(10);

    await page.getByTestId('currency-switcher').selectOption('EUR');
    await expect(cards).toHaveCount(10);
    await expect(page.getByTestId('product-list').getByTestId('product-price').first()).toContainText('€');
    await expect(page.getByTestId('product-list').getByText('$')).toHaveCount(0);
  });
});
