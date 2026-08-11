# Example: feature-development, end to end

A **real, runnable** walk of the harness's core loop — research → plan → human gate →
implementation → verification → human gate → PR — on a small self-contained task, so you
can see the operating model actually work before pointing it at your own codebase.

The task: *add a URL-safe `slugify()` utility with tests* (see
[`sample-project/`](sample-project/)). It's deliberately tiny so the **verification is
real and fast**, not hand-waved.

> **There is a real, paid, autonomous Atomic run recorded here too.** The built-in `goal`
> workflow drove live Claude agents to add a `truncate()` utility to `sample-project/`,
> with three independent reviewers — and the reviewers **caught a real edge-case bug the
> author's passing tests missed**. See **[atomic-goal-run.md](atomic-goal-run.md)** and
> the raw evidence in [atomic-run/](atomic-run/). That run is why `sample-project/` now
> has two features (slugify + truncate) and the suite reports 11 tests.

## Two ways this maps onto the tools

The harness has two layers you can drive. This example exercises both:

1. **Atomic** expresses the process as a workflow —
   [`../../atomic/workflows/feature-development.ts`](../../atomic/workflows/feature-development.ts).
   Atomic discovers and validates it (evidence below). Running it to completion drives
   real LLM agents through the stages; that needs a logged-in provider and answers at the
   human gates.
2. **Herdr** runs and observes the workers. [`run.sh`](run.sh) drives the *same phase
   shape* over a real headless Herdr session so you can watch the cockpit — panes,
   states, and the workspace rolling up to `BLOCKED` at each gate — without needing a
   provider or spending agent credits.

## Run it

```bash
# From the repo root. Uses a real headless Herdr server; runs real `node --test`.
./examples/feature-development/run.sh
```

It creates a workspace with one pane per responsibility, advances the phases, stops
(visibly) at each human gate, runs the **real** checks, and writes real artifacts. A
captured run is in [RUN-TRANSCRIPT.md](RUN-TRANSCRIPT.md).

### What is real vs. simulated

| Real | Simulated |
|------|-----------|
| Headless Herdr server, workspace, one pane per responsibility | The "agents" are `run.sh`'s deterministic steps, **not** live LLM sessions |
| Agent state transitions (`working → blocked → idle`) driving the sidebar | — |
| Workspace status **rolling up to BLOCKED** at each gate (supervision by exception) | — |
| Verification: real `node --check` + `node --test`, output saved as evidence | — |
| Artifacts written to `research/ specs/ artifacts/` | — |

The **live-agent** path (real `claude` per pane) is
[`../../scripts/launch-feature.sh`](../../scripts/launch-feature.sh) `--live`, which uses
`herdr agent start --kind claude` + `herdr agent prompt` + `herdr agent wait`.

## Evidence this actually ran

**Atomic discovers and validates the workflow** (`/workflow list` — our workflow is
registered alongside the built-ins, with its inputs parsed):

```text
╭ WORKFLOWS  10 registered ─────────────────────────────────────────────╮
│ feature-development                                                   │
│   Research → plan → human gate → parallel implementation → verif…     │
│   inputs    objective  ·  scope?  ·  constraints?  ·  +3 more         │
│ … goal · ralph · fan-out-and-synthesize · adversarial-verification … │
```

**The verification is real** — `artifacts/evidence.txt` from a run:

```text
$ node --test
# tests 5
# pass 5
# fail 0
```

**The cockpit rolls up to BLOCKED at a human gate** (from
[RUN-TRANSCRIPT.md](RUN-TRANSCRIPT.md)):

```text
EE-1428 Employee Event Slug   [workspace: ! BLOCKED]
  ○ research         IDLE     w1:p2
  ○ frontend         IDLE     w1:p4
  ○ test             IDLE     w1:p5
  ! planner          BLOCKED  w1:p3   ◄── attention
```

## Produced artifacts (committed, as a model of good output)

```text
research/codebase.md          research/accessibility.md      research/test-strategy.md
specs/implementation-plan.md
artifacts/evidence.txt         artifacts/verification.md
```

These are what "artifacts are handoffs" looks like in practice — inspectable findings,
plan, and evidence rather than conversational memory.

## Watch it live

While a run's server is up, attach the Herdr TUI from Ghostty to see the panes and
sidebar for yourself:

```bash
herdr --session ee-1428
```

Roll up the states from another terminal any time:

```bash
./scripts/status.sh EE-1428
```

## Going further

- Swap the sample task for a real one and run the Atomic workflow with a logged-in
  provider: `/workflow feature-development objective="…"`.
- Add a `create_pr=true` run once you trust the loop (the workflow gates the PR behind
  final human approval — see the workflow source).
