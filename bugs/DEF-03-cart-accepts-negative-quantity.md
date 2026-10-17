# DEF-03: The cart accepts negative and zero quantities

| | |
|---|---|
| **Severity** | S2 Serious |
| **Component** | `cart` (.NET), reached through `frontend` `/api/cart` |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual exploration |
| **Test case** | TC-CART-02 |
| **Regression tests** | `automation/tests/api/cart.spec.ts`: "negative quantity on an empty cart" and "zero quantity is not stored as a line" (both `test.fail('DEF-03')`), plus "a cart with a negative line never reaches payment" (passes today, see below) |

## Summary
`POST /api/cart` stores whatever quantity it is given, including `-3` and `0`, and answers 200. The only reason a negative order does not get through is that an unrelated service happens to refuse it.

## Preconditions
Demo running and ready. The UI cannot send these values (its quantity picker offers 1 to 10), so use the API.

## Steps to reproduce (API)
```bash
source bugs/lib.sh
U=$(new_shopper)
add $U 0PUK6V6EV0 -3             # 1. HTTP 200 (should be rejected)
cart $U                          # 2. the cart now holds quantity -3
order $U                         # 3. HTTP 500 "Failed to place order."
V=$(new_shopper)
add $V 0PUK6V6EV0 0              # 4. quantity 0: HTTP 200
cart $V                          # 5. the cart holds a line with quantity 0
```

## Expected
Steps 1 and 4 are rejected with a 4xx and nothing is stored. A legitimate decrease (the UI sends `-1` to reduce a line from 2 to 1) must keep working, so the check belongs on the **resulting** quantity, not on the delta.

## Actual
- Step 1: **HTTP 200**. Step 2: `items: [{productId: 0PUK6V6EV0, quantity: -3}]`.
- Step 3: HTTP 500. The checkout log shows `shipping quote failure: failed POST to shipping service: expected 200, got 400`: the shipping service refuses the quote because its quantity is an unsigned integer, not because anything checked the cart.
- Steps 4 and 5: HTTP 200, and a line with `quantity: 0` is stored.

## Impact
Low today, high if one defence moves: a negative line that reached payment could produce a **reduced or negative total** (that was not tested, because shipping blocks it first). The checkout flow is protected only by a side effect in another service, and the 500 it produces is a generic failure, not a validation message.

## Root cause (from the code)
`CartService.AddItem` (`src/cart/src/services/CartService.cs:27`) passes the quantity straight to the store, and the store just adds it to the existing line (`src/cart/src/cartstore/ValkeyCartStore.cs:153-165`, `existingItem.Quantity += quantity`). Nothing checks sign, range, or that the result is positive. The shipping service's `u32` cast (`src/shipping/src/shipping_service.rs:22`) is what stops the order.

## Suggested fix
In `AddItem`, reject a request that would leave a line at 0 or below (remove the line instead when it reaches 0), and cap the maximum quantity. Add an explicit total check in `checkout` (total must be greater than 0).
