import { Page } from '@playwright/test';
import { CartPage } from './CartPage';
import { HomePage } from './HomePage';
import { ProductPage } from './ProductPage';

/** All the storefront's page objects bound to one browser page, so a test takes just one parameter. */
export class Pages {
  readonly home: HomePage;
  readonly product: ProductPage;
  readonly cart: CartPage;

  constructor(page: Page) {
    this.home = new HomePage(page);
    this.product = new ProductPage(page);
    this.cart = new CartPage(page);
  }
}
