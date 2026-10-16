# Automation

Playwright + TypeScript. Two projects:

| Project | Folder | What it covers |
|---|---|---|
| `api` | `tests/api` | Frontend REST routes (`/api/*`), which call the backend gRPC services |
| `ui`  | `tests/ui`  | Browser flows through the storefront |

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

## Coverage

TODO: a matrix of test case ID → automated / partial / manual, with the reason for each. See `../test-cases/`.
