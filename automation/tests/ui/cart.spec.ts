import { test, expect } from '@playwright/test';
import { PRODUCTS } from '../../helpers/data';

test.describe('TC-CART-01 cart lifecycle (UI)', () => {
  test('merge, update, persist across reload and tabs, empty', async ({ page, context }) => {
    const addFromProductPage = async (qty: string) => {
      await page.goto(`/product/${PRODUCTS.lensKit.id}`);
      await page.getByTestId('product-quantity').selectOption(qty);
      await page.getByTestId('product-add-to-cart').click();
      await page.waitForURL('**/cart');
    };

    await addFromProductPage('1');
    await addFromProductPage('2');
    // Reload before asserting: without it the page shows a stale quantity ~20% of the time (DEF-10, see bugs/DEF-10-stale-cart-quantity.md).
    await page.reload();
    // The cart line's quantity select offers 1-10; the expiry-month select (1-12) is the only other one with a 10.
    const line = page
      .locator('select')
      .filter({ has: page.locator('option[value="10"]'), hasNot: page.locator('option[value="11"]') });
    await expect(line).toHaveValue('3');

    await line.selectOption('1');
    await expect(page.getByText('$ 30.94')).toBeVisible(); // 21.95 + 8.99 shipping

    await page.reload();
    await expect(line).toHaveValue('1');

    const tab = await context.newPage();
    await tab.goto('/');
    await expect(tab.getByTestId('cart-item-count')).toHaveText('1');

    await page.getByText('Empty Cart').click();
    await expect(page.getByText('Your shopping cart is empty!')).toBeVisible();
  });
});

test.describe('TC-CART-01 stale cart after add (DEF-10)', () => {
  // Observed in 11 of 30 runs (37%): server holds 3, page shows 1. Choosing 2 then sends a +1 delta,
  // so the cart ends at 4. Intermittent, so test.fail() would flap; kept as fixme until it can be
  // forced deterministically (e.g. by delaying the cart GET with page.route). See bugs/DEF-10.
  test.fixme('cart page shows the merged quantity without a reload', async ({ page }) => {
    for (const qty of ['1', '2']) {
      await page.goto(`/product/${PRODUCTS.lensKit.id}`);
      await page.getByTestId('product-quantity').selectOption(qty);
      await page.getByTestId('product-add-to-cart').click();
      await page.waitForURL('**/cart');
    }
    const line = page
      .locator('select')
      .filter({ has: page.locator('option[value="10"]'), hasNot: page.locator('option[value="11"]') });
    await expect(line).toHaveValue('3');
  });
});

test.describe('TC-CART-03 session isolation and recovery (UI)', () => {
  test('two browsers have independent carts', async ({ browser }) => {
    const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [pa, pb] = await Promise.all([a.newPage(), b.newPage()]);

    await pa.goto(`/product/${PRODUCTS.solarFilter.id}`);
    await pa.getByTestId('product-add-to-cart').click();
    await pa.waitForURL('**/cart');

    await pb.goto('/cart');
    await expect(pb.getByText('Your shopping cart is empty!')).toBeVisible();
    await Promise.all([a.close(), b.close()]);
  });

  test('a corrupted stored session is replaced, not fatal', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('session', 'not}{valid-json'));
    await page.goto('/');
    await expect(page.getByTestId('session-id')).toContainText(/session-id: \S+/);
    await expect(page.getByTestId('product-list').getByTestId('product-card').first()).toBeVisible();
  });
});
