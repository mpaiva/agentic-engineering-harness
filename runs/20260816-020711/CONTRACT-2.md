# Contract — phase 2

Mission: `build/MISSION-2.md`. Read it first.

## Ground truth already gathered by lead (don't re-derive)

- Tab 1 (`w1:t1`) currently has 6 panes: `lead`, `team-chat`, 4 hires.
- `kanban`/`team` tabs are the reference pattern: `herdr tab create --label X --cwd "$HERE"
  --no-focus`, idempotency via `herdr tab list` + label search, **no** `$LAUNCHDIR/*.pane`
  record written (that's what keeps `scripts/team.sh` from splitting hires into them).
- `scripts/team.sh` hires by splitting the newest `$LAUNCHDIR/*.pane` file
  (`ls -t "$LAUNCHDIR"/*.pane | head -1`).
- `atomic/docs/workflows.md:116` confirms Atomic's own graph overlay:
  `/workflow status <run-id>`, `F2`, or `/workflow connect <run-id>`.
- `herdr/atomic-integration.md:51-57` currently says no graph view exists at all — that's
  wrong; only the Herdr-sidebar adapter is missing. Atomic's own graph view already ships.

## Work split

- **architect**: design the exact chat-tab shape before anyone edits code. Decide: does
  `build.sh` create the `team-chat` tab the same way as `kanban`/`team` (label-idempotent,
  no pane record)? What breaks in `scripts/team.sh` if `team-chat` becomes a tab instead of
  a pane (answer: verify nothing — team.sh only reads `.pane` files, never touches the tab
  by label)? Write the shape to `build/DESIGN-2.md`: exact `herdr` commands, which lines in
  `build.sh` move/change, and the invariant check for criterion 2. Hand off to implementer.
- **designer**: UX pass (criterion 7) — pick 3+ named usability heuristics (e.g. Nielsen's:
  visibility of system status, consistency & standards, recognition over recall, minimal
  memory load, aesthetic/minimalist design), evaluate current boot sequence + tab/pane
  layout + closing summary block against them, write findings + concrete recommendations to
  `build/UX-REVIEW-2.md`. Cover: tab layout, pane labels, the `README:CHAT/BOARD/TEAM`
  closing summary, and how a human would discover/use the workflow-graph view (criterion 5).
  Hand findings to architect (layout) and docs (copy/wording).
- **researcher**: verify every ground-truth claim before implementer/docs write anything —
  confirm `/workflow connect`/F2/`/workflow status` behavior against `atomic/docs/*.md` and,
  if feasible, a live check; confirm exactly which docs (not just atomic-integration.md)
  make the "no graph view" claim (`grep -rl` across `herdr/`, `docs/`). Report to lead +
  docs + implementer.
- **implementer**: once architect's `build/DESIGN-2.md` lands, make the actual `build.sh`
  change (chat as its own tab), verify `scripts/team.sh` hire-splitting still works
  end-to-end (hire a throwaway role, confirm it splits from the newest hire pane not the
  chat tab, then note how to verify without permanently using a role slot — e.g. don't
  actually hire, trace the logic + `--force` test if needed and clean up). Update the
  `README:CHAT/BOARD/TEAM` summary block to match.
- **docs**: fix `herdr/atomic-integration.md`'s graph-view claim (and any other file
  researcher flags) to distinguish "Atomic's own graph view ships today" from "Herdr-sidebar
  adapter doesn't exist yet." Add the documented way to open it (criterion 5) — command,
  keystroke, when it applies (an agent running a named `/workflow` launch).
- **verifier**: re-check everything independently once slices land. Criterion 3 check:
  `herdr pane list` after a fresh boot shows 1 pane on tab 1 pre-hire. Write
  `build/EVIDENCE-2.md` at the end.

## Sequencing

1. architect + designer + researcher start in parallel now.
2. implementer waits for architect's `build/DESIGN-2.md`.
3. docs waits for researcher's grep results, can start drafting in parallel.
4. verifier checks each slice as it lands; final EVIDENCE-2.md once all criteria pass.

## Board

Same convention as phase 1 — `scripts/board.sh add/move/status`, columns
`research → plan → implementation → verification → review → done`.

## Reporting

`send` lead on completion, reference files by path. >3 repair cycles on one item → `send`
lead immediately, don't grind.
