#!/usr/bin/env bash
# cockpit.sh — one command to size up the harness and pick your next move.
#
#   ./cockpit.sh                 # the default 'harness' session
#   ./cockpit.sh beta            # inspect/drive a named concurrent session
#
# It reads the current state — is a Herdr cockpit running? does build/ already hold a mission?
# how many agents are live? are there archived runs? — then offers only the next steps that make
# sense for that state (attach, resume, fresh, status, stop, …) and runs the one you pick. No
# flags to remember: the menu adapts to what exists. Bash 3.2 safe. Verified against Herdr 0.8.0.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SESSION="${1:-harness}"
case "$SESSION" in ""|.|..|*/*) echo "invalid session name: '$SESSION'" >&2; exit 2 ;; esac
if [ "$SESSION" = "harness" ]; then BUILD="$HERE/build"; else BUILD="$HERE/build-$SESSION"; fi
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

E=$'\033'; R="${E}[0m"; B="${E}[1m"; DIM="${E}[2m"; GRN="${E}[38;5;150m"; YEL="${E}[1;33m"; GREY="${E}[38;5;244m"

# ---- assess ----------------------------------------------------------------
assess(){
  # A busy server can lag a single status reply (a burst of pane ops delays it), so retry a few
  # times before calling the cockpit down — the same guard scripts/status.sh uses. Capture the
  # output and case-match it rather than piping into `grep -q`: under `pipefail`, grep closing the
  # pipe on first match kills `herdr status` with SIGPIPE, and that non-zero would read as "down".
  SERVER_UP=0
  for _ in 1 2 3 4 5; do
    case "$(herdr status 2>/dev/null)" in *"status: running"*) SERVER_UP=1; break ;; esac
    sleep 0.3
  done
  HAS_RUN=0;     [ -f "$BUILD/IDEA.md" ]    && HAS_RUN=1
  HAS_MISSION=0; [ -f "$BUILD/MISSION.md" ] && HAS_MISSION=1
  AGENTS=0; WORKING=0; BLOCKED=0
  if [ "$SERVER_UP" = 1 ]; then
    eval "$(herdr agent list 2>/dev/null | python3 -c "
import json,sys
try: a=json.load(sys.stdin)['result'].get('agents',[])
except (ValueError, KeyError): a=[]
w=sum(1 for x in a if x.get('agent_status')=='working')
b=sum(1 for x in a if x.get('agent_status') in ('blocked','unknown'))
print('AGENTS=%d;WORKING=%d;BLOCKED=%d'%(len(a),w,b))
" 2>/dev/null || echo 'AGENTS=0;WORKING=0;BLOCKED=0')"
  fi
  ARCHIVES=$(ls -d "$HERE"/build.prev-* 2>/dev/null | wc -l | tr -d ' ')
}

summary(){
  printf '\n%sHARNESS%s  %ssession %s%s\n' "$B" "$R" "$DIM" "$SESSION" "$R"
  if [ "$SERVER_UP" = 1 ]; then
    printf '  cockpit   %s● running%s  ·  %d agent(s)' "$GRN" "$R" "$AGENTS"
    [ "$WORKING" -gt 0 ] && printf ', %d working' "$WORKING"
    [ "$BLOCKED" -gt 0 ] && printf ', %s%d need attention%s' "$YEL" "$BLOCKED" "$R"
    printf '\n'
  else
    printf '  cockpit   %s○ not running%s\n' "$GREY" "$R"
  fi
  if [ "$HAS_MISSION" = 1 ]; then
    # Prefer the mission's Goal line (the human-terms one-liner); fall back to its first heading.
    goal="$(awk 'tolower($0)~/^#+ *goal/{g=1;next} g&&/^#/{exit} g&&NF{sub(/^[ \t>*_-]+/,"");print;exit}' "$BUILD/MISSION.md" 2>/dev/null)"
    [ -n "$goal" ] || goal="$(sed -n 's/^#* *//;1p' "$BUILD/MISSION.md" 2>/dev/null)"
    printf '  mission   %s✓ %s%s\n' "$GRN" "$R" "$(printf '%s' "$goal" | cut -c1-58)"
  elif [ "$HAS_RUN" = 1 ]; then
    printf '  mission   %s… intake answered, not yet refined%s\n' "$DIM" "$R"
  else
    printf '  mission   %s○ none in %s%s\n' "$GREY" "${BUILD#$HERE/}" "$R"
  fi
  [ "$ARCHIVES" -gt 0 ] && printf '  archived  %s%d previous run(s) (build.prev-*)%s\n' "$DIM" "$ARCHIVES" "$R"
  printf '\n'
}

# ---- menu ------------------------------------------------------------------
# Build a state-appropriate option list. LABELS[i] is shown; ACTS[i] is dispatched.
build_menu(){
  LABELS=(); ACTS=()
  add(){ LABELS+=("$1"); ACTS+=("$2"); }
  [ "$SERVER_UP" = 1 ] && add "Attach the cockpit (watch & steer the team)" attach
  [ "$SERVER_UP" = 1 ] && [ "$HAS_MISSION" = 1 ] && add "Show team status (roster + agent states)" status
  [ "$HAS_RUN" = 1 ] && add "Resume the current mission (reboot lead, keep build/)" resume
  if [ "$HAS_RUN" = 1 ]; then
    add "Start FRESH — archive build/ and begin a new mission" fresh
  else
    add "Start a new build (fresh intake)" newbuild
  fi
  [ "$SERVER_UP" = 1 ] && add "Stop the cockpit (herdr server stop)" stop
  add "Open a concurrent session (its own build-<name>/)" concurrent
  add "Quit" quit
}

archive_build(){
  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  if [ -e "$BUILD" ]; then
    mv "$BUILD" "$BUILD.prev-$ts" && printf '%sarchived %s → %s%s\n' "$DIM" "${BUILD#$HERE/}" "${BUILD#$HERE/}.prev-$ts" "$R"
  fi
}

run(){   # echo the command, then exec/replace this process with it
  printf '%s› %s%s\n\n' "$DIM" "$*" "$R"; exec "$@"
}

dispatch(){
  case "$1" in
    attach)  run herdr --session "$SESSION" ;;
    status)  BUILD_DIR="$BUILD" HERDR_SESSION="$SESSION" "$HERE/scripts/team-status.sh" </dev/null
             printf '\n%s(enter to return to the menu)%s' "$DIM" "$R"; IFS= read -r _ || true; return 1 ;;
    resume)  run "$HERE/build.sh" --session "$SESSION" --resume ;;
    newbuild) run "$HERE/build.sh" --session "$SESSION" ;;
    fresh)   archive_build; run "$HERE/build.sh" --session "$SESSION" ;;
    stop)    herdr server stop >/dev/null 2>&1 || true; printf '%scockpit stopped.%s\n' "$DIM" "$R"; return 1 ;;
    concurrent)
             printf 'name for the new session (e.g. beta): '; IFS= read -r nm || true
             case "$nm" in ""|*/*|.|..) printf '%sno/invalid name — cancelled%s\n' "$DIM" "$R"; return 1 ;; esac
             run "$HERE/build.sh" --session "$nm" ;;
    quit)    exit 0 ;;
  esac
}

# ---- loop ------------------------------------------------------------------
while :; do
  assess; summary; build_menu
  i=1; for l in "${LABELS[@]}"; do printf '  %s%d%s  %s\n' "$B" "$i" "$R" "$l"; i=$((i+1)); done
  printf '\n%schoose 1-%d: %s' "$B" "${#LABELS[@]}" "$R"
  IFS= read -r choice || exit 0
  case "$choice" in
    ''|*[!0-9]*) printf '%s— pick a number —%s\n' "$YEL" "$R"; continue ;;
  esac
  if [ "$choice" -ge 1 ] 2>/dev/null && [ "$choice" -le "${#LABELS[@]}" ]; then
    dispatch "${ACTS[$((choice-1))]}" || continue   # non-exec actions loop back
  else
    printf '%s— out of range —%s\n' "$YEL" "$R"
  fi
done
