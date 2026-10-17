# DEF-09: Prices in JPY are shown with fractional yen

| | |
|---|---|
| **Severity** | S3 Minor |
| **Component** | `currency` (C++), `frontend` |
| **Status** | Open. Reproduced 2026-10-17 on demo commit `ac0443b` |
| **Detected by** | Manual probing |
| **Test case** | TC-CHK-03 |
| **Regression test** | `automation/tests/api/checkout.spec.ts`: "JPY prices have no fractional yen" (`test.fail('DEF-09')`) |

## Summary
The Japanese yen has no minor unit (there are no sen in circulation), but prices are converted and displayed with two decimals: The Comet Book costs **¥ 110.69**.

## Preconditions
Demo running and ready.

## Steps to reproduce (API)
```bash
source bugs/lib.sh
price HQTGWGPNH4 JPY             # The Comet Book ($0.99): units 110, nanos 690844758
```

## Steps to reproduce (UI)
1. Open `http://localhost:8080`.
2. Choose **JPY** in the currency dropdown.
3. Look at **The Comet Book**: the price reads `¥ 110.69`.

## Expected
A whole number of yen (¥111), as in any real shop; the charged amount is rounded to the currency's minor unit.

## Actual
`units: 110, nanos: 690844758`, displayed as `¥ 110.69`. An order would carry the same fractional yen.

## Impact
Cosmetic for the shopper, but it signals that currencies are treated as "dollars with cents". A payment provider that accepts only whole yen would reject such an amount.

## Root cause (from the code)
The conversion applies the exchange rate and keeps nine decimal places for every currency (`src/currency/src/server.cpp`, `Convert`), and the frontend always formats with `toFixed(2)` (`src/frontend/components/ProductPrice/ProductPrice.tsx:26`). Nothing knows the number of minor units per currency (0 for JPY and KRW, 2 for most, 3 for some).

## Suggested fix
Keep a minor-unit table per currency, round to it in the currency service, and format using it in the frontend (`Intl.NumberFormat` does this).
