# Eval results

Prompt **v2** · model **sonnet** · 29 cases × 1 run(s) · 2026-10-18

> With 29 cases these numbers are directional, not statistically strong. Read the per-case table, not just the percentages. Cases marked *constructed* were written in Playwright's real error format but not captured from a live break.

Next action 25/29 · owner pod 22/29 · both 21/29 · false defect matches 1 · escalation decision right 17/29 (missed 0, needless 12). These are reported, not part of the success bar.

**Accuracy: 26/29 (90%)** · known-defect match 13/13 · cost 0.70 USD-equivalent · 294s model time

Cases written before the v2 prompt (tuned on): 14/14 · added after v2 was frozen (not tuned on): 12/15, of which real captures 8/10

## Success bar
- PASS: at least 25/29 correct
- PASS: every high-confidence answer is correct
- PASS: no S1 product bug labelled flaky

## Per case
| Case | Expected | Got | Confidence | Defect | Human? | OK | Source |
|---|---|---|---|---|---|---|---|
| env-01-504-wall | environment_issue | environment_issue | high | - | no | yes | constructed |
| env-02-stack-down | environment_issue | environment_issue | medium | - | no | yes | constructed |
| env-03-service-unavailable | environment_issue | environment_issue | high | - | no | yes | constructed |
| env-04-paused-catalog-504 | environment_issue | environment_issue | medium | - | no | yes | real |
| env-05-currency-down-500 | environment_issue | environment_issue | medium | - | yes | yes | real |
| fl-01-flag-propagation | flaky_test | flaky_test | medium | - | yes | yes | constructed |
| fl-02-ui-timeout | flaky_test | flaky_test | low | - | yes | yes | constructed |
| fl-03-shared-flag-race | flaky_test | flaky_test | medium | - | yes | yes | constructed |
| mx-01-stale-annotation-masks-outage | environment_issue | test_gap | medium | DEF-05 | yes | **NO** | real |
| mx-02-wall-but-own-price-mismatch | product_bug | environment_issue | medium | DEF-01 | yes | **NO** | constructed |
| mx-03-flaky-in-money-flow | flaky_test | flaky_test | low | - | yes | yes | constructed |
| mx-04-unhealthy-noise-but-renamed-hook | test_gap | test_gap | medium | - | no | yes | constructed |
| pb-01-price-shift | product_bug | product_bug | high | DEF-01 | yes | yes | real |
| pb-02-free-goods | product_bug | product_bug | medium | DEF-05 | yes | yes | real |
| pb-03-cart-poisoned | product_bug | product_bug | high | DEF-07 | no | yes | real |
| pb-04-no-decline-message | product_bug | product_bug | medium | DEF-02 | yes | yes | real |
| pb-05-negative-quantity | product_bug | product_bug | medium | DEF-03 | no | yes | real |
| pb-06-cvv-not-validated | product_bug | product_bug | medium | DEF-06 | yes | yes | real |
| pb-07-past-expiry-months | product_bug | product_bug | medium | DEF-04 | no | yes | real |
| pb-08-nano-drift | product_bug | product_bug | medium | DEF-08 | yes | yes | real |
| pb-09-fractional-yen | product_bug | test_gap | low | DEF-09 | yes | **NO** | real |
| pb-10-currency-list-polluted | product_bug | product_bug | medium | DEF-11 | no | yes | real |
| pb-11-novel-total-omits-shipping | product_bug | product_bug | high | - | yes | yes | constructed |
| pb-12-novel-recommendations-crash | product_bug | product_bug | high | - | no | yes | constructed |
| tg-01-renamed-hook | test_gap | test_gap | medium | - | no | yes | constructed |
| tg-02-stale-rate | test_gap | test_gap | medium | - | yes | yes | constructed |
| tg-03-hardcoded-price | test_gap | test_gap | medium | - | yes | yes | constructed |
| tr-01-intermittent-product-bug | product_bug | product_bug | high | DEF-10 | no | yes | constructed |
| tr-02-stale-test-fail | test_gap | test_gap | high | DEF-01 | yes | yes | real |

## Action, owner and escalation
| Case | Action (want / got) | Owner (want / got) | Defect named | Escalated (want / got) |
|---|---|---|---|---|
| env-01-504-wall | restart_env / restart_env  | Quality Platform / Quality Platform  | - | no / no  |
| env-02-stack-down | restart_env / restart_env  | Quality Platform / Quality Platform  | - | no / no  |
| env-03-service-unavailable | restart_env / restart_env  | Quality Platform / Quality Platform  | - | no / no  |
| env-04-paused-catalog-504 | restart_env / restart_env  | Quality Platform / Quality Platform  | - | no / no  |
| env-05-currency-down-500 | restart_env / restart_env  | Quality Platform / Quality Platform  | - | no / yes (needless) |
| fl-01-flag-propagation | fix_test or quarantine / fix_test  | Quality Platform / Quality Platform  | - | no / yes (needless) |
| fl-02-ui-timeout | quarantine or fix_test / rerun **NO** | Checkout & Payments or Quality Platform / Quality Platform  | - | no / yes (needless) |
| fl-03-shared-flag-race | fix_test or quarantine / fix_test  | Quality Platform / Quality Platform  | - | no / yes (needless) |
| mx-01-stale-annotation-masks-outage | restart_env / fix_test **NO** | Quality Platform / Catalogue & Pricing **NO** | DEF-05 **FALSE** | no / yes (needless) |
| mx-02-wall-but-own-price-mismatch | file_bug / restart_env **NO** | Catalogue & Pricing / Quality Platform **NO** | DEF-01 | yes / yes  |
| mx-03-flaky-in-money-flow | quarantine or fix_test / fix_test  | Storefront or Quality Platform / Quality Platform  | - | yes / yes  |
| mx-04-unhealthy-noise-but-renamed-hook | fix_test / fix_test  | Storefront or Quality Platform / Storefront  | - | no / no  |
| pb-01-price-shift | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-01 | yes / yes  |
| pb-02-free-goods | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-05 | yes / yes  |
| pb-03-cart-poisoned | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | DEF-07 | no / no  |
| pb-04-no-decline-message | file_bug / file_bug  | Storefront / Checkout & Payments **NO** | DEF-02 | no / yes (needless) |
| pb-05-negative-quantity | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | DEF-03 | no / no  |
| pb-06-cvv-not-validated | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | DEF-06 | no / yes (needless) |
| pb-07-past-expiry-months | file_bug / file_bug  | Storefront / Checkout & Payments **NO** | DEF-04 | no / no  |
| pb-08-nano-drift | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-08 | no / yes (needless) |
| pb-09-fractional-yen | file_bug / escalate_human **NO** | Catalogue & Pricing / Quality Platform **NO** | DEF-09 | no / yes (needless) |
| pb-10-currency-list-polluted | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-11 | no / no  |
| pb-11-novel-total-omits-shipping | file_bug / file_bug  | Catalogue & Pricing / Checkout & Payments **NO** | - | yes / yes  |
| pb-12-novel-recommendations-crash | file_bug / file_bug  | Storefront / Storefront  | - | no / no  |
| tg-01-renamed-hook | fix_test / fix_test  | Storefront / Storefront  | - | no / no  |
| tg-02-stale-rate | fix_test / fix_test  | Catalogue & Pricing or Quality Platform / Catalogue & Pricing  | - | no / yes (needless) |
| tg-03-hardcoded-price | fix_test / fix_test  | Catalogue & Pricing or Checkout & Payments or Quality Platform / Checkout & Payments  | - | no / yes (needless) |
| tr-01-intermittent-product-bug | file_bug / file_bug  | Storefront / Checkout & Payments **NO** | DEF-10 | no / no  |
| tr-02-stale-test-fail | fix_test / fix_test  | Catalogue & Pricing or Quality Platform / Catalogue & Pricing  | DEF-01 | no / yes (needless) |

## Per class
| Class | Cases | Precision | Recall |
|---|---|---|---|
| product_bug | 14 | 100% | 86% |
| flaky_test | 4 | 100% | 100% |
| environment_issue | 6 | 83% | 83% |
| test_gap | 5 | 71% | 100% |

## Confusion matrix (rows = expected, columns = got)
| | product_bug | flaky_test | environment_issue | test_gap |
|---|---|---|---|---|
| product_bug | 12 | 0 | 1 | 1 |
| flaky_test | 0 | 4 | 0 | 0 |
| environment_issue | 0 | 0 | 5 | 1 |
| test_gap | 0 | 0 | 0 | 5 |

## Confidence calibration
| Confidence | Answers | Correct |
|---|---|---|
| high | 8 | 8 |
| medium | 18 | 16 |
| low | 3 | 2 |

False "flaky" on real product bugs: **0** (the costly error: it hides bugs).

## Misses
### mx-01-stale-annotation-masks-outage: expected environment_issue, got test_gap (medium)
The test is annotated test.fail for DEF-05 but passed, so Playwright reports "Expected to fail, but passed". The defect looks fixed and the annotation is stale. The only diff is a comment in AdService, which is unrelated to currency or checkout.
Runner-up it gave: product_bug. Guardrails: none

### mx-02-wall-but-own-price-mismatch: expected product_bug, got environment_issue (medium)
Five checkout-related tests fail in the same run while the checkout container is unhealthy, so the run can't be trusted. The 57.08 vs 57.8 value matches DEF-01, but it fails identically on both attempts and no product code changed, so DEF-01 is a real alternative.
Runner-up it gave: product_bug. Guardrails: 1 evidence quote(s) are not in the input and were removed

### pb-09-fractional-yen: expected product_bug, got test_gap (low)
The JPY fractional-yen check received 563467492 instead of 0, and the error message is "Solar System Color Imager", which looks like a product name and not an assertion message. This likely relates to DEF-09 (JPY fractional yen), but the log is thin, and the AdService diff only adds a comment and is unrelated to the flow. A human needs to confirm whether the assertion is wrong or DEF-09 is reproducing.
Runner-up it gave: product_bug. Guardrails: 1 evidence quote(s) are not in the input and were removed

