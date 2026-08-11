# Atomic ↔ Herdr integration

How the orchestration layer (Atomic) and the operations layer (Herdr) fit together —
what works **today**, and the **future adapter** that would make them a single cockpit.

## The clean seam

The integration is deliberately **process-level**, not a special agent type:

```text
Atomic stage  ──►  a command that launches an agent  ──►  runs inside a Herdr pane
                                                              │
                                                              ▼
                                              Herdr recognizes the agent and
                                              reports its state in the sidebar
```

Atomic defines *what should happen* (the stage graph, verification, gates). Herdr runs
and observes *the worker processes*. Herdr does **not** need to model "Atomic" as an
agent kind — an Atomic stage simply results in an agent process, and that process happens
to occupy a Herdr pane.

> **Important nuance:** do not couple Herdr's agent-identity model to Atomic. The right
> shape is `Atomic Stage → Herdr Pane → Claude Code` (or `→ Codex`), never "Herdr treats
> Atomic as an agent." This keeps either layer swappable.

## Today: wiring the two layers

There is **no first-class adapter** between the tools yet (see the gap below). In this
repo the two layers are wired with scripts and the two CLIs. Two working patterns:

### Pattern A — Atomic orchestrates; Herdr hosts the human-facing surface

Run the Atomic workflow (its stages fan out and verify internally), and use Herdr for the
workspace you supervise from. Atomic named runs execute in the background and return a run
id:

```bash
# Inside a Herdr pane (HERDR_ENV=1):
atomic -p '/workflow feature-development objective="Add employee event history (WCAG 2.2 AA)"'
# → returns a run id; monitor with /workflow status <id> or /workflow connect <id>
```

Atomic owns stage state; Herdr shows the pane running the workflow as `working` /
`blocked` (it goes `blocked` when a `ctx.ui.confirm` gate is waiting on you).

### Pattern B — Herdr hosts one pane per responsibility; a script drives the phases

When you want each responsibility visible as its own pane/state in the sidebar, launch an
agent per pane and drive the phase order with `herdr agent prompt` + `herdr agent wait`.
This is what [`../scripts/launch-feature.sh`](../scripts/launch-feature.sh) does, and what
the [example](../examples/feature-development/README.md) runs. It gives you the
per-responsibility cockpit at the cost of expressing the orchestration in shell rather
than in Atomic's graph.

The state primitive that ties a script to the Atomic-style phase order:

```bash
herdr agent wait research  --until done --timeout 900000
herdr agent wait planner   --until done --until blocked --timeout 900000
# … only escalate to the human when an agent reaches `blocked`
```

## The gap (be honest about it)

A single command surface that projects Atomic's *stage graph* into the Herdr *sidebar*
does **not** exist in Atomic `0.9.12` or Herdr `0.8.0`. Concretely, missing today:

- Atomic does not emit Herdr pane/agent state for each stage.
- Herdr cannot read Atomic run state (`/workflow status`) and render stage names.
- So the cockpit in the next section is assembled by convention + scripts, not by a
  built-in bridge.

`scripts/status.sh` approximates the rollup by formatting `herdr agent list`. Treat the
adapter below as a **design target**, not a shipped feature.

## Future: an Atomic ↔ Herdr adapter

A future integration could expose a small command surface that translates Atomic workflow
state into Herdr:

```text
atomic.start    → create a Herdr workspace + panes for the run's stages
atomic.status   → set each pane/agent state from stage state
atomic.pause    → quit the Atomic run, mark panes idle
atomic.resume   → resume the run, re-mark panes working
atomic.review   → surface a human gate as a `blocked` pane needing attention
```

Rendered in the Herdr sidebar, it would look like:

```text
EMPLOYEE EVENTS — EE-1428
Atomic Workflow: feature-development

RESEARCH          ✓
PLAN              ✓
IMPLEMENTATION
   frontend       ● working
   API            ● working
   tests          ✓ done
VERIFICATION
   accessibility  ! blocked   ◄── your attention
   UX             ○ waiting
   architecture   ○ waiting
HUMAN REVIEW      ○ waiting
```

At that point the responsibilities are fully realized:

```text
Herdr  = cockpit   (where the human supervises)
Atomic = engine    (what actually runs and verifies)
Ghostty = surface  (the terminal it all lives in)
```

Building this adapter is the natural next milestone for the harness. It belongs as a thin
translator (an Atomic extension or a sidecar reading `herdr api` + `/workflow status`),
**not** as a change to either tool's core identity model.
