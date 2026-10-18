# DEF-10: The cart page sometimes shows a stale quantity, and changing it corrupts the cart

| | |
|---|---|
| **Severity** | S2 Serious |
| **Component** | `frontend` (React) |
| **Status** | Open. **Intermittent**: reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | **Automated suite** (a UI test failed on some runs and passed on others) |
| **Test case** | TC-CART-01 |
| **Regression test** | `automation/tests/ui/cart.spec.ts`: "cart page shows the merged quantity without a reload" (`test.fixme`, because an intermittent defect would make a known-defect test flap) |

## Summary
After adding the same product twice, the cart page **sometimes shows the first quantity** (1) while the server already holds the total (3). If the shopper then changes the quantity from that stale view, the cart ends at the wrong number.

## Reproduction rate
Measured with a script that did the steps below in a fresh browser each time:

| Batch | Runs | Stale view |
|---|---|---|
| Final measurement | 30 | **11 (37%)** |
| Earlier batches | 10 and 14 | 2 and 4 |

In every run the **server held the correct quantity (3)**. Only the page was wrong. A reload always showed the right value.

## Preconditions
Demo running and ready. A fresh browser profile (empty `localStorage`). The stack under normal background load (the `load-generator` running), as it is by default.

## Steps to reproduce (UI)
1. Open `http://localhost:8080/product/L9ECAV7KIM` (Lens Cleaning Kit).
2. Leave **Quantity** at 1, click **Add To Cart**. You land on `/cart`.
3. Go back to the same product page, set **Quantity** to **2**, click **Add To Cart**. You land on `/cart`.
4. Wait about 3 seconds **without reloading** and read the quantity on the cart line.
5. Repeat with a fresh browser until it shows the stale value (about 1 attempt in 3).

To see the consequence once you have the stale view: change the quantity on the line to **2**.

## Expected
The line shows quantity **3** (1 + 2) after the second add.

## Actual
In about a third of the runs the line shows **1**. Changing it to 2 sends a delta of +1 to the cart (the UI sends deltas, not absolute values), so the server cart becomes **4**, and the page then shows 4. (Observed once while testing the consequence.)

## Impact
The shopper sees one thing and pays for another. Combined with the delta-based update API, a stale screen turns a harmless-looking quantity change into a wrong order.

## Likely cause (not verified)
After each add, the cart provider invalidates its cached cart query (`src/frontend/providers/Cart.provider.tsx`, `onSuccess` → `invalidateQueries`), then the page navigates to `/cart` straight away. A response-ordering race between the refetch started by the first add and the one for the second add is a plausible reason for an older response to win. This was **not** confirmed by tracing the requests, so treat it as a hypothesis for the frontend team.

## Suggested fix
Have the add mutation update the cached cart from its own response (the API already returns the new cart), instead of relying on a refetch; and have quantity changes send the absolute quantity, so a stale view cannot corrupt the cart.

## Notes for testers
The automated test for the first two steps reloads before asserting so that it stays reliable; see the comment in `automation/tests/ui/cart.spec.ts`. This was not a flaky test: comparing the server's cart with the page showed the server was right every time.
