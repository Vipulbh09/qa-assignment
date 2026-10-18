import { test, expect } from '../../fixtures';

// Smoke checks for the frontend's REST layer (src/frontend/pages/api in the demo).
// Each one proves a frontend -> backend gRPC path is alive, nothing more.

test.describe('API smoke @smoke', () => {
  test('product catalogue lists products with a USD price', async ({ shop }) => {
    const products = await shop.products();

    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.id).toBeTruthy();
      expect(p.priceUsd.currencyCode).toBe('USD');
    }
  });

  test('currency service lists supported currencies', async ({ shop }) => {
    expect(await shop.currencies()).toEqual(expect.arrayContaining(['USD', 'EUR']));
  });

  test('cart round-trip: add, read back, empty', async ({ shop }) => {
    // Each test gets its own shopper, so carts stay isolated when tests run in parallel.
    const [{ id: productId }] = await shop.products();

    expect((await shop.addToCart(productId, 2)).status()).toBe(200);
    expect((await shop.cart()).items).toEqual([expect.objectContaining({ productId, quantity: 2 })]);

    expect((await shop.emptyCart()).status()).toBe(204);
    expect((await shop.cart()).items).toEqual([]);
  });
});
