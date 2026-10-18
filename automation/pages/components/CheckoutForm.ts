import { Locator, Page } from '@playwright/test';

/** The shipping and payment form on the cart page. The form is pre-filled with a valid Visa. */
export class CheckoutForm {
  constructor(private readonly page: Page) {}

  get cardNumber(): Locator {
    return this.page.locator('#credit_card_number');
  }

  get expiryMonth(): Locator {
    return this.page.locator('#credit_card_expiration_month');
  }

  get expiryYear(): Locator {
    return this.page.locator('#credit_card_expiration_year');
  }

  get cvv(): Locator {
    return this.page.locator('#credit_card_cvv');
  }

  get placeOrderButton(): Locator {
    return this.page.getByTestId('checkout-place-order');
  }

  /** One `<option>` of the month dropdown (1 = January), to check whether it is offered or disabled. */
  expiryMonthOption(month: number): Locator {
    return this.expiryMonth.locator(`option[value="${month}"]`);
  }

  async chooseExpiryYear(year: number): Promise<void> {
    await this.expiryYear.selectOption(String(year));
  }

  async chooseExpiry(month: number, year: number): Promise<void> {
    await this.expiryMonth.selectOption(String(month));
    await this.chooseExpiryYear(year);
  }
}
