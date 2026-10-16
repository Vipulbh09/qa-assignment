# Flow 1: Checkout (place order)

`POST /api/checkout` → `CheckoutService.PlaceOrder`, which calls cart → product-catalog → currency → shipping/quote → **payment (charge)** → shipping (ship) → cart (empty) → email.

---

## TC-CHK-01: Happy path order in USD

| Field | Value |
|---|---|
| Priority | P1 |
| Automation | Automated (UI + API) |
| Preconditions | Stack healthy; flagd flags all `off`; new browser session (fresh `userId`) |

| # | Step | Expected result |
|---|---|---|
| 1 | Open `/`, choose **Solar System Color Imager** ($175.00), add quantity 2 | Cart icon shows 2 |
| 2 | Open `/cart` | One line, qty 2, subtotal **$350.00**; shipping **$17.98** (2 × 8.99); total **$367.98** |
| 3 | Keep form defaults, click **Place Order** | Redirect to `/cart/checkout/<orderId>`; order ID is a UUID; tracking ID present |
| 4 | Check confirmation page | Same items, quantities and total as step 2 |
| 5 | Open `/cart` again | Cart is empty |
| 6 | In Jaeger (`/jaeger`), open the `PlaceOrder` trace | Spans for cart, product-catalog, currency, quote, payment, shipping, email; no error spans |

**Edge cases:**
- Double-click **Place Order**: exactly one order and one charge (check payment spans).
- Browser back button from the confirmation page, then Place Order again with an empty cart: must not create a zero-value order.
- Email service down: order still succeeds (email failure is logged only, by design).

**Quality risk to flag before ship:** idempotency. Nothing in `PlaceOrder` prevents a double submit from charging twice.

---

## TC-CHK-02: Displayed price equals charged price

| Field | Value |
|---|---|
| Priority | **P1: release blocker** |
| Automation | Automated (API: compare catalogue price with order item cost for every product) |
| Preconditions | Stack healthy; fresh `userId` |
| Status at `ac0443b` | **FAIL (DEF-01)** |

| # | Step | Expected result |
|---|---|---|
| 1 | `GET /api/products` and note **Red Flashlight** (`LS4PSXUNUM`) | `priceUsd` = 57 units, 80 000 000 nanos (**$57.08**) |
| 2 | Add 1 × Red Flashlight to cart; place order in **USD** | Order item `cost` = **$57.08** |
| 3 | Repeat steps 1–2 for every product in the catalogue | Every order item cost equals its catalogue price |

**Actual:** the order item cost is `57 units, 799 999 999 nanos` (**$57.80**). Root cause: `getDouble()` in `src/currency/src/server.cpp` drops leading zeros in the nanos field, and checkout calls `Convert` even for USD→USD.

**Edge cases:**
- Prices ending .01–.09 (the only affected range); .00 and .10–.99 are correct.
- Large quantity (10 × $57.08): error multiplies to $7.20.
- Rounding: `799999999` nanos shows floating-point conversion; totals should be computed in integer minor units. Confirmed separately as DEF-08: $209.95 comes back as 209.949999999 (sub-cent, S3).

**Quality risk to flag before ship:** every non-round price is a potential overcharge. Legal and refund exposure, not just a bug.

---

## TC-CHK-03: Order in a non-USD currency

| Field | Value |
|---|---|
| Priority | P1 |
| Automation | Automated (API) |
| Preconditions | Stack healthy; fresh `userId` |
| Status at `ac0443b` | **FAIL** for products affected by DEF-01; pass for others |

| # | Step | Expected result |
|---|---|---|
| 1 | Switch currency to **EUR** in the header | All prices show €; product count unchanged (10) |
| 2 | Check **The Comet Book** ($0.99) | **€0.88** (0.99 ÷ 1.1305 = 0.8757) |
| 3 | Check **Red Flashlight** ($57.08) | **€50.49** (57.08 ÷ 1.1305) |
| 4 | Add both to cart, place order | Order items and shipping in EUR; total = sum of displayed lines |
| 5 | Switch to **JPY** (zero-decimal currency) and repeat step 2 | No fractional yen shown |

**Actual (step 3):** €51.13, which is the result of converting $57.80.

**Edge cases:**
- Switch currency *after* adding to cart: cart re-prices consistently.
- `currencyCode` not in the supported list (e.g. `XXX`) via API: should be a clean 4xx. **Actual: FAIL (DEF-05).** Every product is priced at 0 and an order for the $3,599 Optical Tube Assembly goes through for 0. Cause: the currency service looks up unknown codes with `std::unordered_map::operator[]`, which returns 0 instead of an error.
- JPY: **Actual: FAIL (DEF-09)**, Comet Book shows ¥110.69.

**Quality risk to flag before ship:** no validation of currency codes server-side. Confirmed as S1: free goods (DEF-05).

---

## TC-CHK-04: Partial failure after payment

| Field | Value |
|---|---|
| Priority | P1 |
| Automation | Partial: failure injection is scripted; reconciling "was the customer charged?" needs a human reading traces |
| Preconditions | Stack healthy; ability to stop the `shipping` container mid-flow |

| # | Step | Expected result |
|---|---|---|
| 1 | Add an item to cart; fill checkout form | n/a |
| 2 | Pause shipping **after** the quote is returned but before `ShipOrder`, e.g. `docker pause shipping` with a breakpoint, or a proxy fault | n/a |
| 3 | Place order | Shopper sees a clear failure **and no charge stands**, *or* the order completes once shipping recovers |
| 4 | Inspect the `PlaceOrder` trace | If payment span succeeded, a compensating refund/void exists |

**Expected per code (`src/checkout/main.go:361-376`):** payment is charged first; a shipping failure returns `Unavailable` with **no refund path**. Expect this case to fail by design.

**Edge cases:**
- Cart-empty failure after a successful order: error is ignored (`_ = cs.emptyUserCart`), cart stays full, so a repeat order is easy.
- Timeout at the frontend (15 s Envoy timeout) while checkout completes server-side: shopper retries, gets charged twice.

**Quality risk to flag before ship:** money taken with no order. This is the risk I would escalate (see `REFLECTION.md`).
