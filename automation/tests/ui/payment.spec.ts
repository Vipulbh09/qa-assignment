import { test, expect, Page } from '@playwright/test';
import { PRODUCTS } from '../../helpers/data';

async function cartWithOneItem(page: Page) {
  await page.goto(`/product/${PRODUCTS.cometBook.id}`);
  await page.getByTestId('product-add-to-cart').click();
  await page.waitForURL('**/cart');
}

test.describe('TC-PAY-02 declined payment feedback', () => {
  test('shopper sees a message when the card is declined', async ({ page }) => {
    test.fail(true, 'DEF-02');
    test.skip(new Date().getMonth() === 0, 'needs a past month in the current year');
    await cartWithOneItem(page);

    // January of the current year: offered by the form, always expired after January.
    await page.locator('#credit_card_expiration_month').selectOption('1');
    await page.locator('#credit_card_expiration_year').selectOption(String(new Date().getFullYear()));
    await page.getByTestId('checkout-place-order').click();

    await expect(page.getByText(/payment could not be processed/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/cart$/);
  });
});

test.describe('TC-PAY-03 expiry selector', () => {
  test('past months of the current year cannot be selected', async ({ page }) => {
    test.fail(true, 'DEF-04');
    const currentMonth = new Date().getMonth() + 1;
    test.skip(currentMonth === 1, 'no past months in January');
    await cartWithOneItem(page);

    await page.locator('#credit_card_expiration_year').selectOption(String(new Date().getFullYear()));
    const january = page.locator('#credit_card_expiration_month option[value="1"]');
    await expect(january).toBeDisabled();
  });
});
