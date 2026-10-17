# Flow 3: Cart state and quantity integrity

Cart service (.NET) stores carts in Valkey, keyed by `userId`. The `userId` is a UUID generated **in the browser** and kept in `localStorage` (`src/frontend/gateways/Session.gateway.ts`). Quantity changes in the UI are sent as **deltas** through `AddItem` (`src/frontend/providers/Cart.provider.tsx`).

---

## TC-CART-01: Add, update, persist and empty

| Field | Value |
|---|---|
| Priority | P1 |
| Automation status | Automated (`api/cart`, `ui/cart`; DEF-10 kept as `fixme`) |
| Preconditions | Baseline (empty `localStorage`: the cart is tied to the `session` key there). |

| # | Step | Expected result |
|---|---|---|
| 1 | Add **Lens Cleaning Kit** ×1 | Cart badge 1 |
| 2 | Add the same product ×2 again | One line, qty **3** (merged, not duplicated) |
| 3 | Change quantity to 1 in the cart | One line, qty 1; total updates |
| 4 | Reload the page | Cart unchanged |
| 5 | Open a new tab | Same cart (same `localStorage` session) |
| 6 | Click **Empty Cart** | Cart empty; badge 0 |

**Edge cases:**
- Add a product ID that doesn't exist via API: should be 4xx, not stored. **Actual: FAIL (DEF-07).** 200, then the shopper's cart returns 500 on every read.
- Add twice from the product page, then look at the cart **without reloading**. **Actual: intermittent FAIL (DEF-10).** 11 of 30 runs show the old quantity; changing it then corrupts the cart (shopper picks 2, gets 4).
- Very large quantity (e.g. 1 000 000): shipping is 8.99 × qty, so check that totals don't overflow.

**Quality risk to flag before ship:** delta-based updates mean concurrent tabs can drift; there's no "set quantity" operation.

---

## TC-CART-02: Cart rejects invalid quantities

| Field | Value |
|---|---|
| Priority | P2 |
| Automation status | Automated (API) |
| Preconditions | Baseline. An API client (curl or Playwright): the UI can't send a negative or zero quantity. |
| Status at `ac0443b` | **FAIL (DEF-03)** |

| # | Step | Expected result |
|---|---|---|
| 1 | `POST /api/cart` with `quantity: -3` on an empty cart | 4xx; nothing stored |
| 2 | `POST /api/cart` with `quantity: 0` | 4xx or no-op. **Actual:** stored as a line with quantity 0 |
| 3 | Add product A ×2, then product B with `quantity: -1` | B rejected |
| 4 | Place an order with the cart from step 3 | Never reaches payment with a negative line |

**Actual:** step 1 returns **200** and the cart stores `quantity: -3`. Checkout then fails with a generic 500. It is blocked only because the shipping service rejects the quote (its item quantity is an unsigned `u32`), not because anything validates it.

**Edge cases:**
- Legitimate negative deltas from the UI (reducing quantity) must still work. Validation must be on the **resulting** quantity, not the delta.
- Non-integer quantity (`1.5`) and string quantity (`"2"`).

**Quality risk to flag before ship:** a negative line that reaches payment would be a refund-to-attacker. Today one unrelated service stands in the way.

---

## TC-CART-03: Session isolation and recovery

| Field | Value |
|---|---|
| Priority | P2 |
| Automation status | Partial: isolation is automatable; the privacy review of guessable IDs is a human judgement |
| Preconditions | Baseline. Two **isolated** browser contexts (separate profiles or incognito), not two tabs: tabs share `localStorage` and so share the cart. Docker access to stop `valkey-cart` (step 4). |

| # | Step | Expected result |
|---|---|---|
| 1 | In A, add 2 items; in B, add 1 different item | Each sees only its own cart |
| 2 | In B, set `localStorage.session` to A's session JSON and reload | Documents the trust model: B now sees A's cart, because the cart trusts any `userId` |
| 3 | Set `localStorage.session` to `not}{valid-json`, reload | New valid session; page works (covered upstream in `Home.cy.ts`) |
| 4 | Stop `valkey-cart`, try to add an item | Clear error; no crash; recovers when Valkey restarts |

**Edge cases:**
- `cartFailure` flag `on`: expected behaviour is documented as a failure demo; verify the UI degrades gracefully.
- Valkey recreated: `valkey-cart` has no volume or persistence settings in `compose.yaml`, so carts are expected to be lost. Confirm, and get product sign-off that this is acceptable.

**Quality risk to flag before ship:** carts are keyed by a client-supplied ID with no authentication. Fine for a demo, a privacy issue for a real shop.
