import { APIRequestContext, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ADDRESS, CARDS } from './data';
import { Money } from './money';

export type CreditCard = {
  creditCardNumber: string;
  creditCardCvv: number;
  creditCardExpirationYear: number;
  creditCardExpirationMonth: number;
};

export const validCard = (overrides: Partial<CreditCard> = {}): CreditCard => ({
  creditCardNumber: CARDS.visa,
  creditCardCvv: 672,
  creditCardExpirationYear: new Date().getFullYear() + 4,
  creditCardExpirationMonth: 1,
  ...overrides,
});

/** Thin client for the frontend's REST routes (src/frontend/pages/api). One instance = one shopper. */
export class Shop {
  readonly userId = `qa-${randomUUID()}`;

  constructor(private readonly request: APIRequestContext) {}

  async products(currencyCode = 'USD') {
    const res = await this.request.get(`/api/products?currencyCode=${currencyCode}`);
    expect(res.status()).toBe(200);
    return (await res.json()) as { id: string; name: string; priceUsd: Money }[];
  }

  addToCart(productId: string, quantity: number) {
    return this.request.post('/api/cart', { data: { userId: this.userId, item: { productId, quantity } } });
  }

  async cart() {
    const res = await this.request.get(`/api/cart?sessionId=${this.userId}`);
    expect(res.status()).toBe(200);
    return (await res.json()) as { items: { productId: string; quantity: number }[] };
  }

  emptyCart() {
    return this.request.delete('/api/cart', { data: { userId: this.userId } });
  }

  placeOrder({ currency = 'USD', card = validCard() }: { currency?: string; card?: CreditCard } = {}) {
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
