# QA Assignment: OpenTelemetry Astronomy Shop

**I tested a 20-service shop the way I'd run quality on a real product: find where money and trust can break, prove it against the running system, automate exactly that, and make the results visible to anyone.** It found **11 confirmed defects**, two of them release blockers, and the evidence is public.

| | |
|---|---|
| 📊 **[QA metrics dashboard](https://vipulbh09.github.io/qa-assignment/)** | Automation coverage, defects by how they were found, pass and flaky rates and the run trend. Every number is computed from this repo by CI. |
| 🧪 **[Allure test report](https://vipulbh09.github.io/qa-assignment/allure/)** | Every automated test with steps, retries, screenshots and traces, grouped as API and UI, with a trend across runs. A link anyone can open, no setup. |
| 🐞 **[Bug reports](bugs/README.md)** | 11 defects, each with steps to reproduce, expected vs. actual, root cause from the code and a suggested fix. |
| 🤖 **[CI triage agent](https://vipulbh09.github.io/qa-assignment/agent/)** | An agent that classifies a red CI run as product bug, flaky test, environment issue or test gap. Design in [`agentic/AGENT-DESIGN.md`](agentic/AGENT-DESIGN.md). |

Both reports are rebuilt by CI after every run on `main`, including red ones, because a failing run is what they exist to show.

## The highlights

- **Two S1 defects in how the shop handles money.** A product priced $57.08 is shown at that price but costed at $57.80. An unsupported currency code prices *everything at 0*, and checkout accepts it: a $3,599 telescope part was ordered and shipped for free. Five of the 11 defects come from one place, the currency service, which makes it one decision for leadership instead of five tickets.
- **Tests that tell the truth.** Each known defect has a test asserting the *correct* behaviour, so it really fails and shows red in the report. A small CI gate accepts those known failures, blocks any new one, and turns red if a known-defect test starts passing (the bug is fixed). The suite can't quietly go green by hiding bugs.
- **Automation that is easy to maintain.** Page Object Model: tests hold scenarios and assertions only, and a CI check fails the build if a test contains a locator, a raw browser call or an endpoint URL.
- **Reliable by design.** One retry with flaky tests labelled in the report, unique data per test, waits on state instead of time, and fault injection through the stack's own feature flags. I measured one intermittent product bug (11 failures in 30 runs) and filed it as a defect instead of retrying it away.

## How I approached it

I treated it as a risk exercise, not a coverage exercise.

1. **Explore first.** I ran the shop, read the code behind checkout, payment, currency and cart, and tried to break the suspicious spots. A bug only counted once I could reproduce it. Some came from exploring by hand, some from using AI to dig through the risky areas I had picked, and two from the automated suite.
2. **Rank the risk** by business impact, likelihood and how late we'd find out. That ranking decides where the effort goes ([`test-strategy.md`](test-strategy.md)).
3. **Manual strategy.** Eleven deep test cases over three flows (checkout, payment, cart) rather than many thin ones, each with expected results, edge cases and the risk to flag before shipping. Visual judgement and exploratory work stay manual, on purpose ([`test-cases/`](test-cases/)).
4. **Automation strategy.** Playwright and TypeScript for API and UI, in a page-object structure. 49 tests, 7 of the 11 cases fully automated, 3 partly, 1 manual with the reason written down. It covers tooling, structure for a team of 4, CI, flakiness and test data ([`automation-strategy.md`](automation-strategy.md)).
5. **Make it reproducible.** The demo is pinned to one upstream commit and CI runs the suite against a fresh stack on every push.

### What to trust

- **Verified by running:** every defect, every automated test (locally and in CI), and the numbers in the docs.
- **Read from code, not executed:** the charge-before-ship risk (TC-CHK-04) and the PII flag. Both are marked as such.
- **Judgement calls:** severities, the targets in the metrics table, and the team structure. Those are mine to defend.

## Repository map

| Path | What |
|---|---|
| [`test-strategy.md`](test-strategy.md) | Risk-based test strategy and how the risks were found |
| [`test-cases/`](test-cases/) | Manual test cases for the highest-risk flows |
| [`bugs/`](bugs/) | 11 bug reports with steps to reproduce, expected vs. actual, root cause and a runnable helper script |
| [`automation/`](automation/) | Playwright + TypeScript automation ([README](automation/README.md)) |
| [`automation-strategy.md`](automation-strategy.md) | Tooling, team structure, CI, flakiness, test data |
| [`agentic/`](agentic/) | Agentic QA workflow + `AGENT-DESIGN.md` + session transcript |
| [`REFLECTION.md`](REFLECTION.md) | Escalations, ownership, week 1 vs. month 3 |
| [`automation/allurerc.mjs`](automation/allurerc.mjs) | Config for the [Allure report](https://vipulbh09.github.io/qa-assignment/allure/) |
| [`dashboard/`](dashboard/) | Builds the [metrics dashboard](https://vipulbh09.github.io/qa-assignment/) from the test cases, the defect log and the Playwright results |

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
