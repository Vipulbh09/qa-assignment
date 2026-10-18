import { test, expect } from '../../fixtures';
import { PRODUCTS, SHIPPING_PER_ITEM_USD, USD_PER_EUR } from '../../helpers/data';
import { Money, toCents, toNanos } from '../../helpers/money';

type OrderItem = { item: { productId: string; quantity: number }; cost: Money };
type Order = { orderId: string; shippingTrackingId: string; shippingCost: Money; items: OrderItem[] };

test.describe('TC-CHK-01 happy path order (API)', () => {
  test('USD order: totals, IDs and cart emptied @smoke', async ({ shop }) => {
    await shop.addToCart(PRODUCTS.imager.id, 2);

    const res = await shop.placeOrder();
    expect(res.status()).toBe(200);
    const order: Order = await res.json();

    expect(order.orderId).toMatch(/^[0-9a-f-]{36}$/);
    expect(order.shippingTrackingId).toBeTruthy();
    expect(order.items).toHaveLength(1);
    expect(order.items[0].item.quantity).toBe(2);
    expect(toCents(order.items[0].cost)).toBe(PRODUCTS.imager.usd);
    expect(toCents(order.shippingCost)).toBe(+(2 * SHIPPING_PER_ITEM_USD).toFixed(2));

    expect((await shop.cart()).items).toEqual([]);
  });
});

test.describe('TC-CHK-02 displayed price equals charged price', () => {
  // DEF-01 is triggered by prices whose cents are 01-09: only Red Flashlight ($57.08) in the seed data.
  const knownDefect: Record<string, string> = { [PRODUCTS.flashlight.id]: 'DEF-01' };

  for (const product of Object.values(PRODUCTS)) {
    test(`${product.name}: order cost equals catalogue price`, async ({ shop }) => {
      test.fail(!!knownDefect[product.id], knownDefect[product.id]);

      const listed = (await shop.products()).find(p => p.id === product.id)!;
      await shop.addToCart(product.id, 1);
      const res = await shop.placeOrder();
      expect(res.status()).toBe(200);
      const order: Order = await res.json();

      // Cent-level: what the shopper sees and pays. Sub-cent drift is covered separately below.
      expect(toCents(order.items[0].cost)).toBe(toCents(listed.priceUsd));
    });
  }

  test('order cost is exact to the nano (no float round-trip)', async ({ shop }) => {
    test.fail(true, 'DEF-08');
    const listed = (await shop.products()).find(p => p.id === PRODUCTS.binoculars.id)!;
    await shop.addToCart(PRODUCTS.binoculars.id, 1);
    const order: Order = await (await shop.placeOrder()).json();

    // Observed: 209.95 comes back as 209.949999999 (currency service converts via double).
    expect(toNanos(order.items[0].cost)).toBe(toNanos(listed.priceUsd));
  });
});

test.describe('TC-CHK-03 non-USD currency', () => {
  const eur = (usd: number) => +(usd / USD_PER_EUR).toFixed(2);

  test('EUR catalogue prices match the published rate', async ({ shop }) => {
    const products = await shop.products('EUR');
    expect(products).toHaveLength(Object.keys(PRODUCTS).length);

    const unaffected = Object.values(PRODUCTS).filter(p => p.id !== PRODUCTS.flashlight.id);
    for (const p of unaffected) {
      const listed = products.find(x => x.id === p.id)!;
      expect(listed.priceUsd.currencyCode, p.name).toBe('EUR');
      expect(toCents(listed.priceUsd), p.name).toBe(eur(p.usd));
    }
  });

  test('EUR price for a 1-9 cent product (Red Flashlight)', async ({ shop }) => {
    test.fail(true, 'DEF-01');
    const listed = (await shop.products('EUR')).find(p => p.id === PRODUCTS.flashlight.id)!;
    expect(toCents(listed.priceUsd)).toBe(eur(PRODUCTS.flashlight.usd));
  });

  test('EUR order is costed in EUR at listed prices', async ({ shop }) => {
    await shop.addToCart(PRODUCTS.cometBook.id, 1);
    const res = await shop.placeOrder({ currency: 'EUR' });
    expect(res.status()).toBe(200);
    const order: Order = await res.json();

    expect(order.items[0].cost.currencyCode).toBe('EUR');
    expect(toCents(order.items[0].cost)).toBe(eur(PRODUCTS.cometBook.usd));
    expect(order.shippingCost.currencyCode).toBe('EUR');
  });

  test('JPY prices have no fractional yen', async ({ shop }) => {
    test.fail(true, 'DEF-09');
    const products = await shop.products('JPY');
    for (const p of products) expect(p.priceUsd.nanos ?? 0, p.name).toBe(0);
  });

  test('unsupported currency code is rejected, not priced at zero', async ({ shop }) => {
    test.fail(true, 'DEF-05');
    const products = await shop.products('XXX').catch(() => null);
    // Either the catalogue refuses the currency, or it must not offer free goods.
    if (products) for (const p of products) expect(toNanos(p.priceUsd), p.name).toBeGreaterThan(0n);
  });

  test('an unknown currency code is not added to the supported list', async ({ shop }) => {
    test.fail(true, 'DEF-11');
    // Mutates shared state: the code stays listed until the currency service restarts
    // (`docker restart currency` locally). A random code keeps parallel runs from colliding.
    const code = 'Q' + Math.random().toString(36).slice(2, 4).toUpperCase();
    expect(await shop.currencies()).not.toContain(code);

    await shop.products(code);

    expect(await shop.currencies()).not.toContain(code);
  });

  test('order in an unsupported currency is refused', async ({ shop }) => {
    test.fail(true, 'DEF-05');
    await shop.addToCart(PRODUCTS.tubeAssembly.id, 1);
    const res = await shop.placeOrder({ currency: 'XXX' });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
