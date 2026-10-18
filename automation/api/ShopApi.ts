import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ADDRESS, CARDS } from '../helpers/data';
import { Money } from '../helpers/money';

export type CreditCard = {
  creditCardNumber: string;
  creditCardCvv: number;
  creditCardExpirationYear: number;
  creditCardExpirationMonth: number;
};

export type Product = { id: string; name: string; priceUsd: Money };
export type Cart = { items: { productId: string; quantity: number }[] };

export const validCard = (overrides: Partial<CreditCard> = {}): CreditCard => ({
  creditCardNumber: CARDS.visa,
  creditCardCvv: 672,
  creditCardExpirationYear: new Date().getFullYear() + 4,
  creditCardExpirationMonth: 1,
  ...overrides,
});

/**
 * Client for the storefront's REST routes (src/frontend/pages/api in the demo). It owns every
 * endpoint URL, so tests never contain one. One instance is one shopper with their own cart.
 *
 * Methods that return parsed data (products, currencies, cart) fail if the status is not 200.
 * Methods that return the raw response are for tests that assert on the status themselves.
 */
export class ShopApi {
  readonly userId: string;

  constructor(private readonly request: APIRequestContext, userId = `qa-${randomUUID()}`) {
    this.userId = userId;
  }

  async products(currencyCode = 'USD'): Promise<Product[]> {
    const res = await this.request.get(`/api/products?currencyCode=${currencyCode}`);
    expect(res.status()).toBe(200);
    return res.json();
  }

  async currencies(): Promise<string[]> {
    const res = await this.request.get('/api/currency');
    expect(res.status()).toBe(200);
    return res.json();
  }

  addToCart(productId: string, quantity: number): Promise<APIResponse> {
    return this.request.post('/api/cart', { data: { userId: this.userId, item: { productId, quantity } } });
  }

  async cart(): Promise<Cart> {
    const res = await this.cartResponse();
    expect(res.status()).toBe(200);
    return res.json();
  }

  cartResponse(): Promise<APIResponse> {
    return this.request.get(`/api/cart?sessionId=${this.userId}`);
  }

  emptyCart(): Promise<APIResponse> {
    return this.request.delete('/api/cart', { data: { userId: this.userId } });
  }

  placeOrder({ currency = 'USD', card = validCard() }: { currency?: string; card?: CreditCard } = {}): Promise<APIResponse> {
    return this.request.post(`/api/checkout?currencyCode=${currency}`, {
      data: {
        userId: this.userId,
        userCurrency: currency,
        email: 'qa@example.com',
        address: ADDRESS,
        creditCard: card,
      },
    });
  }
}
