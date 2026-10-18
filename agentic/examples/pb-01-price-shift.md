## Input
**Test:** checkout.spec.ts > TC-CHK-02 displayed price equals charged price > Red Flashlight: order cost equals catalogue price

**Log**
```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 57.08
Received: 57.8

   at checkout.spec.ts:21:38
```

**Diff**
```diff
diff --git a/src/currency/src/server.cpp b/src/currency/src/server.cpp
--- a/src/currency/src/server.cpp
+++ b/src/currency/src/server.cpp
@@ -178,7 +178,9 @@ static double getDouble(const oteldemo::Money& m)
-  return m.units() + std::stod("0." + std::to_string(m.nanos()));
+  // read the nanos digit by digit to avoid a double conversion
+  double frac = 0; double scale = 0.1;
+  for (char c : std::to_string(m.nanos())) { frac += (c - '0') * scale; scale /= 10; }
+  return m.units() + frac;
 }
```

---

# Triage: checkout.spec.ts > TC-CHK-02 displayed price equals charged price > Red Flashlight: order cost equals catalogue price

**product_bug** · confidence **high** · known defect **DEF-01** · **needs a human**

The order cost came back as 57.8 instead of the catalogue price 57.08, which is the DEF-01 symptom. The diff changes how getDouble in the currency service reads nanos, and that code is on the failing price flow. Checkout money values are wrong, so this needs a human (S1).

## Evidence
- *log*: `Expected: 57.08 Received: 57.8`: The charged cost drops the leading zero of the cents (08 becomes 8). This is the DEF-01 signature, and the test assertion itself is correct.
- *diff*: `for (char c : std::to_string(m.nanos())) { frac += (c - '0') * scale; scale /= 10; }`: to_string(nanos) has no leading zeros, so 80000000 and 8000000 give the same fraction. A value like .08 is read as .8 in this product code on the currency flow.
- *known_defect*: `DEF-01 (S1): Order cost differs from the displayed price ($57.08 shown, $57.80 costed)`: This is the same price and the same symptom as the known defect.

## Runner-up: test_gap
The expected value of 57.08 is the correct catalogue price and the test has no locator or stale-annotation problem. The diff changes product source, not test code. The log shows a wrong money value.

## Next action: file_bug (Catalogue & Pricing)
Link this to DEF-01 as an S1 defect. The getDouble change in src/currency/src/server.cpp parses std::to_string(m.nanos()) digit by digit, which drops leading zeros of the 9-digit nanos field (for example 8000000 is read as .8). Revert the change, or zero-pad nanos to 9 digits, or compute units + nanos / 1e9. Add a regression test for prices with 1-9 cents.

## Guardrails applied
- 1 evidence quote(s) are not in the input and were removed

<sub>prompt v2 · 9.1s · shadow mode: no action was taken</sub>
