# Test Strategy: OpenTelemetry Astronomy Shop

## 1. How I went about it

The goal of this strategy is a reliable quality outcome: the highest quality we can deliver, not the most tests we can write. With 20 services and a small team, covering everything equally means covering the important parts thinly. So I started by working out what could actually hurt a customer or the business, and only then decided what to test.

I did that before writing a single test case:

1. **Ran the shop and used it** like a customer would: browse, add to cart, switch currency, check out, get a card declined.
2. **Read the code behind those journeys**, starting with the services where money moves and state is kept: `checkout`, `currency`, `payment`, `cart`. I looked for the things that tend to break: input that isn't validated, calls that can fail halfway, errors that are swallowed, and logic with no unit tests (`payment` and `currency` have none).
3. **Tried to break the suspicious spots** with odd inputs: negative quantities, unknown currency codes, cards that should be declined, and the built-in flagd faults. A bug only counted once I had reproduced it and could write down the steps.
4. **Ranked the areas** by business impact, how likely they are to fail, and how late we would find out. That ranking is section 2. It decides where the automation goes.

This paid off quickly. Eleven defects came out of it ([`bugs/`](bugs/)), and they came from three places: some by me exploring by hand, some by using AI to dig through the code and probe the risky areas I had already identified (I chose the areas and reproduced every finding myself), and two by the automated suite once the cases were automated. The suite is the safety net. The exploring, by hand and with AI, is what told us where to put it.

The automation follows the same ranking. The first suites cover price integrity, checkout, payment and cart, and every defect has a test that asserts the *correct* behaviour. The test passes while the bug exists (marked as an expected failure) and turns red the day someone fixes it, so a fix can't go unnoticed.

## 2. Where the quality risk is

Risk = **business impact × likelihood × how late we'd find out**. All defects found along the way are listed in [`test-cases/README.md`](test-cases/README.md):

| # | Area | Why it's high risk |
|---|---|---|
| 1 | **Price integrity (currency → checkout)** | Money shown must equal money charged. |
| 2 | **Checkout orchestration** | One call (`PlaceOrder`) touches 7 services. Partial failure is the normal case, not the edge case. |
| 3 | **Payment validation** | Directly gates revenue and fraud. |
| 4 | **Cart state** | Lost or leaked carts = lost sales or privacy issue. |
| 5 | **Data protection** | Regulatory, not just functional. |

Lower risk, lighter coverage: `ad`, `recommendation`, `image-provider`, `email` (failure only logs a warning and doesn't fail the order, which is the right design).

## 3. Test pyramid

Polyglot services talking gRPC means **contract tests are the load-bearing layer**: they catch the cross-language breakage that unit tests can't and E2E finds too late.

| Layer | Owner | What | Share of effort |
|---|---|---|---|
| **Unit** | Developers | Pure logic: money maths, card validation, shipping quote rules. Fix the gap in `payment` and `currency` first. | ~50% of tests |
| **Contract** | Dev + QA | Consumer-driven contracts on `demo.proto` between checkout and its 6 dependencies, and frontend REST ↔ UI. Breaking proto changes fail the provider's PR. | ~20% |
| **Integration / API** | QA | Real services via Docker Compose, through `/api/*`. Business flows, error mapping (e.g. payment decline → 422 `PAYMENT_FAILED`), fault injection via flagd. | ~20% |
| **E2E UI** | QA | Five or six journeys only: browse → cart → checkout, currency switch, decline handling. | ~5% |
| **Performance** | QA + SRE | Reuse the existing Locust `load-generator`. Baseline p95 for `PlaceOrder` and catalogue listing; flag a >20% regression against the last baseline. Run **on request** (before a release, or after a change to a hot path), not on a schedule, because it generates a lot of load. | On request |

**Deliberately not automated:**
- **Visual and layout judgement** of the storefront. Cheaper by eye than by maintaining screenshot baselines on a demo UI.
- **Exploratory testing** of new features and failure combinations. That's where defect #1 was found, and no script would have looked there.

## 4. QA ownership across 20 services (4 QA engineers)

Ownership follows **business domains (pods)**, not services. Nobody can own 5 services in depth, but one person can own a customer journey.

| Pod | Services | QA focus |
|---|---|---|
| **Checkout & Payments** | checkout, payment, cart, email, valkey-cart | Highest risk. Partial-failure and money-movement testing. |
| **Catalogue & Pricing** | product-catalog, currency, quote, shipping, astronomy-db | Price integrity, data correctness. |
| **Storefront** | frontend, frontend-proxy, ad, recommendation, image-provider | UI journeys, REST contract, accessibility. |
| **Quality Platform** (shared) | flagd, otel-collector, load-generator, CI | Test infrastructure, contract tooling, flaky-test triage, performance baseline. |

Rules that make it work:
- **Developers own unit tests and fixing their pipeline;** QA owns risk analysis, contract and integration suites, and the release recommendation.
- Each QA is a **named secondary** for one other pod, so holidays don't create blind spots.
- Cross-pod flows (checkout spans 3 pods) are owned by **Checkout & Payments**, with other pods owning their contracts.

## 5. Quality gates in CI/CD

| Stage | Trigger | Runs | Blocks? |
|---|---|---|---|
| **PR** | every push | Unit, lint, contract verification for changed services, API `@smoke` | **Yes** |
| **Merge to main** | merge | Full API suite + E2E journeys against Compose stack | **Yes** (reverts on red) |
| **Nightly** | schedule | Full suite + flagd fault scenarios | No; creates a ticket and pings pod channel |
| **Pre-release** | release candidate | Nightly results green 3 nights running, exploratory session signed off, `emitRawPii` = off. A performance baseline is **optional**: required only when the release touches a hot or critical path (checkout, catalogue listing, anything on the money path), skipped otherwise | **Yes**, QA recommendation |
| **Production** | continuous | Synthetic checkout using `synthetic_request=true` baggage (payment already skips the charge for these) | Alerts, rollback trigger |

A quarantined (known-flaky) test never blocks, but it can't stay quarantined more than 5 working days without an owner.

## 6. Metrics

| Metric | Definition | Target | Why it matters |
|---|---|---|---|
| **Defect leakage** | Bugs found in a later stage ÷ all bugs found for that release | < 15% | Shows whether earlier gates actually catch things. |
| **Escaped defects** | Prod bugs per release, weighted by severity | 0 S1, trending down | The metric leadership actually feels. |
| **Automation coverage** | Risk-ranked test cases automated ÷ those that should be (not lines of code) | > 80% for P1 flows | Code coverage would reward testing `ad` over `checkout`. |
| **Bugs caught by automation** | Bugs first detected by an automated suite ÷ all bugs found before production | > 40%, trending up | Shows the suites find real defects, not just pass. A suite that never catches anything is cost, not safety. |
| **Automation pass rate: staging** | Passed ÷ executed runs of the full suite on staging, per day | > 98% on unchanged code | Below this, people stop trusting red builds. Read with flaky rate: a drop is either product breakage or test unreliability. |
| **Automation pass rate: production** | Passed ÷ executed runs of the synthetic checkout suite in production | > 99.5% | Production health from the customer's path; a failure here is an incident signal, not a test problem. |
| **Flaky rate** | Tests that pass on retry ÷ total | < 2% | Leading indicator for stability. |
| **Mean time to triage** | CI red → classified (bug / flaky / env / test gap) | < 4 working hours | Measures the feedback loop, not just the tests. |

I'd report these per pod, weekly, with trend lines. A single number per metric hides where the problem is.
