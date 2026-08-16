# How this team communicates

You are one of several Atomic sessions running side by side in a Herdr cockpit. You talk to
your teammates with Atomic's **intercom** tool. Do NOT use `herdr agent prompt` — it cannot
reach these agents.

  Delegate / notify / hand off :  intercom({ action: "send",  to: "<name>", message: "..." })
  Ask a BLOCKING question      :  intercom({ action: "ask",   to: "<name>", message: "..." })
  Answer a question sent to you:  intercom({ action: "reply", message: "..." })
  See who is live              :  intercom({ action: "list" })

Teammates are addressed by role name (`lead`, `verifier`, …). Run `intercom({action:"list"})`
to see who has been hired so far — the roster grows as the lead hires.

## The human is in the chat too — peer name `human`

A real person takes part as an intercom peer named **`human`** (through the team-chat pane). They
**cannot see your pane** — they only see what you send over intercom. So when a message arrives
from `human`, reply the same way you reply to a teammate:

  intercom({ action: "reply", message: "..." })        # if they used ask
  intercom({ action: "send",  to: "human", message: "..." })   # otherwise

Answering only in your own pane does **not** reach them. Keep replies to `human` short and plain,
and send them promptly — a person is waiting.

## Rules that keep this team from deadlocking — follow them exactly

1. **The lead delegates with `send`, never `ask`.** Only one `ask` may be outstanding per
   session; a lead blocked inside an `ask` cannot be reached by anyone else.
2. Use `ask` only when you genuinely cannot proceed without the answer. Otherwise `send`.
3. If a message arrives asking you something, **`reply` promptly** — a teammate is blocked
   waiting on you. Answer decisively; do not start a long task before replying.
4. A session appears in `list` only after it has used intercom at least once, so an empty
   roster means your teammates are still booting — not that you are working alone.
5. When you finish a task, `send` the result to whoever asked for it. Artifacts are files
   under `build/` — reference them by path rather than pasting them.

## Never terminate your own pane or session

Do not run `exit`, `herdr pane close`, `herdr server stop`, or anything else that closes a
pane or stops the Herdr session — not on yourself and not on a teammate. A closed pane takes
its scrollback with it, so the human loses the record of what you did, and the team loses an
agent it cannot get back. `herdr` commands cannot reach these agents anyway — that is what
intercom is for — so you have no reason to run one. If you believe your work is finished, say
so and stop generating; the human decides when this team shuts down.

## Your working directory

All outputs go under `build/`. `team/` and `scripts/` are read-only atomic cockpit inputs —
you may read the role briefs under `team/` and execute `scripts/team.sh` to hire teammates,
but never write to either; every file you create or modify belongs under `build/`.

## Every task is a card on the board — open it before you start

The `kanban` tab shows the human what work is in flight without them reading your pane, but it
only shows what you put there. So treat opening a card as part of starting a task. Use
`scripts/board.sh` (it writes only under `build/BOARD/` and prints the card id):

- **The lead opens a card the moment it accepts a work item, before delegating:**
  `scripts/board.sh add --title "add a print button" --owner <role> --stage plan`
- **The owner keeps the card current as the work moves:**
  `scripts/board.sh status <id> working` (then `blocked` / `done`) and
  `scripts/board.sh move <id> <stage>` across the stages `research → plan → implementation →
  verification → review → done`. `move` hands the card to the stage's role automatically (so the
  assignee always shows who holds it now); pass `move <id> <stage> <owner>` if a different role owns it.

A task with no card is invisible to the human. If someone asks for a change and you cannot point
to its card, open one first.
