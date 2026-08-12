# Example: Atomic Intercom — agents steering each other live

A runnable demo of **Atomic's Intercom** feature: two agents run **concurrently in one workflow** and **talk to each other mid-run** to progress toward a goal. This is the real Intercom feature — not the `herdr agent prompt` substitute used in [agentic-hris](../agentic-hris/README.md).

## What Intercom is

Intercom is **Atomic's** channel for agents in the **same workflow group** to communicate *while they are still generating*: status/needs-attention/completed notices, and blocking **`intercom.ask`** peer questions. It's tool-gated and lives **inside** an Atomic run — so you watch it with `/workflow status`, not in Herdr's sidebar. (Herdr can't see inside an Atomic run; that's the whole reason the two examples exist.)

## The demo

The workflow [`intercom-team`](../../atomic/workflows/intercom-team.ts) runs two agents in **one `ctx.parallel` set with a shared Intercom group** (`group: true`):

- **`builder`** — given a small task (`parseDuration('1h30m') → ms`, with tests) whose spec is **deliberately ambiguous** on three points: invalid input, which units, and bare numbers. It is told **not to guess** — it must `intercom.ask` the peer and implement the answer.
- **`product-owner`** — holds the intended spec and answers the builder's questions **live**, decisively, logging each decision to `build/decisions.md`.

Then a fresh **`verify`** stage checks the built code against those decisions and the test output.

```text
        ┌──────────── shared Intercom group ────────────┐
   builder  ──intercom.ask("invalid input → throw?")──►  product-owner
   builder  ◄──────── "throw a TypeError" ─────────────  product-owner
   builder  ──intercom.ask("support weeks?")─────────►   product-owner
   builder  ◄──────── "h/m/s/d only, no weeks" ───────   product-owner
        └───────────────────────────────────────────────┘
                              │
                     verify (fresh) ──► build/evidence.md
```

The point: the builder **literally cannot finish correctly without communicating** — so the Intercom traffic is real and necessary, not decorative.

## Run it

Needs Atomic logged in to a provider. From the repo root:

```bash
./scripts/sync-workflows.sh
atomic
```
then inside Atomic:
```text
/workflow reload
/workflow intercom-team
```

Watch the two agents coordinate: `/workflow status <run-id>` (and `/workflow connect <run-id>` to attach a stage). Output lands under `build/` (git-ignored): the utility + tests, `decisions.md` (the product-owner's answers), and `evidence.md` (the verifier's checks).

## Honest notes

- **Intercom is intra-workflow.** You monitor it via `/workflow status`, not Herdr. For the Herdr-monitored, per-agent-pane experience, that's [agentic-hris](../agentic-hris/README.md) (which uses `herdr agent prompt`).
- **It spends real tokens** — two concurrent agents plus a verifier. It's a small, self-contained task, so it's cheap as these go, but it's a live paid run.
- **The models must actually use the tool.** The prompts require `intercom.ask`; if a provider/model declines to call it, the builder is told to state the conflict rather than silently guess. If Intercom is unavailable in your Atomic build, the run still completes but without live steering.

## What this example teaches

- **Atomic Intercom** — same-group agents steering each other with `intercom.ask` during generation (`group: true` on a `ctx.parallel` set).
- **Communication as a first-class part of the graph** — the goal is only reachable *through* the exchange.
- The contrast with [agentic-hris](../agentic-hris/README.md): Intercom (inside Atomic, watched via `/workflow status`) vs. `herdr agent prompt` (across panes, watched in Herdr).
