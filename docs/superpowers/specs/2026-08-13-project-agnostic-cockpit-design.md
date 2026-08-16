# Design: a project-agnostic cockpit

**Date:** 2026-08-13
**Status:** approved, not yet implemented

Turn this repository from *a cockpit demonstrated on an HRIS* into *a cockpit that builds
whatever you ask it for*. A human runs one command, is asked what they want to build, and a
lead agent refines that answer into a mission, hires the team the mission actually needs, and
drives the build — with every agent free to trigger workflows on its own slice.

## Why

Today the repo argues its case through four worked examples, two of them HR-domain. That makes
the operating model legible but ties it to a domain nobody else is building. The three-layer
model (Ghostty · Herdr · Atomic) is not HR-specific, and neither is the argument. The examples
should be replaced by a generic builder that produces its own worked example on every run.

## Decisions

These were settled during brainstorming and are not open in implementation:

| Decision | Choice | Consequence |
|---|---|---|
| Removal scope | **All four examples** | `examples/` is deleted entirely. The generic builder becomes the only example. |
| Team composition | **Lead composes from a role library** | Panes are created dynamically. A Rust CLI hires four agents; a web app hires eight. |
| Intake | **Atomic extension popup** | Deterministic — fires before a token is spent, cannot be skipped by model discretion. |
| Workflows | **Generic library** | `feature-development.ts` survives; `hcm-*.ts` and `intercom-team.ts` are deleted. |
| Team assembly | **Lead spawns its own panes** (approach A) | The lead calls `scripts/team.sh add <role>`; the cockpit visibly grows. |

## Ground truth established before design

Verified against the installed tools, per `AGENTS.md`:

- **`prompt-engineer` is real.** Bundled with Atomic 0.9.12 at
  `dist/builtin/workflows/skills/prompt-engineer/`, described as "Create, improve, optimize,
  evaluate, or troubleshoot prompts". It shapes prompts as
  `Role · Goal · Success criteria · Constraints · Tools · Output · Stop rules`. There is no
  skill literally named "improve my prompt"; this is the one. Invoked `/skill:prompt-engineer`.
- **`ctx.ui.input(label, placeholder)`** exists in Atomic's extension API and returns
  `undefined` when the user cancels.
- **`feature-development.ts` is already domain-neutral** — no changes needed.
- **Atomic Intercom is session-to-session**, not workflow-scoped, over a local broker
  (corrected in commit `b089034`).
- **Herdr injects `HERDR_PANE_ID` / `HERDR_SESSION` / `HERDR_SOCKET_PATH`** into every pane, so
  extensions self-configure.

## Architecture

```
atomic-cockpit/
├── build.sh                  ← NEW. the one command a human runs
├── scripts/team.sh           ← NEW. the one command the lead runs
├── team/                     ← NEW. the role library
│   ├── ROLES.md              ← index: what each role is for, when to hire it
│   ├── TRANSPORT.md          ← intercom protocol + deadlock + never-kill-your-pane rules
│   ├── lead.md
│   └── {pm,researcher,architect,implementer,designer,accessibility,
│        verifier,devops,docs}.md
├── atomic/
│   ├── extensions/
│   │   ├── herdr-state.ts    ← existing, unchanged
│   │   └── build-intake.ts   ← NEW. the popup
│   └── workflows/
│       └── feature-development.ts   ← kept; hcm-*.ts and intercom-team.ts deleted
├── build/                    ← git-ignored run output
└── docs/ · herdr/ · ghostty/ · README.md · AGENTS.md
```

The governing split: **humans run `build.sh`, agents run `team.sh`.**

## Flow

```
./build.sh
   │
   ├─ Herdr session `cockpit`, ONE pane, named `lead`
   ├─ Atomic boots with -e herdr-state.ts -e build-intake.ts
   │
   ▼
build-intake.ts on session_start
   └─ ctx.ui.input("What do you want to build today?")
        └─ writes build/IDEA.md (raw, verbatim)
   │
   ▼
lead: /skill:prompt-engineer on IDEA.md
   └─ writes build/MISSION.md
   └─ HUMAN GATE: shows the refined mission, waits for confirmation
   │
   ▼
lead reads team/ROLES.md and hires:
   scripts/team.sh add researcher --reason "..."
   scripts/team.sh add implementer --reason "..."
   scripts/team.sh add verifier    --reason "..."
   │
   ▼
delegate over Intercom (send) · escalate (ask) · answer (reply)
any agent may run /workflow feature-development on its own slice
   │
   ▼
verifier proves it · pm accepts it · build/EVIDENCE.md · stop
```

`MISSION.md` changes status from a hand-written input to a generated output. That single
inversion is what makes atomic cockpit project-agnostic.

## Components

### `build.sh` — human entry point

**Does:** creates the Herdr session, builds one pane, boots the lead, hands off to the popup.
**Interface:** `./build.sh [--model claude-sonnet-5] [--session cockpit] [--dry-run] [--resume]`
**Depends on:** herdr, atomic, `team/lead.md`, both extensions.

Carries forward four mechanics the current `launch-atomic.sh` established by failing first:

1. Select the **unlabeled** pane — Herdr plugin panes carry labels (`Sidebar`, `Explorer`) and
   may register before the root shell pane.
2. **Retry** `agent start` against freshly split panes.
3. **No `exec`**, and tee stderr to a log, so a dead session is diagnosable.
4. **`/name` before any Intercom call.**

Fails fast on `atomic auth print-bearer-token` before booting anything. `--dry-run` prints the
plan and touches nothing. `--resume` re-attaches a lead to an existing `build/` run.

### `atomic/extensions/build-intake.ts` — the popup

**Does:** on `session_start`, opens `ctx.ui.input("What do you want to build today?")` and
writes the answer verbatim to `build/IDEA.md`.
**Depends on:** `ctx.ui.input`, env `ATOMIC_ROLE`, env `BUILD_DIR`.

Guards:

- **Only when `ATOMIC_ROLE=lead`** — otherwise every specialist pops a dialog at boot.
- **No-op if `IDEA.md` exists** — a lead restart resumes instead of re-asking and clobbering.
- **Cancel is recoverable** — `input()` returns `undefined`; nothing is written, and the
  extension registers `/build-intake` to reopen the popup.

**Unverified mechanism, with a proven fallback.** It is not established whether an extension
can make the agent begin a turn on its own after the popup resolves. If it cannot, `build.sh`
polls for `IDEA.md` and sends the one-line kickoff with `herdr pane send-text` — the mechanic
the current launcher already uses. Verify before implementing; the design holds either way.

### `scripts/team.sh` — the hiring helper

**Interface:** `team.sh add <role> --reason "..."` · `team.sh list` · `team.sh roles`

`add` validates the role exists, splits a pane (alternating right/down across existing agent
panes in creation order — deterministic and grid-shaped), renames the pane, boots Atomic with
that role's brief plus `TRANSPORT.md` plus the mission path, `/name`s it, and appends a row to
`build/ROSTER.md` recording the role **and the lead's stated reason**.

Guardrails: **refuses duplicate roles**; **caps the team at 8** (`--force` to exceed). A lead
with bash and no ceiling is the difference between a demo and a runaway.

### `team/` — the role library

| File | Contents |
|---|---|
| `ROLES.md` | One line per role plus an explicit **"hire when…"** condition. This is what makes composition principled rather than arbitrary. |
| `lead.md` | Refine → gate → compose → delegate → converge, plus the hiring bound and the requirement to hire at least a `verifier`. |
| `TRANSPORT.md` | Intercom protocol, deadlock rules, never-kill-your-own-pane rule. Static and versioned rather than generated per launch. |
| Nine role briefs | Each states what it owns, the artifact it produces (by path), how it verifies, and when to escalate. |

Briefs must read correctly for both a Rust CLI and a web app. `implementer` replaces today's
`frontend`/`backend`/`ax`: the mission supplies the domain, the brief supplies the discipline.

### Deleted and kept

**Deleted:** `examples/` entirely; `atomic/workflows/hcm-*.ts`; `atomic/workflows/intercom-team.ts`.
**Kept unchanged:** `atomic/extensions/herdr-state.ts`; `atomic/workflows/feature-development.ts`.

## The human gate

After `MISSION.md` is written and before any hiring, the lead shows the refined mission and
waits for confirmation via `ask_user_question`.

`prompt-engineer` is good at making a prompt sharper, which means it can also make it wider —
quietly promoting "a CSV-to-JSON CLI" into a plugin architecture. Two guards apply:
`MISSION.md` embeds the raw `IDEA.md` verbatim in its own section, and the human confirms
before autonomous spend begins. This is a gate exactly where the repo argues for one: the
moment before commitment, where a wrong decision is expensive and a correction is cheap.

## Failure modes

| Failure | Mitigation |
|---|---|
| Lead dies mid-run *(observed)* | No `exec`; stderr log; run state on disk; `build.sh --resume`. |
| Agent kills its own pane *(observed)* | `TRANSPORT.md` forbids `exit` / `pane close` / `server stop` and explains why; the log outlives the pane. |
| Session connects to broker unnamed *(observed)* | `team.sh` always `/name`s first. Otherwise the agent is unaddressable by role for its whole life. |
| Intercom deadlock | Only one `ask` outstanding per session, so the lead delegates with `send`, never `ask`; `team.sh` refuses duplicate roles. |
| Runaway hiring | Cap of 8 with `--force`; every hire logged with its reason. |
| Group partition | `ATOMIC_INTERCOM_GROUP` exported once in `build.sh` — all or none. Cross-group sends are rejected by the broker, so partial propagation is a silent split-brain. |
| Popup cancelled | Nothing written; `/build-intake` reopens. The lead must not hire without `MISSION.md`. |
| Auth missing | `build.sh` fails fast before booting anything. |
| Lead never runs `team.sh` (approach A's core risk) | One fixed command, stated in the brief and echoed in the kickoff; `team.sh roles` self-documents; the brief requires hiring at least a `verifier`. |
| Mission drift from refinement | Raw `IDEA.md` embedded verbatim; human gate before hiring. |

## Verification

There is no test suite, and per `AGENTS.md` "done" means the commands were run, not asserted.

**Zero-token checks:** `bash -n` on both scripts; `build.sh --dry-run`; `team.sh roles`.

**One real end-to-end run** on something small and cheap (for example, "a CLI that converts CSV
to JSON"), confirming the whole chain:

1. Popup appears before any tokens are spent.
2. `build/IDEA.md` holds the raw answer verbatim.
3. `build/MISSION.md` is generated and the human gate fires.
4. The lead hires a roster that fits the mission, logged in `build/ROSTER.md` with reasons.
5. Every hired agent appears in `intercom list` **by role name**.
6. Sidebar states are live for every pane (the `herdr-state` adapter).
7. The product builds and `build/EVIDENCE.md` is written.

**Docs:** markdown link check across the rewritten files — `AGENTS.md`'s first "done" criterion,
and this rewrite touches roughly 30 files.

## Evidence

Deleting the examples removes the repo's proof that the model works. The first real run is
recorded as `docs/case-study-first-run.md`: the raw idea, the refined mission beside it, the
roster the lead chose and why, the final evidence, and a capture of the cockpit growing from
one pane to N. This is a stronger argument than the HRIS example, because the reader supplies
their own project.

## Implementation phases

Each phase is independently verifiable and leaves the repo coherent:

1. **Cleanup** — delete `examples/`, the `hcm-*` and `intercom-team` workflows; rewrite
   `README.md`, `docs/*`, `AGENTS.md`; replace the `examples/agentic-hris/build/` entry in
   `.gitignore` with a root-level `/build/` (the run directory moves, and without this the
   generated product and its `node_modules` would be committed). Verify: link check passes, no
   stale references, `git status` is clean after a dry run.
2. **Intake and lead** — `build.sh`, `build-intake.ts`, `team/lead.md`, `team/TRANSPORT.md`.
   Verify: popup fires, `IDEA.md` and `MISSION.md` written, gate fires. One agent, cheap.
3. **Role library and hiring** — `team/ROLES.md`, nine briefs, `scripts/team.sh`.
   Verify: the full end-to-end run above.

## Open items

- **The human gate was recommended, not explicitly ratified.** It is specified here as adopted.
  If the run should proceed unattended, remove it from `team/lead.md` — it is one prompt
  instruction, not a structural dependency.
- **Whether an extension can self-start a turn** is unverified; the fallback is proven and the
  design does not depend on the answer.
- **`build/agentic-hris` artifacts from the pre-cleanup run** are git-ignored and therefore not
  recoverable after deletion. Decide whether anything there is worth preserving before phase 1.
