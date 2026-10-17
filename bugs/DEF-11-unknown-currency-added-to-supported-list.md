# DEF-11: Requesting an unknown currency adds it to the supported-currency list for everyone

| | |
|---|---|
| **Severity** | S2 Serious (amplifies DEF-05, which is S1) |
| **Component** | `currency` (C++), `frontend` |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual probing (found while writing the steps for DEF-05) |
| **Test case** | TC-CHK-03 |
| **Regression test** | `automation/tests/api/checkout.spec.ts`: "an unknown currency code is not added to the supported list" (`test.fail('DEF-11')`) |

## Summary
A single anonymous request that mentions a currency code the service does not know **permanently adds that code to the list of supported currencies**, for every shopper, until the currency service restarts. The storefront then offers the bogus currency in its dropdown, and choosing it prices everything at zero (DEF-05).

## Preconditions
Demo running and ready, `currency` container not restarted since startup (so the list is the original 33).

## Steps to reproduce (API)
```bash
source bugs/lib.sh
currencies                        # 1. note the count: 33, and ZZZ is not in the list
price 0PUK6V6EV0 ZZZ              # 2. any request that mentions an unknown code (it answers "0")
currencies                        # 3. the count is now 34 and ZZZ is listed
```
Step 3 can be run by a different client or browser, with no cookies: the change is global.

## Steps to reproduce (UI)
1. In a terminal, run step 2 above (this stands in for any shopper or script that sends an unknown code).
2. In a fresh browser, open `http://localhost:8080` and open the currency dropdown at the top right.
3. **ZZZ** is listed among the real currencies. Choosing it shows every price as `ZZZ 0.00`.

## Expected
The supported list is fixed by the service's own rate table (33 currencies). A lookup of an unknown code returns an error and changes nothing.

## Actual
| Step | Result |
|---|---|
| Before | 33 currencies, no `ZZZ` |
| Request with `currencyCode=ZZZ` | HTTP 200 |
| After | **34 currencies, `ZZZ` listed**, visible to every client |

Restarting the container clears it (`docker restart currency` returned the list to 33).

## Impact
- **State corruption by an unauthenticated request:** anyone can add junk entries to the dropdown shown to all customers, as many as they like.
- It makes DEF-05 reachable by an ordinary shopper through normal UI, not only through a crafted request.
- The list is rebuilt only on restart, so it can persist in production for as long as the service runs.

## Root cause (from the code)
The same lookup as DEF-05. `currency_conversion[code]` (`src/currency/src/server.cpp:231` and `:235`) **inserts the missing key into the rate table**. `GetSupportedCurrencies` then returns every key in that table (`server.cpp:167`), so the inserted code is listed as supported.

## Suggested fix
Same as DEF-05: do read-only lookups (`find`) and reject unknown codes. Make the rate table `const`, so a lookup can never modify it.

## Notes for testers
- This mutates shared state in the stack. The regression test uses a different random code each run, and CI uses a fresh stack each run. Locally, run `docker restart currency` to reset.
- Because of this defect, `XXX` may already be in the dropdown on a stack that has been used for testing DEF-05.
