import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Smoke checks for the frontend's REST layer (src/frontend/pages/api in the demo).
// Each one proves a frontend -> backend gRPC path is alive, nothing more.

test.describe('API smoke @smoke', () => {
  test('product catalogue lists products with a USD price', async ({ request }) => {
    const res = await request.get('/api/products');
    expect(res.status()).toBe(200);

    const products = await res.json();
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.id).toBeTruthy();
      expect(p.priceUsd.currencyCode).toBe('USD');
    }
  });

  test('currency service lists supported currencies', async ({ request }) => {
    const res = await request.get('/api/currency');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(expect.arrayContaining(['USD', 'EUR']));
  });

  test('cart round-trip: add, read back, empty', async ({ request }) => {
    // A fresh userId per test keeps carts isolated when tests run in parallel.
    const userId = randomUUID();
    const products = await (await request.get('/api/products')).json();
    const productId = products[0].id;

    const add = await request.post('/api/cart', {
      data: { userId, item: { productId, quantity: 2 } },
    });
    expect(add.status()).toBe(200);

    const cart = await (await request.get(`/api/cart?sessionId=${userId}`)).json();
    expect(cart.items).toEqual([expect.objectContaining({ productId, quantity: 2 })]);

    const empty = await request.delete('/api/cart', { data: { userId } });
    expect(empty.status()).toBe(204);

    const after = await (await request.get(`/api/cart?sessionId=${userId}`)).json();
    expect(after.items).toEqual([]);
  });
});
