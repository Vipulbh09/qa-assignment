# Manual Test Cases

Three flows, chosen from the risk map in [`../test-strategy.md`](../test-strategy.md) §2. They are where money moves, where state is shared, and where the evidence already shows defects.

| File | Flow | Cases | Why it's highest risk |
|---|---|---|---|
| [`checkout.md`](checkout.md) | Place order: price integrity and orchestration | 4 | Price shown must equal price charged; one call fans out to 7 services |
| [`payment.md`](payment.md) | Payment validation and decline handling | 4 | Gates revenue; no unit tests in the service; shopper-facing failure UX |
| [`cart.md`](cart.md) | Cart state and quantity integrity | 3 | Feeds checkout; client-generated session IDs; no input validation |

**11 cases.** Fewer, deeper cases over many thin ones.

## Defects found while writing these

Observed against upstream commit `ac0443b` on 2026-10-16 (local Docker Compose). Every defect has an automated test (see `../automation/README.md`, "Known defects").

| ID | Severity | Summary | Found by |
|---|---|---|---|
| **DEF-01** | S1 | Order cost differs from displayed price for prices with 1–9 cents. Red Flashlight shows $57.08, order costs $57.799999999. | TC-CHK-02 |
| **DEF-02** | S2 | Declined payment shows **no message** to the shopper; the error is an uncaught JS exception. See [`evidence/decline-no-feedback.png`](evidence/decline-no-feedback.png). | TC-PAY-02 |
| **DEF-03** | S2 | Cart accepts negative and zero-crossing quantities (`quantity: -3` → HTTP 200, stored). Checkout is only blocked because shipping happens to reject it. | TC-CART-02 |
| **DEF-04** | S3 | Expiry dropdown offers past months of the current year (e.g. January 2026), so the UI lets a shopper submit a card that will always be declined. | TC-PAY-03 |
| **DEF-05** | **S1** | Unsupported currency code (e.g. `XXX`) prices **every product at 0**, and checkout accepts it: a $3,599 Optical Tube Assembly was ordered, "paid" and shipped for 0. The currency comes from the browser's `localStorage` session, so a shopper can set it. | TC-CHK-03 |
| **DEF-06** | S2 | Payment doesn't validate CVV or expiry month range: CVV `0` and month `13` are both accepted (HTTP 200). | TC-PAY-01 |
| **DEF-07** | S2 | Adding a non-existent product ID returns 200; after that, `GET /api/cart` for that shopper returns **500**, so the cart is broken. | TC-CART-02 |
| **DEF-08** | S3 | Converted prices drift below a cent: $209.95 comes back as 209.949999999 (double round-trip in the currency service). | TC-CHK-02 |
| **DEF-09** | S3 | JPY prices shown with fractional yen (Comet Book ¥110.69); JPY has no minor unit. | TC-CHK-03 |
| **DEF-10** | S2 | Intermittent (2 of 10 runs): after a second add, the cart page shows a stale quantity (1, server has 3). Changing it to 2 sends a +1 delta and the cart ends at **4**. | TC-CART-01 |

## Baseline preconditions (every case)

Each case lists only what it needs **on top of** these three. Each one is checkable, and each one caused a false failure while I was building the suite.

1. **Stack ready, not just reachable:** `GET /api/products?currencyCode=EUR` returns products (`scripts/wait-for-demo.sh` checks this). USD works earlier than EUR; the stack 504s on conversions until `product-catalog` is healthy.
2. **All flagd flags `off`:** check `http://localhost:8080/feature`. Flags are global, so one left on makes unrelated cases fail.
3. **A new shopper:** new `userId` (API) or empty `localStorage` (UI). The background `load-generator` is creating carts the whole time.

## Conventions

- **Priority:** P1 = blocks release if failing; P2 = fix before next release; P3 = backlog.
- **Automation status:** `Automated` (fully scripted in `../automation`), `Partial` (scripted check plus a human judgement step), `Manual` (with the reason).
- **Fault injection** uses flagd: UI at `http://localhost:8080/feature`, or the API `GET /feature/api/read` then `POST /feature/api/write` (the same mechanism the demo's own Cypress suite uses).
- **Test data:** form default Visa `4432-8015-6152-0454`, CVV `672`; MasterCard `5555-5555-5555-4444`; Amex `3782-822463-10005`; Luhn-invalid `4432-8015-6152-0455`. A fresh `userId` per case. Prices come from `src/postgresql/init.sql`; EUR rate `1.1305` USD per EUR from `src/currency/src/server.cpp`.
- **Shipping** is `8.99 × total item quantity` (`src/quote/app/routes.php`, `src/shipping/src/shipping_service.rs`).
