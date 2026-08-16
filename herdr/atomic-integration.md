# Atomic ↔ Herdr integration

How the orchestration layer (Atomic) and the operations layer (Herdr) fit together — what works **today**, and the **future adapter** that would make them a single cockpit.

## The clean seam

The integration is deliberately **process-level**, not a special agent type:

```text
Atomic stage  ──►  a command that launches an agent  ──►  runs inside a Herdr pane
                                                              │
                                                              ▼
                                              Herdr recognizes the agent and
                                              reports its state in the sidebar
```

Atomic defines *what should happen* (the stage graph, verification, gates). Herdr runs and observes *the worker processes*. Herdr does **not** need to model "Atomic" as an agent kind — an Atomic stage simply results in an agent process, and that process happens to occupy a Herdr pane.

> **Important nuance:** do not couple Herdr's agent-identity model to Atomic. The right shape is `Atomic Stage → Herdr Pane → Claude Code` (or `→ Codex`), never "Herdr treats Atomic as an agent." This keeps either layer swappable.

## Today: wiring the two layers

There is **no first-class adapter** between the tools yet (see the gap below). In this repo the two layers are wired with scripts and the two CLIs. Two working patterns:

### Pattern A — Atomic orchestrates; Herdr hosts the human-facing surface

Run the Atomic workflow (its stages fan out and verify internally), and use Herdr for the workspace you supervise from. Atomic named runs execute in the background and return a run id:

```bash
# Inside a Herdr pane (HERDR_ENV=1):
atomic -p '/workflow feature-development objective="Add CSV export to the report view"'
# → returns a run id; monitor with /workflow status <id> or /workflow connect <id>
```

Atomic owns stage state; Herdr shows the pane running the workflow as `working` / `blocked` (it goes `blocked` when a `ctx.ui.confirm` gate is waiting on you).

### Pattern B — Herdr hosts one pane per responsibility; a script drives the phases

When you want each responsibility visible as its own pane/state in the sidebar, launch an agent per pane and drive the phase order with `herdr agent prompt` + `herdr agent wait`. This is what [`../scripts/launch-feature.sh`](../scripts/launch-feature.sh) does. It gives you the per-responsibility cockpit at the cost of expressing the orchestration in shell rather than in Atomic's graph.

The state primitive that ties a script to the Atomic-style phase order:

```bash
herdr agent wait w1:p3 --until done --timeout 900000
herdr agent wait w1:p4 --until done --until blocked --timeout 900000
# … only escalate to the human when an agent reaches `blocked`
```

> Pass the `pane_id` from `herdr agent list`, not the role name — on Herdr 0.8.0 a role name
> returns `agent_not_found`. See [workspace-conventions.md](workspace-conventions.md#the-state-vocabulary-shared-with-atomic-stages).

## The gap (be honest about it)

Atomic already ships its own graph overlay for a running workflow — `/workflow status <run-id>`, `F2`, or `/workflow connect <run-id>` all open it (see `atomic/docs/workflows.md:116`). What does **not** exist in Atomic `0.9.13` or Herdr `0.8.0` is a bridge that projects that stage graph into the Herdr *sidebar*. Concretely, missing today:

- Atomic does not emit Herdr pane/agent state for each stage.
- Herdr cannot read Atomic run state (`/workflow status`) and render stage names.
- So the cockpit in the next section is assembled by convention + scripts, not by a built-in bridge.

`scripts/status.sh` approximates the rollup by formatting `herdr agent list`. Treat the adapter below as a **design target**, not a shipped feature.

## Watching a workflow graph today

1. Attach to the Herdr session holding the agent (`herdr --session <SESSION>`) and switch to
   that agent's own pane — the recipe only works inside the pane actually running the
   workflow.
2. Once there, either press **F2**, or run `/workflow connect <run-id>`, or run
   `/workflow status <run-id>` for a text summary instead of the interactive overlay.

The run id appears in that agent's own turn output right after it starts the workflow
(the `workflow({ action: "run", ... })` tool call returns it). This opens Atomic's own graph
overlay (`atomic/docs/workflows.md:116`, `atomic/docs/quickstart.md:148`) — it shows that
one agent's stage graph, in that agent's own pane. It does **not** appear in the Herdr
sidebar across panes; that cross-pane rollup is the adapter described below, and it does not
exist yet.

## Future: an Atomic ↔ Herdr adapter

A future integration could expose a small command surface that translates Atomic workflow state into Herdr:

```text
atomic.start    → create a Herdr workspace + panes for the run's stages
atomic.status   → set each pane/agent state from stage state
atomic.pause    → quit the Atomic run, mark panes idle
atomic.resume   → resume the run, re-mark panes working
atomic.review   → surface a human gate as a `blocked` pane needing attention
```

Rendered in the Herdr sidebar, it would look like:

```text
CSV EXPORT — RPT-204
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

Building this adapter is the natural next milestone for atomic cockpit. It belongs as a thin translator (an Atomic extension or a sidecar reading `herdr api` + `/workflow status`), **not** as a change to either tool's core identity model.
