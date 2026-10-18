# DEF-05: An unknown currency code prices everything at zero, and checkout accepts it

| | |
|---|---|
| **Severity** | S1 Critical |
| **Component** | `currency` (C++), `checkout`, `frontend` |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual probing |
| **Test case** | TC-CHK-03 |
| **Regression tests** | `automation/tests/api/checkout.spec.ts`: "unsupported currency code is rejected, not priced at zero" and "order in an unsupported currency is refused" (both `knownDefect('DEF-05')`) |

## Summary
If the currency is a code the currency service has no exchange rate for, **every price becomes 0** and an order for any product, however expensive, **goes through for nothing**. A normal shopper can reach this from the storefront's own currency dropdown (see DEF-11 for why the dropdown offers it).

## Preconditions
Demo running and ready. Seeded product **Optical Tube Assembly** (`9SIQT8TOJO`), $3,599.00.

## Steps to reproduce (API)
```bash
source bugs/lib.sh
price 9SIQT8TOJO USD             # 1. normal price: units 3599
price 9SIQT8TOJO XXX             # 2. same product in an unknown currency: units 0
U=$(new_shopper)
add $U 9SIQT8TOJO 1
order $U "$VISA" XXX             # 3. order it: HTTP 200, item cost and shipping both 0
```

## Steps to reproduce (UI, as a normal shopper)
Do DEF-11's steps first so that `XXX` is in the dropdown (or, without that, run `price 9SIQT8TOJO XXX` once in a terminal).
1. Open `http://localhost:8080/product/9SIQT8TOJO`.
2. In the currency dropdown at the top right, choose **XXX**. The price changes to **XXX 0.00**.
3. Click **Add To Cart**. The cart shows `Shipping XXX 0.00` and `Total XXX 0.00`.
4. Click **Place Order**. The page shows **"Your order is complete!"**, with the item, shipping and total all at `XXX 0.00`.

Alternative for step 2: in the browser console, `localStorage.session` holds `{"userId": ..., "currencyCode": "USD"}`. Change `currencyCode` to `"XXX"` and reload.

## Expected
An unknown currency is rejected (a 4xx at the API, and the code never offered in the UI), and prices are never 0 because of a failed lookup.

## Actual
- Step 2: `{'currencyCode': 'XXX', 'units': 0, 'nanos': 0}` for every product (the whole catalogue lists as XXX 0).
- Step 3: **HTTP 200**, an order ID is returned, `items[0].cost` and `shippingCost` are `0` in `XXX`. The payment service logs `Transaction complete.` for an `amount` of `{currencyCode: XXX}` (units and nanos absent, i.e. zero): the card is "charged" nothing.

## Impact
Anyone can obtain any product, **including shipping**, for free, with no authentication and no special tools. This is the most serious defect found. It turns a missing validation into a direct financial loss.

## Root cause (from the code)
`src/currency/src/server.cpp:235` reads the target rate with `currency_conversion[to_code]`. In C++, `operator[]` on an `unordered_map` **inserts a default value (0.0) when the key is missing** instead of failing, so the converted amount is `price × 0 = 0`. Neither `currency` (no error for an unknown code) nor `checkout` (accepts any `currencyCode`) rejects it. The same lookup for the source currency (line 231) would divide by zero. That path was not tested.

## Suggested fix
Use `.find()` (or `.at()`) and return a gRPC `INVALID_ARGUMENT` / `NOT_FOUND` for an unknown code; validate `currencyCode` at the frontend API as well; have `checkout` reject a zero total.

## Related
DEF-11 (the same lookup also adds the code to the supported list); DEF-01, 08, 09 (other currency-conversion defects).
