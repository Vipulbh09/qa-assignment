# DEF-06: Payment does not validate the CVV or the expiry-month range

| | |
|---|---|
| **Severity** | S2 Serious |
| **Component** | `payment` (Node.js) |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual probing |
| **Test case** | TC-PAY-01 |
| **Regression tests** | `automation/tests/api/payment.spec.ts`: "CVV 0 is rejected" and "expiry month 13 is rejected" (both `knownDefect('DEF-06')`) |

## Summary
An order with **CVV `0`** or **expiry month `13`** is accepted and completed (HTTP 200). The service checks the card number, the card type and whether the date is in the past, but not that the CVV is real or that the month exists.

## Preconditions
Demo running and ready. The UI limits the form (CVV pattern `\d{3}`, month dropdown 1 to 12), so use the API.

## Steps to reproduce (API)
```bash
source bugs/lib.sh
U=$(new_shopper); add $U 0PUK6V6EV0 1
order $U '{"creditCardNumber":"4432-8015-6152-0454","creditCardCvv":0,"creditCardExpirationYear":2030,"creditCardExpirationMonth":1}'
V=$(new_shopper); add $V 0PUK6V6EV0 1
order $V '{"creditCardNumber":"4432-8015-6152-0454","creditCardCvv":672,"creditCardExpirationYear":2030,"creditCardExpirationMonth":13}'
```

## Expected
Both orders are refused with HTTP 422 and `PAYMENT_FAILED`.

## Actual
Both return **HTTP 200** and an order ID.

## Impact
Weaker card checks than the form implies: this service is the shop's own gate, and malformed data gets past it. Month `13` is accepted because the expiry comparison treats it as the following January.

## Root cause (from the code)
`src/payment/charge.js` reads `creditCardCvv` (line 54) but never uses it for validation, and the expiry check (line 86) only compares `currentYear * 12 + currentMonth` with `year * 12 + month`, so out-of-range months pass. Month `0` and negative values were not tested.

## Suggested fix
Validate CVV length and digits (3 or 4, by card type), month 1 to 12 and a sensible year range, and return the same `PAYMENT_FAILED` error as other declines.
