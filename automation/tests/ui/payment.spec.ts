import { test, expect } from '../../fixtures';
import { PRODUCTS } from '../../helpers/data';

test.describe('TC-PAY-02 declined payment feedback', () => {
  test('shopper sees a message when the card is declined', async ({ pages }) => {
    test.fail(true, 'DEF-02');
    test.skip(new Date().getMonth() === 0, 'needs a past month in the current year');
    await pages.product.open(PRODUCTS.cometBook.id);
    const cart = await pages.product.addToCart();

    // January of the current year: offered by the form, always expired after January.
    await cart.checkoutForm.chooseExpiry(1, new Date().getFullYear());
    await cart.submitOrder();

    await expect(cart.declineMessage).toBeVisible({ timeout: 10_000 });
    expect(cart.path()).toBe('/cart');
  });
});

test.describe('TC-PAY-03 expiry selector', () => {
  test('past months of the current year cannot be selected', async ({ pages }) => {
    test.fail(true, 'DEF-04');
    test.skip(new Date().getMonth() + 1 === 1, 'no past months in January');
    await pages.product.open(PRODUCTS.cometBook.id);
    const cart = await pages.product.addToCart();

    await cart.checkoutForm.chooseExpiryYear(new Date().getFullYear());

    await expect(cart.checkoutForm.expiryMonthOption(1)).toBeDisabled();
  });
});
