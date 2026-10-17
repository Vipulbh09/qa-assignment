# DEF-02: A declined payment shows the shopper no message

| | |
|---|---|
| **Severity** | S2 Serious |
| **Component** | `frontend` (React) |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual exploration |
| **Test case** | TC-PAY-02 |
| **Regression test** | `automation/tests/ui/payment.spec.ts`: "shopper sees a message when the card is declined" (`test.fail('DEF-02')`) |

## Summary
When payment is declined, the page **does nothing visible**: no message, no highlighted field, no change of page. The only trace is an uncaught error in the browser console.

## Preconditions
Demo running and ready. Any month except January of the current year (the steps pick January, which must be in the past: true from February onwards).

## Steps to reproduce (UI)
1. Open `http://localhost:8080/product/0PUK6V6EV0` and click **Add To Cart**. You land on `/cart`.
2. Open the browser developer console.
3. In the checkout form, set **Year** to the current year (2026) and **Month** to **January**. Leave the rest as pre-filled (Visa `4432-8015-6152-0454`).
4. Click **Place Order**.

## Steps to reproduce (API, to see what the frontend receives)
```bash
source bugs/lib.sh
U=$(new_shopper); add $U 0PUK6V6EV0 1
order $U '{"creditCardNumber":"4432-8015-6152-0454","creditCardCvv":672,"creditCardExpirationYear":2026,"creditCardExpirationMonth":1}'
```
The API answers correctly: HTTP **422** with `{"error":"Your payment could not be processed. Please check your card details and try again.","code":"PAYMENT_FAILED"}`. The message exists; the page never shows it.

## Expected
A visible message that the payment failed and what to do (for example, the text the API already returns), the entered data kept, and the button usable again.

## Actual
- The page stays on `/cart`. Nothing on it mentions an error (checked: no text matching "could not be processed", "declined", "expired" or "try again").
- The browser console shows an uncaught error: `Your payment could not be processed. Please check your card details and try again.`
- Evidence: [`test-cases/evidence/decline-no-feedback.png`](../test-cases/evidence/decline-no-feedback.png).

## Impact
The shopper cannot tell whether the order went through, failed, or is still loading. Expect repeated clicks (each one calls payment again), abandoned carts and support contacts, on the most valuable step of the journey.

## Root cause (from the code)
`onPlaceOrder` (`src/frontend/components/Cart/CartDetail.tsx:25`) awaits `placeOrder(...)` with no `try/catch`, and the cart provider's mutation only handles success (`src/frontend/providers/Cart.provider.tsx`, `onSuccess`; there is no `onError`). The rejected promise from the 422 response is therefore never turned into UI state.

## Suggested fix
Catch the rejection in `onPlaceOrder` (or add `onError` to the mutation), show the API's message in an accessible alert (announced to screen readers), and keep the form data.

## Related
DEF-04: the form lets a shopper choose a past month, which is one way to hit this.
