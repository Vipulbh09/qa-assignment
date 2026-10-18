# Reflection

## 1. Which quality risks would I escalate to engineering leadership, and why those?

I escalate what a single team can't fix alone, or what creates financial or legal exposure. Individual bugs go to the owning pod; **patterns** go to leadership.

1. **Money is handled as floating point across services.** This isn't one bug. DEF-01 (shown $57.08, charged $57.80), DEF-05 (unsupported currency means everything costs 0; a $3,599 item shipped for free), DEF-08 (sub-cent drift) and DEF-09 (fractional yen) all come from the same design choice in the currency service, and checkout calls it even for USD→USD. Fixing it touches currency, checkout, payment and frontend, so it needs a cross-pod decision ("money is integer minor units, everywhere") that only leadership can make stick.
2. **Checkout charges before it ships, with no compensation.** If shipping fails after payment, the customer is charged with no order and no refund path (`checkout/main.go`). This is an architecture gap (no saga or refund step), not a test gap. More testing can't make it safe.
3. **The riskiest services have the least testing.** Payment and currency have zero unit tests; most of the defects I found are in or around them. That's an investment and priority call, not a QA task.
4. **Card data can be written to traces.** The `emitRawPii` flag puts card number and CVV into telemetry. It must be provably off outside local environments: a compliance risk that leadership owns.

I would *not* escalate DEF-02 (no decline message), DEF-04 or DEF-10 individually. They're real, but one pod can fix each in a sprint.

## 2. With 4 QA engineers, how do I structure ownership across 20 services?

**By business domain, not by service.** Nobody can know 5 services deeply, but one person can own a customer journey end to end.

| QA | Owns | Why it's sized this way |
|---|---|---|
| 1 | **Checkout & Payments** (checkout, payment, cart, email) | Highest risk, so the most senior QA |
| 2 | **Catalogue & Pricing** (product-catalog, currency, quote, shipping) | Where most confirmed defects live |
| 3 | **Storefront** (frontend, proxy, ad, recommendation, images) | Largest UI surface, lowest money risk |
| 4 | **Quality Platform** (flagd, collector, load-generator, CI, shared helpers) | Keeps the other three fast: test infra, contracts, flaky triage |

Three rules make it work: developers own unit tests; each QA is the named **backup** for one other pod; and **cross-pod flows belong to the pod where the money moves** (checkout spans three pods, Checkout & Payments owns it).

## 3. What do I build in week 1 vs. month 3?

**Week 1: find out where we're blind, and stop the bleeding.**
- Risk map and exploratory testing of the money paths (that's how DEF-01 and DEF-05 were found).
- A smoke suite on every PR against a pinned, reproducible stack: done in this repo.
- Raise the S1s with evidence. Don't wait for a framework to be "ready".
- Agree severity definitions and a triage rota with each pod.

**Month 3: make quality a property of the pipeline, not of the QA team.**
- **Contract tests** on `demo.proto` in every service's PR, so cross-language breakage fails before merge.
- Unit tests in payment and currency owned by their developers, with QA reviewing the cases.
- Nightly fault-injection scenarios, and an on-request Locust performance baseline (not scheduled, because of the load it generates), with regressions filed automatically.
- **Synthetic checkout in production** (`synthetic_request=true`), so production pass rate is a real metric.
- The **CI triage agent** from [`agentic/`](agentic/) in **shadow mode**: it classifies every failure, and humans confirm until its accuracy on our own history justifies trusting it.
- Metrics from `test-strategy.md` §6 reported per pod, weekly, with trends.

The test of month 3: a developer can break checkout, and find out **before merge, from a red check, with the cause named**, without a QA engineer in the loop.
