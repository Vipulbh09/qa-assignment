# Automation

Playwright + TypeScript, built on the **Page Object Model**. Two kinds of tests, `api` and `ui`:

| Project | Folder | What it covers | Runs |
|---|---|---|---|
| `api` | `tests/api` | Frontend REST routes (`/api/*`), which call the backend gRPC services | In parallel |
| `ui`  | `tests/ui`  | Browser flows through the storefront | In parallel |

Fault injection (flagd) is an API test too, so it lives in `tests/api`. Any spec there named `*.serial.spec.ts` changes global flags, so Playwright runs it alone, after everything else (the `api-serial` project in `playwright.config.ts`).

## Structure: tests describe, page objects do

```
automation/
  pages/                  UI page objects: every selector lives here
    BasePage.ts             shared behaviour (header, session id, reload, current path)
    HomePage.ts  ProductPage.ts  CartPage.ts  OrderConfirmationPage.ts
    components/             parts shared across pages: Header.ts, CheckoutForm.ts
    Pages.ts                bundles the page objects for one browser page
  api/                    API clients: every endpoint URL lives here
    ShopApi.ts              one instance = one shopper (products, cart, checkout, currencies)
    FlagdApi.ts             feature flags; remembers what it changed and restores it
  fixtures/index.ts       hands page objects and API clients to tests (Playwright fixtures)
  helpers/                test data (data.ts) and exact money maths (money.ts)
  tests/                  scenarios and assertions only: api/, ui/
  scripts/check-pom.mjs   fails the build if a test breaks the rules below
```

A UI test reads like the scenario it checks, and contains no selector:

```ts
test('merge, update, persist across reload and tabs, empty', async ({ pages, newTab }) => {
  await pages.product.open(PRODUCTS.lensKit.id);
  const cart = await pages.product.addToCart(2);      // returns the CartPage it lands on
  await expect(cart.lineQuantity).toHaveValue('2');   // locators come from the page object
  await cart.emptyCart();
  await expect(cart.emptyMessage).toBeVisible();
});
```

**The rules** (enforced by `npm run lint:pom`, which CI runs before the tests):

1. **No locators in tests.** No `getBy...`, `locator(...)`, selector strings or `data-cy`. If a test needs something new, add a getter or method to a page object.
2. **No raw browser calls in tests.** No `page.`, `click`, `fill`, `goto`. Page objects expose actions (`addToCart`, `placeOrder`, `chooseExpiry`), and tests only assert.
3. **No raw HTTP or URLs in tests.** Endpoints live in `ShopApi` and `FlagdApi`.
4. **Tests import `test` and `expect` from `fixtures/`, never from `@playwright/test`.** The fixtures are `pages` (this test's browser), `newTab` (another tab, same shopper), `newSession` (a separate browser, a different shopper), `shop` (a fresh API shopper), `newShopper` (more shoppers) and `flags` (flag control, restored when the test ends).
5. **Page objects return locators; tests make the assertions.** A page method that moves to another page returns that page's object (`addToCart()` returns a `CartPage`).

## Prerequisites

- Docker (Compose v2), with roughly 6 GB of memory available to it
- Node.js 20 or later
- **A machine that is not busy.** The demo is 20 containers. If it starves for CPU, `checkout` and `product-catalog` turn unhealthy and tests fail with 504s or timeouts that look like product bugs (see "Running on a laptop" below).

## Run

```bash
# from the repo root: clone the pinned demo and start it (first run pulls images).
# On a laptop add LOADGEN=off, see "Running on a laptop" below.
./scripts/start-demo.sh

cd automation
npm ci
npx playwright install chromium

npm test              # everything
npm run test:smoke    # @smoke subset
npm run test:api      # the parallel API specs (the *.serial.spec.ts ones run only in a full `npm test`)
npm run check         # type check + POM check (no stack needed)
npm run report        # open the last HTML report

# when finished
../scripts/stop-demo.sh
```

Set `BASE_URL` to target a different host (default `http://localhost:8080`).

## Running on a laptop

The demo stack is heavy: right after start-up the Docker VM can use several cores for a few minutes. Findings from building this suite on an 8-core Mac:

- `./scripts/start-demo.sh` now waits for **every container to be healthy**, not just for the shop to answer. A working EUR listing came minutes before `checkout` and `product-catalog` stopped reporting `unhealthy`.
- **`LOADGEN=off ./scripts/start-demo.sh`** starts the stack without the `load-generator` (simulated shoppers). It is the biggest avoidable CPU load; with it off, three consecutive full runs passed. CI keeps it on.
- Locally the suite uses **2 browser workers** (CI uses Playwright's default), and assertions wait up to 10 s instead of 5 s.
- If a run shows many `504`s, first check `docker ps`: a container marked `(unhealthy)` makes the result meaningless. Restart the stack (`../scripts/stop-demo.sh`, then start) and rerun.

## Conventions

- Selectors use the `data-cy` attributes the frontend already ships (`testIdAttribute` in `playwright.config.ts`), and live only in `pages/`.
- Each test creates its own `userId` (the `shop` fixture), so tests never share a cart and can run in parallel.
- Tag fast, critical checks with `@smoke`. PRs run only those (see `.github/workflows/e2e.yml`).
- Money is compared as integer nanos or rounded cents (`helpers/money.ts`), never floats, so the tests can't share the bug they look for.
- Flags are changed only through `api/FlagdApi.ts`, which waits until flagd itself reports the new variant (it takes ~2s to propagate). The `flags` fixture restores every flag a test changed when the test ends, even if it fails.
- Don't run the `api-serial` project with `--repeat-each` or more than one worker: repeats are spread across workers and would flip the same global flags concurrently.

## Known defects: how they show up in results

Each confirmed defect has a test that asserts the **correct** behaviour and starts with `knownDefect('DEF-xx')`:

- While the bug exists, the test **fails for real**. It is red in the list output, the Playwright report and the Allure report, tagged with the DEF id, a link to the bug report and (for UI tests) a screenshot and trace.
- `scripts/gate.mjs` decides whether CI passes (`npm test` runs it after the tests): a failure on a known defect is accepted and listed, any other failure blocks, and a known-defect test that **passes** blocks too, because the bug is fixed and the marker must be removed.

Defect IDs and descriptions live in `helpers/data.ts` and [`../test-cases/README.md`](../test-cases/README.md). The one intermittent defect (DEF-10) is `test.fixme`, because a known-defect test would flap.

## Metrics dashboard

The metrics dashboard lives at the repo root, in [`../dashboard/`](../dashboard/). `node ../dashboard/build.mjs` builds `dashboard/dist/index.html` from `../test-cases/` and `test-results/results.json` (written by every run). CI publishes it to [GitHub Pages](https://vipulbh09.github.io/qa-assignment/) after each `main`, nightly or manual run, including failing ones, and keeps the last 50 runs for the pass-rate trend.

## Coverage

Result of the last local run (pinned demo `ac0443b`): **48 passed (34 normal + 14 known-defect), 1 fixme, 0 flaky, about 35s.**

| Test case | Automation | Spec(s) | Not automated, and why |
|---|---|---|---|
| TC-CHK-01 Happy path order | **Partial** | `api/checkout`, `ui/checkout` | Step 6 (reading the Jaeger trace for missing or error spans) needs judgement on what a healthy trace looks like |
| TC-CHK-02 Displayed = charged price | **Automated** | `api/checkout` (all 10 products + nano exactness) | n/a |
| TC-CHK-03 Non-USD currency | **Automated** | `api/checkout`, `ui/checkout` | n/a |
| TC-CHK-04 Failure after payment | **Manual** | n/a | Needs shipping to fail *between* quote and ship within one request; `docker pause` before the order fails the quote instead. Automating it needs a fault hook in the product (e.g. a flag on `ShipOrder`), a change I'd ask the team for, not fake in the test |
| TC-PAY-01 Card validation matrix | **Automated** | `api/payment` (8 rows) | n/a |
| TC-PAY-02 Decline message | **Partial** | `ui/payment` | Automation checks a message appears; whether it is *clear and actionable* is a human call |
| TC-PAY-03 Expiry selector | **Automated** | `ui/payment` | n/a |
| TC-PAY-04 Injected payment failure | **Automated** | `api/payment-failure.serial` | n/a |
| TC-CART-01 Cart lifecycle | **Automated** | `api/cart`, `ui/cart` | n/a (DEF-10 kept as `fixme`) |
| TC-CART-02 Invalid quantities/products | **Automated** | `api/cart` | n/a |
| TC-CART-03 Isolation and recovery | **Partial** | `api/cart`, `ui/cart` | Stopping Valkey mid-test disrupts every parallel test; the session-takeover step is a privacy review, not a pass/fail check |

**Test cases:** 7 of 11 fully automated, 3 partial, 1 manual. **64%** fully automated, **91%** with at least the main path automated.
