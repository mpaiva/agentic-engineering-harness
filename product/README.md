# HCM Graph — the product

A Human Capital Management product built **from scratch**, graph-native, by a team of specialized agents that [Atomic](../atomic/README.md) orchestrates as an engineering graph. This folder is the product and its project docs; the workflows that build it live in [`atomic/workflows/`](../atomic/workflows/).

This is the harness ([agentic-engineering-harness](../README.md)) pointed at a real product — the [operating model](../docs/operating-model.md) applied end to end.

## Read these first

1. **[PROJECT.md](PROJECT.md)** — the contract: goal, scope, constraints, verification, gates, and the roadmap.
2. **[domain-graph.md](domain-graph.md)** — the HCM graph model (nodes, edges, invariants) for the first slice.
3. **[agent-team.md](agent-team.md)** — the specialist agents and how Atomic wires them into an engineering graph.

## First slice

**Core HR — people + org graph:** an employee directory, a keyboard-navigable org chart, and a person view, backed by a real graph database and served by an API — with graph invariants enforced and WCAG 2.2 AA accessibility. Full definition in [PROJECT.md](PROJECT.md#first-slice--core-hr-people--org-graph).

## Where we are

**Phase 0 — Research (next action).** Nothing is built yet. The first step is to let an Atomic workflow research and recommend the stack, then stop for your approval.

### Run Phase 0

From a pane (inside Herdr, or a plain terminal), with Atomic logged in to your Claude subscription:

```bash
cd ~/git-repos/agentic-engineering-harness
./scripts/sync-workflows.sh    # makes the repo's workflows discoverable by Atomic
atomic
```
then, inside Atomic:
```text
/workflow reload
/workflow hcm-stack-research
```

It fans out four research branches (graph DB · API · UI/org-chart · accessibility), writes them under `product/research/`, synthesizes `product/research/stack-recommendation.md`, and **stops at a human gate** for you to approve the stack. Follow progress with `/workflow status`.

After you approve: **Phase 1** finalizes the graph schema (`product/design/schema.md`, another gate), then **Phase 2** builds the slice in parallel and **Phase 3** verifies it. See the [roadmap](PROJECT.md#roadmap).

## Layout (grows as we build)

```text
product/
├── README.md          ← you are here
├── PROJECT.md         ← the contract
├── domain-graph.md    ← the graph model
├── agent-team.md      ← specialists + orchestration
├── research/          ← Phase 0 output (stack recommendation)
├── design/            ← Phase 1 output (finalized schema)
└── artifacts/         ← verification evidence
```
