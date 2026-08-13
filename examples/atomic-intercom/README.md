# Example: Atomic Intercom — agents steering each other live

A runnable demo of **Atomic's Intercom** feature: two agents run **concurrently in one workflow** and **talk to each other mid-run** to progress toward a goal.

## What Intercom is

Intercom is **Atomic's** channel for direct messaging **between Atomic sessions on the same machine**, over a local broker (`~/.atomic/agent/intercom/broker.sock`, auto-spawned on first use). Peers exchange `send` (fire-and-forget), blocking **`ask`**, and `reply`, plus status/needs-attention/completed notices — and with `ask`, *while the asking agent is still generating*.

It works at **two scales**, and both are real:

| Scale | Who is talking | How you watch it |
|-------|----------------|------------------|
| **Inside one workflow** | Stages/sub-agents in a shared group (`group: true` on a `ctx.parallel` set) | `/workflow status` — this example |
| **Across separate sessions** | Independent `atomic` processes, one per terminal or Herdr pane | The panes themselves — [agentic-hris](../agentic-hris/README.md)'s `launch-atomic.sh` |

Every session belongs to exactly one **group** and can only message peers in that group (cross-group sends are rejected by the broker, not merely hidden). Workflow stages inherit their run's group automatically; standalone sessions take theirs from `ATOMIC_INTERCOM_GROUP`, falling back to `"default"`.

> **Earlier versions of this page said Intercom was intra-workflow only and "invisible to Herdr."** That was wrong. Atomic 0.9.12's `docs/intercom.md` describes it as "direct messaging between Atomic sessions on the same machine," and a nine-session run under `agentic-hris/launch-atomic.sh` confirmed it: nine independent Atomic sessions, one per Herdr pane, each registered by role name in one group, delegating and replying across panes. Herdr still can't see *inside* a single Atomic run — the distinction is the run, not Intercom.

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

- **This demo is the intra-workflow shape.** Both agents are stages of one run, so you monitor them with `/workflow status` — Herdr cannot see inside a single Atomic run. For Intercom **across** separate sessions, one per Herdr pane, see [agentic-hris](../agentic-hris/README.md)'s `launch-atomic.sh`.
- **It spends real tokens** — two concurrent agents plus a verifier. It's a small, self-contained task, so it's cheap as these go, but it's a live paid run.
- **The models must actually use the tool.** The prompts require `intercom.ask`; if a provider/model declines to call it, the builder is told to state the conflict rather than silently guess. If Intercom is unavailable in your Atomic build, the run still completes but without live steering.

## What this example teaches

- **Atomic Intercom** — same-group agents steering each other with `intercom.ask` during generation (`group: true` on a `ctx.parallel` set).
- **Communication as a first-class part of the graph** — the goal is only reachable *through* the exchange.
- The contrast with [agentic-hris](../agentic-hris/README.md): the same Intercom channel at a different scale — stages of one run, watched via `/workflow status`, vs. nine independent sessions in Herdr panes, watched in the cockpit.
