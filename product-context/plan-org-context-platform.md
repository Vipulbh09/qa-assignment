# Plan: an Organizational Context Repository

A proposal for a dedicated **context repo** that holds structured, versioned knowledge about an organization's systems, products, teams and tests, and for how employees and AI agents use it to find what is relevant to them.

Status: plan only. Nothing is built. It is written to show how this could be achieved, in phases, with the decisions and risks stated.

Labels used throughout:
- **[Given]** comes from the brief.
- **[Assumption]** is my guess about the organization. It needs validating.
- **[Recommendation]** is my proposal. It can be changed.

All example names (Acme, `svc-orders`, teams) are fictional and illustrate the shape of the data only.

---

## 1. Executive summary

**Problem.** Knowledge about how systems, products, teams and tests fit together is scattered across wikis, chat, tickets, code and people's heads. Employees spend time finding basics and asking colleagues. AI assistants fill the gaps with general knowledge, which is confident and often wrong for this particular organization.

**Proposal.** One dedicated Git repository, the *context repo*, holding typed YAML specs (systems, services, teams, test suites, coverage, features, use cases, business rules, glossary) with schemas, CI validation and a source and freshness record on every fact. People edit it by pull request. Employees and agents read it through simple, increasingly capable access layers: plain files, then a CLI, then a chat or IDE agent, and an API or MCP server only if needed.

**Value, in the order I expect it to appear:**
1. **Find things fast.** "Who owns this, what does it depend on, how do I run it, what tests cover it?" answered in seconds with a source.
2. **Better QA.** The right regression tests for a change, and visible coverage gaps.
3. **Trustworthy agents.** Answers that cite specs and say when information is missing.
4. **Onboarding and leadership visibility.** Faster ramp-up; ownership and documentation gaps measured, not guessed.

**Approach.** Start with the narrowest useful slice: engineering context for a handful of systems, serving one or two concrete use cases. Prove it with measurement. Add entity types and infrastructure only when a real question can't be answered.

---

## 2. Requirements, assumptions and unknowns

### Given [Given]
- A centralized, machine-readable, version-controlled knowledge repository.
- Two audiences: employees (engineers, QA, product, others) and AI agents.
- Candidate content: systems, repositories, services, teams, test suites, coverage mapping, dev environment, product areas, features, use cases, business entities, plans/entitlements, personas, glossary, sources of truth, documentation references, ownership and freshness.
- Typed specification files (YAML or similar), schemas, validation in CI, ownership and PR workflow, optional CLI, agent access that starts simple.
- The entity list is a candidate set, not mandatory.

### Assumptions to validate [Assumption]
- Code lives in Git and PR review is normal practice.
- The first and highest-value audience is engineering and QA; product context comes later.
- Teams will maintain specs only if something they care about consumes them (CI, a tool, an agent).
- Some documentation already exists (wiki, README files, service catalogue). The repo links to it and structures what matters; it does not copy it wholesale.
- There are enough systems (dozens, not two) that finding things is a real problem.

### Unknown, needs input
Listed in section 11.

---

## 3. Architecture

### Principles [Recommendation]
Structured over scattered. Authoritative over speculative. Store once, link elsewhere. Readable by people and parseable by tools. Governed but lightweight. Simplest access that works.

### Layers
```
  Existing sources          code repos, API contracts, CI results, wiki, tickets, service catalogue
        |   (generators for facts, humans for judgement)
  CONTEXT REPO              typed YAML + JSON Schemas + CI validation   <- the core
        |
  Access layers (add only when needed)
        1. Files + repo search
        2. CLI                 deterministic lookups
        3. Chat / IDE agent    uses the CLI and a retrieval skill
        4. API / MCP server    only if several clients need it
        5. Index / graph       only if relationship queries outgrow the CLI
        |
  Employees and agents      engineers, QA, product, support, leadership, automation
```

### Repository structure [Recommendation]
```
context-repo/
  schemas/        # one JSON Schema per entity type; the contract
  systems/        # system + service specs, one folder per system
  teams/          # teams, owners, escalation, channels
  testing/        # test suites, coverage mappings, known defects
  product/        # product areas, features, use cases, business rules   (phase 4)
  glossary/       # domain terms
  sources/        # source-of-truth registry
  tools/          # validate, lookup, generate, staleness check, CLI
  docs/           # contributor guide, readiness model, ADRs, agent retrieval guide
  CODEOWNERS
```
Not created until a use case needs it: `personas/`, plans/entitlements (unless the business has them), search index, graph, MCP server.

### Central repo or specs beside code? [Recommendation]
Start **central**: one place to search, validate and measure, and simple for a pilot. Revisit when many teams are contributing. The likely end state is **hybrid**: schemas and shared entities central, per-system specs in each system's repo (so the code owner owns the spec) and aggregated by tooling. This is a decision for stakeholders (section 11).

---

## 4. Prioritized entity model

Priority is by how directly an entity helps the first use cases (find owners and dependencies, find relevant tests).

| Priority | Entity | Why | Phase |
|---|---|---|---|
| P0 | System, Service, Repository | Anchor for everything | 1 |
| P0 | Team / Ownership | Who owns it, who to ask | 1 |
| P0 | Test Suite, Coverage Mapping | Test discovery and gap finding | 2 |
| P0 | Source of Truth and Freshness (fields on every entity, plus a registry) | Trust | 1 |
| P1 | Development Environment | Run it locally | 2 |
| P1 | Feature, Use Case, Business Rule | Link product behaviour to systems and tests | 4 |
| P1 | Known Defect | Regression targets and risk patterns | 2 to 4 |
| P2 | Business Entity, Glossary | Shared language, agent grounding | 4 |
| P3 | Plan / Entitlement, Persona | Only if the business has them | 5+ |

### Fields common to every entity [Recommendation]
```yaml
id: svc-orders                  # stable, unique, kebab-case
kind: service
title: Orders service
owner: team-orders              # required to leave 'draft'
status: draft | reviewed | deprecated
verified:
  level: verified-by-running | read-from-code | docs-only | inferred
  by: <person or tool>
  on: 2026-01-15
sources:                        # at least one above 'draft'
  - { type: code | api-contract | doc | ticket | test-run, ref: <path | URL | id> }
links:                          # typed relationships, never prose
  depends_on: []
  tested_by: []
  documented_in: []
```
**Absence rule.** A missing link means *unknown*, not *none*. A spec may assert completeness (`depends_on_complete: true`). Agents must not infer "no dependency" or "no test" from silence.

### Example specs (fictional)

**Service**
```yaml
id: svc-orders
kind: service
title: Orders service
owner: team-orders
system: sys-storefront
repo: repo-orders
language: go
api: { protocol: grpc, contract: "repo-orders:api/orders.proto" }
depends_on: [svc-inventory, svc-payments, svc-notifications]
depends_on_complete: true
tested_by: [suite-orders-api, suite-checkout-e2e]
dev_env: env-storefront-local
verified: { level: read-from-code, by: alice, on: 2026-01-15 }
sources: [{ type: code, ref: "repo-orders:cmd/orders/main.go" }]
```

**Test suite**
```yaml
id: suite-orders-api
kind: test_suite
title: Orders API tests
owner: team-qa-storefront
location: "repo-orders:tests/api"
run: "make test-api"
environments: [local, staging]
scope: { services: [svc-orders], features: [feat-place-order] }
type: automated
```

**Coverage mapping**
```yaml
id: cov-place-order
kind: coverage_mapping
covers: { feature: feat-place-order, rules: [rule-total-equals-sum-of-lines] }
automated: [suite-orders-api, suite-checkout-e2e]
manual: [tc-order-edge-cases]
gaps: ["no test for partial inventory availability"]
```

**Business rule**
```yaml
id: rule-total-equals-sum-of-lines
kind: business_rule
statement: "An order total equals the sum of line totals plus tax and shipping."
applies_to: [feat-place-order, feat-cart]
owner: team-product-storefront
```

**Source-of-truth registry**
```yaml
- topic: api-contracts
  authoritative: "the .proto / OpenAPI file in each service repo"
  rule: "specs reference it; they never hand-copy field lists"
- topic: ownership
  authoritative: "the HR / org directory"
- topic: test-results
  authoritative: "CI run artifacts"
```

---

## 5. Ownership, governance and contribution

| Concern | Rule [Recommendation] |
|---|---|
| Ownership | The team that owns the system or process owns its specs. The `owner` field is required; no owner means the spec stays `draft`. |
| Changes | Pull request. CODEOWNERS routes review to the owning team. |
| Automated checks | Schema validity; unique stable IDs; every link resolves; every `sources` ref exists; required fields per readiness level; no orphans; no secrets or personal data. |
| Generated vs curated | Anything derivable (API tables, dependency graphs, test inventories, ownership from the org directory) is generated and marked `generated: true`. People curate judgement: rules, risks, gaps. |
| Freshness | Each entity has `verified.on`. A scheduled job flags specs whose source changed after that date, or that exceed a maximum age, and opens an issue for the owner. |
| Conflicts | The source-of-truth registry decides. A spec that disagrees with its source is a defect in the spec. |
| Platform ownership | A small named maintainer group owns schemas, tooling and the contributor guide. |

### Readiness model (what "complete" means for a system)
| Level | Requires |
|---|---|
| L0 Registered | System id, owner, repo link |
| L1 Mapped | Services, dependencies (with completeness flag), docs links |
| L2 Testable | Test suites with run commands, coverage mapping, dev environment |
| L3 Product-aware | Features, use cases, business rules, known defects linked |
| L4 Agent-ready | All of the above reviewed, fresh, and passing the agent evaluation (section 9) |

Adoption is reported per system as its readiness level.

---

## 6. How employees find relevant things

The point of the repo is retrieval. These are the experiences, simplest first. Each calls the same underlying specs.

| Access | How it feels | Needs |
|---|---|---|
| **Browse and search** | Open the repo, search for a service or term, read a spec | Nothing but the repo |
| **CLI** `ctx` | `ctx show svc-orders`, `ctx owner svc-orders`, `ctx deps svc-orders`, `ctx tests-for --diff change.patch`, `ctx glossary "SKU"` | The `tools/` code |
| **Chat or IDE agent** | "Who owns checkout and what breaks if I change the payments API?" The agent calls the CLI, answers, cites spec IDs | A retrieval skill that tells the agent which commands and files to use |
| **PR bot** | On a pull request, comments with affected services, owners to tag, suggested test suites, and *unmapped* files | CI plus the CLI |
| **Dashboards** | Readiness, ownership gaps, stale specs, coverage gaps by team | The validator's output |
| **API or MCP** | Other tools and agents query the same lookups remotely | Only if several clients need it |

### How an agent should behave [Recommendation]
- Use the documented retrieval path; never load the whole repo.
- Prefer structured CLI lookups to free-text search.
- Respect the source-of-truth registry.
- Separate verified facts from inferred ones in the answer.
- Report conflicts and missing metadata; never resolve them silently.
- Never conclude "none" from absence.
- Always cite entity IDs.
- Recommend; do not change specs, tests or code without human approval.

---

## 7. Usage scenarios

**New engineer, first week.** `ctx show sys-storefront` lists its services, owners, dev environment and docs. `ctx env sys-storefront` prints how to start it locally. They skip a week of asking around.

**Developer planning a change.** "I'm changing the payments API." The agent runs `ctx impact svc-payments`: dependent services, owning teams to notify, the test suites that cover those paths, and any dependency marked incomplete so they know to double-check.

**QA picking tests.** `ctx tests-for --diff change.patch` returns suites mapped to the touched services and features, plus a list of touched files that map to nothing. That list is the gap report.

**QA designing new tests.** The agent loads the feature, its business rules, known defects and existing coverage, then proposes cases that cite those IDs and marks the ones already covered.

**Product manager.** "Which tests cover the checkout use case?" returns use case, features, systems and suites, with gaps stated.

**On-call engineer.** "Who owns `svc-notifications` and how do I escalate?" returns team, channel, escalation path and runbook link.

**Engineering lead.** A quarterly view of systems by readiness level, specs with no owner, stale specs and coverage gaps.

**Support or business analyst.** "What does 'entitlement' mean here and which features does the Pro plan include?" is answered from the glossary and plan entities, if the organization has them.

---

## 8. Roadmap, milestones and dependencies

No dates: team size and priorities are unknown.

| Phase | Deliverable | Exit criterion | Depends on |
|---|---|---|---|
| **0. Discovery** | Stakeholders, top 2 to 3 use cases, inventory of existing docs and catalogues, answers to section 11 | Use cases ranked; a sponsor and platform maintainers named | Stakeholder time |
| **1. Foundation** | Repo, schemas for P0 entities, validation in CI, contributor guide, readiness model; 3 to 5 representative systems specced | CI green; pilot teams reviewed their own specs | Phase 0 |
| **2. Testing and dev workflows** | Test suites and coverage mappings for the pilot systems; `ctx` CLI (`show`, `deps`, `owner`, `tests-for`, `validate`, `stale`); dev environment specs | `tests-for` selects the right suites on 5 past changes, checked by QA | Phase 1 |
| **3. Agent access** | Retrieval skill or instructions; chat or IDE agent over the CLI; PR bot | The with/without evaluation (section 9) shows measurable improvement | Phase 2 |
| **4. Product and business context** | Features, use cases, business rules, glossary, plans where relevant; use-case-to-test traceability | Top use cases trace feature to service to test | Phase 3 |
| **5. Scale-out** | A team outside the pilot onboards using only the contributor guide; adoption metrics; hybrid model decision | Onboarded unaided | Phase 4 |
| **6. Advanced access (conditional)** | MCP/API, index or graph | A written case showing the measured limit of the simpler layer | Phase 5 |

**Critical path:** phases 1 to 3. If phase 3's evaluation doesn't show clear gains, stop adding systems and fix the specs or retrieval first.

---

## 9. Success metrics and impact evaluation

Measure outcomes, not file counts.

| Metric | How measured |
|---|---|
| Systems at each readiness level | Validator output |
| Share of repos and services with a named owner | Validator |
| Share of features mapped to systems and test suites | Coverage mappings |
| Time for a new engineer to understand and run a system | Timed trial before and after |
| Time to identify relevant regression tests | 5 past changes, by hand vs `ctx tests-for` |
| **Agent accuracy with vs without the context** | Same questions, two arms, graded against known answers |
| Share of agent answers with valid source references | Evaluation harness |
| Wrong or invented services, owners and tests per 100 answers | Evaluation harness |
| Stale or conflicting specs | Staleness job |
| Weekly users and agent queries, by team | CLI and bot telemetry |

### Evaluation method [Recommendation]
Build a labelled question set from real tasks ("who owns X", "which suites cover this diff", "what depends on Y"). Run the agent **with** and **without** the context repo. Keep a held-out portion so tuning the specs to the questions doesn't inflate the score. Report sample sizes and uncertainty; small sets give wide error bars.

**Checkpoint.** After phase 3, compare against baselines. If the gain isn't clear, pause expansion.

---

## 10. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Specs go stale and mislead people and agents with confident wrong answers | Freshness checks, verified levels, generators for derivable facts |
| Maintenance burden; teams ignore it | Minimal required fields, specs close to the owning team, quick wins (CLI, PR bot) that make updating worthwhile |
| Over-modelling before a use case exists | Entities added on demand; P2 and P3 deferred |
| Agents treat missing data as "doesn't exist" | Completeness flags and the agent rules in section 6 |
| Model-written content introduces errors | Required citations, human review gate, `draft` status until reviewed |
| Competes with or duplicates an existing catalogue or wiki | Reference it as a source of truth; don't replace it without a decision |
| Sensitive information (secrets, personal or customer data) in specs | Content rules, secret scanning in CI, access control on the repo |
| Infrastructure built too early (MCP, graph, index) | Gate on a measured limit of the simpler layer |
| Evaluation flattered by leakage | Held-out questions; hide the answer entry under test |

### Trade-offs
- **Central vs beside-code.** Central is easier to search and govern; beside-code is more accurate. Start central, move to hybrid.
- **Generated vs curated.** Generated is accurate but shallow; curated is deep but decays. Generate facts, curate judgement.
- **Strict vs lenient schemas.** Strict makes tools reliable but slows contributors. Raise strictness with readiness level.

---

## 11. Open questions and decisions for stakeholders

### Questions
1. How many systems, teams and repos are there, and where does knowledge live today (wiki, service catalogue, tickets)?
2. Which use case ranks first: finding owners and dependencies, test selection, test generation, onboarding, or something else?
3. Is there an existing developer portal or catalogue that must remain the source of truth?
4. What are the confidentiality and access rules for what's stored and what agents may read?
5. Which agent runtime or assistant is standard, so the first access layer matches it?
6. Who sponsors this, and who maintains the platform?

### Decisions needed
- Pilot systems and sponsor.
- First use case and the baseline to measure against.
- Central, beside-code or hybrid repository model.
- Readiness level the pilot must reach, and by when.
- Whether this integrates with or supersedes existing documentation systems.
