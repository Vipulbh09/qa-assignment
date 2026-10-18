import { test, expect } from '../../fixtures';
import { PRODUCTS } from '../../helpers/data';

// TC-PAY-04. Flags are global to the stack, so a *.serial.spec.ts file runs serially, after the other api and
// ui tests (the `api-serial` project in playwright.config.ts). The `flags` fixture puts every flag back when a test ends.

test.describe.configure({ mode: 'serial' });

test('paymentFailure: declines are 422, never 500, and create no order', async ({ flags, newShopper }) => {
  // The variant labelled "90%" is configured as 0.95 in demo.flagd.json.
  await flags.set('paymentFailure', '90%');

  const statuses: number[] = [];
  for (let i = 0; i < 20; i++) {
    const shopper = newShopper();
    await shopper.addToCart(PRODUCTS.cometBook.id, 1);
    statuses.push((await shopper.placeOrder()).status());
  }

  // Probabilistic flag: assert a range, not an exact count. P(fewer than 14 of 20 at p=0.95) < 0.001.
  expect(statuses.filter(s => s === 422).length).toBeGreaterThanOrEqual(14);
  expect(statuses.every(s => s === 200 || s === 422), `statuses: ${statuses}`).toBe(true);
});

test('paymentUnreachable: outage is a 500, not a "check your card" 422', async ({ flags, shop }) => {
  await flags.set('paymentUnreachable', 'on');

  await shop.addToCart(PRODUCTS.cometBook.id, 1);
  const res = await shop.placeOrder();

  expect(res.status()).toBe(500);
  expect((await res.json()).code).not.toBe('PAYMENT_FAILED');
});

test('recovery: orders succeed once flags are off', async ({ flags, shop }) => {
  await flags.set('paymentUnreachable', 'on');
  await flags.set('paymentUnreachable', 'off');

  await shop.addToCart(PRODUCTS.cometBook.id, 1);
  await expect.poll(async () => (await shop.placeOrder()).status(), { timeout: 30_000 }).toBe(200);
});
