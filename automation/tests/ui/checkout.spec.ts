import { test, expect } from '../../fixtures';
import { PRODUCTS } from '../../helpers/data';

test.describe('TC-CHK-01 happy path order (UI)', () => {
  test('browse, add 2, check totals, place order, cart emptied', async ({ pages }) => {
    await pages.product.open(PRODUCTS.imager.id);
    const cart = await pages.product.addToCart(2);

    // 2 x $175.00 + 2 x $8.99 shipping
    await expect(cart.amount('$ 17.98')).toBeVisible();
    await expect(cart.amount('$ 367.98')).toBeVisible();

    const confirmation = await cart.placeOrder();
    await expect(confirmation.heading).toBeVisible();
    await expect(confirmation.orderId).toBeVisible();
    await expect(confirmation.item(PRODUCTS.imager.name)).toBeVisible();
    await expect(confirmation.quantity(2)).toBeVisible();
    await expect(confirmation.amount('$ 350.00')).toBeVisible();
    await expect(confirmation.amount('$ 17.98')).toBeVisible();

    await cart.open();
    await expect(cart.emptyMessage).toBeVisible();
  });
});

test.describe('TC-CHK-03 currency switch (UI)', () => {
  test('switching to EUR re-prices the whole catalogue', async ({ pages }) => {
    const { home } = pages;
    await home.open();
    await expect(home.productCards).toHaveCount(10);

    await home.header.chooseCurrency('EUR');

    await expect(home.productCards).toHaveCount(10);
    await expect(home.productPrices.first()).toContainText('€');
    await expect(home.textInProductList('$')).toHaveCount(0);
  });
});
