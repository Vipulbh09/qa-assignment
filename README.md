# QA Assignment: OpenTelemetry Astronomy Shop

**📊 [QA metrics dashboard](https://vipulbh09.github.io/qa-assignment/)**: automation coverage, defects by detection source, CI pass and flaky rates. Rebuilt by CI from this repo on every push to `main`.

## Approach

I treated this as a risk exercise, not a coverage exercise: find where money and trust can break, prove it against the running system, then automate exactly that.

1. **Explore before writing.** I read the code paths behind checkout, payment, currency and cart, and probed them live. That found **11 confirmed defects**, each with a report and steps to reproduce in [`bugs/`](bugs/), including two S1s: prices with 1–9 cents are charged wrongly ($57.08 shown, $57.80 costed), and an unsupported currency code makes **everything free** (a $3,599 item ordered and shipped for 0). Full list: [`test-cases/README.md`](test-cases/README.md).
2. **Go deep on three flows:** checkout, payment and cart. 11 test cases, each with preconditions, expected results, edge cases and the risk to flag before shipping.
3. **Automate what pays back:** 49 Playwright tests (API, UI and flagd fault injection) in a page-object structure: tests hold scenarios and assertions only, and a CI check fails the build if one contains a locator or a raw call. 7 of 11 cases fully automated, 3 partially, 1 deliberately manual, with the reason recorded. Known defects are asserted with `test.fail()`, so the suite is green today and turns red the moment a bug is fixed.
4. **Make it reproducible:** the demo is pinned to one upstream commit, and CI runs the suite against a fresh stack on every push.

### Calls I made where the brief was ambiguous

| The brief says | What I found | What I did |
|---|---|---|
| Each service has an OpenAPI spec | None exist; services talk **gRPC** (`pb/demo.proto`), and the frontend exposes REST routes | Tested the real interfaces: REST via `/api/*`, gRPC contracts as the next step |
| `docker compose up` runs the shop | Kafka, accounting and fraud-detection are only in `compose.full.yaml` | Kept to the default stack; the async order pipeline is an explicit gap, not a pass |
| Images on Docker Hub | They're on `ghcr.io` | Pinned the demo commit so image versions can't drift |
| Clone the repo with `--depth=1` | That takes whatever upstream `main` is that day, so results aren't reproducible | Pinned commit `ac0443b`; override with `DEMO_REF` |

### What's where and how much to trust it

- **Verified by running:** every defect, every automated test (local and CI), all numbers in the docs.
- **Read from code, not executed:** the charge-before-ship risk (TC-CHK-04) and the PII flag. Both are marked as such.
- **Judgement calls:** severities, the targets in the metrics table, and the team structure. Those are mine to defend.

## Repository map

| Path | What |
|---|---|
| [`test-strategy.md`](test-strategy.md) | Risk-based test strategy |
| [`test-cases/`](test-cases/) | Manual test cases for the highest-risk flows |
| [`bugs/`](bugs/) | 11 bug reports with steps to reproduce, expected vs. actual, root cause and a runnable helper script |
| [`automation/`](automation/) | Playwright + TypeScript automation ([README](automation/README.md)) |
| [`automation-strategy.md`](automation-strategy.md) | Tooling, team structure, CI, flakiness, test data |
| [`agentic/`](agentic/) | Agentic QA workflow + `AGENT-DESIGN.md` + session transcript |
| [`REFLECTION.md`](REFLECTION.md) | Escalations, ownership, week 1 vs. month 3 |
| [`automation/dashboard/`](automation/dashboard/) | Builds the [metrics dashboard](https://vipulbh09.github.io/qa-assignment/) from test cases, defect log and Playwright results |

## Quick start

Requires Docker (Compose v2, around 6 GB of memory) and Node.js 20 or later.

```bash
./scripts/start-demo.sh          # clones the demo at a pinned commit, starts it, waits until healthy
                                 # (on a laptop: LOADGEN=off ./scripts/start-demo.sh, see automation/README.md)
cd automation && npm ci && npx playwright install chromium
npm test
../scripts/stop-demo.sh
```

The demo is pinned to upstream commit `ac0443b` (override with `DEMO_REF=<sha>`) so results are reproducible.
