# Workspace and naming conventions

Consistent conventions are what make supervision-by-exception legible. When every
workspace and agent is named the same way, one glance at the Herdr sidebar tells you where
your judgment is needed — across every project you're running.

## One outcome = one workspace

> **Default rule:** one meaningful engineering outcome = one Herdr workspace.

Name the workspace after the outcome (ticket id + short title), not after a tool or a
person:

```text
EE-1428  Employee Event Details
NAV-431  Global Navigation
LMS-812  Course Assignment
DS-204   Accessible Date Picker
```

```bash
herdr workspace create --name "EE-1428 Employee Event Details"
```

A workspace bundles the agents working the outcome **and** the runtime processes that
support them.

## What lives inside a workspace

```text
EE-1428 Employee Event Details
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

Agents go in **agent panes** (Herdr validates agent identity and interprets state there).
Runtime processes — dev server, test watcher, `tail -f` logs — go in **ordinary panes**
(`herdr pane`), because they are not agents and should not be classified as such.

## Name agents by responsibility, not by model

The model is an implementation detail. The responsibility communicates intent and stays
stable even if you swap Claude for Codex underneath.

Avoid:

```text
Claude 1 · Claude 2 · Codex · Claude Test
```

Prefer:

```text
research · planner · frontend · backend · accessibility · test · review · integration · verifier
```

Herdr enforces a name grammar for agents: `[a-z][a-z0-9_-]{0,31}`, unique among live
agents. A name follows the current pane occupant and clears when that agent exits or is
replaced. So `herdr agent rename <pane-or-agent> frontend` gives you a stable handle you
can `prompt`, `wait` on, and `read` regardless of which model backs it.

```bash
herdr agent rename <pane-id> planner
herdr agent prompt planner "Read research/*.md and produce specs/implementation-plan.md"
herdr agent wait planner --until done --timeout 900000
```

## The state vocabulary (shared with Atomic stages)

| Herdr state | Meaning | Maps to workflow phase |
|-------------|---------|------------------------|
| `working` | actively progressing | a stage is executing |
| `blocked` | recognized an approval/question UI | a human gate, or a question |
| `done` | finished (idle after unseen work) | stage complete |
| `idle` | ready for input / available | between stages |
| `unknown` | present, unclassifiable | investigate with `herdr agent explain` |

Keeping agent names (responsibility) and states aligned with the Atomic workflow's stage
names is what lets the two layers be read as one cockpit — see
[atomic-integration.md](atomic-integration.md).

## Workspace hygiene

- **One outcome per workspace.** Don't stuff two tickets into one workspace; the state
  rollup stops being meaningful.
- **Retire workspaces when the PR merges.** Keep the sidebar to *live* outcomes.
- **Use git worktrees** (`herdr worktree`) when parallel implementation agents would
  otherwise fight over the same working tree.
