import { test, expect } from '../../fixtures';
import { CARDS, PRODUCTS } from '../../helpers/data';
import { validCard } from '../../api';
import type { CreditCard } from '../../api';

// TC-PAY-01: card validation matrix. Each row is its own test so a report shows exactly which rule broke.

const now = new Date();
const thisMonth = now.getMonth() + 1;
const thisYear = now.getFullYear();
const lastMonth = thisMonth === 1 ? { m: 12, y: thisYear - 1 } : { m: thisMonth - 1, y: thisYear };

type Row = { name: string; card: Partial<CreditCard>; accepted: boolean; defect?: string };

const rows: Row[] = [
  { name: 'Visa, future expiry', card: {}, accepted: true },
  { name: 'MasterCard, future expiry', card: { creditCardNumber: CARDS.mastercard }, accepted: true },
  { name: 'Amex is not accepted', card: { creditCardNumber: CARDS.amex }, accepted: false },
  { name: 'Luhn-invalid number', card: { creditCardNumber: CARDS.luhnInvalid }, accepted: false },
  {
    name: 'expiring this month is still valid',
    card: { creditCardExpirationMonth: thisMonth, creditCardExpirationYear: thisYear },
    accepted: true,
  },
  {
    name: 'expired last month',
    card: { creditCardExpirationMonth: lastMonth.m, creditCardExpirationYear: lastMonth.y },
    accepted: false,
  },
  { name: 'CVV 0 is rejected', card: { creditCardCvv: 0 }, accepted: false, defect: 'DEF-06' },
  { name: 'expiry month 13 is rejected', card: { creditCardExpirationMonth: 13 }, accepted: false, defect: 'DEF-06' },
];

test.describe('TC-PAY-01 card validation matrix', () => {
  for (const row of rows) {
    test(row.name, async ({ shop }) => {
      test.fail(!!row.defect, row.defect);
      await shop.addToCart(PRODUCTS.cometBook.id, 1);

      const res = await shop.placeOrder({ card: validCard(row.card) });

      if (row.accepted) {
        expect(res.status()).toBe(200);
      } else {
        // A decline is a 422 with a stable code, never a 500.
        expect(res.status()).toBe(422);
        expect((await res.json()).code).toBe('PAYMENT_FAILED');
        // A declined order must leave the cart intact so the shopper can retry.
        expect((await shop.cart()).items).toHaveLength(1);
      }
    });
  }
});
