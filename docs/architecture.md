# Architecture

The harness is a **composition of three tools with strictly separated responsibilities**. The separation is the point: each layer is replaceable, and none of them tries to be the others.

```text
┌─────────────────────────────────────────────────────────────┐
│  Engineer                                                     │
└───────────────┬─────────────────────────────────────────────┘
                │ types, reads, decides
┌───────────────▼─────────────────────────────────────────────┐
│  GHOSTTY — interaction surface                                │
│  Fast, native, GPU-accelerated terminal. Terminal-first.      │
│  Does NOT orchestrate. Does NOT know about agents.            │
└───────────────┬─────────────────────────────────────────────┘
                │ runs inside a terminal
┌───────────────▼─────────────────────────────────────────────┐
│  HERDR — agent workspace + operations layer                   │
│  Holds real terminals open (survives lid close / disconnect). │
│  Groups panes into workspaces & tabs. Recognizes coding       │
│  agents in panes and reports their live state. Exposes a CLI  │
│  + socket API so agents and scripts can drive panes.          │
│  Does NOT define the engineering process.                     │
└───────────────┬─────────────────────────────────────────────┘
                │ each stage runs as an agent in a pane
┌───────────────▼─────────────────────────────────────────────┐
│  ATOMIC — orchestration + verification                        │
│  Defines the process as an explicit workflow: stages,         │
│  dependencies (DAG), parallelism, bounded retries, checks,    │
│  artifacts, checkpoints, human approval gates. Runs           │
│  author/verifier separation with fresh-context verifiers.     │
│  Does NOT try to be the day-long UI.                          │
└───────────────┬─────────────────────────────────────────────┘
                │ launches specialized agents
┌───────────────▼─────────────────────────────────────────────┐
│  AGENTS — Claude Code / Codex / … , named by responsibility   │
│  research · planner · frontend · backend · test · a11y ·      │
│  review · integration · verifier                              │
└───────────────┬─────────────────────────────────────────────┘
                │ produce
┌───────────────▼─────────────────────────────────────────────┐
│  EVIDENCE + HUMAN GATES → PULL REQUEST                         │
└─────────────────────────────────────────────────────────────┘
```

## The three responsibilities, precisely

### Atomic defines *what should happen*

Atomic (`@bastani/atomic`) is a "verifiable coding agent runtime." A workflow is a TypeScript definition with **inputs, stages, branches, parallelism, retries, checks, artifacts, checkpoints, and human review gates**. Stages form a directed acyclic graph; each stage declares expected outputs validated against a schema before the workflow proceeds. Verification is built into the model via **author/verifier separation** — fresh-context verifiers that are independent of the implementer's claims.

Atomic ships reusable building-block workflows we compose from rather than reinvent:

| Built-in | Purpose |
|----------|---------|
| `fan-out-and-synthesize` | Partition independent work, collect evidence, synthesize. |
| `adversarial-verification` | Challenge candidates with fresh verifiers and bounded repair. |
| `loop-until-done` | Iterate against a durable ledger until done or bound exhausted. |
| `goal` | Bounded implementation with parallel review and reducer-gated completion. |
| `ralph` | Research-first delegated implementation with multi-model review. |

Atomic is the **engine**. See [atomic/README.md](../atomic/README.md).

### Herdr manages *where and how workers run*

Herdr (`herdrdev/herdr`) is a single Rust binary that turns your terminal into a workspace manager for coding agents. It:

- **Holds real terminals open.** Agents keep working when the laptop lid closes or the network drops; Herdr restores the layout on restart.
- **Groups panes** into workspaces and tabs.
- **Recognizes coding agents** inside panes and classifies each one's state as `idle`, `working`, `blocked`, `done`, or `unknown` — via lifecycle hooks (installed with `herdr integration install <agent>`) or, failing that, screen-manifest detection of the terminal buffer.
- **Rolls state up** the sidebar: a `blocked` agent makes its pane, tab, and workspace read as blocked, so the human sees *which project needs a decision*.
- **Exposes a CLI + socket API** (`herdr agent`, `herdr pane`, `herdr workspace`, `herdr api snapshot`) so scripts and agents can spawn panes, prompt agents, read output, and — crucially — **`herdr agent wait --until <state>`** to block until an agent reaches a state. That `wait` primitive is how supervision-by-exception is implemented.

Herdr is the **cockpit**. See [herdr/setup.md](../herdr/setup.md).

### Ghostty is *where the human sits*

Ghostty is a fast, native, GPU-accelerated terminal. Its only job here is to be a good terminal-first surface so the engineer is not forced into a proprietary agent IDE. Herdr runs inside it. See [ghostty/recommended-config.md](../ghostty/recommended-config.md).

## Why keep them separate

Collapsing any two layers looks convenient and costs you later:

- **If Ghostty owned orchestration**, you would be locked to one terminal and one process model. Ghostty stays a dumb, fast surface so it is replaceable.
- **If Herdr defined the process**, your engineering workflow would be encoded in an operations tool with no schema, no versioning, and no verification model. Herdr stays about panes and state.
- **If Atomic were the day-long UI**, engineers would live inside the orchestrator and lose the supervision-by-exception view across *many* concurrent outcomes. Atomic stays the engine that a cockpit observes.

The clean seam between "process definition" (Atomic) and "worker operation" (Herdr) is what lets you swap Claude for Codex under a stage, or run the same workflow on a rented box, without rewriting the process.

## How a stage becomes a running agent

The integration today is **process-level**, not a special agent type:

```text
Atomic stage  ──►  a shell command that launches an agent (e.g. `claude` / `atomic -p`)
                         │
                         ▼
                   runs inside a Herdr pane
                         │
                         ▼
                   Herdr recognizes the agent and reports its state
```

Herdr does **not** need to model "Atomic" as an agent kind. An Atomic stage simply results in an agent process, and that process happens to run in a Herdr pane. This avoids coupling Herdr's agent-identity model to Atomic. See [herdr/atomic-integration.md](../herdr/atomic-integration.md) for the mapping and the future adapter concept.

## The engineering graph (target state)

The long-term goal is that the engineering *process itself* is an executable graph:

```text
Issue / Product Goal
        │
     Research  ──(parallel: codebase · patterns · design system · APIs · a11y · tests)
        │
      Plan
        │
   ┌──── Human Gate: plan review ────┐
        │
  Implementation ──(parallel: frontend · backend · tests · docs)
        │
   Integration
        │
  Automated Verification  ──(compile · typecheck · unit · integration · browser · a11y)
        │
  Review  ──(parallel: UX · accessibility · architecture · security)
        │
   ┌──── Human Gate: approval ────┐
        │
       PR
```

Atomic expresses this graph; Herdr runs and shows it; the engineer supervises it. See the [maturity model in the operating model](operating-model.md#maturity-model) for how a team climbs from "one engineer, one agent" to operating this graph.
