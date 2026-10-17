# Automation Strategy

Each section separates **what this repo does today** from **what I'd do with a team of 4 on a real product**. Everything under "today" runs in CI on every push ([`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)).

## 1. Why these tools

| Need | Choice | Why this over the alternatives |
|---|---|---|
| API + UI tests | **Playwright + TypeScript** | One runner, one report, one language for both layers: the `request` fixture covers the REST routes, the browser covers the storefront. TypeScript matches the frontend (Next.js), so devs can read and fix the tests. Built-in trace viewer makes CI failures debuggable without re-running. **Project dependencies** let fault-injection tests run alone after everything else, which global flags require. |
| Why not Cypress? | Upstream already uses it | Cypress is weaker at pure API testing, multi-tab and multi-context flows (TC-CART-03 needs two isolated shoppers), and parallelism without a paid service. I kept upstream's `data-cy` selectors so both suites share the same hooks. |
| Fault injection | **flagd** (already in the stack) | Real failures through the real code paths, with no mocks to maintain. The demo ships the flags. |
| Contract tests (next step) | **Pact**, or **buf breaking** on `demo.proto` | 8 languages talk gRPC. A proto change in Go can break a client in C++. `buf breaking` is a cheap first gate; consumer-driven Pact is the fuller answer. |
| Performance (next step) | **Locust** (already in the stack as `load-generator`) | Reuse what exists; don't add a second load tool. |

## 2. Structure for a team of 4

**Today:** one repo, split by layer (`tests/api`, `tests/ui`, `tests/faults`), shared `helpers/`.

**With a team**, I'd split by **pod**, not by layer, so ownership is obvious:

```
automation/
  helpers/            # owned by Quality Platform: shop client, money, flagd, fixtures
  tests/
    checkout/  api/ ui/     # Checkout & Payments pod
    catalogue/ api/ ui/     # Catalogue & Pricing pod
    storefront/ ui/         # Storefront pod
    faults/                 # shared; runs serially
  CODEOWNERS          # each folder requires review from its pod's QA
```

- **Shared helpers are a product.** One owner (the Quality Platform QA) reviews every change; pods consume them. This is what stops 4 people writing 4 different "add to cart" helpers.
- **Unit and contract tests live in the service repos**, owned by developers. This repo holds only cross-service tests: API flows, E2E, fault injection.
- **Conventions are enforced, not documented:** lint rule against `waitForTimeout`, `forbidOnly` in CI (already on), required `DEF-xx` annotation on any `test.fail`.
- **Review rule:** a new test must name the test case or risk it covers. No test without a reason to exist.

## 3. Where tests run in CI

| Trigger | Runs today | Target state | Blocks? |
|---|---|---|---|
| **Pull request** | `@smoke` (5 tests) against a fresh Compose stack | + contract checks for changed protos; + specs tagged with the changed pod | Yes |
| **Push to main** | Full suite: api → ui → faults (49 tests, ~35s of test time) | Same, plus automatic revert-or-fix-forward within 1 hour | Yes |
| **Nightly (03:00)** | Full suite | + Locust baseline (p95 `PlaceOrder`, catalogue); + every flagd scenario | No; raises a ticket |
| **Manual** | Full suite (`workflow_dispatch`) | Same | No |
| **Production** | n/a | Synthetic checkout every 5 min with `synthetic_request=true` baggage (payment skips the charge for these) | Pages on-call |

**How failures surface:**

1. **GitHub check** on the PR or commit: red or green, the first thing anyone sees.
2. **HTML report + traces** uploaded as an artifact (14 days). Every failure has a screenshot and a Playwright trace (`retain-on-failure`), so nobody needs to reproduce locally to start debugging.
3. **Service logs** (last 200 lines per container) dumped into the artifact on failure, so you can tell environment from product without the stack still running.
4. **JUnit XML** for trend tracking (pass rate, flaky rate, duration per test).
5. **Target state:** nightly failures post to the owning pod's channel with the classified cause (see [`agentic/`](agentic/): an agent that triages CI failures into product bug / flaky / environment / test gap).

## 4. Flakiness

Flakiness is a **product of test design**, mostly. Prevention beats retries.

**Prevention: things this suite already does, each from a real problem hit while building it:**

| Rule | The problem it fixed |
|---|---|
| Wait on **state**, never on time | The first fault test saw 0 declines: the flag takes ~2s to propagate. `setFlag()` now polls flagd's own evaluation API until it reports the new variant. |
| Readiness = the **slowest real path**, not "port open" | USD listings work before `product-catalog` is healthy; EUR requests 504'd for ~40s after "ready". `wait-for-demo.sh` now waits on a EUR listing. |
| Global state runs **serially and is always restored** | flagd flags affect every test. The `faults` project runs after `api` and `ui`, one worker, and resets flags in `afterAll`. |
| **Unique data per test** | The stack's own `load-generator` creates carts while tests run. Every test is a new shopper (`qa-<uuid>`), so parallel tests and background traffic never collide. |
| **Assert ranges on probabilistic behaviour** | `paymentFailure` fails ~95% of payments, not all. The test asserts at least 14 of 20 declines (P(false fail) < 0.001), not an exact count. |
| Selectors from the **product's own test hooks** (`data-cy`) | Text and CSS selectors break on copy and styling changes. Where hooks don't exist (order confirmation page), assert on what the shopper reads, and ask the team to add hooks. |

**Detection:** CI retries once. A test that fails then passes is labelled **flaky** in the report, not hidden. Flaky rate is a tracked metric (target < 2%, see `test-strategy.md` §6).

**Handling:**
- A flaky test gets an owner and is tagged `@quarantine`: still runs, never blocks, and must be fixed or deleted within **5 working days**.
- **An intermittent product bug is not a flaky test.** DEF-10 (stale cart quantity, 2 runs in 10) looked like flakiness until I compared server state with the UI: the server was right and the page was stale. It's filed as a defect and kept as `test.fixme` with the reproduction rate, not retried until green.
- **Known defects** are asserted with `test.fail('DEF-xx')`: the suite stays green while the bug exists and turns red when it's fixed, so a fix can't go unnoticed and the test can't rot.

## 5. Test data

| Data | Approach |
|---|---|
| **Product catalogue and prices** | Seeded by the demo (`src/postgresql/init.sql`); the demo is **pinned to a commit** (`scripts/start-demo.sh`), so expected prices don't shift underneath the tests. Constants live in `helpers/data.ts` with their source file named. |
| **Shoppers and carts** | Created per test, never shared, never cleaned up: Valkey has no persistence, so a fresh stack is a clean slate. |
| **Cards** | Public test numbers (Visa, MasterCard, Amex, Luhn-invalid) and the form's own default. Never real card data. |
| **Money** | Compared as integer nanos or rounded cents (`helpers/money.ts`), never as floats. Otherwise the tests would share the very bug (DEF-01, DEF-08) they exist to catch. |
| **Feature flags** | Changed only through `helpers/flagd.ts`, verified before use, restored after. |
| **Production** | Synthetic orders tagged `synthetic_request=true`, so payment doesn't charge and the orders can be filtered out of reporting. |
| **Data I'd add with a team** | A small API to seed edge-case products (prices ending .01–.09, zero-decimal currencies) without editing the shared seed, so pricing tests don't depend on one product happening to cost $57.08. |
