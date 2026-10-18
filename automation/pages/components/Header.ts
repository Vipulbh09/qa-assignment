import { Locator, Page } from '@playwright/test';

/** The top bar shown on every storefront page. */
export class Header {
  constructor(private readonly page: Page) {}

  get currencySwitcher(): Locator {
    return this.page.getByTestId('currency-switcher');
  }

  get cartItemCount(): Locator {
    return this.page.getByTestId('cart-item-count');
  }

  async chooseCurrency(code: string): Promise<void> {
    await this.currencySwitcher.selectOption(code);
  }
}
