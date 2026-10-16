# Automation

Playwright + TypeScript. Two projects:

| Project | Folder | What it covers | Runs |
|---|---|---|---|
| `api` | `tests/api` | Frontend REST routes (`/api/*`), which call the backend gRPC services | In parallel |
| `ui`  | `tests/ui`  | Browser flows through the storefront | In parallel |
| `faults` | `tests/faults` | flagd fault injection (payment failures) | Serially, **after** `api` and `ui`, because flags are global to the stack |

## Prerequisites

- Docker (Compose v2), with roughly 6 GB of memory available to it
- Node.js 20 or later

## Run

```bash
# from the repo root: clone the pinned demo and start it (first run pulls images)
./scripts/start-demo.sh

cd automation
npm ci
npx playwright install chromium

npm test              # everything
npm run test:smoke    # @smoke subset
npm run test:api      # API project only
npm run report        # open the last HTML report

# when finished
../scripts/stop-demo.sh
```

Set `BASE_URL` to target a different host (default `http://localhost:8080`).

## Conventions

- Selectors use the `data-cy` attributes the frontend already ships (`testIdAttribute` in `playwright.config.ts`).
- Each test creates its own `userId`, so tests never share a cart and can run in parallel.
- Tag fast, critical checks with `@smoke`. PRs run only those (see `.github/workflows/e2e.yml`).
- Money is compared as integer nanos or rounded cents (`helpers/money.ts`), never floats, so the tests can't share the bug they look for.
- Flags are changed only through `helpers/flagd.ts`, which waits until flagd itself reports the new variant (it takes ~2s to propagate) and is always reset in `afterAll`.
- Don't run the `faults` project with `--repeat-each` or more than one worker: repeats are spread across workers and would flip the same global flags concurrently.

## Known defects: how they show up in results

Each confirmed defect has a test that asserts the **correct** behaviour, wrapped in `test.fail('DEF-xx')`:

- While the bug exists, the test fails as expected and the suite stays green (the list reporter shows `✘`, counted as passed).
- When the bug is fixed, the test starts passing, Playwright reports it as **unexpected**, and the build goes red, prompting someone to remove the `test.fail()`.

Defect IDs and descriptions live in `helpers/data.ts` and [`../test-cases/README.md`](../test-cases/README.md). The one intermittent defect (DEF-10) is `test.fixme`, because `test.fail` would flap.

## Coverage

Result of the last local run (pinned demo `ac0443b`): **47 passed (34 normal + 13 known-defect), 1 fixme, 0 flaky, about 40s.**

| Test case | Automation | Spec(s) | Not automated, and why |
|---|---|---|---|
| TC-CHK-01 Happy path order | **Partial** | `api/checkout`, `ui/checkout` | Step 6 (reading the Jaeger trace for missing or error spans) needs judgement on what a healthy trace looks like |
| TC-CHK-02 Displayed = charged price | **Automated** | `api/checkout` (all 10 products + nano exactness) | n/a |
| TC-CHK-03 Non-USD currency | **Automated** | `api/checkout`, `ui/checkout` | n/a |
| TC-CHK-04 Failure after payment | **Manual** | n/a | Needs shipping to fail *between* quote and ship within one request; `docker pause` before the order fails the quote instead. Automating it needs a fault hook in the product (e.g. a flag on `ShipOrder`), a change I'd ask the team for, not fake in the test |
| TC-PAY-01 Card validation matrix | **Automated** | `api/payment` (8 rows) | n/a |
| TC-PAY-02 Decline message | **Partial** | `ui/payment` | Automation checks a message appears; whether it is *clear and actionable* is a human call |
| TC-PAY-03 Expiry selector | **Automated** | `ui/payment` | n/a |
| TC-PAY-04 Injected payment failure | **Automated** | `faults/payment-failure` | n/a |
| TC-CART-01 Cart lifecycle | **Automated** | `api/cart`, `ui/cart` | n/a (DEF-10 kept as `fixme`) |
| TC-CART-02 Invalid quantities/products | **Automated** | `api/cart` | n/a |
| TC-CART-03 Isolation and recovery | **Partial** | `api/cart`, `ui/cart` | Stopping Valkey mid-test disrupts every parallel test; the session-takeover step is a privacy review, not a pass/fail check |

**Test cases:** 7 of 11 fully automated, 3 partial, 1 manual. **64%** fully automated, **91%** with at least the main path automated.
