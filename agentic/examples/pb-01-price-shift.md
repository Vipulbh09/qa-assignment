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

TC-CHK-02 charged 57.8 instead of the displayed 57.08, which is the DEF-01 symptom. The diff rewrites getDouble in the currency service's nanos-to-fraction handling, which is on the pricing flow.

## Evidence
- *log*: `Expected: 57.08 Received: 57.8`: The charged cost drops the leading zero of the cents, matching the DEF-01 symptom of $57.08 shown and $57.80 costed.
- *diff*: `diff --git a/src/currency/src/server.cpp b/src/currency/src/server.cpp`: Product source in the currency service changed on the money conversion path used by checkout.
- *diff*: `for (char c : std::to_string(m.nanos())) { frac += (c - '0') * scale; scale /= 10; }`: to_string(nanos) does not zero-pad to 9 digits. For nanos=80000000 the string is '80000000', which is read as 0.8 instead of 0.08, so cents lose their leading zero.

## Runner-up: test_gap
The test's expected value of 57.08 is the correct catalogue price. No test code changed and the log shows no locator problem. This is not a stale knownDefect marker that now passes, because the test still fails on the wrong charged amount.

## Next action: file_bug (Catalogue & Pricing)
S1 money bug. Link it to DEF-01 and block or revert the currency/src/server.cpp getDouble change. Zero-pad nanos to 9 digits, or restore the original std::stod conversion with correct padding. Then re-run TC-CHK-02 and the other price tests.

## Guardrails applied
- 1 evidence quote(s) are not in the input and were removed

<sub>prompt v2.1 · 8.9s · shadow mode: no action was taken</sub>
