# Agentic QA Workflow: CI triage agent

Takes a failing test (name, log, git diff, plus CI artifacts when available) and classifies it as **product bug / flaky test / environment issue / test gap**, with confidence, evidence and a proposed next action. Shadow mode: it reports, it changes nothing.

It runs on your own **Claude Code login** (`claude -p`), with **no API key**. Design, guardrails, evaluation and limits: [`AGENT-DESIGN.md`](AGENT-DESIGN.md).

```bash
cd agentic && npm ci
npm run check        # typecheck + unit tests (no model needed)
npm run eval         # 29 cases through your Claude Code session, about 5 minutes
npm run triage -- --test "<test name>" --log <log file> --diff <patch file>
```

| Path | What |
|---|---|
| [`AGENT-DESIGN.md`](AGENT-DESIGN.md) | Workflow diagram, what the agent vs a human decides, guardrails, eval, limits |
| `src/` | Evidence collector, signal rules, prompt, Claude Code wrapper, guardrails, report, CLI |
| `prompts/triage.system.md` | The system prompt (reviewable as a file) |
| `evals/cases/` | 29 labelled cases (14 real): `case.json`, `log.txt`, `diff.patch` each |
| `evals/results/` | [`latest.md`](evals/results/latest.md) (v2) and [`v1.md`](evals/results/v1.md) |
| `report/build.mjs` | Builds the [CI triage report](https://vipulbh09.github.io/qa-assignment/agent/) page published with the QA dashboard |
| `src/ci-triage.ts` | Triages the failing tests of a CI run from Playwright's `results.json` |
| `examples/` | Four sample inputs (one real, three constructed) with the agent output |

**Result:** 28/29 with prompt v2.1: 14/14 on the 14 cases the prompt was tuned on and 14/15 on 15 cases added afterwards (it was 12/15 on the first run with the same rules, so read it as about 13 plus or minus a couple). 13 of the 29 cases are real captures. Read [the evaluation section](AGENT-DESIGN.md#evaluation) before quoting a number.

## In CI

A wall of 504s is classified by a rule with no model call (see [Rules-only baseline](AGENT-DESIGN.md#rules-only-baseline-srcbaselinets)); everything else goes to the model. The `agent` job runs after Playwright, never fails the build, and publishes its report at `/agent/` on the same GitHub Pages site as the QA dashboard. The model steps need the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`; a subscription token, not an API key). Without it the checks and a signals-only triage still run and the report says the eval was not re-run. Details and what is not yet verified: [`AGENT-DESIGN.md`](AGENT-DESIGN.md#in-ci).

Session transcript: [`transcript/session.raw.jsonl`](transcript/session.raw.jsonl) is the raw, unedited Claude Code session file (one JSON record per line, about 11 MB: messages, tool calls and results, hidden reasoning, system prompt and API request records; it contains the author's home path and email). [`transcript/session.jsonl`](transcript/session.jsonl) is an earlier, redacted and truncated export of the same session, up to the point of the 504-rule work.
