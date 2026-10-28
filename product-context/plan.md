# Plan: product context for the test-case generation agent

Status: proposal, nothing built yet.

## Assumption to confirm
"OpenTelemetry" means the **OpenTelemetry Astronomy Shop demo**, the 20-service app already under test, pinned in `.demo/` at commit `ac0443b`. A thin second layer covers OTel itself (traces, metrics, logs, flagd), because the shop exists to show that off. The whole OTel spec is out of scope.

## Goal
A versioned, reviewable **product-context pack** in the repo. A test-case generation agent loads the right slice of it per request, so it generates cases grounded in how the product works, not in general OTel knowledge.

## 1. Where the knowledge comes from

| Source | Gives the agent | How it's pulled |
|---|---|---|
| `.demo/pb/demo.proto` | Exact API contracts per service (RPCs, fields, enums) | Script, deterministic |
| `.demo/compose*.yaml`, `otel-config.yml` | Service dependency graph, ports, env, infra | Script |
| flagd flag config | Every fault-injection flag, its variants, the service it hits | Script |
| `.demo/src/<service>/` | Business logic, validation, error paths, language/stack | LLM-assisted summary, human-reviewed |
| `.demo/test/tracetesting`, `AGENTS.md`, `CLAUDE.md`, docs | What upstream already tests, conventions | Read plus summary |
| opentelemetry.io demo docs | Intended behaviour, scenarios, architecture | Fetch and summarise, URL kept |
| **This repo**: `bugs/`, `test-cases/`, `test-strategy.md`, `automation/` page objects | Known defects, risk ranking, existing coverage, real selectors | Script plus summary |

The last row matters most: it tells the agent what has already been found, what is covered and where the risk sits.

## 2. The pack: `product-context/`
```
product-context/
  INDEX.md              # ≤2 pages, always loaded: what the shop is, service map, top risks
  architecture.md       # call graph, sync vs async (Kafka), data stores
  flows/                # browse, cart, checkout, recommendations, ads
  services/<svc>.md     # one per service (template below)
  feature-flags.md      # flag -> effect -> what to test
  invariants.md         # business rules that must always hold (money, currency, stock, totals)
  known-defects.md      # generated from bugs/, with the pattern behind each
  coverage-map.md       # existing TC / automated test IDs by service and flow, plus gaps
  testability.md        # endpoints, selectors, env quirks (e.g. the 504 wall), data setup
  manifest.json         # id, tags (service, flow, risk), file, token size, source, verified level
  sources.lock          # upstream sha, doc URLs, retrieval date, generator version
```
Each `services/<svc>.md` follows one template: purpose, language, API, dependencies, config and flags, validation rules, failure modes, known defects, test ideas by technique (boundary, state, negative, fault injection), testability hooks.

Every fact carries a **provenance tag**: `[verified-by-running]`, `[read-from-code: file:line]` or `[docs-only]`. The agent states lower-confidence facts as assumptions.

## 3. Building it
1. **Generators** (`product-context/build/`): proto, compose and flagd become tables with no model involved, so they can't hallucinate and can be regenerated.
2. **Narrative drafts**: Claude Code reads one service at a time and fills the template, citing `file:line`.
3. **Human review gate**: spot-check each service file, mainly invariants and failure modes. Unreviewed files are marked `draft` and the loader warns on them.
4. **Staleness check** (CI): if the `.demo` pin changes, or a source file hash differs from `sources.lock`, flag the affected context files.

## 4. Feeding it to the generator agent
A new `testgen/` next to `agentic/`, reusing its pattern (Claude Code login via `claude -p`, zod schemas, prompt as a reviewable file).

**Tiered loading** keeps prompts small and relevant:
- **Tier 0, always:** `INDEX.md`, `invariants.md`, output rules.
- **Tier 1, by input:** a requirement, diff or feature name is mapped through `manifest.json` tags to the matching `services/`, `flows/` and `feature-flags` slices, plus related `known-defects` entries. A diff touching `currency` pulls currency, checkout and payment context.
- **Tier 2, on demand:** the agent reads other pack files when needed, e.g. the proto for a specific RPC.

**Output contract** (a schema, not free text): test-case ID, title, flow, risk, technique, preconditions, steps, expected result, automation candidate (yes/no/partial and why), and `context_refs[]`, the IDs of the facts the case relies on.

**Guardrails:**
- A case with no `context_refs` is rejected.
- Endpoints, RPCs and flags it names must exist in the generated tables.
- Checked against `coverage-map.md` and `known-defects.md`, so it can mark a duplicate or a regression check.
- The agent proposes only; it writes nothing to `test-cases/`.

## 5. Proving the context helps
Same method as the triage eval:
- Run generation **with and without** the pack on held-out inputs: the 11 known defect areas plus a few diffs.
- Measure **recall of known defects** (did it propose a case that would catch them?), share of cases citing valid refs, hallucinated-endpoint rate, and duplicate rate against existing cases.
- Avoid leakage: hide a defect's own `known-defects.md` entry when measuring recall of that defect, otherwise the eval is circular.

## 6. Phases
1. **Skeleton and generators** (proto, compose, flagd, manifest, provenance). No model needed.
2. **Deep context for the money path** first: checkout, payment, currency, cart. That's where the defects are, so the payoff shows soonest.
3. **Remaining services, flows and the OTel layer.**
4. **`testgen/` loader and agent**, then the with/without eval.
5. **CI staleness check**, then expand.

## Open decisions
1. **Scope:** the shop only (assumed), or also deep OTel SDK/Collector knowledge?
2. **Location:** top-level `product-context/` in this repo (recommended), or a separate repo?
3. **Depth first:** money path only, or all 20 services up front?
