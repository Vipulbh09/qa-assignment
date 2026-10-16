# Test Strategy: OpenTelemetry Astronomy Shop

**Scope:** upstream `opentelemetry-demo` at commit `ac0443b`, default `compose.yaml` (20 services).
**Author's stance:** quality effort goes where money, trust and blast radius are. Not every service gets equal attention.

## 1. Context and the calls I made

| Ambiguity | Decision | Why |
|---|---|---|
| Brief says each service has an OpenAPI spec | None exist. The contracts are **gRPC** (`pb/demo.proto`) plus the frontend's **REST** routes (`src/frontend/pages/api/`). I test against those. | Testing the real interfaces beats inventing specs. |
| Kafka, accounting and fraud-detection | **Out of scope.** They only exist in `compose.full.yaml`; checkout skips Kafka when no broker is configured. | Test what the brief runs. I note it as a gap, not a pass. |
| `load-generator` runs during tests | Kept on for exploratory and performance runs; tests isolate themselves with a unique `userId` per test. | Real shops have concurrent traffic. Isolation, not a sterile environment. |
| Fault injection | Use the built-in **flagd** flags (`paymentFailure`, `cartFailure`, `productCatalogFailure`, …) for negative paths. | Deterministic failures without mocks. |

## 2. Where the quality risk is

I ranked risk as **business impact × likelihood × how late we'd find out**, and backed each ranking with evidence from exploring the running system and its code. All defects are listed in [`test-cases/README.md`](test-cases/README.md):

| # | Area | Why it's high risk | Evidence |
|---|---|---|---|
| 1 | **Price integrity (currency → checkout)** | Money shown must equal money charged. | **Confirmed defect.** `currency/src/server.cpp` `getDouble()` drops leading zeros in `nanos`: $57.08 is read as $57.80. Checkout calls `Convert` even for USD→USD, so a USD shopper sees **$57.08** for Red Flashlight but the order is costed at **$57.799999999**. EUR listing shows €51.13 instead of €50.49. Any price with 1–9 cents is affected. **Worse:** an unsupported currency code (`XXX`, settable from the browser's `localStorage`) prices everything at **0**, and checkout accepts it; a $3,599 item was ordered for 0. |
| 2 | **Checkout orchestration** | One call (`PlaceOrder`) touches 7 services. Partial failure is the normal case, not the edge case. | `checkout/main.go`: card is **charged before shipping**; if shipping then fails, the order errors with no refund or compensation. `emptyUserCart` errors are ignored (`_ =`), so a paid cart can stay full and be ordered twice. |
| 3 | **Payment validation** | Directly gates revenue and fraud. | `payment/charge.js` validates card number, type (Visa/MC only) and expiry, but **not amount or CVV**. Payment and currency have **zero unit tests** in the repo. **Confirmed defect:** a declined card shows the shopper *no message*; the error is an uncaught JS exception. |
| 4 | **Cart state** | Lost or leaked carts = lost sales or privacy issue. | State in Valkey keyed by a client-generated `userId`. **Confirmed defect:** the cart accepts negative quantities (`-3` → HTTP 200, stored); checkout is blocked only because shipping happens to reject the quote. |
| 5 | **Data protection** | Regulatory, not just functional. | flagd `emitRawPii` writes card number and CVV into traces. Must be provably **off** in every non-local environment. |

Lower risk, lighter coverage: `ad`, `recommendation`, `image-provider`, `email` (failure only logs a warning and doesn't fail the order, which is the right design).

## 3. Test pyramid

Polyglot services talking gRPC means **contract tests are the load-bearing layer**: they catch the cross-language breakage that unit tests can't and E2E finds too late.

| Layer | Owner | What | Share of effort |
|---|---|---|---|
| **Unit** | Developers | Pure logic: money maths, card validation, shipping quote rules. Fix the gap in `payment` and `currency` first. | ~50% of tests |
| **Contract** | Dev + QA | Consumer-driven contracts on `demo.proto` between checkout and its 6 dependencies, and frontend REST ↔ UI. Breaking proto changes fail the provider's PR. | ~20% |
| **Integration / API** | QA | Real services via Docker Compose, through `/api/*`. Business flows, error mapping (e.g. payment decline → 422 `PAYMENT_FAILED`), fault injection via flagd. | ~20% |
| **E2E UI** | QA | Five or six journeys only: browse → cart → checkout, currency switch, decline handling. | ~5% |
| **Performance** | QA + SRE | Reuse the existing Locust `load-generator`. Baseline p95 for `PlaceOrder` and catalogue listing; fail nightly on >20% regression. | Nightly |

**Deliberately not automated:**
- **Visual and layout judgement** of the storefront. Cheaper by eye than by maintaining screenshot baselines on a demo UI.
- **Exploratory testing** of new features and failure combinations. That's where defect #1 was found, and no script would have looked there.
- **Observability correctness** (are the traces *useful*?). Upstream already has `test/telemetry/`; I'd review dashboards manually per release.
- **One-off flag scenarios** like `emailMemoryLeak`. Run manually during resilience game days, not every build.

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
| **Nightly** | schedule | Full suite + flagd fault scenarios + Locust performance baseline | No; creates a ticket and pings pod channel |
| **Pre-release** | release candidate | Nightly results green 3 nights running, exploratory session signed off, `emitRawPii` = off | **Yes**, QA recommendation |
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
