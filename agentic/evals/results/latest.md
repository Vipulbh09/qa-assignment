# Eval results

Prompt **v2** · model **sonnet** · 14 cases × 1 run(s) · 2026-10-18

> With 14 cases these numbers are directional, not statistically strong. Read the per-case table, not just the percentages. Cases marked *constructed* were written in Playwright's real error format but not captured from a live break.

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
