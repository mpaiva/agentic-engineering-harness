#!/usr/bin/env bash
# graph-tab.sh — jump the human's cockpit to whichever pane owns a live workflow run, so they
# can see Atomic's own graph overlay (F2 / /workflow connect <run-id>).
#
#   ./scripts/graph-tab.sh              # focus the lead's pane (default owner)
#   ./scripts/graph-tab.sh <agent-name> # focus a specific teammate's pane instead
#
# This is deliberately NOT a new Herdr tab running its own `atomic` process. That was tried
# and disproven live — see specs/2026-08-16-graph-tab.md §1: a second `atomic` process cannot
# attach to a run launched by a different process (`/workflow connect <run-id>` fails with
# `Error: Run not found` even in the same project directory). The graph only exists inside the
# exact session that launched the run.
#
# So this script does the only thing that reliably works: `herdr agent focus <pane-id>`
# switches your cockpit's active pane to the one that owns the run, then YOU press F2 there.
# It does not inject `/workflow connect` text into that pane — see
# specs/2026-08-16-graph-tab.md §4 (7a): typing into a live agent's input while it may be
# mid-turn risks scrambling its conversation. F2 is a local TUI keybinding, not a chat
# message, so it is always safe to press.
#
# Note: `herdr agent focus` only accepts a pane ID, not the display name string shown by
# `herdr agent list`/`herdr pane list` (name-based lookup returns `agent_not_found` even for
# a live, correctly-labeled agent — verified live against Herdr 0.8.0). This script resolves
# the name to its pane ID first for that reason.
#
# v1 assumes the lead is the one launching named workflow runs (true for this harness's usage
# so far — see specs/2026-08-16-graph-tab.md §4). Pass an agent name to target someone else.
#
# Verified against Herdr 0.8.0. Bash 3.2 safe.
set -uo pipefail

AGENT="${1:-lead}"

if ! command -v herdr >/dev/null 2>&1; then
  echo "herdr not found on PATH." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found on PATH (needed to parse herdr's JSON)." >&2
  exit 1
fi

PANE_ID="$(herdr pane list 2>/dev/null | python3 -c "
import sys, json
agent = sys.argv[1]
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
panes = data.get('result', {}).get('panes', [])
for p in panes:
    if p.get('agent') == agent:
        print(p.get('pane_id', ''))
        sys.exit(0)
sys.exit(1)
" "$AGENT")"

if [ -z "$PANE_ID" ]; then
  echo "No live pane found for agent '$AGENT'. Check who's hired: herdr agent list" >&2
  exit 1
fi

if ! herdr agent focus "$PANE_ID" >/dev/null 2>&1; then
  echo "Warning: could not focus pane $PANE_ID for agent '$AGENT'." >&2
  echo "Focus it by hand:  herdr agent focus $PANE_ID" >&2
  exit 1
fi

echo "Focused '$AGENT''s pane ($PANE_ID)."
echo "Press F2 there to open Atomic's workflow graph overlay."
echo "(Empty overlay = no named workflow run is currently live in that session — not a failure.)"
