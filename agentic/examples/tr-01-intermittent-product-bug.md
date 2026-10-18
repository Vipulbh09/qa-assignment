## Input
**Test:** cart.spec.ts > TC-CART-01 cart lifecycle (UI) > cart page shows the merged quantity without a reload

**Log**
```
Attempt 1 (failed):
Error: expect(locator).toHaveValue(expected) failed

Locator: getByTestId('cart-item-quantity')
Expected: "3"
Received: "1"

Diagnostic captured by the test on failure:
  GET /api/cart (same shopper) -> items: [{ productId: "L9ECAV7KIM", quantity: 3 }]   <- server holds 3
  page shows 1 until reload

Attempt 2 (passed). Same code, no environment problems, all containers healthy.
```

**Diff**
```diff
(empty)
```

---

# Triage: cart.spec.ts > TC-CART-01 cart lifecycle (UI) > cart page shows the merged quantity without a reload

**product_bug** · confidence **high** · known defect **DEF-10**

The cart page showed quantity 1 while GET /api/cart returned 3, so the server state was correct and the UI was stale until a reload. This is the intermittent DEF-10 stale-quantity bug. It passed on retry only because the bug shows up about 1 run in 3.

## Evidence
- *log*: `GET /api/cart (same shopper) -> items: [{ productId: "L9ECAV7KIM", quantity: 3 }]   <- server holds 3`: The server state is correct, so the wrong value is in the UI layer.
- *log*: `page shows 1 until reload`: The UI displays a stale quantity, which is the DEF-10 symptom.
- *signal*: `status: flaky (passed on retry)`: The failure is intermittent, which matches DEF-10 (about 1 run in 3). Rule 2 says not to call this flaky.
- *log*: `Attempt 2 (passed). Same code, no environment problems, all containers healthy.`: This rules out an environment cause. The test and the code were the same on both attempts.
- *known_defect*: `DEF-10 (S2): Stale quantity on the cart page, about 1 run in 3 (**intermittent**)`: The known defect matches the symptom and the intermittent rate.

## Runner-up: flaky_test
The test assertion is correct. The server holds 3 and the UI shows 1, which is a product defect and not a timing problem in the test. Rule 2 says not to call an intermittent product bug flaky.

## Next action: file_bug (Checkout & Payments)
Link this occurrence to DEF-10: the cart page shows quantity 1 while /api/cart returns 3 until reload. Add the run artifacts to the existing defect. Keep the test unquarantined so it keeps catching the bug.

<sub>prompt v2 · 12.4s · shadow mode: no action was taken</sub>
