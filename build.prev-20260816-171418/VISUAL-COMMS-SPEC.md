# Spec — four-tab stakeholder visual communication upgrade

Refined from human's raw request (prompt-engineer pass: outcome, audience, per-tab
success criteria, constraints, stop rules).

## Raw request

> the chat needs to communicate in plain language, the kanban must track every task by
> each member, the team needs to provide a profile for each crew member currently in the
> session and also those members available in the harness but not being used. the
> workflows can provide a forecast of stages with ETA and complexity level, as well as
> detailed completion status.

## Outcome

A non-technical stakeholder watching any of the 4 Herdr tabs (chat, kanban, team,
workflows) understands crew progress without asking the lead a question first.

## Audience

`human` — the team-chat peer. Not a developer. Reads tabs, not logs.

## Scope note (amends mission Non-goal)

`build/MISSION.md` non-goals say "no dashboard beyond what herdr-board/kanban already
provides." This request explicitly asks to extend those 4 existing tabs — direct human
instruction supersedes that line for this work item. Not a new framework, not a new tab:
improving copy/data density on tools already built (`cockpit.sh`, `scripts/kanban.sh` /
`board.sh`, `scripts/team-status.sh`, `scripts/workflow-tab.sh`).

## Per-tab success criteria

### 1. Chat tab (`scripts/team-chat.sh`)
1. Every automated status line reads as one plain-English sentence a non-engineer
   understands — no bare stage ids, run UUIDs, or tool-call jargon without a plain gloss.
2. A sample transcript in `build/EVIDENCE.md` shows a raw event next to its rendered
   plain-language line.

### 2. Kanban tab (`scripts/kanban.sh` + `scripts/board.sh`)
1. Every open or done task is attributed to exactly one owning crew member, visible in
   the card view without opening the file.
2. A stakeholder can answer "what is X working on right now" by reading the board alone.
3. Cards missing an owner are impossible to create (`board.sh add` requires `--owner`,
   already true — confirm and document).

### 3. Team tab (`scripts/team-status.sh`)
1. Every currently-hired crew member (live in `intercom list` / `herdr agent list`) shows
   a one-line profile: role, what they own, current task, status.
2. Every role in `team/ROLES.md` **not** currently hired shows in a separate "available,
   not hired" section with a one-line description of when to hire it.
3. Section 2 never overlaps section 1 (no role appears in both).

### 4. Workflows tab (`scripts/workflow-tab.sh`)
1. Each tracked workflow run shows its stage list with a forecast: remaining stages, an
   ETA estimate, and a complexity label (low/medium/high) per stage.
2. Each run shows detailed completion status: stage-by-stage pass/fail/running/pending,
   not just an overall percentage.
3. ETA is derived from real data (elapsed time of completed stages, or a labeled
   estimate) — never a fabricated fixed number.

## Constraints

- No new dependencies. Bash/python3 only, matching existing scripts.
- Keep each script's existing non-interactive/piped fallback behavior (per team-status.sh
  header comment) — these run live in Herdr panes, not just interactively.
- Ground every "available role" claim in `team/ROLES.md`; ground every "hired member"
  claim in live `herdr agent list` / `intercom list` output, not assumption.
- Verifier re-runs every tab script and confirms the new content live before sign-off.

## Non-goals

- No new tab beyond the existing 4.
- No change to the underlying workflow/board/intercom data model — this is presentation
  only, reading data that already exists.

## Stop rules

- Each tab's criteria has evidence in `build/EVIDENCE.md` (command + before/after output)
  or is logged in `build/BLOCKED.md`.
- Repair cap: 3 rounds per tab, then escalate to lead.
