# UX review — boot sequence, tab/pane layout, closing summary (phase 2)

Scope: `build.sh` pane/tab creation (~L330-431) and closing summary block (~L439-453),
current README `CHAT/BOARD/TEAM` lines, and workflow-graph discoverability. Evaluated
against Nielsen heuristics.

## Heuristics used

1. **Visibility of system status** — the human should always know what's running and where.
2. **Consistency & standards** — same kind of thing should look/behave the same way.
3. **Recognition rather than recall** — the UI should show options, not require the human
   to remember a command from earlier in the scrollback.
4. **Minimal memory load / minimalist design** — fewer things to track, no redundant info.
5. **Match between system and the real world** — labels should mean what they say.

## Finding 1 — team-chat is a pane, kanban/team are tabs (inconsistency)

**Heuristic: Consistency & standards, Minimal memory load.**

`team-chat` is a pane split off `lead` on tab 1 (`build.sh` ~L341); `kanban` and `team` are
each their own tab (~L369, ~L410). Three "always-on cockpit surfaces" with two different
shapes. A human scanning the tab bar sees `[1] [kanban] [team]` and has no visual cue that
tab 1 secretly holds a second, equally-important surface (chat) crammed beside the lead. As
hires grow (up to 4), team-chat's pane keeps shrinking against them — the one place showing
the *whole team's conversation* competes for space with the panes doing the work.

Rationale for fix (already scoped to architect, criterion 1): promoting `team-chat` to its
own tab makes the three background-info surfaces (chat, board, roster) consistent in kind
and location — "background info lives in a tab, active work lives in pane splits on tab 1."
One mental model instead of two.

## Finding 2 — pane labels are accurate but not self-explanatory in the tab bar

**Heuristic: Match between system and real world, Recognition rather than recall.**

Tab bar today reads `1 · kanban · team` (soon `+chat`). A first-time user has no reason to
know tab `1` is "the live team" vs. `kanban` being a board vs. `team` being a roster — they
learn this only by reading the closing summary block in the terminal, which then scrolls out
of view. Once scrolled away, the human must *recall* what each tab is, not recognize it.

**Recommendation:** rename tab `1` itself to a label, not leave it as the numeric default.
Herdr's own tab bar already supports `--label` on `tab create`; there's no equivalent
first-tab rename call in `build.sh` today (it renames the *lead pane*, not the tab). If
`herdr tab rename` (or equivalent) exists, label tab 1 something like `team` — wait, that
collides with the roster tab's existing label. Use `crew` or `agents` for tab 1 and keep
`team` for the roster tab, or rename the roster tab to `roster` and free `team` for tab 1.
**This is a naming call, not mine to make alone — sending to architect for the exact label
set** so it doesn't collide with the invariant that `kanban`/`team` are found by label search
in `build.sh`.

## Finding 3 — closing summary block is the single source of truth, and it scrolls away

**Heuristic: Visibility of system status.**

`build.sh` ~L439-453 prints WATCH / ROSTER / MISSION / STOP / CHAT / BOARD / TEAM once, at
boot, to the launching terminal — not to any pane inside the cockpit itself. Once that
terminal's scrollback is gone (new tab, `clear`, closed window), the human has no in-cockpit
way to re-discover "how do I reopen chat" or "how do I stop this" short of reading
`build.sh`'s source or this README section again.

This is a **one-shot status message being asked to double as a permanent reference card.**
That's the actual defect — not the wording of the block itself, which is otherwise clear,
labeled, and scannable (fixed-width labels, one command per line — good use of consistency
already).

**Recommendation (to architect/implementer, not required by this phase's criteria but worth
logging):** the roster tab (`team`, via `scripts/team-status.sh`) is the one surface that
stays open the whole run — the natural place to also render the same reopen-commands
footer, so "how do I get chat back" is answerable by looking inside the cockpit, not by
scrolling a terminal that may already be gone. Out of scope to build this phase; noting it
so it isn't lost. Deliberately not doing this myself — scope guard, PM/architect call.

**In scope this phase:** the block's CHAT/BOARD/TEAM lines must be edited to match whatever
tab layout architect lands on (criterion 6) — see Finding 1. Concretely, once chat is its
own tab, the line should read the same shape as BOARD/TEAM already do:

```
 CHAT:     opens automatically in the 'team-chat' tab · reopen: ./scripts/team-chat.sh
```

(only the word "pane" → "tab" changes — sending exact wording to docs).

## Finding 4 — workflow graph view is effectively undiscoverable today

**Heuristic: Recognition rather than recall, Visibility of system status.**

Today, nothing in the cockpit — not the tab bar, not the closing summary, not
`herdr/atomic-integration.md` — tells a human that when a hired specialist launches a named
`/workflow`, they can watch its live stage graph. The only path is: know that Atomic ships
`/workflow status <run-id>`, `F2`, or `/workflow connect <run-id>` (confirmed
`atomic/docs/workflows.md:116`), know which agent pane is running the workflow, attach to
*that pane specifically*, and type the command. Nothing surfaces the run id to the human
without reading that agent's own scrollback first. That's four things to recall with zero
recognition affordances — the opposite of this heuristic.

**Recommendation (concrete, for docs + architect):**
1. Document the flow in `herdr/atomic-integration.md` as a discrete "how to watch it" recipe:
   attach to the pane the workflow-launching agent is running in
   (`herdr --session <SESSION>`, switch to its pane), then inside that pane's Atomic session
   press `F2` or run `/workflow connect <run-id>` — the run id appears in that agent's own
   turn output right after it launches the workflow (`workflow({action:"run",...})` returns
   it). No new tooling needed — this is criterion 5's "at minimum a documented
   command/keystroke," already met by what ships.
2. Nice-to-have, not required this phase: have the agent that launches a named workflow
   `send` the run id to `lead` (and therefore team-chat) as a one-line intercom message when
   it starts — e.g. `"launched feature-development, run <uuid> — watch with F2 or
   /workflow connect <uuid> in my pane"`. That single line closes the recognition gap
   entirely (human reads it in team-chat, no recall needed) without building any adapter.
   Flagging for architect/lead to decide if it's in scope — it's a one-line convention in
   `team/*.md`, not new code, so it may be cheap enough to include.

## Summary of concrete recommendations

| # | Change | Owner | Heuristic |
|---|--------|-------|-----------|
| 1 | team-chat → own tab (already scoped) | architect/implementer | Consistency |
| 2 | Give tab 1 an explicit label distinct from `team` (roster) | architect (naming) | Recognition over recall |
| 3 | CHAT line in closing summary: "pane" → "tab" | docs | Consistency |
| 4 | Document F2 / `/workflow connect <run-id>` recipe in `herdr/atomic-integration.md` | docs | Recognition, visibility |
| 5 (optional, flagging only) | Launching agent announces run id in team-chat | architect/lead call | Visibility of system status |

Not making layout or copy decisions myself — routing #2 to architect, #3-#4 to docs per the
contract's lane split.
