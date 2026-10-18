# DEF-01: Order cost differs from the displayed price

| | |
|---|---|
| **Severity** | S1 Critical |
| **Component** | `currency` (C++), used by `checkout` and `frontend` |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual exploration |
| **Test case** | TC-CHK-02 |
| **Regression tests** | `automation/tests/api/checkout.spec.ts`: "Red Flashlight: order cost equals catalogue price" and "EUR price for a 1-9 cent product" (both `knownDefect('DEF-01')`) |

## Summary
A product priced with 1 to 9 cents is **costed higher than it is displayed**. Red Flashlight is shown at $57.08 but the order is costed at $57.80. Foreign-currency prices are wrong for the same products.

## Preconditions
Demo running and ready (see the repo README). Seeded product **Red Flashlight** (`LS4PSXUNUM`), $57.08.

## Steps to reproduce (API)
```bash
source bugs/lib.sh
price LS4PSXUNUM                 # 1. the price the storefront displays
U=$(new_shopper)
add $U LS4PSXUNUM 1              # 2. add one to the cart
order $U                         # 3. place the order in USD (default card and address)
```
Then compare `items[0].cost` in step 3 with the price from step 1. For the foreign-currency symptom: `price LS4PSXUNUM EUR`.

## Steps to reproduce (UI)
1. Open `http://localhost:8080/product/LS4PSXUNUM`. The price reads **$ 57.08**.
2. Click **Add To Cart**, then **Place Order** (the form is pre-filled).
3. The confirmation page lists the item's total. It reads **$ 57.80**.

## Expected
The order costs what the storefront showed: **57 units, 80 000 000 nanos ($57.08)**. In EUR, 57.08 ÷ 1.1305 = **€50.49**.

## Actual
| Where | Value |
|---|---|
| Catalogue price (USD) | `units: 57, nanos: 80000000` ($57.08) |
| Order item cost (USD) | `units: 57, nanos: 799999999` (**$57.80**) |
| Catalogue price (EUR) | `units: 51, nanos: 127819548` (**€51.13**; should be €50.49) |

## Impact
The customer is charged **$0.72 too much on every unit** of this product, and the confirmation page contradicts the product page. Any price whose cents are 01 to 09 is affected (in the seed data, only this product). Overcharging with no way for the customer to notice beforehand is a refund and legal exposure, not a cosmetic issue.

## Root cause (from the code)
`getDouble()` in `src/currency/src/server.cpp:181` converts the `nanos` field to a fraction by reading its decimal digits one at a time. It ignores how many leading zeros there are, so `80000000` nanos (0.08) is read as **0.8**. `checkout` makes the problem reachable for USD too: it calls `Convert` on every item, even USD to USD (`src/checkout/main.go:550`), whereas the frontend skips conversion for USD (`src/frontend/services/ProductCatalog.service.ts:11`). That is why the product page is right and the order is wrong.

## Suggested fix
Compute `units + nanos / 1e9` directly. Better, convert in integer arithmetic (see DEF-08), and skip the call when the source and target currency are the same.

## Related
Same function, different symptoms: DEF-08 (sub-cent drift), DEF-09 (fractional yen).
