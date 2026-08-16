# Workspace and naming conventions

Consistent conventions are what make supervision-by-exception legible. When every workspace and agent is named the same way, one glance at the Herdr sidebar tells you where your judgment is needed — across every project you're running.

## One outcome = one workspace

> **Default rule:** one meaningful engineering outcome = one Herdr workspace.

Name the workspace after the outcome (ticket id + short title), not after a tool or a person:

```text
RPT-204  CSV Export
NAV-431  Global Navigation
LMS-812  Course Assignment
DS-204   Accessible Date Picker
```

```bash
herdr workspace create --name "RPT-204 CSV Export"
```

A workspace bundles the agents working the outcome **and** the runtime processes that support them.

## What lives inside a workspace

```text
RPT-204 CSV Export
│
├── Agents
│   ├── research
│   ├── planner
│   ├── frontend
│   ├── backend
│   ├── accessibility
│   ├── test
│   ├── review
│   └── integration
│
└── Runtime
    ├── dev server
    ├── test watcher
    └── logs
```

Agents go in **agent panes** (Herdr validates agent identity and interprets state there). Runtime processes — dev server, test watcher, `tail -f` logs — go in **ordinary panes** (`herdr pane`), because they are not agents and should not be classified as such.

## Name agents by responsibility, not by model

The model is an implementation detail. The responsibility communicates intent and stays stable even if you swap Claude for Codex underneath.

Avoid:

```text
Claude 1 · Claude 2 · Codex · Claude Test
```

Prefer:

```text
research · planner · frontend · backend · accessibility · test · review · integration · verifier
```

Herdr enforces a name grammar for agents: `[a-z][a-z0-9_-]{0,31}`, unique among live agents. A name follows the current pane occupant and clears when that agent exits or is replaced. `herdr agent rename <pane-id> frontend` gives that pane a stable *label* — it is what the sidebar, `herdr agent list`, and the state rollup show you.

```bash
herdr agent rename w1:p3 planner
herdr agent prompt w1:p3 "Read research/*.md and produce specs/implementation-plan.md"
herdr agent wait w1:p3 --until done --timeout 900000
```

> **Target by pane id, not by the name you just set.** On Herdr 0.8.0 the label is for reading,
> not for addressing: `herdr agent wait planner …` returns `agent_not_found` even after a
> successful rename, and the same holds for `get`, `read`, and `explain`. Verified against
> three live named agents. Keep the rename for the human-facing sidebar, and pass the `pane_id`
> from `herdr agent list` when scripting.

## The state vocabulary (shared with Atomic stages)

| Herdr state | Meaning | Maps to workflow phase |
|-------------|---------|------------------------|
| `working` | actively progressing | a stage is executing |
| `blocked` | recognized an approval/question UI | a human gate, or a question |
| `done` | finished (idle after unseen work) | stage complete |
| `idle` | ready for input / available | between stages |
| `unknown` | present, unclassifiable | investigate: `herdr agent read <pane-id> --source detection --lines 40 > /tmp/buf` then `herdr agent explain --file /tmp/buf --agent claude` |

Keeping agent names (responsibility) and states aligned with the Atomic workflow's stage names is what lets the two layers be read as one cockpit — see [atomic-integration.md](atomic-integration.md).

## Workspace hygiene

- **One outcome per workspace.** Don't stuff two tickets into one workspace; the state rollup stops being meaningful.
- **Retire workspaces when the PR merges.** Keep the sidebar to *live* outcomes.
- **Use git worktrees** (`herdr worktree`) when parallel implementation agents would otherwise fight over the same working tree.
