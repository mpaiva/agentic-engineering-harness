#!/usr/bin/env bash
# new-workspace.sh — create a Herdr workspace for one engineering outcome.
#
#   ./scripts/new-workspace.sh EE-1428 "Employee Event Details"
#
# One meaningful engineering outcome = one workspace (see herdr/workspace-conventions.md).
# Ensures a headless Herdr server for the session is running, then creates the workspace.
# Verified against Herdr 0.8.0.
set -euo pipefail

ID="${1:?usage: new-workspace.sh <TICKET-ID> <title>}"
TITLE="${2:?usage: new-workspace.sh <TICKET-ID> <title>}"
SESSION="$(echo "$ID" | tr '[:upper:]' '[:lower:]')"
export PATH="$HOME/.local/bin:$PATH"

herdr(){ command herdr --session "$SESSION" "$@"; }

# Start the persistent server for this session if it isn't already up.
if ! herdr status 2>/dev/null | grep -q 'status: running'; then
  echo "› starting Herdr server for session '$SESSION'…"
  command herdr server --session "$SESSION" >/dev/null 2>&1 &
  # wait for the socket to answer
  for _ in $(seq 1 30); do
    if herdr status 2>/dev/null | grep -q 'status: running'; then break; fi
    sleep 0.3
  done
fi

echo "› creating workspace: $ID $TITLE"
herdr workspace create --label "$ID $TITLE" >/dev/null
echo "✓ workspace ready."
echo
echo "Next:"
echo "  ./scripts/launch-feature.sh $ID \"<objective>\"     # drive the feature workflow"
echo "  ./scripts/status.sh $ID                            # cockpit rollup"
echo "  herdr --session $SESSION                            # attach the TUI (from Ghostty)"
