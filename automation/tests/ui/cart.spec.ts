import { test, expect } from '../../fixtures';
import { PRODUCTS } from '../../helpers/data';

test.describe('TC-CART-01 cart lifecycle (UI)', () => {
  test('merge, update, persist across reload and tabs, empty', async ({ pages, newTab }) => {
    const { product } = pages;

    await product.open(PRODUCTS.lensKit.id);
    await product.addToCart(1);
    await product.open(PRODUCTS.lensKit.id);
    const cart = await product.addToCart(2);
    // Reload before asserting: without it the page shows a stale quantity in about a third of
    // runs (DEF-10, see bugs/DEF-10-stale-cart-quantity.md).
    await cart.reload();
    await expect(cart.lineQuantity).toHaveValue('3');

    await cart.setQuantity(1);
    await expect(cart.amount('$ 30.94')).toBeVisible(); // 21.95 + 8.99 shipping

    await cart.reload();
    await expect(cart.lineQuantity).toHaveValue('1');

    const tab = await newTab();
    await tab.home.open();
    await expect(tab.home.header.cartItemCount).toHaveText('1');

    await cart.emptyCart();
    await expect(cart.emptyMessage).toBeVisible();
  });
});

test.describe('TC-CART-01 stale cart after add (DEF-10)', () => {
  // Observed in 11 of 30 runs (37%): server holds 3, page shows 1. Choosing 2 then sends a +1 delta,
  // so the cart ends at 4. Intermittent, so test.fail() would flap; kept as fixme until it can be
  // forced deterministically (e.g. by delaying the cart GET with page.route). See bugs/DEF-10.
  test.fixme('cart page shows the merged quantity without a reload', async ({ pages }) => {
    const { product } = pages;
    await product.open(PRODUCTS.lensKit.id);
    await product.addToCart(1);
    await product.open(PRODUCTS.lensKit.id);
    const cart = await product.addToCart(2);

    await expect(cart.lineQuantity).toHaveValue('3');
  });
});

test.describe('TC-CART-03 session isolation and recovery (UI)', () => {
  test('two browsers have independent carts', async ({ newSession }) => {
    const [a, b] = [await newSession(), await newSession()];

    await a.product.open(PRODUCTS.solarFilter.id);
    await a.product.addToCart();

    await b.cart.open();
    await expect(b.cart.emptyMessage).toBeVisible();
  });

  test('a corrupted stored session is replaced, not fatal', async ({ pages }) => {
    await pages.home.corruptStoredSession();
    await pages.home.open();

    await expect(pages.home.sessionId).toContainText(/session-id: \S+/);
    await expect(pages.home.productCards.first()).toBeVisible();
  });
});
