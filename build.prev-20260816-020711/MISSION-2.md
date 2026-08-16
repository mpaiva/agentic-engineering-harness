# Mission — phase 2: cockpit UX

## Raw idea

See `build/IDEA-2.md` (verbatim).

## Goal

A senior engineer who runs `./build.sh` gets a cockpit that reads clearly at a glance:
each Herdr tab has one job, the live intercom conversation is not fighting the lead's own
pane for space, and the human can actually see an agent's Atomic workflow graph when one is
running — not just read about a "future adapter" that undersells what Atomic already ships
today (`/workflow connect`, `F2` graph overlay). Atomic cockpit becomes something an engineer
would show a colleague, not something they'd forgive.

## Current state (verified this session)

- Tab 1 (`w1:t1`) holds 6 panes: `lead`, `team-chat`, and up to 4 hires — team-chat was
  split as a pane next to the lead (`build.sh` ~L341), competing for space as hires grow.
- `kanban` (`w1:t2`) and `team` (`w1:t3`) are already dedicated tabs, each with exactly 1
  pane, opened idempotently by label check, and deliberately write no `$LAUNCHDIR/*.pane`
  record so `scripts/team.sh` never splits hires from them.
- `scripts/team.sh` finds where to put the next hire by splitting the **newest**
  `$LAUNCHDIR/*.pane` file — any new tab must not break that invariant.
- `herdr/atomic-integration.md` says a graph view "does not exist in Atomic 0.9.12" —
  that's true only for a *Herdr-sidebar* adapter. Atomic's own TUI already has a graph
  overlay: `/workflow status <run-id>`, `F2`, or `/workflow connect <run-id>` (confirmed in
  `atomic/docs/workflows.md:116`). The doc conflates the two and undersells what ships
  today.

## Success criteria

1. `team-chat` opens as its own Herdr tab (like `kanban`/`team`), not a pane split off the
   lead. Idempotent (skip on `--resume` if it already exists) and best-effort, matching the
   existing pattern for `kanban`/`team`.
2. `scripts/team.sh`'s hire-splitting logic is unaffected — verified by hiring one role
   after the change and confirming it still splits from the newest hire pane, not the chat
   tab.
3. Tab 1 holds only `lead` + hires after the change (chat and board panes no longer share
   it) — verified with `herdr pane list` showing 1 pane on `w1:t1` at boot with 0 hires.
4. `herdr/atomic-integration.md` (and any other doc making the same claim) is corrected to
   distinguish "Atomic's own graph view exists today" from "a Herdr-sidebar adapter does
   not exist yet" — each claim backed by a command or doc citation.
5. A concrete, documented way for the human to open an agent's live workflow graph from
   inside this cockpit exists — at minimum a documented command/keystroke
   (`/workflow connect <run-id>` or `F2` inside that agent's pane), ideally a short helper
   or README section explaining when a hired teammate is running a named workflow and how
   to watch it. No fabricated "auto-opens a graph tab" claim unless actually implemented
   and verified.
6. `README.md`'s summary of what opens where (CHAT/BOARD/TEAM lines, ~L448-450) matches
   the new tab layout exactly.
7. A UX pass judges the full boot sequence (tabs, pane labels, the closing summary block in
   `build.sh`) against at least 3 named usability heuristics (e.g. visibility of system
   status, consistency, minimal memory load) with a short written rationale per change —
   not just "moved chat," but *why* it reads better.
8. Every shell script touched passes `bash -n`; every doc link touched still resolves.
9. `build/EVIDENCE-2.md` records each criterion, the command/check that verified it, and
   result — same discipline as phase 1's `build/EVIDENCE.md`.

## Constraints

- Same as phase 1 (`build/MISSION.md` Constraints section applies unchanged): no new
  runtime deps, no secrets, no new remote/push, ground every tool claim in the actual
  installed binary, don't invent a test suite this repo doesn't have.
- Preserve `scripts/team.sh`'s "no pane record for board-style tabs" invariant — do not
  make the chat tab hireable-into.
- Do not build the full "Atomic ↔ Herdr adapter" described as a future milestone in
  `herdr/atomic-integration.md` — that's a real, large, separate project. This phase
  surfaces what Atomic already has today; it does not build the adapter.

## Non-goals

- Not redesigning Ghostty config or keybindings.
- Not building the Herdr-sidebar↔Atomic-stage adapter (still a documented future
  milestone, not this mission).
- Not adding new roles to `team/ROLES.md` or changing the hiring model.
- Not touching phase 1's closed items (G1/G2/G3, link health) unless this phase's changes
  break them.

## Stop rules

Same discipline as phase 1: 3 repair cycles per item max, then `build/BLOCKED.md` and wait.
No hard deadline — "no rush" from the human is explicit; correctness and taste over speed.
Stop when every success criterion is checked in `build/EVIDENCE-2.md`.
