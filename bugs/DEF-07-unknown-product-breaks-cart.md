# DEF-07: Adding an unknown product breaks the shopper's cart

| | |
|---|---|
| **Severity** | S2 Serious |
| **Component** | `cart` (.NET), `frontend` `/api/cart` |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual probing |
| **Test case** | TC-CART-02 |
| **Regression test** | `automation/tests/api/cart.spec.ts`: "unknown product ID is rejected and does not break the cart" (`knownDefect('DEF-07')`) |

## Summary
A product ID that does not exist is accepted into the cart (HTTP 200). After that, **every read of that shopper's cart returns HTTP 500**. The storefront then shows an **empty cart with no error**, even if the shopper adds real products, so they cannot check out.

## Preconditions
Demo running and ready.

## Steps to reproduce (API)
```bash
source bugs/lib.sh
U=$(new_shopper)
add $U NOT-A-PRODUCT 1           # 1. HTTP 200 (should be rejected)
cart $U                          # 2. "Internal Server Error [HTTP 500]"
```
Recovery: `curl -X DELETE $BASE/api/cart -H 'content-type: application/json' -d "{\"userId\":\"$U\"}"` returns 204, and `cart $U` works again.

## Steps to reproduce (UI)
In the browser console on the storefront, run
`fetch('/api/cart', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({userId: JSON.parse(localStorage.session).userId, item: {productId:'NOT-A-PRODUCT', quantity:1}})})`
then open `/cart`: it says **"Your shopping cart is empty!"**. Now go to any product and click **Add To Cart**: you land on `/cart` again and it **still says empty**, with no **Place Order** button.

## Expected
Step 1 is rejected with a 4xx and the cart is unchanged.

## Actual
- API: step 1 returns 200 and the item is stored. Step 2 returns **500**. The frontend log shows `5 NOT_FOUND: Product Not Found: NOT-A-PRODUCT`.
- UI (checked in a browser): `/cart` reads "Your shopping cart is empty!" after the poisoning, and still reads that after adding a real product (`GET /api/cart` for that shopper is 500 the whole time). The Place Order button never appears.

## Impact
A single bad request leaves a shopper **unable to check out, with no error to explain why**: the cart looks empty and stays empty. The only ways out are the API's `DELETE` or clearing the browser's stored session, neither of which a shopper would think of. A catalogue item that is removed later would do the same to every cart that still holds it (this was not tested).

## Root cause (from the code)
`AddItem` in the cart service stores any product ID without checking the catalogue (`src/cart/src/services/CartService.cs:27`). Reading the cart then looks up every item in the product catalogue (`src/frontend/pages/api/cart.ts`, the `GET` branch), and one `NOT_FOUND` rejects the whole `Promise.all`, which becomes the 500. The cart provider (`src/frontend/providers/Cart.provider.tsx`) then falls back to its default empty cart, which is why the UI shows "empty" instead of an error.

## Suggested fix
Validate the product ID on add; and make the cart read tolerate or drop items whose product is gone, instead of failing the whole cart.
