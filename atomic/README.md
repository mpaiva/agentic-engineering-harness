# Atomic layer — the engineering process as a workflow

[Atomic](https://github.com/bastani-inc/atomic) (`@bastani/atomic`) is the orchestration and verification engine. This directory holds the **workflow definitions** that encode our engineering process as explicit, versioned, resumable graphs.

> Verified against Atomic `0.9.12`. Command surfaces here are copied from the installed binary (`atomic --help`) and Atomic's bundled workflow docs (`$(npm root -g)/@bastani/atomic/docs/workflows.md`).

## Mental model

A workflow is a TypeScript module that **default-exports** a `workflow({...})` definition. The `run(ctx)` body is imperative TypeScript that materializes a graph of tracked stages at runtime. Each stage is a **model stage** (an agent turn), not a deterministic function. Stages pass large context to each other as **artifact files**, not inline prompt text.

```ts
import { workflow } from "@bastani/workflows";
import { Type } from "typebox";

export default workflow({
  name: "feature-development",
  description: "Research → plan → gate → implement → verify → bounded repair → review → PR.",
  inputs: {
    objective: Type.String({ description: "What must be true when the work is done." }),
  },
  outputs: {
    status: Type.Union([Type.Literal("completed"), Type.Literal("needs_human")]),
    summary: Type.String(),
  },
  run: async (ctx) => {
    // ctx.task / ctx.parallel / ctx.ui.confirm / ctx.exit …
  },
});
```

## The `ctx` primitives we use

| Primitive | What it does |
|-----------|--------------|
| `ctx.task(name, opts)` | One tracked model stage. Key opts: `prompt`, `context: "fresh"` (clean context for verifiers), `output` + `outputMode: "file-only"` (write an artifact), `reads: [paths]`, `schema` (structured gate output), `model`. |
| `ctx.parallel([items], { concurrency })` | Run independent stages concurrently, then barrier. Used for fan-out research and parallel implementation. |
| `ctx.chain(steps)` | Sequential stages that hand context forward. |
| `ctx.ui.confirm(msg)` / `ctx.ui.input(msg)` / `ctx.ui.select(msg, opts)` | **Human gates.** Suspend the run and wait for a person. |
| `ctx.exit({ status, reason, outputs })` | End the run early (e.g. plan rejected, repair bound exhausted). |
| `ctx.tool(name, args, fn)` | Durable, cached side effect (e.g. opening the PR). Result is checkpointed; resume does not re-run it. |

Two rules that shape the workflow's structure:

1. **DAG only — no cycles.** A repair loop must be **unrolled**: each repair iteration creates *new* tracked nodes (`review-1`, `repair-1`, `review-2`, …). You may not point `repair` back at the original `implement` node. This is why the reference workflow loops with a bounded `for` that names each iteration.
2. **Independent verifiers get fresh context.** Reviewer/verifier stages use `context: "fresh"` so the implementer's optimism can't bias them. They evaluate the artifacts and the diff, not the author's narrative.

## Reserved `status` output

Returning a top-level `status` of `"failed"`, `"blocked"`, `"needs_human"`, or `"incomplete"` marks the run as *not a clean completion* — Atomic surfaces it as blocked/needs-attention rather than success. The reference workflow returns `status: "needs_human"` when the plan gate is declined or the repair bound is exhausted, and pairs it with a `summary` for the run notice.

## Running a workflow

Atomic discovers project workflows only from **`.atomic/workflows/`** (with the dot). The authored, version-controlled copies live in [`workflows/`](workflows/) for readability, so make them runnable first with the sync helper (it copies them into `.atomic/workflows/`, which is gitignored/derived):

```bash
# From the repo root, once (and after editing a workflow):
./scripts/sync-workflows.sh

# Inside atomic (interactive):
/workflow reload                 # rediscover after a sync
/workflow list
/workflow inputs feature-development
/workflow feature-development objective="Add employee event history view (WCAG 2.2 AA)"
```

Monitor and control runs:

```text
/workflow status <run-id>     # progress + stage graph
/workflow connect <run-id>    # attach to the running stage
/workflow quit <run-id>       # pause for later
/workflow resume <run-id>     # resume a paused run
```

Named runs execute in the **background** and return a run id, which is exactly what makes them supervisable from Herdr (see [../herdr/atomic-integration.md](../herdr/atomic-integration.md)).

## When to write your own vs. use a built-in

Atomic ships composable built-ins — prefer them before hand-rolling:

| Built-in | Use when |
|----------|----------|
| `goal` | Bounded implementation with a durable ledger and reducer-gated completion. |
| `ralph` | Research-first delegated implementation with multi-model review. |
| `fan-out-and-synthesize` | Partition independent research, collect evidence, synthesize. |
| `adversarial-verification` | Challenge a candidate with fresh verifiers + bounded repair. |
| `loop-until-done` | Iterate against a durable ledger until done or bound exhausted. |

[`workflows/feature-development.ts`](workflows/feature-development.ts) is a **teaching reference** that shows the full research → gate → implement → verify → repair → gate → PR shape explicitly. In production you would often express the implementation core with `goal` or `ralph` and keep only the gates and fan-out around them.
