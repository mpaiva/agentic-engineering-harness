# Archived runs

One directory per finished `./build.sh` run, named for when it was archived
(`YYYYMMDD-HHMMSS`). Each is a frozen copy of that run's `build/` directory, moved here
rather than deleted.

These are **records, not examples**. Nobody edits them, and nothing in the project reads
from them. If a claim elsewhere in the repo cites `build/EVIDENCE.md` or `build/A11Y.md`
for a particular run, this is where that file actually is.

A live run writes to `build/`, which is gitignored — it is regenerated every time and is
never committed. When a run is done, archiving it here is what makes its paper trail
checkable:

```bash
mv build runs/$(date +%Y%m%d-%H%M%S)
```

`./build.sh` refuses to start over an existing `build/` and prints that command.

The first three were asked to improve this project itself; the fourth was asked to build
something with it.

| Run | Asked for | What came of it |
|---|---|---|
| `20260815-225614` | *"help finish building atomic cockpit"* | an audit of the whole repo, in `artifacts/cockpit-audit/` |
| `20260816-020711` | assess where we are, plan autonomously, hire as many agents as needed | a second pass with its own contract, design and UX review (the `-2` files) |
| `20260816-171418` | *"build a team to help me improve this repository"* | the team-chat, kanban, team and workflows tabs — see `TAB-COMMS-PLAN.md` and `VISUAL-COMMS-SPEC.md` |
| `20260816-201304` | one line of a public-domain poem every 2 seconds | the page written up in [docs/case-study-road-not-taken.md](../docs/case-study-road-not-taken.md) |

In all four:

- `IDEA.md` — the answer to *What do you want to build today?*, saved verbatim
- `MISSION.md` — that answer refined into numbered success criteria
- `ROSTER.md` — who was hired, and the reason given for each
- `EVIDENCE.md` — what the work claims, and how it was checked
- `BOARD/` — the kanban cards, one file each
- `team-chat.log` — every message the agents sent each other, as JSON lines
- `.launch/` — the generated per-agent launcher scripts and their stderr

Only when the mission called for it — which is itself worth reading, since it shows what the
lead judged the job to need:

- `CONTRACT.md` (3 of 4) — the shared interface the agents agreed on before splitting up
- `A11Y.md` (2 of 4) — accessibility findings, and any exemption the lead ruled on
- `EVIDENCE-VERIFIER.md` (1 of 4) — a second, independent pass by an agent that built none
  of it. Present only in `20260816-201304`, where the mission made independent proof a
  success criterion.
