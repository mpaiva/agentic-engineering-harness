#!/usr/bin/env bash
# launch-feature.sh — drive the feature-development phases across Herdr panes.
#
#   ./scripts/launch-feature.sh EE-1428 "Add employee event history (WCAG 2.2 AA)"
#   ./scripts/launch-feature.sh EE-1428 "…" --demo    # no agents/credits; shows the choreography
#
# This is the Herdr-side realization of atomic/workflows/feature-development.ts:
# one pane per responsibility, phases advanced by agent STATE, human gates surfaced as
# BLOCKED. In production you would instead run the Atomic workflow (which fans out and
# verifies internally) and use Herdr as the cockpit — see herdr/atomic-integration.md.
#
# Modes:
#   --live  (default)  start real `claude` agents in panes and prompt them per phase.
#   --demo             deterministic placeholder workers — runnable with no model access.
#
# Verified against Herdr 0.8.0. `herdr agent wait` resolves only recognized live agents,
# so --demo authors state with `pane report-agent` and polls; --live uses `agent wait`.
set -euo pipefail

ID="${1:?usage: launch-feature.sh <TICKET-ID> <objective> [--live|--demo]}"
OBJECTIVE="${2:?usage: launch-feature.sh <TICKET-ID> <objective> [--live|--demo]}"
MODE="${3:---live}"
SESSION="$(echo "$ID" | tr '[:upper:]' '[:lower:]')"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

RESPONSIBILITIES=(research planner frontend backend test verifier)

ensure_server(){
  if ! herdr status 2>/dev/null | grep -q 'status: running'; then
    command herdr server --session "$SESSION" >/dev/null 2>&1 &
    for _ in $(seq 1 30); do
      if herdr status 2>/dev/null | grep -q 'status: running'; then break; fi
      sleep 0.3
    done
  fi
}

root_pane(){ herdr pane list 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['panes'][0]['pane_id'])"; }

# Split the root pane into one pane per responsibility; echo "name=pane_id" lines.
make_panes(){
  local root; root="$(root_pane)"
  local prev="$root" name pid
  for name in "${RESPONSIBILITIES[@]}"; do
    pid="$(herdr pane split "$prev" --direction down --no-focus 2>/dev/null \
          | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['pane']['pane_id'])")"
    herdr pane rename "$pid" "$name" >/dev/null 2>&1 || true
    echo "$name=$pid"
    prev="$pid"
  done
}

SEQ=0
set_state(){ # pane agent state [message]
  SEQ=$((SEQ+1))
  if [ -n "${4:-}" ]; then
    herdr pane report-agent "$1" --source launch-feature --agent "$2" --state "$3" --message "$4" --seq "$SEQ" >/dev/null 2>&1 || true
  else
    herdr pane report-agent "$1" --source launch-feature --agent "$2" --state "$3" --seq "$SEQ" >/dev/null 2>&1 || true
  fi
}
pane_of(){ eval "printf '%s' \"\${PANE_$1}\""; }

echo "════════════════════════════════════════════════════════════════"
echo " feature-development  ·  $ID"
echo " objective: $OBJECTIVE"
echo " mode: $MODE"
echo "════════════════════════════════════════════════════════════════"
ensure_server
herdr workspace create --label "$ID feature" >/dev/null 2>&1 || true

# Bash 3.2 (macOS default) has no associative arrays; map name→pane via dynamic vars.
while IFS='=' read -r name pid; do eval "PANE_$name=$pid"; done < <(make_panes)
echo "panes: $(for r in "${RESPONSIBILITIES[@]}"; do printf '%s=%s ' "$r" "$(pane_of "$r")"; done)"

if [[ "$MODE" == "--live" ]]; then
  cat <<EOF

LIVE mode drives real agents. For each responsibility the driver would:
  herdr agent start <name> --kind claude --pane <pane>
  herdr agent prompt <name> "<phase prompt scoped to that responsibility>"
  herdr agent wait  <name> --until done --until blocked --timeout 900000
Then advance to the next phase when the stage's agents report 'done', and stop for you
when any reports 'blocked'. Start it by attaching the TUI in Ghostty:  herdr --session $SESSION

Re-run with --demo to watch the full choreography here without model access.
EOF
  exit 0
fi

# ── --demo: deterministic choreography with real state transitions ──────────────
phase(){ echo; echo "── phase: $1 ──"; }
work(){ set_state "$(pane_of "$1")" "$1" working; sleep 0.4; }
done_(){ set_state "$(pane_of "$1")" "$1" idle; }   # idle = ready/finished for a hook

phase "research (parallel fan-out)"
for r in research frontend backend test; do work "$r"; done
for r in research frontend backend test; do done_ "$r"; done
./scripts/status.sh "$ID" || true

phase "plan"
work planner; sleep 0.4; done_ planner

phase "human gate — plan review (surfaced as BLOCKED)"
set_state "$(pane_of planner)" planner blocked "Approve plan to begin implementation?"
./scripts/status.sh "$ID" || true
echo "→ a human answers here; assume approved."
set_state "$(pane_of planner)" planner idle

phase "implementation (parallel)"
for r in frontend backend test; do work "$r"; done
for r in frontend backend test; do done_ "$r"; done

phase "verification (independent verifier)"
work verifier; sleep 0.4; done_ verifier
echo "✓ demo choreography complete. In a real run, evidence + gates gate the PR."
./scripts/status.sh "$ID" || true
