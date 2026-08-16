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

Diagnose why an agent is in a given state — capture the buffer Herdr classifies, then replay
the manifest rules against it:

```bash
herdr agent read w1:p5 --source detection --lines 40 > /tmp/pane.txt
herdr agent explain --file /tmp/pane.txt --agent claude
```
```text
agent: claude
state: idle
manifest: remote:…/agent-detection/remote/claude.toml 2026.08.13.1
rule: live_prompt_box (region=prompt_box_body priority=950)
evidence: "❯\n"
```

`--agent` takes the **agent backend** (`claude`, `codex`, …) — the manifest to match against —
not the pane's role name. Passing a role (`--agent docs`) returns `fallback_reason:
unknown_agent`, because no manifest by that name exists.

Two caveats, both verified against Herdr 0.8.0:

- **The `<target>` form does not resolve.** `herdr agent explain <role-name>` returns
  `agent_not_found`, and `herdr agent explain <pane-id>` returns `agent_explain_unavailable —
  does not have a detected agent label`, even for panes that `herdr agent list` reports
  cleanly. Use the `--file` / `--agent` form above. See
  [docs/troubleshooting.md](troubleshooting.md#herdr-agent-state-is-unclear).
- **`explain` shows mechanism 2, not mechanism 1.** It replays the *screen-manifest* rules
  against a captured buffer, so its verdict can disagree with `herdr agent list` when lifecycle
  hooks are installed — the hooks are authoritative and win. A pane that `list` reports as
  `working` can read as `idle` here, because the snapshot caught an idle-looking prompt box.
  Trust `herdr agent list` for *what* the state is; use `explain` to understand *why* the
  buffer-based fallback would classify it that way.

## Reading state from scripts and other agents

Everything the sidebar shows is available over the CLI / socket API, so a workflow — or a supervising agent — can act on state without a human:

```bash
# Snapshot the whole session as JSON
herdr api snapshot

# List agents and their current states — this is where you get the pane ids
herdr agent list

# Read what an agent has printed
herdr agent read w1:p5 --lines 40

# Block until an agent reaches a terminal-ish state (the supervision primitive)
herdr agent wait w1:p5 --until done --timeout 900000
herdr agent wait w1:p5 --until blocked --until done
```

> **Target these by pane id, not role name.** On Herdr 0.8.0 every one of these subcommands
> rejects a role name with `agent_not_found` — `herdr agent wait docs …` fails even while
> `herdr agent list` reports an agent literally named `docs`. The `pane_id` field from
> `herdr agent list` (`w1:p5`, …) is what resolves. Scripts should read the pane id out of
> `herdr agent list` rather than hardcoding role names.

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
