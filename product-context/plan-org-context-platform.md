# Plan: an organizational context platform, and where product context goes next

Status: draft for discussion. Nothing here is built.

How to read the labels:
- **[Confirmed]** is true today and can be checked in this repo or in what you told me.
- **[Assumption]** is something I had to guess. It needs validating before it drives a decision.
- **[Recommendation]** is my proposal. It can be changed.

Relationship to [`plan.md`](plan.md): that plan builds a product-context pack for one system (the OpenTelemetry Astronomy Shop) so a test-case generation agent can use it. This plan is the next step. It generalises that pack into a platform an organization can run for all of its systems, and it uses the shop pack as the pilot.

---

## 1. Executive summary

**The problem.** Knowledge about how systems, products, teams and tests fit together lives in docs, Slack threads, spreadsheets and people's heads. Engineers, QA and now AI agents all pay for that. People lose time finding basics, and agents guess from general knowledge when they should read the facts.

**The proposal.** A version-controlled repository of typed, validated specification files (YAML plus schemas) that describe systems, services, owners, test suites, coverage, features, use cases, business rules and sources of truth. Humans read and edit it through normal pull requests. Tools and agents read the same files through a small lookup layer. Each fact says where it came from and when it was last verified.

**Business value, in the order I'd expect it to show up:**
1. QA: given a change or a feature, the right regression tests and the right new test ideas are found in minutes, not by asking around.
2. Agents: answers and generated tests cite specs instead of guessing, which can be measured.
3. Engineering: ownership, dependencies and local setup are discoverable.
4. Leadership: gaps in ownership, coverage and documentation are visible as numbers.

**Approach.** Start small and prove value on one use case (test generation and test selection for one system). Add entity types, tools and infrastructure only when a real use case demands them.

---

## 2. What is confirmed, assumed and unknown

### Confirmed
- The repo is a QA assignment against the OpenTelemetry Astronomy Shop demo, pinned to upstream commit `ac0443b` in `.demo/`.
- It already holds structured knowledge that the platform would formalise: 11 defect reports in `bugs/`, 11 manual test cases in `test-cases/`, a risk-based `test-strategy.md`, and a Playwright suite in `automation/` (49 tests, page-object structure, CI gate for known defects).
- It already has an agent pattern to reuse: `agentic/` (Claude Code login via `claude -p`, schemas, prompts as files, a labelled eval set).
- You want a test-case generation agent to use product context to identify test cases ([`plan.md`](plan.md)).

### Assumptions to validate
- **[Assumption]** The "organization" is a real or hypothetical engineering organization with many systems and teams. Nothing in this repo describes one. Every organization-level detail below is generic until you supply facts.
- **[Assumption]** QA and quality engineering is the first and most valuable audience, because that is the work this repo shows.
- **[Assumption]** Source code is in Git, and pull-request review is already normal practice.
- **[Assumption]** Teams will keep specs up to date only if the specs are used by something they care about (CI, an agent, a tool). Documentation nobody consumes decays.

### Unknown, needs stakeholder input
See section 10.

---

## 3. Architecture and repository structure

### Principles [Recommendation]
Structured over scattered. Authoritative over speculative. Store a fact once and link to it. Human-readable and machine-readable. Governed but lightweight. Start with files, not infrastructure.

### Layers
```
 Sources of truth        code, protos, compose, flag config, docs, tickets, test results
        |  (generators + human curation)
 Spec repository         typed YAML + schemas + validation in CI        <- the platform's core
        |
 Access layer            1) files + search   2) CLI lookup   3) MCP/API (only if needed)
        |
 Consumers               engineers, QA, product, test-gen agent, triage agent, CI
```

### Repository layout [Recommendation]
Adapted from the concept: only directories with a Phase 1-3 use are included.

```
context/
  schemas/            # one JSON Schema per entity type (the contract)
  systems/            # system + service specs
  teams/              # ownership, escalation
  testing/            # test suites, coverage mappings, known defects
  product/            # features, use cases, business rules, entitlements (later phase)
  glossary/           # domain terms
  sources/            # source-of-truth registry (what is authoritative for what)
  tools/              # validate, lookup, generate, staleness check
  docs/               # contributor guide, readiness model, ADRs
```
Not created until needed: `personas/`, knowledge graph, search index, MCP server.

### Where this sits relative to the current repo
**[Recommendation]** Keep the pilot inside this repo as `product-context/` (per `plan.md`), shaped exactly like one system's slice of the layout above. When a second system exists, extract the schemas and tools into a shared repo and keep per-system specs next to each system's code. That makes the owner of the code the owner of the spec.

---

## 4. Prioritized entity model

Priority is by how directly an entity feeds the first use case (QA test selection and generation).

| Priority | Entity | Why | Phase |
|---|---|---|---|
| P0 | **System**, **Service** | Anchor for everything else | 2 |
| P0 | **Team / Ownership** | Who to ask, who reviews | 2 |
| P0 | **Test Suite**, **Coverage Mapping** | Core of test selection and gap finding | 2 |
| P0 | **Source of Truth**, **Freshness** (a field on every entity, not a separate type) | Makes facts trustworthy | 2 |
| P1 | **Feature**, **Use Case** | Links product behaviour to systems and tests | 3 to 5 |
| P1 | **Business Rule / Invariant** | What must always hold; the richest source of test ideas | 3 |
| P1 | **Known Defect** | Patterns to avoid repeating; regression targets | 3 |
| P1 | **Feature Flag / Fault Injection** | Testability hooks | 3 |
| P2 | **Business Entity**, **Glossary** | Shared language, agent grounding | 5 |
| P2 | **Development Environment** | Local setup via tooling | 3 to 6 |
| P3 | **Plan / Entitlement**, **Persona** | Only where the organization has them | 5+ |

Entities not in this list should be added only when someone asks a question the model cannot answer.

### Common fields (every entity) [Recommendation]
```yaml
id: <kebab-case, globally unique, stable>
kind: <entity type>
title: <human name>
owner: <team id>
status: draft | reviewed | deprecated
verified:
  level: verified-by-running | read-from-code | docs-only | inferred
  by: <person or tool>
  on: <date>
sources:            # at least one for anything above 'draft'
  - type: code | proto | doc | ticket | test-run
    ref: <path:line | URL | id>
    commit: <sha, where applicable>
links:              # relationships; always typed, never prose
  depends_on: []
  tested_by: []
  documented_in: []
```
**Important rule:** an absent link means *unknown*, not *none*. Specs may say `depends_on_complete: true` to assert that the list is exhaustive. Agents must not treat missing metadata as proof that a dependency does not exist.

### Example schemas (illustrative, using this repo's pilot)

**System / Service**
```yaml
id: svc-checkout
kind: service
title: Checkout service
owner: team-shop-checkout          # [Assumption] placeholder team
system: sys-astronomy-shop
language: go
api:
  protocol: grpc
  contract: { ref: .demo/pb/demo.proto, commit: ac0443b }
depends_on: [svc-cart, svc-currency, svc-payment, svc-shipping, svc-product-catalog, svc-email]
depends_on_complete: true
flags: [paymentFailure, ...]       # linked to flag entities
tested_by: [suite-playwright-api, suite-playwright-ui, tc-chk-01]
verified: { level: read-from-code, by: vipul, on: 2026-10-28 }
sources: [{ type: code, ref: ".demo/src/checkout/main.go" }]
```

**Test Suite**
```yaml
id: suite-playwright-api
kind: test_suite
title: Playwright API tests
owner: team-qa
location: automation/
run: "cd automation && npm test"
environments: [local-docker, ci]
scope: { services: [svc-checkout, svc-currency, svc-cart, svc-payment] }
stability: { flaky_policy: "1 retry, labelled in report" }
```

**Coverage Mapping**
```yaml
id: cov-checkout-multi-currency
kind: coverage_mapping
covers: { feature: feat-checkout, rules: [rule-total-equals-sum-of-parts] }
by:
  automated: [pw-api-checkout-total]
  manual:    [tc-chk-02]
gap: "no test for unsupported currency code at checkout"   # this one is a known S1 defect area
```

**Business Rule / Invariant**
```yaml
id: rule-price-shown-equals-price-charged
kind: business_rule
statement: "The price shown for a product equals the price used in the cart and at checkout."
applies_to: [feat-product-display, feat-cart, feat-checkout]
violated_by: [defect-currency-price-shift]
verified: { level: verified-by-running, on: 2026-10-18 }
```

**Known Defect**
```yaml
id: defect-currency-unsupported-zero
kind: known_defect
severity: S1
component: svc-currency
pattern: "unvalidated input silently yields a zero value that downstream treats as valid"
regression_test: pw-api-currency-unsupported
report: bugs/<file>.md
```
Fields and IDs above are examples to show the shape, not a verified export of this repo's real IDs. Phase 2 generates them from the real files.

**Source of Truth registry**
```yaml
- topic: api-contracts
  authoritative: ".demo/pb/demo.proto"
  consumers: [svc-*]
  rule: "specs derive from this; never hand-copy field lists"
- topic: known-defects
  authoritative: "bugs/"
- topic: test-results
  authoritative: "CI run artifacts (Playwright results.json)"
```

---

## 5. Ownership, governance and contribution

**[Recommendation]**

| Concern | Rule |
|---|---|
| Who owns a spec | The team that owns the code or process it describes (`owner` field, required). No owner means the spec cannot leave `draft`. |
| How changes land | Pull request. CODEOWNERS routes review to the owning team. |
| What CI checks | Schema validity; unique and stable IDs; every link resolves; every `sources` ref exists (file exists, URL not 404); required fields by readiness level; no orphan entities. |
| Where specs live | Next to the code they describe when possible; schemas and shared entities in the central repo. |
| Generated vs curated | Anything derivable (API tables, dependency graphs, flag lists, test inventory) is generated and marked `generated: true`. Humans curate only judgement: rules, risks, failure modes. |
| Freshness | Each entity has `verified.on`. A scheduled job flags entities whose source files changed after that date or that exceed a max age. |
| Conflicts | The source-of-truth registry decides. A spec that disagrees with its authoritative source is a defect in the spec. |

### Readiness model (what "complete" means for a system)
| Level | Requires |
|---|---|
| L0 Registered | System id, owner, repo link |
| L1 Mapped | Services, dependencies (with `depends_on_complete`), docs links |
| L2 Testable | Test suites with run commands, coverage mapping, testability notes |
| L3 Product-aware | Features, use cases, business rules, known defects linked |
| L4 Agent-ready | All of the above `reviewed`, fresh, and passing the agent eval (section 7) |

Adoption is reported per system as its readiness level.

---

## 6. Roadmap, milestones and dependencies

Phases follow the concept document, adjusted to start from what already exists. No dates, because team size and priorities are unknown.

| Phase | Deliverable | Exit criterion | Depends on |
|---|---|---|---|
| **0. Discovery** | Stakeholders, top 3 use cases, inventory of existing docs and metadata, answers to section 10 | Use cases ranked; a named owner for the pilot | Stakeholder time |
| **1. Pilot spec set** (= `plan.md` phases 1 and 2) | Schemas for P0 entities; generators for proto, compose, flags, test inventory; deep specs for the shop's money path; validation in CI | CI validates the pack; money-path specs reviewed | Phase 0 decisions |
| **2. Developer and QA tooling** | `ctx` CLI: `lookup`, `deps`, `owner`, `tests-for <service|file|diff>`, `validate`, `stale` | `tests-for` picks the known regression tests for a sample change | Phase 1 |
| **3. Agent integration** (= `plan.md` phase 4) | Test-gen agent and triage agent read the pack through tiered loading; skill/instructions for retrieval path | With/without eval shows measurable gain (section 8) | Phase 2 |
| **4. Product and business layer** | Features, use cases, rules, glossary, entitlements where relevant; coverage mapping from use case to tests | Each top use case traces feature to service to test | Phase 3 |
| **5. Second system** | A different system onboarded by its own team using only the contributor guide | Onboarded without help from the platform author | Phase 4 |
| **6. Scale** | Org-wide adoption metrics; MCP/API or search index **only if** file/CLI access proves insufficient | A written case showing the measured limit of the simpler approach | Phase 5 |

**The critical path** is phase 1 into phase 3. Everything after it is optional until phase 3 shows the pack changes outcomes.

---

## 7. Integrating developer tooling, QA workflows and AI agents

### Access pattern, simplest first [Recommendation]
1. **Files + search.** Agents and people read YAML directly. This works on day one.
2. **CLI (`ctx`).** Deterministic queries that agents can call as a tool: `ctx tests-for --diff <patch>`, `ctx deps svc-checkout`, `ctx owner svc-currency`. This gives agents structured answers instead of grep.
3. **MCP server or API.** Wrap the CLI only when multiple clients or remote use justify it.
4. **Index or graph.** Only when relationship queries get too slow or complex for the CLI. Not before.

### QA workflow
- **Test selection:** a diff maps to files, services, features and the suites that cover them (`tests-for`). The result lists suites, the coverage-mapping entries used and any *unmapped* files, so gaps are visible instead of silently ignored.
- **Test generation:** the agent loads Tier 0 (index, rules), Tier 1 (slices selected by tags from the diff or requirement) and Tier 2 on demand, as in `plan.md`. Output must cite entity IDs.
- **CI triage:** the existing triage agent gets the owner, known defects and flag state for the failing test's service, so a classification can cite "known defect X" or "owner is Y".
- **Gap reports:** coverage mappings with a `gap` or no tests become a prioritised backlog.

### Developer workflow
- Ownership and dependency lookup replaces asking in chat.
- Local environment specs (run commands, ports, flags, test data) feed the setup scripts, instead of the scripts holding the knowledge. In this repo, `scripts/start-demo.sh` and the pinned `DEMO_REF` are the first candidates to be driven from a spec.

### Agent rules (go into the retrieval skill) [Recommendation]
- Follow the documented retrieval path; do not load the whole repo.
- Respect the source-of-truth registry.
- Separate `verified` from `inferred` in every answer.
- Report conflicts and missing metadata instead of resolving them silently.
- Never conclude "no dependency" or "no test" from absence alone.
- Propose; do not write to specs or tests without human approval.

---

## 8. Concrete usage examples

**Engineer, new to the shop's checkout:** `ctx show svc-checkout` returns owner, dependencies, flags, tests and known defects. Nothing is searched for by hand.

**QA, a PR changes `.demo/src/currency/`:** `ctx tests-for --diff pr.patch` returns: currency API tests (automated), manual cases TC-CHK-02 and the payment cases, five known currency defects flagged as regression targets, and one unmapped file reported as a gap.

**Test-gen agent, "generate tests for multi-currency checkout":** it loads the checkout and currency specs, the rule *price shown equals price charged*, the unsupported-currency defect pattern and the existing coverage mapping. It proposes boundary cases, an unsupported code, a zero-decimal currency, plus a fault-injection case via a flag. Each proposed case cites entity IDs, and cases already covered are marked as duplicates.

**Triage agent, a checkout test fails with 504s:** it checks the environment spec and the known-defect list before deciding; the owner is attached to the report.

**Product manager, "which tests cover the checkout use case?":** use case, features, coverage mapping and suites, in one traced answer. Gaps are shown explicitly.

**Engineering lead, quarterly review:** a table of systems by readiness level, owners missing, and stale specs.

---

## 9. Success metrics and impact evaluation

Measure outcomes, not file counts.

| Metric | Baseline needed | Source |
|---|---|---|
| Systems at each readiness level | None (start at 0) | Validator |
| Repos/services with a named owner | Inventory in phase 0 | Validator |
| Features mapped to systems and tests | Phase 4 | Coverage mappings |
| Time for a new engineer to run a system | Measure once before and after | Onboarding trial |
| Time to find relevant regression tests | Measure by hand on 5 past changes | `tests-for` vs manual |
| **Agent accuracy with vs without context** | Run both arms on the same inputs | Eval harness |
| Share of agent answers with valid source refs | n/a | Eval harness |
| Hallucinated endpoints/flags/services per 100 cases | Without-context arm | Eval harness |
| Recall of known defects by generated tests | Held-out defect set | Eval harness |
| Stale or conflicting specs | n/a | Staleness job |
| Adoption: distinct users/agents querying per week | n/a | CLI telemetry |

**Evaluation method [Recommendation].** Reuse the `agentic/evals` approach: a labelled case set, an ablation (with vs without the pack), and a held-out split so tuning the pack to the cases does not inflate the score. Hide a defect's own entry when measuring recall of that defect. Report the sample sizes; the triage eval already shows that small sets give wide error bars.

**Kill/continue checkpoint.** If after phase 3 the with-context arm is not clearly better, stop expanding and fix the pack or the retrieval before adding systems.

---

## 10. Risks, trade-offs, open questions and decisions

### Risks and mitigations
| Risk | Mitigation |
|---|---|
| Specs rot and mislead agents with confident wrong facts | Freshness checks in CI, `verified` levels, generators for anything derivable |
| Maintenance burden causes teams to ignore it | Specs live next to code, minimal required fields, value delivered early through the CLI and CI |
| Over-modelling before there is a use case | Entity types added only on demand; P2/P3 deferred |
| Agents treat missing data as "does not exist" | Explicit `*_complete` flags and the agent rules in section 7 |
| LLM-written narrative introduces errors | Source citations required; human review gate; `draft` status until reviewed |
| Leaking test answers into the eval makes results look better than they are | Held-out split; hide the entry under test |
| Confidential content (PII, secrets, customer data) in specs | Content rules in the contributor guide; secret scanning in CI [Assumption: needed in a real org] |
| Tooling sprawl (MCP, graph, index) built too early | Gate on a written, measured limit of the simpler layer |

### Trade-offs
- **Central repo vs specs beside code.** Central is easier to search and govern; beside-code keeps specs accurate. Recommended: schemas central, specs beside code, once there is more than one system.
- **Generated vs curated.** Generated is accurate but shallow; curated is deep but decays. Recommended: generate the facts, curate the judgement.
- **Strict vs lenient schemas.** Strict gives reliable tools but slows contributors. Recommended: strictness rises with readiness level.

### Open questions (need your input)
1. Is the target a real organization or the assignment as a demonstration? If real, how many systems, teams and repos? What documentation and metadata already exist, and where?
2. Who are the stakeholders and the first sponsor? Who owns the platform itself?
3. Which use case ranks first: test generation, test selection, triage, onboarding, or something else?
4. Is the shop pilot the right pilot, or should a second, more representative system come first?
5. Is there an existing service catalogue or documentation system (a developer portal, wiki or CMDB) that must stay the source of truth, in which case this platform references it rather than replacing it?
6. What are the data-sensitivity and access constraints for specs and for what agents may read?
7. Which agent runtime and access method is standard (Claude Code, an internal agent, an IDE assistant)? That decides whether a skill, CLI or MCP server comes first.

### Decisions needed from stakeholders
- Pilot system and sponsor.
- Top use case and the baseline to measure against.
- Repository model: central, beside-code, or hybrid.
- Readiness level the pilot must reach, and by when.
- Whether this platform supersedes or integrates with existing documentation systems.
