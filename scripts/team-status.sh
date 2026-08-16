#!/usr/bin/env bash
# team-status.sh — a live roster + state board for the team, shown in the 'team' tab.
#
#   ./scripts/team-status.sh                 # live view in this pane
#   HERDR_SESSION=harness ./scripts/team-status.sh
#
# It joins two things the harness already produces: build/ROSTER.md (who the lead hired and
# WHY) and `herdr agent list` (each agent's live state — working/blocked/idle/done). The result
# is the supervision-by-exception view from docs/monitoring-agents.md: WORKING needs nothing,
# BLOCKED / UNKNOWN are sorted last so they are the final thing you read.
#
# It is a viewer, not a controller — hiring stays an explicit act. The footer prints the exact
# scripts/team.sh commands to add a role, list roles, or see the roster. Refreshes every 2s and
# on resize; q quits. Piped / non-interactive output renders once and exits.
#
# Dependency-free beyond what the rest of the harness already needs (bash, python3 for the one
# JSON parse — same as scripts/status.sh). Bash 3.2 safe. Verified against Herdr 0.8.0.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
SESSION="${HERDR_SESSION:-harness}"
ROSTER="$BUILD/ROSTER.md"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

# The rollup reads `herdr agent list` JSON on stdin and ROSTER (path via env) for reasons, then
# prints one coloured row per agent. Same marker vocabulary as scripts/status.sh.
ROLLUP=$(cat <<'PY'
import sys, json, os, re
mark  = {"working":"\u25cf","blocked":"!","idle":"\u25cb","unknown":"?","done":"\u2713"}
color = {"working":"38;5;150","blocked":"1;33","idle":"38;5;244","unknown":"1;33","done":"38;5;150"}
order = {"working":0,"idle":1,"done":1,"unknown":2,"blocked":3}
E="\033"; R=E+"[0m"; DIM=E+"[2m"
pal=["39","213","46","214","123","208","220","141"]      # per-name chip colours (match team-chat.sh)
def chip(name):
    su=sum(ord(c) for c in name)
    return E+"[1;38;5;16;48;5;"+pal[su%len(pal)]+"m "+name+" "+R
reasons={}
try:
    for line in open(os.environ.get("ROSTER","")):
        m=re.match(r"\s*\|\s*`([^`]+)`\s*\|[^|]*\|\s*(.*?)\s*\|\s*$", line)
        if m: reasons[m.group(1)]=m.group(2)
except Exception:
    pass
try:
    agents=json.load(sys.stdin)["result"].get("agents",[])
except Exception:
    agents=[]
if not agents:
    print("  "+DIM+"(no agents yet \u2014 the lead boots first, then hires with scripts/team.sh add)"+R)
    raise SystemExit
for a in sorted(agents, key=lambda a: order.get(a.get("agent_status"),9)):
    st=a.get("agent_status","unknown"); nm=a.get("agent",""); pane=a.get("pane_id","")
    col=color.get(st,"0"); mk=mark.get(st,"?")
    flag=("   "+E+"[1;33m\u25c4\u2500\u2500 attention"+R) if st in ("blocked","unknown") else ""
    reason=reasons.get(nm,"")
    print("  "+E+"["+col+"m"+mk+R+" "+chip(nm)+" "+E+"["+col+"m"+("%-8s"%st.upper())+R+" "+DIM+pane+R+(("  "+reason) if reason else "")+flag)
PY
)

render(){
  printf '\033[1mTEAM\033[0m  \033[2msession %s\033[0m\n\n' "$SESSION"
  herdr agent list 2>/dev/null | ROSTER="$ROSTER" python3 -c "$ROLLUP"
  printf '\n\033[2m\xe2\x94\x80\xe2\x94\x80 controls \xe2\x94\x80\xe2\x94\x80\033[0m\n'
  printf '  \033[1mhire\033[0m   scripts/team.sh add <role> --reason "why this mission needs it"\n'
  printf '  \033[1mroles\033[0m  scripts/team.sh roles      \033[1mlist\033[0m  scripts/team.sh list\n'
  printf '\n\033[2mAttend to ! BLOCKED / ? UNKNOWN. \xe2\x97\x8f WORKING needs nothing from you.\033[0m\n'
}

# Piped / non-interactive: nothing to refresh — render once and exit.
if [ ! -t 1 ] || [ ! -t 0 ]; then
  render
  exit 0
fi

# ---- live view ----
TMP="$(mktemp "${TMPDIR:-/tmp}/teamstatus.XXXXXX")"
cleanup(){ printf '\033[?25h\033[?1049l'; rm -f "$TMP"; }
trap cleanup EXIT
trap 'printf "\033[?25h\033[?1049l"; exit 0' INT TERM
printf '\033[?1049h\033[?25l'                 # alt screen + hide cursor

# Flicker-free: home the cursor, redraw each line with a clear-to-EOL, then clear anything left
# below — no full-screen clear (that flashes on every 2s refresh).
paint(){ render > "$TMP"; printf '\033[H'; sed 's/$/\033[K/' "$TMP"; printf '\033[J'; }

while :; do
  paint
  key=""; IFS= read -rsn1 -t 2 key </dev/tty || true
  case "$key" in q|Q) break ;; esac
done
