# HCM Graph — project definition

A Human Capital Management (HCM) product built **from scratch**, on a **graph data model**, by a team of **specialized agents** that Atomic orchestrates as an **engineering graph**. This file is the contract: it defines what we are building and how we will know it works. Every workflow and agent reads from it.

Built with the [agentic-engineering-harness](../../README.md) operating model — see the [six responsibilities](../../docs/operating-model.md#every-autonomous-task-defines-six-things).

## Why graph

HCM data *is* a graph: people → managers → positions → org units → jobs → locations → skills. The questions that matter are traversals — reporting chains, span of control, reorg impact, matrix relationships — which are natural on a graph and awkward in flat tables. So the product is graph-native, and the agent team is organized as a graph too. See [domain-graph.md](domain-graph.md).

## First slice — Core HR: people + org graph

We build **one vertical slice end to end** before widening. Everything else (time, performance, recruiting, benefits) hangs off this backbone.

### Goal (what must be TRUE when the slice is done)

An HR admin or engineer can, against a real graph database served by an API in an accessible web UI:

1. Browse an **employee directory** (search by name, filter by org unit / location).
2. Open an **org chart** and navigate reporting lines up and down, by keyboard.
3. Open a **person** and see their manager, direct reports, position, job, and org unit.
4. Trust the data because **graph invariants are enforced** (see Verification).

### Scope

**In:** Person, Position, Job, OrgUnit, Location nodes and the relationships between them; the graph schema + constraints; a read API; directory + org-chart + person UI; seed data for a realistic ~200-person company.

**Out (later slices):** write/edit flows beyond seed, authn/authz, payroll, time, performance, benefits, recruiting, historical/temporal effective-dating UI (the *model* supports temporality; the first UI reads "as of today").

### Context

- Domain model: [domain-graph.md](domain-graph.md).
- Agent team and orchestration: [agent-team.md](agent-team.md).
- Reporting structure lives on **positions**, not people, so it survives people changes (a common, robust HCM pattern). A person↦manager view is derived.

### Constraints

- **Graph-native.** Core relationships are graph edges, queried as traversals — not reconstructed from join tables.
- **Accessibility is a build stage, not cleanup.** WCAG 2.2 AA; the org chart must be fully keyboard-navigable and screen-reader-sensible (org charts are notoriously inaccessible — this is a first-class requirement, see [verification-and-gates.md](../../docs/verification-and-gates.md#ux-and-accessibility-are-verification-layers-not-cleanup)).
- Follow the stack chosen in Phase 0; add no dependencies without approval.
- Small, reviewable changes; artifacts over conversational memory.

### Verification (how we know it works — evidence, not claims)

- **Graph invariants** (enforced by DB constraints + tested): no cycles in `REPORTS_TO`; at most one active holder per position; every active position sits in exactly one org unit; every person with an active position has exactly one manager (or is a root, e.g. CEO).
- **Graph queries** return correct results: full reporting chain up/down, span of control, all-reports-transitively.
- Compile + typecheck + unit + integration (against a real graph DB) + **browser/e2e** pass.
- **Accessibility**: automated axe pass + a scripted keyboard walkthrough of the org chart.
- Independent, fresh-context verifier signs off from evidence (Atomic author/verifier separation).

### Approval (human gates)

Stop for a human at: **stack choice** (Phase 0), **domain model** (Phase 1), **final review** before PR (Phase 3). Plus the standing gates where cost is high: architecture, accessibility, security.

## Roadmap

| Phase | What | Output | Gate |
|-------|------|--------|------|
| **0 · Research** | Propose the stack (graph DB, API paradigm, UI + org-chart lib, a11y approach) | `examples/hcm-graph/research/stack-recommendation.md` | **Approve stack** |
| **1 · Model** | Finalize the graph schema + constraints + seed plan | `examples/hcm-graph/design/schema.md` | **Approve model** |
| **2 · Build** | Parallel: DB + constraints, graph queries, API, directory/org-chart UI, tests | working slice + evidence | — |
| **3 · Verify** | Graph invariants, queries, a11y, e2e; bounded repair | `examples/hcm-graph/artifacts/evidence.md` | **Final review → PR** |

Phase 0 runs the [`hcm-stack-research`](../../atomic/workflows/hcm-stack-research.ts) Atomic workflow. Later phases specialize the [`feature-development`](../../atomic/workflows/feature-development.ts) shape with the [agent team](agent-team.md).

## Status

**All four phases complete — the Core-HR slice is built, independently verified against a real graph DB, and human-approved.** **Phase 0 (stack)** approved — [stack-recommendation.md](research/stack-recommendation.md) (Neo4j Community · tRPC · React Router 7 + Vite · ARIA `tree` org chart · Docker Compose + Testcontainers). **Phase 1 (model)** approved — [schema.md](design/schema.md) (Neo4j 5 CE constraints/guards, marquee traversals, ~200-person seed plan). **Phases 2–3** ran [`hcm-feature-build`](../../atomic/workflows/hcm-feature-build.ts): the slice lives under [`app/`](app/) (server = tRPC + Neo4j repository, web = React Router 7 + React Aria `tree` org chart, e2e = Playwright + axe). Evidence at [examples/hcm-graph/artifacts/evidence.md](artifacts/evidence.md): tsc clean; 57 server + 24 web unit; **47 integration against real Neo4j**; the five §6 invariants each return 0 rows; the four §5 traversals correct on the seed; Playwright 9/9 incl. the org-chart keyboard walkthrough; **axe WCAG 2.2 AA = 0 violations** on all three views — 0 repair cycles, approved at the final gate. To build/run locally: Docker via Colima, then `cd examples/hcm-graph/app && npm install && npm run db:up && npm run migrate && npm run seed && npm run dev` (see [artifacts/phase-2-run-notes.md](artifacts/phase-2-run-notes.md)). Next: widen beyond Core HR (time, performance, recruiting) on this backbone, or open a PR (`hcm-feature-build create_pr=true`, once a remote is authorized).
