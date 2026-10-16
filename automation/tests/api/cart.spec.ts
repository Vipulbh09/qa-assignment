import { test, expect } from '@playwright/test';
import { PRODUCTS } from '../../helpers/data';
import { Shop } from '../../helpers/shop';

test.describe('TC-CART-01 cart operations (API)', () => {
  test('adding the same product twice merges the line', async ({ request }) => {
    const shop = new Shop(request);
    await shop.addToCart(PRODUCTS.lensKit.id, 1);
    await shop.addToCart(PRODUCTS.lensKit.id, 2);

    expect((await shop.cart()).items).toEqual([expect.objectContaining({ productId: PRODUCTS.lensKit.id, quantity: 3 })]);
  });

  test('a negative delta reduces quantity (how the UI updates quantities)', async ({ request }) => {
    const shop = new Shop(request);
    await shop.addToCart(PRODUCTS.lensKit.id, 3);
    await shop.addToCart(PRODUCTS.lensKit.id, -2);

    expect((await shop.cart()).items).toEqual([expect.objectContaining({ quantity: 1 })]);
  });
});

test.describe('TC-CART-02 invalid quantities and products are rejected', () => {
  test('negative quantity on an empty cart', async ({ request }) => {
    test.fail(true, 'DEF-03');
    const shop = new Shop(request);
    const res = await shop.addToCart(PRODUCTS.imager.id, -3);

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect((await shop.cart()).items).toEqual([]);
  });

  test('zero quantity is not stored as a line', async ({ request }) => {
    test.fail(true, 'DEF-03');
    const shop = new Shop(request);
    await shop.addToCart(PRODUCTS.imager.id, 0);

    expect((await shop.cart()).items).toEqual([]);
  });

  test('a cart with a negative line never reaches payment', async ({ request }) => {
    const shop = new Shop(request);
    await shop.addToCart(PRODUCTS.cometBook.id, 2);
    await shop.addToCart(PRODUCTS.tubeAssembly.id, -1);

    const res = await shop.placeOrder();
    // Passes today only because shipping rejects the quote (see DEF-03). Keeps that safety net under test.
    expect(res.status()).not.toBe(200);
  });

  test('unknown product ID is rejected and does not break the cart', async ({ request }) => {
    test.fail(true, 'DEF-07');
    const shop = new Shop(request);
    const res = await shop.addToCart('NOT-A-PRODUCT', 1);

    expect(res.status()).toBeGreaterThanOrEqual(400);
    const cart = await request.get(`/api/cart?sessionId=${shop.userId}`);
    expect(cart.status()).toBe(200);
  });
});

test.describe('TC-CART-03 session isolation', () => {
  test("one shopper's cart is not visible to another", async ({ request }) => {
    const a = new Shop(request);
    const b = new Shop(request);
    await a.addToCart(PRODUCTS.lensKit.id, 2);
    await b.addToCart(PRODUCTS.solarFilter.id, 1);

    expect((await a.cart()).items.map(i => i.productId)).toEqual([PRODUCTS.lensKit.id]);
    expect((await b.cart()).items.map(i => i.productId)).toEqual([PRODUCTS.solarFilter.id]);
  });
});
