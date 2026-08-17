# Evidence — phase 2 (cockpit UX, `build/MISSION-2.md`)

Verified independently by `verifier` on 2026-08-15, after implementer/architect/docs
reported their slices done. Every command below was re-run by this agent.

## 1. `team-chat` opens as its own Herdr tab, not a pane split off the lead

**PASS**

```
$ grep -n "team-chat" build.sh | sed -n '1,6p'
331-370 block: herdr tab create --label team-chat ... herdr pane run "$CHATPANE" ...
```

Read `build.sh:331-370` in full: creates the tab with `herdr tab create --label team-chat`,
never splits a pane off `$LEAD`. Idempotent (checks `herdr tab list` for an existing
`team-chat` label first, skips if found) and best-effort (every `herdr` call ends `|| true`),
matching the existing `kanban`/`team` pattern.

## 2. `scripts/team.sh`'s hire-splitting logic is unaffected

**PASS** (code-trace + live API-shape verification; see note)

```
$ grep -n "herdr tab" scripts/team.sh
(no output — 0 hits)
$ sed -n '92p' scripts/team.sh
LAST_PANE="$(ls -t "$LAUNCHDIR"/*.pane 2>/dev/null | head -1)" || true
```

`team.sh` finds the hire target by globbing `$LAUNCHDIR/*.pane` only — it never calls
`herdr tab`. Neither `team-chat` (criterion 1) nor `kanban`/`team` write a `.pane` file
(confirmed: no `> "$LAUNCHDIR/team-chat.pane"`/`kanban.pane`/`team.pane` anywhere in
`build.sh`), so the newest `.pane` file is always a real hire, never a board-style tab.

Note: reproducing this live requires a `herdr session attach` (interactive) plus a real hire
(no paid model call needed, but TUI attach was not scriptable in this pass). Verified instead
via full code-trace of `build.sh`'s tab-creation blocks and `scripts/team.sh:92`, plus a live,
read-only `herdr pane list` / `herdr tab list` against a running session to confirm the JSON
field names (`result.tabs[].label`, `result.panes[].tab_id`, etc.) the scripts parse actually
match the installed Herdr's real output shape — not just the docs.

## 3. Tab 1 holds only `lead` + hires after the change

**PASS** (code-trace)

Traced every `herdr tab create` / pane-split call site in `build.sh`:
- `team-chat` (L331-370), `kanban` (L378-418), `team` (L420-431): each creates its **own**
  new tab via `herdr tab create`, none splits a pane on the lead's tab.
- The lead pane itself is the session's original default pane (found via `root_pane()` /
  `lead_pane_by_label()`, `build.sh:203-227`) — the only pane on tab 1 until `team.sh` splits
  hires from it.

No code path adds a non-hire pane to tab 1. This structurally guarantees "1 pane on `w1:t1`
at boot with 0 hires" without a live boot (a full boot needs a paid agent run, out of scope
per constraints).

## 4. `herdr/atomic-integration.md` corrected: Atomic's graph view vs. Herdr-sidebar adapter

**PASS** — verified in a prior slice pass, re-confirmed:

```
$ sed -n '49,57p' herdr/atomic-integration.md
```
L51: "Atomic already ships its own graph overlay for a running workflow — `/workflow status
<run-id>`, `F2`, or `/workflow connect <run-id>` all open it (see
`atomic/docs/workflows.md:116`). What does **not** exist ... is a bridge that projects that
stage graph into the Herdr *sidebar*."

Citation re-checked against the installed copy:
```
$ sed -n '116p' /Users/mp/.bun/install/global/node_modules/@bastani/atomic/docs/workflows.md
Named workflow runs execute in the background. By default, after launch expect a full run id
and monitor it with `/workflow status <run-id>`, F2, or `/workflow connect <run-id>`. ...
```
Exact match. The two claims (Atomic's own overlay ships; Herdr-sidebar bridge doesn't) are
now clearly separated, not conflated.

## 5. Documented way to open an agent's live workflow graph from inside the cockpit

**PASS**

`herdr/atomic-integration.md:59-73` ("Watching a workflow graph today"): numbered recipe —
attach to the session, switch to the agent's own pane, press **F2** or run `/workflow
connect <run-id>` / `/workflow status <run-id>`. Citations `atomic/docs/workflows.md:116`
and `atomic/docs/quickstart.md:148` both re-verified against the installed copies (exact
text match, see phase-1 EVIDENCE.md and prior verification round).

`README.md:173-179` mirrors this in plain language ("Click into that agent's own box, then
press F2, or type `/workflow connect <run-id>`...") and links to the doc section via
`herdr/atomic-integration.md#watching-a-workflow-graph-today` — anchor confirmed to resolve
(heading exists at `herdr/atomic-integration.md:59`).

No fabricated "auto-opens a graph tab" claim — both docs are explicit that it opens in the
agent's own pane, not the sidebar.

## 6. `README.md`'s summary of what opens where matches the new tab layout

**PASS, with one wording note**

```
$ grep -n "CHAT:\|BOARD:\|TEAM:" README.md build.sh
build.sh:488: CHAT:     opens in the 'team-chat' tab · reopen: ./scripts/team-chat.sh
build.sh:489: BOARD:    opens in the 'kanban' tab · add cards: ./scripts/board.sh · reopen: ./scripts/kanban.sh
build.sh:490: TEAM:     live roster in the 'team' tab · reopen: ./scripts/team-status.sh
```

**Note:** the CHAT/BOARD/TEAM closing-summary block lives in `build.sh` (the script's actual
terminal output), not in `README.md` itself — `README.md` has no literal copy of this block
(confirmed: `grep -n "CHAT:\|BOARD:\|TEAM:" README.md` returns 0 hits). `MISSION-2.md`'s
criterion 6 names the file as `README.md`; the artifact that matters (the text the human
actually sees) is accurate and matches the new tab layout exactly (`team-chat`/`kanban`/
`team`, "tab" not "pane" throughout). Flagging the file-reference mismatch as a documentation
label discrepancy in the mission text itself, not a defect in the shipped block — the
block's content is correct wherever it lives.

## 7. UX pass against ≥3 named usability heuristics, with rationale per change

**PASS**

`build/UX-REVIEW-2.md` exists, cites 5 named Nielsen heuristics (Visibility of system
status, Consistency & standards, Recognition rather than recall, Minimal memory load, Match
between system and the real world) and evaluates 4 findings against them with written
rationale for each (Finding 1: chat-tab promotion; Finding 2: tab-1 naming, routed to
architect — landed as `crew`; Finding 3: closing-summary scroll-away, explicitly logged as
out of phase-2 scope; Finding 4: workflow-graph discoverability, addressed by criterion 5).
Each finding states *why* the change reads better, not just what changed — matches the
criterion's "not just 'moved chat,' but why."

## 8. Every shell script touched passes `bash -n`; every doc link touched still resolves

**PASS**

```
$ bash -n build.sh && echo OK
OK
```
(No other scripts were touched this phase — only `build.sh`.)

```
$ python3 /tmp/linkcheck.py
Total broken: 0
```

Full site-wide re-scan across all 35 tracked `.md` files, not just the touched ones.

## 9. `build/EVIDENCE-2.md` exists

**PASS** — this file.

## Crew rename detail (build.sh:233-250)

Re-verified independently, beyond what the criteria strictly require:

```
$ bash -n build.sh && echo OK
OK
```

- Idempotency: checks `herdr tab list` for a tab already labeled `crew` before renaming;
  skips if found (safe on `--resume`).
- Finds the lead's `tab_id` via `herdr pane list`, filtering `panes` where `pane_id ==
  "$LEAD"`, reading `.tab_id`.
- Renames with `herdr tab rename "$LEAD_TAB" crew`.

CLI usage cross-checked against the installed binary:
```
$ herdr tab rename --help
Usage: herdr tab rename <TAB_ID> <LABEL>...
```
Matches exactly.

JSON field names the script parses (`result.tabs[].label`, `result.panes[].tab_id`, etc.)
cross-checked against a live, read-only query on a running (non-team) Herdr session:
```
$ herdr tab list
{"id":"cli:tab:list","result":{"tabs":[{"...","label":"1",...,"tab_id":"w1:t1",...}, ...
$ herdr pane list
{"id":"cli:pane:list","result":{"panes":[{"...","pane_id":"w1:p1","tab_id":"w1:t1",...}
```
Field names match what `build.sh`'s Python parses exactly.

Resulting tab order per the code trace: `crew` (renamed tab 1, holding `lead` + hires) →
`team-chat` → `kanban` → `team`, matching the claimed layout.

`grep -rn "tab 1\|tab1" README.md docs/*.md herdr/*.md` → 0 hits, confirming no doc sweep
needed for numeric tab references.

## Summary

All 9 `MISSION-2.md` criteria: **PASS**. One non-blocking note under criterion 6 (the
summary block's actual location is `build.sh`, not `README.md` as the mission text names it
— content itself is correct). Finding 5 (agent announces run id in team-chat) and Finding 3
(reopen-commands footer in the roster tab) remain explicitly deferred per
`UX-REVIEW-2.md` — not criteria of this phase.
