# Organizational Context Repository

A dedicated repository that holds structured, version-controlled knowledge about how the organization's software, products, teams and tests fit together. It is written for two audiences: **employees** and the **AI agents** that help them.

## What the repo contains

Typed YAML specs, each with an owner, a source and a last-verified date, checked by CI.

| Area | What it describes |
|---|---|
| **Systems and services** | What each system does, its repositories, services, dependencies and how to run it locally |
| **Teams and ownership** | Who owns what, how to escalate, which channel to use |
| **Testing** | Test suites and how to run them, which services and features they cover, known coverage gaps |
| **Product** | Product areas, features, use cases, business rules, plans and entitlements |
| **Glossary** | Standard definitions of domain terms |
| **Sources of truth** | Which document or system is authoritative for each topic |
| **Schemas and tools** | Validation rules, plus a lookup CLI and checks for stale or incomplete specs |

It links to existing documentation instead of copying it. The entity types are a starting set, to be adjusted to the organization's real needs.

## How it benefits employees

| Who | Benefit |
|---|---|
| **Developers** | Find owners, dependencies and architecture in seconds. Set up a local environment from one spec. See which teams a change affects. |
| **QA** | Find the test suites for a service or change, spot coverage gaps, and generate tests grounded in real features and business rules. |
| **Product and business** | See how features and use cases map to systems and tests. Use one set of definitions for shared terms. |
| **New joiners** | Ramp up from a single trusted place instead of asking around. |
| **Leadership** | See where ownership, documentation or coverage is missing. |
| **AI assistants** | Answer from verified, cited facts instead of guessing, and say when information is missing. |

## How people use it
Open the repo and search it, run a CLI lookup (`ctx owner svc-orders`, `ctx tests-for <change>`), or ask a chat or IDE assistant that reads the specs and cites them.

## Starting small
Begin with a few representative systems and one or two use cases, such as finding owners and dependencies, and picking relevant tests. Measure whether it saves time and improves answers, then expand.
