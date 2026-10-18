import { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { CartPage } from './CartPage';

export class ProductPage extends BasePage {
  async open(productId: string): Promise<void> {
    await this.page.goto(`/product/${productId}`);
  }

  get quantity(): Locator {
    return this.page.getByTestId('product-quantity');
  }

  get addToCartButton(): Locator {
    return this.page.getByTestId('product-add-to-cart');
  }

  get price(): Locator {
    return this.page.getByTestId('product-detail').getByTestId('product-price').first();
  }

  /** Add the product (default quantity 1) and land on the cart page. */
  async addToCart(quantity = 1): Promise<CartPage> {
    await this.quantity.selectOption(String(quantity));
    await this.addToCartButton.click();
    await this.page.waitForURL('**/cart');
    return new CartPage(this.page);
  }
}
