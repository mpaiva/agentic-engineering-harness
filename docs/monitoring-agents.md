# Monitoring autonomous runs — supervision by exception

The engineer should **not** continuously watch autonomous agents. The harness watches; the human is pulled in only for exceptions and judgment.

## The wrong question and the right questions

Move away from asking, all day:

```text
What should I ask Claude next?
```

Toward monitoring the *system*:

```text
What is running?
What stage is each task in?
What is blocked?
What failed?
What evidence has been produced?
Where is human input required?
```

## Agent states

Herdr classifies each agent pane into one of five states. Your response to each:

| State | Meaning | Your action |
|-------|---------|-------------|
| **WORKING** | Actively making progress. | None. Leave it alone. |
| **DONE** | Finished (idle after unseen background work). | Inspect the artifact, or let the workflow continue. |
| **BLOCKED** | Herdr recognized an approval/question UI — the agent is waiting on input. | Decide: answer the question or unblock it. |
| **FAILED** | A stage produced failing evidence and exhausted its retry bound. | Inspect evidence → retry, redirect, or stop. |
| **IDLE** | Available for more work. | Assign work, or ignore. |

> Herdr's own vocabulary is `idle`, `working`, `blocked`, `done`, `unknown`. `FAILED` here is a workflow-level outcome (a stage that exhausted its repair bound and stopped for review); operationally it surfaces as a `blocked` agent plus failing evidence in an artifact. `unknown` means an agent is present but Herdr can't classify it confidently — it does **not** prove completion.

Attention goes to **BLOCKED** and **FAILED**. `WORKING` needs nothing from you.

## How Herdr knows the state

Two mechanisms, in priority order:

1. **Lifecycle hooks** — installed with `herdr integration install <agent>` (e.g. `claude`). The agent authoritatively reports `idle` / `working` / `blocked`.
2. **Screen manifests** — when hooks aren't available, Herdr reads the live bottom-buffer terminal snapshot and matches it against TOML rules (and terminal titles / progress sequences).

State **rolls up**: a `blocked` agent makes its pane, tab, and *workspace* read as blocked in the sidebar. That is the whole point — you scan workspaces, not panes.

Diagnose why an agent is in a given state:

```bash
herdr agent explain <agent-name-or-pane-id>
```

## Reading state from scripts and other agents

Everything the sidebar shows is available over the CLI / socket API, so a workflow — or a supervising agent — can act on state without a human:

```bash
# Snapshot the whole session as JSON
herdr api snapshot

# List agents and their current states
herdr agent list

# Read what an agent has printed
herdr agent read <agent>

# Block until an agent reaches a terminal-ish state (the supervision primitive)
herdr agent wait <agent> --until done --timeout 900000
herdr agent wait <agent> --until blocked --until done
```

`herdr agent wait --until <state>` is how the harness implements *supervision by exception* in automation: a coordinator waits on many agents and only escalates the ones that reach `blocked`, or that fail their checks.

## The cockpit you actually want

The target view — one glance tells you where your judgment is needed across everything you're running:

```text
CSV EXPORT — RPT-204               NAV-431 GLOBAL NAV       DS-204 DATE PICKER
Atomic workflow: implementation-v3

RESEARCH          ✓                RESEARCH        ✓          RESEARCH      ● working
PLAN              ✓                PLAN            ● working  PLAN          ○ waiting
IMPLEMENTATION                     …                          …
   frontend       ● working
   API            ● working
   tests          ✓ done
VERIFICATION
   accessibility  ! blocked  ◄── attention
   UX             ○ waiting
   architecture   ○ waiting
HUMAN REVIEW      ○ waiting
```

Today Herdr provides the pane/state cockpit and Atomic provides the stage graph; a first-class adapter that projects Atomic's stage names into the Herdr sidebar is a documented future step (see [herdr/atomic-integration.md](../herdr/atomic-integration.md)). Until then, `scripts/status.sh` rolls up `herdr agent list` into the same at-a-glance view for a feature workspace, and `scripts/team-status.sh` is the live version shown in the team cockpit's **`team` tab** — it joins `build/ROSTER.md` (who was hired and why) with each agent's live state, sorts BLOCKED/UNKNOWN last, and prints the `scripts/team.sh` hire/list controls. `build.sh` opens it automatically.

## The principle

> Human attention should be directed to **exceptions** rather than raw activity. Do not make humans monitor agents; make the harness monitor agents and bring humans the decisions that require human judgment.
