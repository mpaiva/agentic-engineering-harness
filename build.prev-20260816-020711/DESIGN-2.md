# DESIGN-2 — team-chat: pane → own tab

Mission: `build/MISSION-2.md`. Contract: `build/CONTRACT-2.md`. Card:
`design-team-chat-pane-own-tab`.

## Decision (hard-to-reverse: tab layout + invariant)

`team-chat` becomes a Herdr **tab**, created exactly like `kanban`/`team`:
label-idempotent `herdr tab create`, best-effort (`|| true` everywhere), and — the
load-bearing part — **no `$LAUNCHDIR/*.pane` record written**. That's what keeps
`scripts/team.sh` from ever splitting a hire into it or counting it against the agent cap.

Tab order after boot: `w1:t1` lead+hires, `w1:t2` team-chat, `w1:t3` kanban, `w1:t4` team.
(Chat first because it's the highest-traffic tab and matches the CHAT/BOARD/TEAM order
already used in the closing summary — no functional requirement forces this order, it's a
readability call.)

## Invariant check (criterion 2) — confirmed safe, not just asserted

`scripts/team.sh` hire-splitting logic (`team.sh:92-95`):
```sh
LAST_PANE="$(ls -t "$LAUNCHDIR"/*.pane 2>/dev/null | head -1)" || true
TARGET_FILE="${LAST_PANE:-$LAUNCHDIR/lead.pane}"
```
It globs `$LAUNCHDIR/*.pane` only. It never calls `herdr tab list`, never reads a tab label,
never touches anything by name — grepped `scripts/team.sh` for `herdr tab`: zero hits. A
tab that writes no `.pane` file is invisible to it by construction. Nothing in team.sh
changes.

**Bonus fix, worth flagging to lead**: today `team-chat.pane` IS written
(`build.sh:345`), and it lands in `$LAUNCHDIR` *after* `lead.pane` but *before* any hire —
so the current code has the first hire split off the **chat pane**, not the lead, until a
second hire exists. Moving chat to a tab (no `.pane` file) removes this side effect for
free: the first hire will correctly split from `lead.pane`.

## Exact `build.sh` change

**Delete lines 330–351** (current team-chat pane block: comment + `herdr pane list` label
check + `herdr pane split` + rename + `team-chat.pane` write + `send-text`/`send-keys`
launch).

**Insert in its place** (same location, right before the kanban tab block that currently
starts at line 353) — this new block, following the kanban/team block's exact idiom
(`herdr tab create` → idempotency via `herdr tab list` python filter → `herdr pane run` to
launch, no `.pane` file):

```bash
# Open a read-only "team chat" tab so the human can watch the whole intercom conversation as
# one feed (intercom-bridge.ts writes it — see specs/2026-08-14-intercom-team-chat-pane.md).
# Idempotent: skip if a team-chat tab already exists (e.g. on --resume). Best-effort: a
# failure here must never fail the run, so every herdr call swallows its error. Same pattern
# as the kanban/team tabs below: label-idempotent `herdr tab create`, and deliberately NO
# $LAUNCHDIR/*.pane record — scripts/team.sh hires by splitting the newest
# $LAUNCHDIR/*.pane file, and a team-chat.pane entry would make every hire land in this tab
# (and count against the agent cap) instead of splitting from the lead/hire grid.
if ! herdr tab list 2>/dev/null | python3 -c "
import sys, json
def labelled(o):
    if isinstance(o, dict):
        return o.get('label') == 'team-chat' or any(labelled(v) for v in o.values())
    if isinstance(o, list):
        return any(labelled(v) for v in o)
    return False
try: sys.exit(0 if labelled(json.load(sys.stdin)) else 1)
except Exception: sys.exit(1)
"; then
  CHATPANE="$(herdr tab create --label team-chat --cwd "$HERE" --no-focus 2>/dev/null \
    | python3 -c "
import sys, json
def find(o):
    if isinstance(o, dict):
        if 'pane_id' in o: return o['pane_id']
        for v in o.values():
            r = find(v)
            if r: return r
    if isinstance(o, list):
        for v in o:
            r = find(v)
            if r: return r
    return None
try: print(find(json.load(sys.stdin)) or '')
except Exception: pass
" 2>/dev/null || true)"
  if [ -n "$CHATPANE" ]; then
    # Pass the feed and the team's intercom group so the viewer's "chat" peer joins the same
    # group as the agents (otherwise the human could not message them). BUILD_DIR-derived
    # path means --session beta watches build-beta/team-chat.log.
    herdr pane run "$CHATPANE" env "TEAMCHAT_FEED=$BUILD/team-chat.log" "ATOMIC_INTERCOM_GROUP=$GROUP" ./scripts/team-chat.sh >/dev/null 2>&1 || true
  fi
fi
```

Notes on the swap:
- `herdr pane run <PANE> env K=V ... CMD` replaces the old `send-text` + `send-keys Enter`
  two-step — matches how kanban/team launch their viewer script, and avoids a race where
  Enter is sent before the shell prompt is ready (tab-create panes are fresh shells, same as
  kanban/team's).
- No `herdr pane rename` call: tab-created panes take their tab's label already; kanban/team
  don't rename their pane either.
- `scripts/team-chat.sh` itself is untouched — it already reads `TEAMCHAT_FEED` and
  `ATOMIC_INTERCOM_GROUP` from the environment (see current inline `send-text` line 348),
  so `herdr pane run ... env K=V ... ./scripts/team-chat.sh` is a drop-in equivalent launch
  path.

## Closing summary block (build.sh ~L448, criterion 6)

Change:
```
 CHAT:     opens automatically in the 'team-chat' pane · reopen: ./scripts/team-chat.sh
```
to:
```
 CHAT:     opens in the 'team-chat' tab · reopen: ./scripts/team-chat.sh
```
(match the phrasing style already used by the `BOARD:`/`TEAM:` lines directly below it —
`opens in the 'X' tab · reopen: ...`). This is a 1-line text change, no logic.

## Addendum — designer's Finding 2 & 5 (routed here per their message)

### Finding 2 — tab 1 needs an explicit label

**Decision: rename tab 1 to `crew`, leave the roster tab's label as `team`.** Renaming the
roster tab instead would touch more surface (README, closing summary, `team-status.sh`
comments already say "team" tab) for no benefit — `crew` is unclaimed, reads correctly next
to `kanban`/`team-chat`/`team`, and needs a change in exactly one place: build.sh, once,
right after `$LEAD` is established.

Verified `herdr tab rename <TAB_ID> <LABEL>` exists (`herdr tab rename --help`) and that
`herdr pane list` already returns each pane's `tab_id` (confirmed live:
`{"pane_id":"w1:p1",...,"tab_id":"w1:t1",...}`). No new API surface needed. Grepped
`build.sh`/`README.md` for `"tab 1"` / numeric tab references — zero hits, so nothing else
depends on the tab staying unlabeled.

**Exact `build.sh` change**: insert this block right after line 231
(`echo "$LEAD" > "$LAUNCHDIR/lead.pane"`), before the `/name`/kickoff sends — it only needs
`$LEAD` to exist, and doing it early keeps all "make tab 1 legible" logic together instead
of scattered near the end:

```bash
# Give tab 1 an explicit label so it doesn't read as a bare "1" in the tab bar, ambiguous
# next to the 'team' roster tab (UX finding 2, build/UX-REVIEW-2.md). Idempotent: skip if a
# tab already carries the 'crew' label (e.g. on --resume). Best-effort — never fails the run.
if ! herdr tab list 2>/dev/null | python3 -c "
import sys, json
try: tabs = json.load(sys.stdin)['result']['tabs']
except Exception: sys.exit(1)
sys.exit(0 if any(t.get('label') == 'crew' for t in tabs) else 1)
"; then
  LEAD_TAB="$(herdr pane list 2>/dev/null | python3 -c "
import sys, json
try: panes = json.load(sys.stdin)['result']['panes']
except Exception: sys.exit(1)
p = [x for x in panes if x['pane_id'] == '$LEAD']
print(p[0]['tab_id'] if p else '')
" 2>/dev/null || true)"
  [ -n "$LEAD_TAB" ] && herdr tab rename "$LEAD_TAB" crew >/dev/null 2>&1 || true
fi
```

No closing-summary wording depends on tab 1's label today (WATCH just says
`herdr --session $SESSION`), so this is additive — no other line needs to change for
criterion 6 beyond the CHAT line already specified above.

### Finding 5 — agent announces workflow run id in team-chat (optional)

**Decision: defer, do not implement this phase.** It requires editing `team/*.md` role
briefs (e.g. `team/lead.md` or a shared convention) to instruct every role to `send` its
run id on workflow launch — that's writable only by lead/PM per the harness's own
read-only-for-architect rule on `team/`, it is not required by any MISSION-2 success
criterion, and MISSION-2's non-goals explicitly rule out changing the hiring/role model.
Criterion 5 is already satisfied without it (F2 / `/workflow connect <run-id>` inside the
launching agent's own pane, documented by docs per Finding 4). Logging it here so it isn't
lost, per designer's note — lead's call if a future phase wants it.

## Verification implementer should run (criterion 3)

1. Fresh boot (`./build.sh`, answer intake): `herdr pane list` filtered to `w1:t1` shows
   exactly 1 pane (`lead`) before any hire.
2. `herdr tab list` shows 4 tabs: `crew` (`w1:t1`, renamed from default `1`), `team-chat`,
   `kanban`, `team`.
3. Hire one throwaway role (or trace + `--force` per contract's guidance), confirm
   `$LAUNCHDIR/<role>.pane` is written and the new pane lands split from `lead.pane`
   (first hire) — not inside the team-chat tab, and no `team-chat.pane` file exists in
   `$LAUNCHDIR` at any point.
4. `bash -n build.sh` passes.

## Handoff

Files: `build/DESIGN-2.md` (this file). No other files touched by architect this round.
