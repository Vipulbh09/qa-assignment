# Eval results

Prompt **v2.1** · model **sonnet** · 30 cases × 1 run(s) · 2026-10-18

> With 30 cases these numbers are directional, not statistically strong. Read the per-case table, not just the percentages. Cases marked *constructed* were written in Playwright's real error format but not captured from a live break.

Decided by rule (no model call): 2/30, 2 correct (env-01-504-wall, env-04-paused-catalog-504).

Next action 27/30 · owner pod 24/30 · both 23/30 · false defect matches 1 · escalation decision right 18/30 (missed 0, needless 12). These are reported, not part of the success bar.

**Accuracy: 29/30 (97%)** · known-defect match 12/13 · cost 0.66 USD-equivalent · 286s model time

Cases written before the v2 prompt (tuned on): 14/14 · added after v2 was frozen (not tuned on): 15/16, of which real captures 9/10

## Success bar
- PASS: at least 26/30 correct
- PASS: every high-confidence answer is correct
- PASS: no S1 product bug labelled flaky

## Per case
| Case | Expected | Got | Confidence | Defect | Human? | OK | Source | By |
|---|---|---|---|---|---|---|---|---|
| env-01-504-wall | environment_issue | environment_issue | high | - | no | yes | constructed | rule |
| env-02-stack-down | environment_issue | environment_issue | medium | - | no | yes | constructed | model |
| env-03-service-unavailable | environment_issue | environment_issue | high | - | no | yes | constructed | model |
| env-04-paused-catalog-504 | environment_issue | environment_issue | high | - | no | yes | real | rule |
| env-05-currency-down-500 | environment_issue | environment_issue | medium | - | yes | yes | real | model |
| fl-01-flag-propagation | flaky_test | flaky_test | medium | - | yes | yes | constructed | model |
| fl-02-ui-timeout | flaky_test | flaky_test | low | - | yes | yes | constructed | model |
| fl-03-shared-flag-race | flaky_test | flaky_test | medium | - | yes | yes | constructed | model |
| mx-01-fixed-marker-masks-outage | environment_issue | test_gap | medium | DEF-05 | yes | **NO** | real | model |
| mx-02-wall-but-own-price-mismatch | product_bug | product_bug | medium | DEF-01 | yes | yes | constructed | model |
| mx-03-flaky-in-money-flow | flaky_test | flaky_test | low | - | yes | yes | constructed | model |
| mx-04-unhealthy-noise-but-renamed-hook | test_gap | test_gap | medium | - | no | yes | constructed | model |
| pb-01-price-shift | product_bug | product_bug | high | DEF-01 | yes | yes | real | model |
| pb-02-free-goods | product_bug | product_bug | medium | DEF-05 | yes | yes | real | model |
| pb-03-cart-poisoned | product_bug | product_bug | high | DEF-07 | no | yes | real | model |
| pb-04-no-decline-message | product_bug | product_bug | medium | DEF-02 | yes | yes | real | model |
| pb-05-negative-quantity | product_bug | product_bug | medium | DEF-03 | no | yes | real | model |
| pb-06-cvv-not-validated | product_bug | product_bug | high | DEF-06 | yes | yes | real | model |
| pb-07-past-expiry-months | product_bug | product_bug | medium | DEF-04 | no | yes | real | model |
| pb-08-nano-drift | product_bug | product_bug | medium | - (want DEF-08) | yes | yes | real | model |
| pb-09-fractional-yen | product_bug | product_bug | high | DEF-09 | yes | yes | real | model |
| pb-10-currency-list-polluted | product_bug | product_bug | high | DEF-11 | no | yes | real | model |
| pb-11-novel-total-omits-shipping | product_bug | product_bug | high | - | yes | yes | constructed | model |
| pb-12-novel-recommendations-crash | product_bug | product_bug | high | - | no | yes | constructed | model |
| pb-13-slow-checkout-504 | product_bug | product_bug | high | - | yes | yes | constructed | model |
| tg-01-renamed-hook | test_gap | test_gap | high | - | no | yes | constructed | model |
| tg-02-stale-rate | test_gap | test_gap | medium | - | yes | yes | constructed | model |
| tg-03-hardcoded-price | test_gap | test_gap | medium | - | yes | yes | constructed | model |
| tr-01-intermittent-product-bug | product_bug | product_bug | high | DEF-10 | no | yes | constructed | model |
| tr-02-fixed-known-defect | test_gap | test_gap | high | DEF-01 | yes | yes | constructed | model |

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
| mx-01-fixed-marker-masks-outage | restart_env / fix_test **NO** | Quality Platform / Checkout & Payments **NO** | DEF-05 **FALSE** | no / yes (needless) |
| mx-02-wall-but-own-price-mismatch | file_bug / file_bug  | Catalogue & Pricing / Checkout & Payments **NO** | DEF-01 | yes / yes  |
| mx-03-flaky-in-money-flow | quarantine or fix_test / escalate_human **NO** | Storefront or Quality Platform / Checkout & Payments **NO** | - | yes / yes  |
| mx-04-unhealthy-noise-but-renamed-hook | fix_test / fix_test  | Storefront or Quality Platform / Storefront  | - | no / no  |
| pb-01-price-shift | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-01 | yes / yes  |
| pb-02-free-goods | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-05 | yes / yes  |
| pb-03-cart-poisoned | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | DEF-07 | no / no  |
| pb-04-no-decline-message | file_bug / file_bug  | Storefront / Checkout & Payments **NO** | DEF-02 | no / yes (needless) |
| pb-05-negative-quantity | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | DEF-03 | no / no  |
| pb-06-cvv-not-validated | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | DEF-06 | no / yes (needless) |
| pb-07-past-expiry-months | file_bug / file_bug  | Storefront / Storefront  | DEF-04 | no / no  |
| pb-08-nano-drift | file_bug / file_bug  | Catalogue & Pricing / Checkout & Payments **NO** | - | no / yes (needless) |
| pb-09-fractional-yen | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-09 | no / yes (needless) |
| pb-10-currency-list-polluted | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-11 | no / no  |
| pb-11-novel-total-omits-shipping | file_bug / file_bug  | Catalogue & Pricing / Checkout & Payments **NO** | - | yes / yes  |
| pb-12-novel-recommendations-crash | file_bug / file_bug  | Storefront / Storefront  | - | no / no  |
| pb-13-slow-checkout-504 | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | - | yes / yes  |
| tg-01-renamed-hook | fix_test / fix_test  | Storefront / Storefront  | - | no / no  |
| tg-02-stale-rate | fix_test / fix_test  | Catalogue & Pricing or Quality Platform / Catalogue & Pricing  | - | no / yes (needless) |
| tg-03-hardcoded-price | fix_test / fix_test  | Catalogue & Pricing or Checkout & Payments or Quality Platform / Checkout & Payments  | - | no / yes (needless) |
| tr-01-intermittent-product-bug | file_bug / file_bug  | Storefront / Storefront  | DEF-10 | no / no  |
| tr-02-fixed-known-defect | fix_test / fix_test  | Catalogue & Pricing or Quality Platform / Catalogue & Pricing  | DEF-01 | no / yes (needless) |

## Per class
| Class | Cases | Precision | Recall |
|---|---|---|---|
| product_bug | 15 | 100% | 100% |
| flaky_test | 4 | 100% | 100% |
| environment_issue | 6 | 100% | 83% |
| test_gap | 5 | 83% | 100% |

## Confusion matrix (rows = expected, columns = got)
| | product_bug | flaky_test | environment_issue | test_gap |
|---|---|---|---|---|
| product_bug | 15 | 0 | 0 | 0 |
| flaky_test | 0 | 4 | 0 | 0 |
| environment_issue | 0 | 0 | 5 | 1 |
| test_gap | 0 | 0 | 0 | 5 |

## Confidence calibration
| Confidence | Answers | Correct |
|---|---|---|
| high | 14 | 14 |
| medium | 14 | 13 |
| low | 2 | 2 |

False "flaky" on real product bugs: **0** (the costly error: it hides bugs).

## Misses
### mx-01-fixed-marker-masks-outage: expected environment_issue, got test_gap (medium)
The test is marked knownDefect DEF-05 but now passes, so the defect looks fixed and the marker is stale. The AdService diff is a comment-only change unrelated to currency or checkout. The 13 sibling failures are unexplained and may be separate, so the fix is not fully confirmed.
Runner-up it gave: product_bug. Guardrails: 1 evidence quote(s) are not in the input and were removed

