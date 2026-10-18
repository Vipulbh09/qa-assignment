import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { CheckoutForm } from './components/CheckoutForm';
import { OrderConfirmationPage } from './OrderConfirmationPage';

export class CartPage extends BasePage {
  readonly checkoutForm = new CheckoutForm(this.page);

  async open(): Promise<void> {
    await this.page.goto('/cart');
  }

  get emptyMessage(): Locator {
    return this.page.getByText('Your shopping cart is empty!');
  }

  /**
   * The quantity picker of the (single) cart line. It offers 1 to 10; the form's expiry-month
   * select (1 to 12) is the only other select with a "10", so exclude anything offering 11.
   */
  get lineQuantity(): Locator {
    return this.page
      .locator('select')
      .filter({ has: this.page.locator('option[value="10"]'), hasNot: this.page.locator('option[value="11"]') });
  }

  /** An amount as the shopper reads it, e.g. "$ 17.98". Use for shipping, line and order totals. */
  amount(text: string): Locator {
    return this.page.getByText(text);
  }

  /** The message shown when the payment is declined. */
  get declineMessage(): Locator {
    return this.page.getByText(/payment could not be processed/i);
  }

  async setQuantity(quantity: number): Promise<void> {
    await this.lineQuantity.selectOption(String(quantity));
  }

  async emptyCart(): Promise<void> {
    await this.page.getByText('Empty Cart').click();
  }

  /** Click Place Order and stay on the page (use when the order is expected to fail). */
  async submitOrder(): Promise<void> {
    await this.checkoutForm.placeOrderButton.click();
  }

  /** Click Place Order and wait for the confirmation page. */
  async placeOrder(): Promise<OrderConfirmationPage> {
    await this.submitOrder();
    await this.page.waitForURL('**/cart/checkout/**');
    return new OrderConfirmationPage(this.page);
  }
}
