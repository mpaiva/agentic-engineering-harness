#!/usr/bin/env bash
# pane.sh — rearrange Herdr panes/tabs by agent name or tab label, not raw wN:pM IDs.
#
#   ./scripts/pane.sh list                              # every pane: name, pane id, tab
#   ./scripts/pane.sh totab <name>                       # open a pane as its own new tab
#   ./scripts/pane.sh tab <name> <existing-tab-label> [right|down]  # move into a tab (default: right)
#   ./scripts/pane.sh split <name> right|down [target]    # split, optionally next to <target>
#   ./scripts/pane.sh swap <name-a> <name-b>              # swap two panes' positions
#   ./scripts/pane.sh resize <name> left|right|up|down [amount]
#   ./scripts/pane.sh rename <name> <new-label>
#   ./scripts/pane.sh zoom <name> [on|off|toggle]         # default: toggle
#   ./scripts/pane.sh close <name>
#
# <name> is resolved in this order: (1) a raw pane id like w1:p3, used as-is; (2) a live
# agent name (lead/researcher/implementer/...), via `herdr pane list`'s "agent" field; (3) a
# tab label (kanban/team/workflows/team-chat/...), via `herdr tab list` — the first pane in
# that tab is used, which is exactly right for this repo's single-pane utility tabs.
#
# Built after live-checking Herdr's actual right-click pane menu (2026-08-16): it offers
# Rename/Clear name/Swap/Split right/Split down/Zoom/Close — but NOT "open as tab", even
# though the CLI supports it (`herdr pane move --new-tab`). This script fills that gap and
# gives every action a name-based interface instead of raw IDs, for both menu-covered and
# menu-missing actions alike.
#
# Verified against Herdr 0.8.0. Bash 3.2 safe.
set -uo pipefail

usage(){
  cat >&2 <<'EOF'
usage: pane.sh list
       pane.sh totab <name>
       pane.sh tab <name> <existing-tab-label> [right|down]
       pane.sh split <name> right|down [target-name]
       pane.sh swap <name-a> <name-b>
       pane.sh resize <name> left|right|up|down [amount]
       pane.sh rename <name> <new-label>
       pane.sh zoom <name> [on|off|toggle]
       pane.sh close <name>
EOF
  exit 2
}

if ! command -v herdr >/dev/null 2>&1; then echo "herdr not found on PATH." >&2; exit 1; fi
if ! command -v python3 >/dev/null 2>&1; then echo "python3 not found on PATH." >&2; exit 1; fi

# resolve <name> — print "<pane_id>\t<tab_id>" or nothing (exit 1) if not found.
resolve(){
  local name="$1"
  case "$name" in
    w*:p*)
      # Raw pane id: still need its tab_id, so look it up rather than trusting the caller.
      herdr pane list 2>/dev/null | python3 -c "
import sys, json
target = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(1)
for p in data.get('result', {}).get('panes', []):
    if p.get('pane_id') == target:
        print(p.get('pane_id','') + '\t' + p.get('tab_id',''))
        sys.exit(0)
sys.exit(1)
" "$name"
      return $? ;;
  esac
  # Try agent name first.
  local out
  out="$(herdr pane list 2>/dev/null | python3 -c "
import sys, json
name = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(1)
for p in data.get('result', {}).get('panes', []):
    if p.get('agent') == name:
        print(p.get('pane_id','') + '\t' + p.get('tab_id',''))
        sys.exit(0)
sys.exit(1)
" "$name")"
  if [ -n "$out" ]; then printf '%s\n' "$out"; return 0; fi
  # Fall back to tab label — first pane in that tab.
  local tab_id
  tab_id="$(herdr tab list 2>/dev/null | python3 -c "
import sys, json
name = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(1)
for t in data.get('result', {}).get('tabs', []):
    if t.get('label') == name:
        print(t.get('tab_id',''))
        sys.exit(0)
sys.exit(1)
" "$name")"
  [ -n "$tab_id" ] || return 1
  herdr pane list 2>/dev/null | python3 -c "
import sys, json
tab_id = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(1)
for p in data.get('result', {}).get('panes', []):
    if p.get('tab_id') == tab_id:
        print(p.get('pane_id','') + '\t' + p.get('tab_id',''))
        sys.exit(0)
sys.exit(1)
" "$tab_id"
}

need_pane(){
  local name="$1" info
  info="$(resolve "$name")"
  if [ -z "$info" ]; then
    echo "No pane found for '$name' (not a raw pane id, live agent name, or tab label)." >&2
    echo "Check: ./scripts/pane.sh list" >&2
    exit 1
  fi
  printf '%s\n' "$info"
}

cmd_list(){
  echo "  NAME/LABEL           PANE      TAB       TAB LABEL"
  herdr pane list 2>/dev/null | python3 -c "
import sys, json
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for p in data.get('result', {}).get('panes', []):
    name = p.get('agent') or '(unnamed)'
    print('  %-20s  %-8s  %-8s' % (name, p.get('pane_id',''), p.get('tab_id','')))
"
  echo
  echo "  TABS (use their label as <name> for utility panes: kanban, team, workflows, chat, crew)"
  herdr tab list 2>/dev/null | python3 -c "
import sys, json
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for t in data.get('result', {}).get('tabs', []):
    print('  %-20s  tab=%s  panes=%s' % (t.get('label',''), t.get('tab_id',''), t.get('pane_count','')))
"
}

[ $# -ge 1 ] || usage
ACTION="$1"; shift

case "$ACTION" in
  list) cmd_list ;;

  totab)
    [ $# -ge 1 ] || usage
    INFO="$(need_pane "$1")"; PANE_ID="${INFO%%$'\t'*}"
    herdr pane move "$PANE_ID" --new-tab
    ;;

  tab)
    [ $# -ge 2 ] || usage
    INFO="$(need_pane "$1")"; PANE_ID="${INFO%%$'\t'*}"
    SPLITDIR="${3:-right}"
    case "$SPLITDIR" in right|down) ;; *) echo "direction must be right or down" >&2; exit 2 ;; esac
    TABINFO="$(herdr tab list 2>/dev/null | python3 -c "
import sys, json
name = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(1)
for t in data.get('result', {}).get('tabs', []):
    if t.get('label') == name:
        print(t.get('tab_id',''))
        sys.exit(0)
sys.exit(1)
" "$2")"
    if [ -z "$TABINFO" ]; then echo "No tab labeled '$2'. Check: ./scripts/pane.sh list" >&2; exit 1; fi
    # --tab requires --split too: dropping a pane into an existing tab must say how it splits
    # in (verified live 2026-08-16 -- herdr rejects --tab without --split).
    herdr pane move "$PANE_ID" --tab "$TABINFO" --split "$SPLITDIR"
    ;;

  split)
    [ $# -ge 2 ] || usage
    INFO="$(need_pane "$1")"; PANE_ID="${INFO%%$'\t'*}"
    DIR="$2"
    case "$DIR" in right|down) ;; *) echo "direction must be right or down" >&2; exit 2 ;; esac
    if [ $# -ge 3 ]; then
      TINFO="$(need_pane "$3")"; TARGET_ID="${TINFO%%$'\t'*}"
      herdr pane move "$PANE_ID" --split "$DIR" --target-pane "$TARGET_ID"
    else
      herdr pane split "$PANE_ID" --direction "$DIR"
    fi
    ;;

  swap)
    [ $# -ge 2 ] || usage
    AINFO="$(need_pane "$1")"; A_ID="${AINFO%%$'\t'*}"
    BINFO="$(need_pane "$2")"; B_ID="${BINFO%%$'\t'*}"
    herdr pane swap --source-pane "$A_ID" --target-pane "$B_ID"
    ;;

  resize)
    [ $# -ge 2 ] || usage
    INFO="$(need_pane "$1")"; PANE_ID="${INFO%%$'\t'*}"
    DIR="$2"
    case "$DIR" in left|right|up|down) ;; *) echo "direction must be left/right/up/down" >&2; exit 2 ;; esac
    if [ $# -ge 3 ]; then
      herdr pane resize --pane "$PANE_ID" --direction "$DIR" --amount "$3"
    else
      herdr pane resize --pane "$PANE_ID" --direction "$DIR"
    fi
    ;;

  rename)
    [ $# -ge 2 ] || usage
    INFO="$(need_pane "$1")"; PANE_ID="${INFO%%$'\t'*}"
    shift
    herdr pane rename "$PANE_ID" "$@"
    ;;

  zoom)
    [ $# -ge 1 ] || usage
    INFO="$(need_pane "$1")"; PANE_ID="${INFO%%$'\t'*}"
    case "${2:-toggle}" in
      on) herdr pane zoom --pane "$PANE_ID" --on ;;
      off) herdr pane zoom --pane "$PANE_ID" --off ;;
      toggle|"") herdr pane zoom --pane "$PANE_ID" --toggle ;;
      *) echo "zoom state must be on/off/toggle" >&2; exit 2 ;;
    esac
    ;;

  close)
    [ $# -ge 1 ] || usage
    INFO="$(need_pane "$1")"; PANE_ID="${INFO%%$'\t'*}"
    herdr pane close "$PANE_ID"
    ;;

  *) usage ;;
esac
