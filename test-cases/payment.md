# Flow 2: Payment validation and decline handling

`PaymentService.Charge` (`src/payment/charge.js`) validates the card (Luhn check, Visa/MasterCard only, not expired) and charges. A decline surfaces through checkout → frontend `/api/checkout` (HTTP 422, `PAYMENT_FAILED`) → UI.

**Baseline** (every case assumes these, and lists only what it needs on top):
1. **Stack ready, not just reachable:** `GET /api/products?currencyCode=EUR` returns products (`scripts/wait-for-demo.sh` checks this). USD works earlier than EUR.
2. **All flagd flags `off`:** check `http://localhost:8080/feature`. Flags are global, so one left on makes unrelated cases fail.
3. **A new shopper:** new `userId` (API) or empty `localStorage` (UI). The background `load-generator` creates carts the whole time.

**Priority:** P1 = blocks release if failing; P2 = fix before next release; P3 = backlog. **Automation status:** `Automated` (fully scripted in `../automation`), `Partial` (scripted check plus a human judgement step), `Manual` (with the reason). Defects are in [`../bugs/`](../bugs/).

---

## TC-PAY-01: Card validation matrix (API)

| Field | Value |
|---|---|
| Priority | P1 |
| Automation status | Automated (API, data-driven) |
| Preconditions | Baseline (`paymentFailure` and `paymentUnreachable` off, otherwise declines are random). A new shopper with one item **per row**: a successful order empties the cart. |

| # | Card | Expiry | Expected result |
|---|---|---|---|
| 1 | Visa `4432-8015-6152-0454` | 01/2030 | 200, order placed |
| 2 | MasterCard `5555-5555-5555-4444` | 01/2030 | 200, order placed |
| 3 | Amex `378282246310005` | 01/2030 | 422 `PAYMENT_FAILED`; log says only VISA or MasterCard accepted |
| 4 | Luhn-invalid `4432-8015-6152-0455` | 01/2030 | 422 `PAYMENT_FAILED`; "Credit card info is invalid" |
| 5 | Visa | **current month and year** | 200 (card valid through end of month) |
| 6 | Visa | **last month** | 422 `PAYMENT_FAILED`; "expired" |
| 7 | Visa, CVV `0` | 01/2030 | 422. **Actual: 200, FAIL (DEF-06)**: CVV is never checked |
| 8 | Visa, month `13` | 13/2030 | 422. **Actual: 200, FAIL (DEF-06)** |

**Edge cases:**
- Card number with spaces vs. dashes vs. digits only: consistent result.
- Month 0 via API: should be 4xx, not a 500 (month 13 is row 8).
- Year `2030` vs `30`.

**Quality risk to flag before ship:** CVV is not validated and the charge amount is not validated (no check for zero or negative totals).

---

## TC-PAY-02: Shopper sees a clear message when payment is declined

| Field | Value |
|---|---|
| Priority | P1 |
| Automation status | Partial: the absence of a message is automatable; whether the message is *clear* needs a human |
| Preconditions | Baseline. **Not January** (needs a past month in the current year). One item in cart, on `/cart`. Browser console open, since the failure only shows there. |
| Status at `ac0443b` | **FAIL (DEF-02)** |

| # | Step | Expected result |
|---|---|---|
| 1 | Set expiry to a past date (January of the current year) | n/a |
| 2 | Click **Place Order** | Visible message explaining the payment failed and what to do; form keeps entered data; button usable again |
| 3 | Fix expiry to 01/2030, click **Place Order** | Order succeeds |

**Actual:** nothing visible happens. The page stays on `/cart` with no message; the browser logs an uncaught error "Your payment could not be processed…". Cause: `onPlaceOrder` in `src/frontend/components/Cart/CartDetail.tsx` has no error handling.

**Edge cases:**
- Repeated clicks after a silent failure: each one calls payment again.
- Screen reader: the error must be announced, not just shown.

**Quality risk to flag before ship:** silent failure on the money step drives abandonment and duplicate attempts.

---

## TC-PAY-03: Expiry date selector only offers valid dates

| Field | Value |
|---|---|
| Priority | P3 |
| Automation status | Automated (UI) |
| Preconditions | Baseline. **Not January.** One item in cart, on `/cart`. |
| Status at `ac0443b` | **FAIL (DEF-04)** |

| # | Step | Expected result |
|---|---|---|
| 1 | Open the **Year** dropdown | Starts at current year |
| 2 | Choose current year, open **Month** | Past months are disabled, or a past selection shows an inline error before submit |

**Actual:** all 12 months are selectable for the current year.

**Quality risk to flag before ship:** low on its own; it feeds directly into DEF-02.

---

## TC-PAY-04: Payment service failure (injected)

| Field | Value |
|---|---|
| Priority | P2 |
| Automation status | Automated (API + flagd toggle) |
| Preconditions | Baseline. Access to flagd (`/feature` UI or `/feature/api/*`). **Nothing else running against the stack**: the flags affect every shopper. |

| # | Step | Expected result |
|---|---|---|
| 1 | Set `paymentFailure` = `90%` via `/feature` | Flag saved |
| 2 | Place 20 orders via API | Most return 422 `PAYMENT_FAILED`; none return 500; no order created for failed ones |
| 3 | Set `paymentUnreachable` = `on`, place 1 order | 500 with a generic message (not 422): the frontend must not tell the shopper to "check card details" when the service is down |
| 4 | Reset both flags to `off` | Orders succeed again |

**Edge cases:**
- The `90%` variant is configured as `0.95` in `src/flagd/demo.flagd.json`. Label and value disagree. Minor, but tests asserting a 90% rate would be wrong.
- The flag is probabilistic, so assert on a range, not an exact count, or the test becomes flaky.

**Quality risk to flag before ship:** whether a decline vs. an outage is distinguished correctly decides what the shopper is told.
