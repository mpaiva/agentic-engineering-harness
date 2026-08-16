# The kanban board — every card's stage at a glance

`build.sh` opens a tab named `kanban` running [scripts/kanban.sh](../scripts/kanban.sh): a live
board whose columns are the harness's own workflow stages. Agents and the human put cards on it
with [scripts/board.sh](../scripts/board.sh). All board state is files under `build/BOARD/` —
git-ignored run output, like everything else under `build/`.

## Columns are the workflow stages

The six columns are fixed, in this order — the stages from
[monitoring-agents.md](monitoring-agents.md):

| `stage:` value in a card | Column |
|--------------------------|--------|
| `research` | RESEARCH |
| `plan` | PLAN |
| `implementation` | IMPLEMENTATION |
| `verification` | VERIFICATION |
| `review` | HUMAN REVIEW |
| `done` | DONE |

A card with a missing or unknown `stage:` falls into RESEARCH.

## The card format

One markdown file per card under `build/BOARD/`. A small header, a `---` separator, then the
title (first line) and an optional body:

```text
stage: implementation
status: working
owner: implementer
---
CSV export endpoint
Streams rows instead of buffering; verifier checks the 1M-row case.
```

`status:` drives the card's colour on the board: `waiting` (dim grey), `working` (teal),
`blocked` (yellow), `done` (green).

## Driving the board with board.sh

```bash
./scripts/board.sh add --title "CSV export endpoint" --stage implementation --owner implementer
# prints the card's id, e.g. csv-export-endpoint

./scripts/board.sh move csv-export-endpoint verification
./scripts/board.sh status csv-export-endpoint blocked
./scripts/board.sh list
```

`add` accepts `--body` for the optional body text; new cards start as `status: waiting`. `move`
reassigns the card's owner to the stage's role (research→researcher, plan→architect,
implementation→implementer, verification→verifier, review→lead; `done` keeps whoever finished
it) so the assignee always shows who holds the work now — pass an explicit third argument,
`move <id> <stage> <owner>`, to override.
The files are plain markdown — editing one by hand is equally valid, the viewer picks up any
change within a second.

## Watching the board

The `kanban` tab opens automatically on `./build.sh` (and `--resume`). Reopen it anywhere with:

```bash
./scripts/kanban.sh                         # the default build/BOARD/
BUILD_DIR=$PWD/build-beta ./scripts/kanban.sh   # a --session beta run's board
```

Keys: `←`/`→` or `h`/`l` select a column, `↑`/`↓` or `j`/`k` a card, `p` previews the selected
card's markdown full-screen, `q` quits. The board repaints on every resize, so the columns never
shatter — the same live-TUI approach as [the team chat pane](../scripts/team-chat.sh). Piped
output (`./scripts/kanban.sh | cat`) renders the board once and exits.
