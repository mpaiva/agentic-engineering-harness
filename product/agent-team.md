# The agent team — graph engineering, orchestrated by Atomic

The specialized agents that build HCM Graph, and how Atomic wires them into an **engineering graph**. Agents are named by **responsibility**, not model (the model is an implementation detail — see [agent naming](../herdr/workspace-conventions.md#name-agents-by-responsibility-not-by-model)). Each gets a **small context** and returns a **concise artifact**; Atomic carries the larger picture.

## The specialists

| Agent | Owns | Returns |
|-------|------|---------|
| **graph-modeler** | The domain graph: nodes, edges, constraints, temporal shape. | `product/design/schema.md` |
| **db-engineer** | The graph database: schema, constraints/indexes, migrations, seed generation. | migrations + seed + a run log |
| **query-specialist** | Graph traversals: reporting chain, span of control, org rollup, reorg impact. | tested query modules |
| **api-engineer** | The API over the graph (paradigm chosen in Phase 0). | endpoints/schema + contract tests |
| **frontend-engineer** | Directory, org-chart, and person views. | UI + component tests |
| **accessibility-specialist** | WCAG 2.2 AA; keyboard + screen-reader for the org chart. | a11y report + fixes |
| **test-engineer** | Unit / integration (real DB) / e2e coverage. | test suites + results |
| **verifier** | *Fresh-context* check of invariants, queries, a11y, and the diff — from evidence, not claims. | pass/fail + findings |

Plus the standing roles from the harness: **research**, **planner**, **integration**, and review gates for **architecture** and **security**.

## The engineering graph (how Atomic orchestrates them)

```text
Phase 0  Research ─ fan-out ─┬─ graph-db options
                             ├─ API paradigm (GraphQL vs REST over a graph)
                             ├─ UI + org-chart library
                             └─ accessible-org-chart approach
                                    │ synthesize
                             ▼  ┌── HUMAN GATE: approve stack ──┐

Phase 1  graph-modeler → schema.md
                             ▼  ┌── HUMAN GATE: approve model ──┐

Phase 2  Implement ─ parallel ─┬─ db-engineer (schema + constraints + seed)
                               ├─ query-specialist (traversals)
                               ├─ api-engineer (API over the graph)
                               ├─ frontend-engineer (directory · org chart · person)
                               └─ test-engineer (tests)
                                    │ integrate

Phase 3  Verify ─ parallel ─┬─ invariants (no cycles · one holder · one org unit …)
                            ├─ query correctness (chains · span · rollup)
                            ├─ accessibility (axe + keyboard walkthrough)
                            └─ e2e
                                │  bounded repair (max 3) ── fresh verifier
                            ▼  ┌── HUMAN GATE: final review → PR ──┐
```

Two rules from the harness shape this graph:

- **Independent verification.** The agents that wrote the graph, queries, and UI do not get to declare them correct. A fresh-context **verifier** re-derives correctness from evidence (real seed data, real queries, real a11y runs). See [verification-and-gates.md](../docs/verification-and-gates.md).
- **Bounded loops.** Repair runs at most 3 cycles, then escalates to a human with evidence. No open-ended "keep fixing until it works."

## Where the agents run

Each phase is an Atomic stage; Atomic fans out its own sub-agents inside one run (on your Claude subscription). Herdr keeps that run organized and alive; you follow progress with `/workflow status` and the run ledger. (Herdr's colored status does not yet read Atomic — a known gap, see [herdr/atomic-integration.md](../herdr/atomic-integration.md).)

## Mapping to workflows

- **Phase 0** → [`atomic/workflows/hcm-stack-research.ts`](../atomic/workflows/hcm-stack-research.ts) — run, stack **approved**.
- **Phase 1** → [`atomic/workflows/hcm-model-design.ts`](../atomic/workflows/hcm-model-design.ts) — run, model **approved** ([schema.md](design/schema.md)).
- **Phases 2–3** → [`atomic/workflows/hcm-feature-build.ts`](../atomic/workflows/hcm-feature-build.ts) — authored now the stack is approved, so its stages name the real tools (Neo4j 5 CE · tRPC/zod · React Router 7 + Vite · React Aria `Tree` · Testcontainers · axe + Playwright). **Run-time prerequisite:** the integration + e2e evidence needs a container runtime (Docker) for a real Neo4j; see [artifacts/phase-2-run-notes.md](artifacts/phase-2-run-notes.md).
