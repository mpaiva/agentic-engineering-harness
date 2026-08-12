#!/usr/bin/env bash
# launch.sh — stand up a Herdr-monitored team of Claude agents that autonomously build
# the agentic-first HRIS in MISSION.md, coordinating via `herdr agent prompt`.
#
#   ./launch.sh                 # DRY RUN — print the plan + every prompt, touch nothing
#   ./launch.sh --layout        # build the split-pane Herdr grid only (no paid agents)
#   ./launch.sh --go            # FULL LAUNCH — start 9 live Claude agents, autonomous
#   ./launch.sh --go --session my-hris
#
# Team & layout (right + down splits) — a 3×3 grid:
#     ┌───────────────┬───────────────┬───────────────┐
#     │  lead         │ pm            │ researcher    │
#     ├───────────────┼───────────────┼───────────────┤
#     │  designer     │ frontend      │ ax            │
#     ├───────────────┼───────────────┼───────────────┤
#     │  accessibility│ backend       │ verifier      │
#     └───────────────┴───────────────┴───────────────┘
#
# GUARDRAILS: agents work only in ./build/ (isolated). Full-autonomy mode spends real
# Claude tokens across NINE agents for a long time — the mode the harness explicitly
# warns about; the `pm`/`verifier` (+ research/design/a11y specs) are the floor of trust.
# Watch it, and stop it when you want (see the end of this script's output).
#
# Verified against Herdr 0.8.0. Bash 3.2 safe.
set -euo pipefail

SESSION="agentic-hris"
MODE="dry-run"
while [ $# -gt 0 ]; do
  case "$1" in
    --go) MODE="go" ;;
    --layout) MODE="layout" ;;
    --session) SESSION="$2"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac; shift
done

HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="$HERE/build"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }
pane_id(){ python3 -c "import sys,json;print(json.load(sys.stdin)['result']['pane']['pane_id'])"; }

SPECIALISTS="pm researcher designer frontend ax backend accessibility verifier"   # everyone but lead

shared_context(){ # $1 = role name
  cat <<EOF
You are the "$1" agent on an autonomous engineering team building an agentic-first HRIS.
Mission & definition of done: $HERE/MISSION.md  (read it fully before acting).
All work happens under: $BUILD  (create/use it; never touch anything outside it).
You are inside Herdr; your teammates are live agents in this session: lead, pm, researcher,
designer, frontend, ax, backend, accessibility, verifier. The "lead" agent will assign you
scoped tasks in this pane. Acknowledge your role in one line, then WAIT for the lead's first task.

--- YOUR ROLE BRIEF ---
$(cat "$HERE/team/$1.md")
EOF
}

lead_kickoff(){
  cat <<EOF
You are the "lead" agent — principal engineer and orchestrator of this team. Confirm you are
inside Herdr (test "\${HERDR_ENV:-}" = 1), then drive the build.

Mission & definition of done: $HERE/MISSION.md  (read it fully now).
Build directory (isolated): $BUILD
Your team, each a live Claude agent in this same Herdr session — talk to them by name:
  herdr agent prompt pm "..."              herdr agent prompt researcher "..."
  herdr agent prompt designer "..."        herdr agent prompt frontend "..."
  herdr agent prompt ax "..."              herdr agent prompt backend "..."
  herdr agent prompt accessibility "..."   herdr agent prompt verifier "..."
  herdr agent wait <name> --until idle --until blocked --timeout 1800000   # await a handoff
  herdr agent read <name>                                                   # read their output

"pm" is your peer: pm owns WHAT/WHY (priorities, scope, product acceptance), you own HOW.
Begin now: (1) read the mission; (2) in parallel, task "pm" to write $BUILD/PRD.md (v1 scope,
non-goals, acceptance criteria) and "researcher" to gather evidence into $BUILD/RESEARCH.md;
(3) with the PRD + research, have "designer" write $BUILD/DESIGN.md and "accessibility" write
$BUILD/A11Y.md while "backend" ships the data model + tools + seed; (4) write $BUILD/CONTRACT.md
fixing the data model, API surface, and copilot tool contract; (5) then have "frontend" and "ax"
build to the specs; (6) after each slice, task "verifier" to re-run checks and report evidence,
and "pm" to accept it against the PRD — do not call it done without both. Route product/scope
questions to "pm" and "how does X work" questions to "researcher".
Drive to the MISSION.md acceptance criteria, write $BUILD/EVIDENCE.md, then stop. Max ~3 repair
cycles per slice, else write $BUILD/BLOCKED.md and stop for the human.

--- YOUR ROLE BRIEF ---
$(cat "$HERE/team/lead.md")
EOF
}

# ── DRY RUN: print the plan and the exact prompts, touch nothing ─────────────────
if [ "$MODE" = "dry-run" ]; then
  echo "════════════════════════════════════════════════════════════════════"
  echo " DRY RUN — nothing launched. Team, layout, and prompts below."
  echo " Session: $SESSION   ·   Build dir: $BUILD"
  echo "════════════════════════════════════════════════════════════════════"
  echo "Team: lead $SPECIALISTS"
  echo; echo "── lead kickoff prompt ──"; lead_kickoff | sed 's/^/  /'
  for r in $SPECIALISTS; do
    echo; echo "── $r prompt ──"; shared_context "$r" | sed 's/^/  /'
  done
  echo; echo "To build just the Herdr grid:   ./launch.sh --layout"
  echo "To launch for real (paid, autonomous):   ./launch.sh --go"
  exit 0
fi

# ── Preconditions for layout/go ──────────────────────────────────────────────────
command -v herdr >/dev/null || { echo "herdr not found on PATH (run ./scripts/setup.sh)" >&2; exit 1; }
if [ "$MODE" = "go" ]; then
  command -v claude >/dev/null || { echo "claude (Claude Code) not found on PATH (run ./scripts/setup.sh)" >&2; exit 1; }
fi
mkdir -p "$BUILD"

# Fresh session, started FROM the HRIS dir so every pane inherits that cwd.
herdr server stop >/dev/null 2>&1 || true
sleep 1
rm -rf "$HOME/.config/herdr/sessions/$SESSION"
sleep 0.5
( cd "$HERE" && command herdr server --session "$SESSION" >/dev/null 2>&1 & )
for _ in $(seq 1 40); do
  if herdr status 2>/dev/null | grep -q 'status: running' \
     && herdr workspace list 2>/dev/null | grep -q '"workspaces"'; then break; fi
  sleep 0.3
done
[ "$MODE" = "go" ] && herdr integration install claude >/dev/null 2>&1 || true
herdr workspace create --label "Agentic HRIS" >/dev/null 2>&1 || true

# ── Build the split grid (right + down): a 3×3 — row1 plan, row2 build, row3 assure ───
LEAD=$(herdr pane list | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['panes'][0]['pane_id'])")
PM=$(herdr pane split "$LEAD"            --direction right --no-focus --cwd "$HERE" | pane_id)
RESEARCHER=$(herdr pane split "$PM"      --direction right --no-focus --cwd "$HERE" | pane_id)
DESIGNER=$(herdr pane split "$LEAD"      --direction down  --no-focus --cwd "$HERE" | pane_id)
FRONTEND=$(herdr pane split "$PM"        --direction down  --no-focus --cwd "$HERE" | pane_id)
AX=$(herdr pane split "$RESEARCHER"      --direction down  --no-focus --cwd "$HERE" | pane_id)
ACCESSIBILITY=$(herdr pane split "$DESIGNER" --direction down --no-focus --cwd "$HERE" | pane_id)
BACKEND=$(herdr pane split "$FRONTEND"   --direction down  --no-focus --cwd "$HERE" | pane_id)
VERIFIER=$(herdr pane split "$AX"        --direction down  --no-focus --cwd "$HERE" | pane_id)
echo "grid: lead=$LEAD pm=$PM researcher=$RESEARCHER designer=$DESIGNER frontend=$FRONTEND ax=$AX backend=$BACKEND accessibility=$ACCESSIBILITY verifier=$VERIFIER"

if [ "$MODE" = "layout" ]; then
  echo "✓ Herdr grid built (no agents started). Attach to watch:  herdr --session $SESSION"
  echo "  Tear down:  herdr --session $SESSION server stop"
  exit 0
fi

# ── GO: start a Claude agent in each pane, then brief it ─────────────────────────
start_agent(){ # $1 name  $2 pane  $3 prompt
  # --dangerously-skip-permissions: agents must run commands without a human approving each
  # one, or an autonomous team stalls at every prompt. This is the risky mode the harness
  # warns about — the isolated build/ dir and the "only touch build/" instruction are the
  # guardrails. Run this on a throwaway machine/VM for real work (see docs/security.md).
  herdr agent start "$1" --kind claude --pane "$2" -- --dangerously-skip-permissions >/dev/null 2>&1 || {
    echo "  ! could not start agent '$1' on $2 (pane busy? claude missing?)" >&2; return 0; }
  herdr agent wait "$1" --until idle --timeout 45000 >/dev/null 2>&1 || sleep 4
  herdr agent prompt "$1" "$3" >/dev/null 2>&1 || echo "  ! could not prompt '$1'" >&2
  echo "  ✓ $1 launched + briefed"
}

# The root (lead) pane defaults to $HOME; point it at the project dir before launch.
herdr pane send-text "$LEAD" "cd \"$HERE\"" >/dev/null 2>&1 || true
herdr pane send-keys "$LEAD" Enter >/dev/null 2>&1 || true
sleep 1

echo "Starting specialists (they acknowledge their role, then await the lead)…"
start_agent pm            "$PM"            "$(shared_context pm)"
start_agent researcher    "$RESEARCHER"    "$(shared_context researcher)"
start_agent designer      "$DESIGNER"      "$(shared_context designer)"
start_agent frontend      "$FRONTEND"      "$(shared_context frontend)"
start_agent ax            "$AX"            "$(shared_context ax)"
start_agent backend       "$BACKEND"       "$(shared_context backend)"
start_agent accessibility "$ACCESSIBILITY" "$(shared_context accessibility)"
start_agent verifier      "$VERIFIER"      "$(shared_context verifier)"
echo "Starting the lead (it will read the mission and delegate)…"
start_agent lead "$LEAD" "$(lead_kickoff)"

cat <<EOF

════════════════════════════════════════════════════════════════════
 The team is live and autonomous. Nine Claude agents are now working.
════════════════════════════════════════════════════════════════════
 WATCH:    herdr --session $SESSION          (attach the TUI; the sidebar shows each
           agent working / blocked / done — supervise by exception)
 PEEK:     herdr --session $SESSION agent read lead
 NUDGE:    herdr --session $SESSION agent prompt lead "status?"
 STOP 1:   herdr --session $SESSION agent send-keys <name> C-c   (interrupt one agent)
 STOP ALL: herdr --session $SESSION server stop                 (halt the whole team)

 Output lands in:  $BUILD   (isolated — nothing else in the repo is touched)
 Cost: nine live agents running autonomously spend real tokens continuously.
       Check in, and stop them when you've seen enough.
EOF
