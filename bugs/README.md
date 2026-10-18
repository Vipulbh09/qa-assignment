# Bug reports

Eleven defects found in the OpenTelemetry Astronomy Shop at upstream commit `ac0443b`. Each report has the same shape: summary, **steps to reproduce** (API and UI), expected vs. actual, impact, root cause from the code, and a suggested fix. Every step was run against the live stack on 2026-10-17, and the actual results quoted are what came back.

| ID | Severity | Defect | Detected by | Regression test |
|---|---|---|---|---|
| [DEF-01](DEF-01-order-cost-differs-from-price.md) | **S1** | Order cost differs from the displayed price ($57.08 shown, $57.80 costed) | Manual exploration | `api/checkout` |
| [DEF-05](DEF-05-unknown-currency-prices-everything-at-zero.md) | **S1** | An unknown currency prices everything at 0, and checkout accepts it | Manual probing | `api/checkout` |
| [DEF-02](DEF-02-no-message-on-declined-payment.md) | S2 | A declined payment shows the shopper no message | Manual exploration | `ui/payment` |
| [DEF-03](DEF-03-cart-accepts-negative-quantity.md) | S2 | The cart accepts negative and zero quantities | Manual exploration | `api/cart` |
| [DEF-06](DEF-06-payment-skips-cvv-and-month-validation.md) | S2 | Payment skips CVV and expiry-month validation | Manual probing | `api/payment` |
| [DEF-07](DEF-07-unknown-product-breaks-cart.md) | S2 | An unknown product silently breaks the cart (it looks empty, checkout is impossible) | Manual probing | `api/cart` |
| [DEF-10](DEF-10-stale-cart-quantity.md) | S2 | Stale quantity on the cart page, about 1 run in 3 (**intermittent**) | **Automated suite** | `ui/cart` (`fixme`) |
| [DEF-11](DEF-11-unknown-currency-added-to-supported-list.md) | S2 | An unknown currency is added to the supported list for every shopper | Manual probing | `api/checkout` |
| [DEF-04](DEF-04-expiry-dropdown-offers-past-months.md) | S3 | The expiry selector offers past months | Manual exploration | `ui/payment` |
| [DEF-08](DEF-08-sub-cent-price-drift.md) | S3 | Converted prices drift below a cent | **Automated suite** | `api/checkout` |
| [DEF-09](DEF-09-fractional-yen.md) | S3 | JPY prices shown with fractional yen | Manual probing | `api/checkout` |

**Detected by** records how each defect was first found: *Manual exploration* (reading code and checking live while writing the test cases), *Manual probing* (deliberate API probes while preparing the automation), or *Automated suite* (a scripted test failed first). It feeds the "bugs caught by automation" metric on the dashboard.

**Severity:** S1 = money or data wrong for customers, release blocker; S2 = a customer-visible failure or a safety net that only holds by accident; S3 = minor or cosmetic.

**Five of these share one root area.** DEF-01, DEF-05, DEF-08, DEF-09 and DEF-11 all come from the currency service's conversion code (`src/currency/src/server.cpp`): a digit-by-digit nanos reader, an inserting map lookup, a float round-trip, and no per-currency decimals. That makes it one decision for leadership (see [`../REFLECTION.md`](../REFLECTION.md)), not five separate bugs.

## How to reproduce

1. Start the demo: `./scripts/start-demo.sh` (from the repo root).
2. For the API steps: `source bugs/lib.sh`. It defines `price`, `add`, `cart`, `order`, `currencies` and `new_shopper`, and each report shows exactly which to run. It needs `curl` and `python3`.
3. For the UI steps: open `http://localhost:8080` in a browser. Where the browser console is needed, the report says so.
4. Each report names the automated test that checks the **correct** behaviour. It is marked with `knownDefect('DEF-xx')`, so it really fails while the bug exists and shows up red, with a screenshot for UI tests, in the Playwright and Allure reports. CI accepts those failures but fails on any new one, and also fails if a known-defect test starts passing (the bug is fixed: remove the marker).

## Things to know before you start

- **Reset between runs of DEF-05 and DEF-11.** They change shared state: the currency list gains the unknown code until the currency service restarts. Run `docker restart currency` to reset (this restored the original 33 currencies).
- **Don't run reproductions while the automated suite runs.** They share one stack.
- Defects reproduced on a freshly started stack with the default background load (`load-generator` on).
