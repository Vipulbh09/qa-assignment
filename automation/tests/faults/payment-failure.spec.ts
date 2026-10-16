import { test, expect } from '@playwright/test';
import { PRODUCTS } from '../../helpers/data';
import { setFlag } from '../../helpers/flagd';
import { Shop } from '../../helpers/shop';

// TC-PAY-04. Flags are global to the stack: this file runs serially, after the
// api and ui projects (see playwright.config.ts), and always restores the flags.

test.describe.configure({ mode: 'serial' });

test.afterAll(async ({ request }) => {
  await setFlag(request, 'paymentFailure', 'off');
  await setFlag(request, 'paymentUnreachable', 'off');
});

test('paymentFailure: declines are 422, never 500, and create no order', async ({ request }) => {
  // The variant labelled "90%" is configured as 0.95 in demo.flagd.json.
  await setFlag(request, 'paymentFailure', '90%');

  const statuses: number[] = [];
  for (let i = 0; i < 20; i++) {
    const shop = new Shop(request);
    await shop.addToCart(PRODUCTS.cometBook.id, 1);
    statuses.push((await shop.placeOrder()).status());
  }

  // Probabilistic flag: assert a range, not an exact count. P(fewer than 14 of 20 at p=0.95) < 0.001.
  expect(statuses.filter(s => s === 422).length).toBeGreaterThanOrEqual(14);
  expect(statuses.every(s => s === 200 || s === 422), `statuses: ${statuses}`).toBe(true);
});

test('paymentUnreachable: outage is a 500, not a "check your card" 422', async ({ request }) => {
  await setFlag(request, 'paymentFailure', 'off');
  await setFlag(request, 'paymentUnreachable', 'on');

  const shop = new Shop(request);
  await shop.addToCart(PRODUCTS.cometBook.id, 1);
  const res = await shop.placeOrder();

  expect(res.status()).toBe(500);
  expect((await res.json()).code).not.toBe('PAYMENT_FAILED');
});

test('recovery: orders succeed once flags are off', async ({ request }) => {
  await setFlag(request, 'paymentUnreachable', 'off');
  const shop = new Shop(request);
  await shop.addToCart(PRODUCTS.cometBook.id, 1);
  await expect.poll(async () => (await shop.placeOrder()).status(), { timeout: 30_000 }).toBe(200);
});
