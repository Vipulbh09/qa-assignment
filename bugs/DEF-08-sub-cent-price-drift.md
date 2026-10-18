# DEF-08: Converted prices drift below a cent

| | |
|---|---|
| **Severity** | S3 Minor |
| **Component** | `currency` (C++), used by `checkout` |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | **Automated suite** (the exact-nanos comparison failed first) |
| **Test case** | TC-CHK-02 |
| **Regression test** | `automation/tests/api/checkout.spec.ts`: "order cost is exact to the nano (no float round-trip)" (`knownDefect('DEF-08')`) |

## Summary
The price on an order differs from the catalogue price by one nano (a billionth of a unit): $209.95 becomes `209.949999999`. It is invisible when rounded to cents, but it is exact-value corruption in money handling.

## Preconditions
Demo running and ready. Seeded product **Roof Binoculars** (`2ZYFJ3GM2N`), $209.95.

## Steps to reproduce (API)
```bash
source bugs/lib.sh
price 2ZYFJ3GM2N                 # 1. units 209, nanos 950000000
U=$(new_shopper); add $U 2ZYFJ3GM2N 1
order $U                         # 2. look at items[0].cost
```

## Expected
`units: 209, nanos: 950000000` (identical to the catalogue).

## Actual
`units: 209, nanos: 949999999`.

## Impact
Rounds to the right cents today, so customers will not notice. It still means every converted amount passes through floating point and is truncated on the way back, so exact comparisons (for example a reconciliation against an exact ledger) would show differences.

## Root cause (from the code)
`Convert` turns the amount into a `double`, multiplies and divides by exchange rates, then `getUnitsAndNanos()` (`src/currency/src/server.cpp:195`) splits it back with `long nano = rem * pow(10, 9)`, which **truncates** the floating-point remainder (0.9499999999999886 × 1e9 becomes 949999999) instead of rounding it.

## Suggested fix
Do the conversion in integer arithmetic (or a decimal type), and round to the currency's minor unit.

## Related
DEF-01 (same function, large error), DEF-09 (currencies without cents).
