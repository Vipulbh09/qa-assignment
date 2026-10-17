# DEF-04: The expiry selector offers months that have already passed

| | |
|---|---|
| **Severity** | S3 Minor |
| **Component** | `frontend` (React) |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual exploration |
| **Test case** | TC-PAY-03 |
| **Regression test** | `automation/tests/ui/payment.spec.ts`: "past months of the current year cannot be selected" (`test.fail('DEF-04')`) |

## Summary
After choosing the current year, all 12 months can still be selected, so the shopper can pick a month that is already in the past. The card is then always declined (DEF-02), and with no message.

## Preconditions
Demo running and ready. Today's month must not be January (otherwise no month is in the past).

## Steps to reproduce (UI)
1. Open `http://localhost:8080/product/0PUK6V6EV0`, click **Add To Cart**.
2. In the checkout form, set **Year** to the current year (2026).
3. Open the **Month** dropdown.

## Expected
Months before the current month are disabled or hidden for the current year (or the form shows an inline error before submitting).

## Actual
All **12 months** are offered and none is disabled. The year list starts at the current year and offers 20 years. (Checked with the page's own `<option disabled>` attribute: none are disabled.)

## Impact
Minor on its own: the shopper can enter an invalid card date that the server will always refuse. It matters because the refusal is invisible (DEF-02) and the form gives no hint about the cause.

## Root cause (from the code)
The month options are 12 static `<option>` elements (`src/frontend/components/CheckoutForm/CheckoutForm.tsx:153`). Only the year list is generated from the current date (`CheckoutForm.tsx:11`); the months do not depend on the chosen year.

## Suggested fix
Disable the months earlier than the current month when the selected year is the current year, and change an already-selected past month when the year changes.

## Related
DEF-02 (no message on a decline), DEF-06 (the server does not range-check the month either).
