# Phase 2–3 — run notes and the environment gap

Phase 2 (build) and Phase 3 (verify) are encoded in
[`atomic/workflows/hcm-feature-build.ts`](../../atomic/workflows/hcm-feature-build.ts). This note records
what was done autonomously, why the build was **not executed to a "working slice + evidence" here**, and
exactly how to run it for real. Per [AGENTS.md](../../AGENTS.md): *ground truth over assumption; do not
fabricate evidence; label future/not-implemented clearly.*

## What is done

- The Phase 2–3 workflow is authored, synced, and discovers cleanly in Atomic (module + input schema valid).
- It specializes the reference `feature-development` shape with the named specialists from
  [agent-team.md](../agent-team.md) and pins the **real** tools now that Phase 0/1 are approved:
  Neo4j 5 Community · tRPC + zod (Hono) · React Router 7 + Vite · React Aria `Tree` · Neo4j Testcontainers ·
  axe + Playwright · vitest + tsc.
- Every stage is grounded in the approved artifacts ([PROJECT.md](../PROJECT.md),
  [schema.md](../design/schema.md), [stack-recommendation.md](../research/stack-recommendation.md),
  [domain-graph.md](../domain-graph.md)); it carries independent fresh-context verification, a bounded repair
  loop (max 3, unrolled/DAG-safe), and the Phase-3 final-review human gate.

## Why the build was not executed in this environment

Two hard blockers, both of which make a literal build here either unverifiable or out of the repo's stated scope:

1. **No container runtime.** This environment has Node 22 + npm but **no Docker** (`docker` not found), so
   Neo4j cannot run. The approved evidence contract — integration tests against a **real** graph DB
   (Testcontainers) and Playwright e2e — cannot produce real results. Building the app and reporting those as
   passing would be **fabricated evidence**, which the harness forbids. The workflow's automated-verification
   stage is written to record such a gap as `UNVERIFIED` rather than claim a pass, and the independent verifier
   treats an unverified real-DB/e2e check as **failing** — so a run here would (correctly) escalate as blocked,
   not produce a trustworthy slice.
2. **The repo is intentionally not an app project.** [AGENTS.md](../../AGENTS.md): *"this repo is
   intentionally not an npm/cargo project… do not add runtime dependencies or package manifests without being
   asked."* Scaffolding the full `app/` workspace (package manifests, `node_modules`, a `docker-compose.yml`) is
   exactly that kind of change. `hcm-feature-build.ts` is written as that authorization boundary: running it is
   the deliberate act of turning the worked example into runnable code.

Missing tooling observed: `docker` (blocker), `pnpm`, `bun` (npm is sufficient).

## How to run it for real

In a **Docker-capable** environment with Node 22:

```bash
cd agentic-engineering-harness
./scripts/sync-workflows.sh            # make workflows discoverable
atomic                                  # logged in to your Claude subscription
# inside atomic:
/workflow reload
/workflow hcm-feature-build             # defaults target the approved slice
```

The run fans out the specialists into `app/` (`server/` tRPC + Neo4j repository, `web/` React Router 7 + Vite,
`test/` Testcontainers), integrates, records evidence to `product/artifacts/evidence.md`, runs a fresh
independent verifier, repairs up to 3 cycles, and **stops at the final-review gate**. It stays local by default
(`create_pr=false`); the repo takes no remote/push unless you ask.

## Acceptance the run must prove (from PROJECT.md §Verification + schema.md)

- The five invariants hold on real seed — schema.md §6 validation queries each return **0 rows**.
- The four marquee traversals (§5) return correct chains, counts, and rollups.
- tsc + unit + integration (real Neo4j) + Playwright e2e pass.
- Org chart passes an **axe** run and a **scripted keyboard walkthrough** of the ARIA `tree`.
- A fresh-context verifier signs off from that evidence — not from any implementer's claim.
