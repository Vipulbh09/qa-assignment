# QA Assignment: OpenTelemetry Astronomy Shop

## Approach
<!-- 4-6 lines: what you prioritised, and the key calls you made -->

## Repository map

| Path | What |
|---|---|
| [`test-strategy.md`](test-strategy.md) | Risk-based test strategy |
| [`test-cases/`](test-cases/) | Manual test cases for the highest-risk flows |
| [`automation/`](automation/) | Playwright + TypeScript automation ([README](automation/README.md)) |
| [`automation-strategy.md`](automation-strategy.md) | Tooling, team structure, CI, flakiness, test data |
| [`agentic/`](agentic/) | Agentic QA workflow + `AGENT-DESIGN.md` + session transcript |
| [`REFLECTION.md`](REFLECTION.md) | Escalations, ownership, week 1 vs. month 3 |

## Quick start

Requires Docker (Compose v2, around 6 GB of memory) and Node.js 20 or later.

```bash
./scripts/start-demo.sh          # clones the demo at a pinned commit, starts it, waits until ready
cd automation && npm ci && npx playwright install chromium
npm test
../scripts/stop-demo.sh
```

The demo is pinned to upstream commit `ac0443b` (override with `DEMO_REF=<sha>`) so results are reproducible.
