# Automation Strategy

Each section separates **what this repo does today** from **what I'd do with a team of 4 on a real product**. Everything under "today" runs in CI on every push ([`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)).

## 1. Why these tools

I used **Playwright with TypeScript** for both the API and the UI tests. One runner, one report and one language for both layers means a failure is read the same way whether it came from a REST call or a browser click, and nobody maintains two frameworks. The `request` fixture covers the frontend's REST routes and the browser covers the storefront. TypeScript matches the frontend (Next.js), so developers can read and fix the tests themselves. The trace viewer lets us debug a CI failure without re-running it, and project dependencies let the fault-injection tests run alone, after everything else, which they need because they change global flags.

## 2. Structure for a team of 4

**Today:** one repo using the **Page Object Model**: `pages/` (UI page objects, all selectors), `api/` (API clients, all endpoints), `fixtures/` (wiring), `helpers/` (data, money) and `tests/` split by layer (`api`, `ui`, `faults`). Tests contain only scenarios and assertions.

**With a team**, I'd split by **pod**, not by layer, so ownership is obvious. The page objects are split the same way: each QA owns the pages and API clients for the pod they handle, and only the base classes and fixtures are shared. Each pod also gets its own pipeline job, kept in a `pipelines/` folder, so a slow or red pod doesn't hold up the others as the team grows.

```
automation/
  base/ fixtures/ helpers/        # shared, owned by Quality Platform: BasePage, wiring, data, money
  checkout/                       # Checkout & Payments pod
    pages/ api/ tests/
  catalogue/                      # Catalogue & Pricing pod
    pages/ api/ tests/
  storefront/                     # Storefront pod
    pages/ tests/
  faults/                         # shared; runs serially
  pipelines/
    checkout.yml                  # one CI job per pod: runs only that pod's tests
    catalogue.yml
    storefront.yml
    faults.yml
  CODEOWNERS                      # each folder requires review from its pod's QA
```

GitHub only reads workflows from `.github/workflows/`, so there the per-pod files would be thin wrappers that call the job definitions in `pipelines/`.

- **Page objects and API clients stay in one place per screen.** The pod that owns a screen owns its page object, and other pods reuse it instead of writing their own "add to cart" helper. A UI change is then fixed in one page object, not in every test that touches that screen.
- **Unit and contract tests live in the service repos**, owned by developers. This repo holds only cross-service tests: API flows, E2E, fault injection.
- **Conventions are enforced, not documented:** `npm run lint:pom` (already in CI) fails the build if a test contains a locator, a raw browser call, a raw HTTP call or an endpoint URL, and `forbidOnly` is on in CI. I would add a lint rule against `waitForTimeout` and a required `DEF-xx` annotation on any `test.fail`.
- **Review rule:** a new test must name the test case or risk it covers. No test without a reason to exist.

## 3. Where tests run in CI

| Trigger | Runs today | Target state | Blocks? |
|---|---|---|---|
| **Pull request** | Type check + POM check, then `@smoke` (5 tests) against a fresh Compose stack | + contract checks for changed protos; + specs tagged with the changed pod | Yes |
| **Push to main** | Full suite: api → ui → faults (49 tests, ~35s of test time) | Same, plus automatic revert-or-fix-forward within 1 hour | Yes |
| **Nightly (03:00)** | Full suite | + every flagd scenario | No; raises a ticket |
| **Manual** | Full suite (`workflow_dispatch`) | Same, plus an optional Locust baseline (p95 `PlaceOrder`, catalogue) when someone asks for it | No |
| **Production** | n/a | Synthetic checkout every 5 min with `synthetic_request=true` baggage (payment skips the charge for these) | Pages on-call |

**How failures surface:**

1. **GitHub check** on the PR or commit: red or green, the first thing anyone sees.
2. **HTML report + traces** uploaded as an artifact (14 days). Every failure has a screenshot and a Playwright trace (`retain-on-failure`), so nobody needs to reproduce locally to start debugging.
3. **Service logs** (last 200 lines per container) dumped into the artifact on failure, so you can tell environment from product without the stack still running.
4. **Allure report** (`allure-playwright` + Allure 3, no Java): every run on `main` publishes steps, attachments, retries and a trend history to GitHub Pages at `/allure/`, next to the metrics dashboard. The history file is fetched from the last published report and appended to, so the trend charts grow without a database.
5. **Target state:** nightly failures post to the owning pod's channel with the classified cause (see [`agentic/`](agentic/): an agent that triages CI failures into product bug / flaky / environment / test gap).

## 4. Flakiness

How I handle it:

- **Retry once, and show it.** CI retries a failed test one time. A test that fails and then passes is labelled **flaky** in the report, never hidden, and the flaky rate is tracked (target under 2%).
- **Quarantine with an owner.** A flaky test gets an owner and a `@quarantine` tag: it still runs but never blocks the build, and it is fixed or deleted within 5 working days.
- **Fix the cause, not the symptom.** I wait on state instead of time (the flag-change helper polls flagd until the new value is live), wait for every container to be healthy before the run, give each test its own shopper so parallel tests and background traffic don't collide, and assert ranges on random behaviour (at least 14 of 20 payments declined, not an exact count).
- **An intermittent product bug is not a flaky test.** DEF-10 (stale quantity on the cart page, about 1 run in 3) looked like flakiness until I compared the server's cart with the page: the server was right and the page was stale. It is filed as a defect and kept as `test.fixme`, not retried until green.
- **Known defects stay visible.** Each is asserted with `test.fail('DEF-xx')`: the suite stays green while the bug exists and goes red when someone fixes it, so a fix can't go unnoticed.
- **Environment first when many tests fail at once.** A wall of 504s means the stack is overloaded (on my laptop `checkout` went unhealthy), not that 19 things broke. The triage agent in [`agentic/`](agentic/) uses the same rule.

## 5. Test data

The shop's catalogue is seeded by the demo itself, and I pinned the demo to one commit, so the prices the tests expect don't move. Every test creates its own shopper (`qa-<uuid>`) and never reuses one, so tests can run in parallel. The cart store keeps nothing between restarts, so there is nothing to clean up. The values live in `helpers/data.ts`.

A sample of what the tests use, and why:

| Data | Example | Why this one |
|---|---|---|
| Product, cents that trip the price bug | Red Flashlight, $57.08 | Any price with 1 to 9 cents exposes the display-vs-charged mismatch (DEF-01) |
| Product, ordinary price | Starsense Explorer Refractor Telescope, $349.95 | A clean happy-path order |
| Product, very cheap and very dear | The Comet Book $0.99, Optical Tube Assembly $3,599.00 | Rounding at the bottom, and the biggest amount at the top |
| Currencies | USD, EUR, JPY, and `XXX` (unsupported) | The base case, a conversion, a zero-decimal currency (DEF-09), and the unknown code that prices everything at 0 (DEF-05) |
| Valid card | Visa `4432-8015-6152-0454` (the checkout form's default), Mastercard `5555-5555-5555-4444` | Public test numbers, never a real card |
| Invalid card | `4432-8015-6152-0455` (fails the Luhn check) | Checks the decline path |
| Quantities | 1, 2, and `-3` or `0` through the API | Normal use, then the negative and zero cases the cart should refuse (DEF-03) |
| Address | 1600 Amphitheatre Parkway, Mountain View, CA 94043 | One fixed, valid shipping address |

Money is compared as whole cents or integer nanos, never as floats, because floats would give my tests the same bug they are meant to catch. Feature flags are only changed through one helper and are put back when the test ends. In production, synthetic orders would carry `synthetic_request=true`, so payment skips the charge.
