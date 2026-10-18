import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** "Your order is complete!". This page has no test hooks, so its locators read what the shopper reads. */
export class OrderConfirmationPage extends BasePage {
  get heading(): Locator {
    return this.page.getByText('Your order is complete!');
  }

  get orderId(): Locator {
    return this.page.getByText(/^Order ID:/);
  }

  /** The line for a product, by name (the name also appears in the product image's alt text). */
  item(name: string): Locator {
    return this.page.getByText(name).first();
  }

  quantity(count: number): Locator {
    return this.page.getByText(`Quantity: ${count}`);
  }

  amount(text: string): Locator {
    return this.page.getByText(text);
  }
}
