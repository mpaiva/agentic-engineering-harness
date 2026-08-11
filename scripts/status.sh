#!/usr/bin/env bash
# status.sh — supervision-by-exception cockpit for a workspace.
#
#   ./scripts/status.sh EE-1428
#
# Rolls up `herdr agent list` + workspace state into an at-a-glance view, drawing your
# attention to BLOCKED / UNKNOWN agents. This approximates the future Atomic↔Herdr
# adapter's sidebar (see herdr/atomic-integration.md) using only shipped commands.
# Verified against Herdr 0.8.0.
set -euo pipefail

ID="${1:?usage: status.sh <TICKET-ID>}"
SESSION="$(echo "$ID" | tr '[:upper:]' '[:lower:]')"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

# Tolerate a momentarily busy server (a burst of pane ops can delay a status reply).
up=""
for _ in 1 2 3 4 5; do
  if herdr status 2>/dev/null | grep -q 'status: running'; then up=1; break; fi
  sleep 0.3
done
if [ -z "$up" ]; then
  echo "No running Herdr server for session '$SESSION'. Start one with:"
  echo "  ./scripts/new-workspace.sh $ID \"<title>\""
  exit 1
fi

# NOTE: the JSON is piped into python via stdin, so the code MUST come from `-c`
# (a heredoc on the same command would capture stdin and starve json.load).
WS_ROLLUP=$(cat <<'PY'
import sys, json
mark = {"working":"●","blocked":"!","idle":"○","unknown":"?","done":"✓"}
for w in json.load(sys.stdin)["result"]["workspaces"]:
    st = w.get("agent_status","unknown")
    print(f"\n{w['label']}   [workspace: {mark.get(st,'?')} {st.upper()}]")
PY
)
AGENT_ROLLUP=$(cat <<'PY'
import sys, json
agents = json.load(sys.stdin)["result"].get("agents", [])
if not agents:
    print("  (no agents yet)"); raise SystemExit
mark = {"working":"●","blocked":"!","idle":"○","unknown":"?","done":"✓"}
order = {"working":0,"idle":1,"done":1,"unknown":2,"blocked":3}
for a in sorted(agents, key=lambda a: order.get(a.get("agent_status"),9)):
    st = a.get("agent_status","unknown")
    flag = "   ◄── attention" if st in ("blocked","unknown") else ""
    print(f"  {mark.get(st,'?')} {a['agent']:<16} {st.upper():<8} {a.get('pane_id','')}{flag}")
PY
)

# Workspace rollup (a blocked agent flips its whole workspace to blocked).
herdr workspace list 2>/dev/null | python3 -c "$WS_ROLLUP"
# Per-responsibility rollup, exceptions last so they're the final thing you read.
herdr agent list 2>/dev/null | python3 -c "$AGENT_ROLLUP"

echo
echo "Attend to BLOCKED / UNKNOWN. WORKING needs nothing from you."
