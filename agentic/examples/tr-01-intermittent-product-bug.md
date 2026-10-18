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

```

---

# Triage: cart.spec.ts > TC-CART-01 cart lifecycle (UI) > cart page shows the merged quantity without a reload

**product_bug** · confidence **high** · known defect **DEF-10**

The cart page showed quantity 1 while the server already held 3, and it stayed at 1 until a reload. That is the DEF-10 stale-quantity pattern, an intermittent product bug. It is not a flaky test.

## Evidence
- *log*: `GET /api/cart (same shopper) -> items: [{ productId: "L9ECAV7KIM", quantity: 3 }]   <- server holds 3`: Server state is correct, so the wrong value is only in the UI.
- *log*: `page shows 1 until reload`: The UI is stale and does not self-correct, which is a product rendering or state defect.
- *signal*: `status: flaky (passed on retry)`: The intermittent pass fits the DEF-10 'about 1 run in 3' profile. Rule 2 says not to call this flaky.
- *known_defect*: `DEF-10 (S2): Stale quantity on the cart page, about 1 run in 3 (**intermittent**)`: This matches the known defect exactly.

## Runner-up: flaky_test
The failure was not caused by test timing or shared state. The server held the correct value and the UI showed a stale one, and no containers were unhealthy. The retry pass is just the intermittent manifestation of the bug.

## Next action: file_bug (Storefront)
Link this occurrence to DEF-10 (stale cart quantity, server has 3 and UI shows 1 until reload). Do not quarantine or mask the test. Keep it as a regression signal for the stale cart UI state.

<sub>prompt v2.1 · 9.3s · shadow mode: no action was taken</sub>
