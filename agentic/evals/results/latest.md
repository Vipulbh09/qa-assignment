# Eval results

Prompt **v2** · model **sonnet** · 14 cases × 1 run(s) · 2026-10-18

> With 14 cases these numbers are directional, not statistically strong. Read the per-case table, not just the percentages. Cases marked *constructed* were written in Playwright's real error format but not captured from a live break.

Next action 13/14 · owner pod 13/14 · both 12/14 · false defect matches 0 · escalation decision right 8/14 (missed 0, needless 6). These are reported, not part of the success bar.

**Accuracy: 14/14 (100%)** · known-defect match 5/5 · cost 0.36 USD-equivalent · 152s model time

## Success bar
- PASS: at least 12/14 correct
- PASS: every high-confidence answer is correct
- PASS: no S1 product bug labelled flaky

## Per case
| Case | Expected | Got | Confidence | Defect | Human? | OK | Source |
|---|---|---|---|---|---|---|---|
| env-01-504-wall | environment_issue | environment_issue | high | - | no | yes | constructed |
| env-02-stack-down | environment_issue | environment_issue | medium | - | no | yes | constructed |
| env-03-service-unavailable | environment_issue | environment_issue | high | - | no | yes | constructed |
| fl-01-flag-propagation | flaky_test | flaky_test | medium | - | yes | yes | constructed |
| fl-02-ui-timeout | flaky_test | flaky_test | low | - | yes | yes | constructed |
| fl-03-shared-flag-race | flaky_test | flaky_test | medium | - | yes | yes | constructed |
| pb-01-price-shift | product_bug | product_bug | high | DEF-01 | yes | yes | real |
| pb-02-free-goods | product_bug | product_bug | medium | DEF-05 | yes | yes | real |
| pb-03-cart-poisoned | product_bug | product_bug | high | DEF-07 | no | yes | real |
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
| fl-01-flag-propagation | fix_test or quarantine / fix_test  | Quality Platform / Quality Platform  | - | no / yes (needless) |
| fl-02-ui-timeout | quarantine or fix_test / rerun **NO** | Checkout & Payments or Quality Platform / Quality Platform  | - | no / yes (needless) |
| fl-03-shared-flag-race | fix_test or quarantine / fix_test  | Quality Platform / Quality Platform  | - | no / yes (needless) |
| pb-01-price-shift | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-01 | yes / yes  |
| pb-02-free-goods | file_bug / file_bug  | Catalogue & Pricing / Catalogue & Pricing  | DEF-05 | yes / yes  |
| pb-03-cart-poisoned | file_bug / file_bug  | Checkout & Payments / Checkout & Payments  | DEF-07 | no / no  |
| tg-01-renamed-hook | fix_test / fix_test  | Storefront / Storefront  | - | no / no  |
| tg-02-stale-rate | fix_test / fix_test  | Catalogue & Pricing or Quality Platform / Catalogue & Pricing  | - | no / yes (needless) |
| tg-03-hardcoded-price | fix_test / fix_test  | Catalogue & Pricing or Checkout & Payments or Quality Platform / Checkout & Payments  | - | no / yes (needless) |
| tr-01-intermittent-product-bug | file_bug / file_bug  | Storefront / Checkout & Payments **NO** | DEF-10 | no / no  |
| tr-02-stale-test-fail | fix_test / fix_test  | Catalogue & Pricing or Quality Platform / Catalogue & Pricing  | DEF-01 | no / yes (needless) |

## Per class
| Class | Cases | Precision | Recall |
|---|---|---|---|
| product_bug | 4 | 100% | 100% |
| flaky_test | 3 | 100% | 100% |
| environment_issue | 3 | 100% | 100% |
| test_gap | 4 | 100% | 100% |

## Confusion matrix (rows = expected, columns = got)
| | product_bug | flaky_test | environment_issue | test_gap |
|---|---|---|---|---|
| product_bug | 4 | 0 | 0 | 0 |
| flaky_test | 0 | 3 | 0 | 0 |
| environment_issue | 0 | 0 | 3 | 0 |
| test_gap | 0 | 0 | 0 | 4 |

## Confidence calibration
| Confidence | Answers | Correct |
|---|---|---|
| high | 6 | 6 |
| medium | 7 | 7 |
| low | 1 | 1 |

False "flaky" on real product bugs: **0** (the costly error: it hides bugs).

## Misses
None.
