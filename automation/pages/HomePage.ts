import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  async open(): Promise<void> {
    await this.page.goto('/');
  }

  get root(): Locator {
    return this.page.getByTestId('home-page');
  }

  get productList(): Locator {
    return this.page.getByTestId('product-list');
  }

  get productCards(): Locator {
    return this.productList.getByTestId('product-card');
  }

  get productPrices(): Locator {
    return this.productList.getByTestId('product-price');
  }

  /** Any element inside the product list that contains this text (for example a currency symbol). */
  textInProductList(text: string): Locator {
    return this.productList.getByText(text);
  }
}
