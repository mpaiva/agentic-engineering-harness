#!/usr/bin/env bash
# board.sh — create and move cards on the team's kanban board (scripts/kanban.sh renders it).
#
#   ./scripts/board.sh add --title T [--stage S] [--owner R] [--body B]   # prints the new card's id
#   ./scripts/board.sh move <id> <stage>
#   ./scripts/board.sh status <id> <state>
#   ./scripts/board.sh list
#
# Stages (the harness workflow stages — see docs/kanban.md): research, plan, implementation,
# verification, review, done. States: waiting, working, blocked, done.
#
# A card is one markdown file under build/BOARD/: a small `stage:`/`status:`/`owner:` header,
# a `---` separator, then the title (first line) and an optional body. All board state lives in
# files under build/ — this script never writes anywhere else. Bash 3.2 safe.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
BOARD="${BOARD_DIR:-$BUILD/BOARD}"
SEP="$(printf '\037')"

usage(){
  echo "usage: board.sh add --title T [--stage S] [--owner R] [--body B]" >&2
  echo "       board.sh move <id> <stage>      (research|plan|implementation|verification|review|done)" >&2
  echo "       board.sh status <id> <state>    (waiting|working|blocked|done)" >&2
  echo "       board.sh list" >&2
  exit 2
}

valid_stage(){ case "$1" in research|plan|implementation|verification|review|done) return 0;; *) return 1;; esac; }
valid_state(){ case "$1" in waiting|working|blocked|done) return 0;; *) return 1;; esac; }

# set_field <file> <key> <value> — rewrite one header line in place. If the key is missing from
# the header, insert it just before the `---` separator so `move` works on hand-written cards too.
set_field(){
  local f="$1" key="$2" val="$3" tmp="$1.tmp.$$"
  awk -v k="$key" -v v="$val" '
    body { print; next }
    /^---[ \t]*$/ { if (!done) { print k ": " v; done=1 }; body=1; print; next }
    index($0, k ":") == 1 { if (!done) { print k ": " v; done=1 }; next }
    { print }
  ' "$f" > "$tmp" && mv "$tmp" "$f"
}

cmd="${1:-}"; [ -n "$cmd" ] || usage; shift
case "$cmd" in
  add)
    title=""; stage="research"; owner=""; body=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --title) title="${2:-}"; shift ;;
        --stage) stage="${2:-}"; shift ;;
        --owner) owner="${2:-}"; shift ;;
        --body)  body="${2:-}";  shift ;;
        *) usage ;;
      esac; shift
    done
    [ -n "$title" ] || { echo "add needs --title" >&2; exit 2; }
    valid_stage "$stage" || { echo "unknown stage: $stage (research|plan|implementation|verification|review|done)" >&2; exit 2; }
    mkdir -p "$BOARD"
    # id = a filename-safe slug of the title; suffix a counter on collision.
    slug="$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//' | cut -c1-40)"
    [ -n "$slug" ] || slug="card"
    id="$slug"; n=2
    while [ -e "$BOARD/$id.md" ]; do id="$slug-$n"; n=$((n+1)); done
    {
      printf 'stage: %s\nstatus: waiting\nowner: %s\n---\n%s\n' "$stage" "$owner" "$title"
      if [ -n "$body" ]; then printf '\n%s\n' "$body"; fi
    } > "$BOARD/$id.md"
    echo "$id"
    ;;
  move)
    id="${1:-}"; stage="${2:-}"; { [ -n "$id" ] && [ -n "$stage" ]; } || usage
    valid_stage "$stage" || { echo "unknown stage: $stage (research|plan|implementation|verification|review|done)" >&2; exit 2; }
    f="$BOARD/$id.md"; [ -f "$f" ] || { echo "no such card: $id" >&2; exit 1; }
    set_field "$f" stage "$stage"
    ;;
  status)
    id="${1:-}"; state="${2:-}"; { [ -n "$id" ] && [ -n "$state" ]; } || usage
    valid_state "$state" || { echo "unknown state: $state (waiting|working|blocked|done)" >&2; exit 2; }
    f="$BOARD/$id.md"; [ -f "$f" ] || { echo "no such card: $id" >&2; exit 1; }
    set_field "$f" status "$state"
    ;;
  list)
    [ -d "$BOARD" ] || exit 0
    set -- "$BOARD"/*.md
    [ -f "${1:-}" ] || exit 0
    awk -v sep="$SEP" '
      function flush(   id){ if (fn != "") { id=fn; sub(/^.*\//,"",id); sub(/\.md$/,"",id);
        printf "%-32s %-15s %-8s %-12s %s\n", id, (st==""?"research":st), (ss==""?"waiting":ss), (ow==""?"-":ow), t } }
      FNR==1 { flush(); fn=FILENAME; st=""; ss=""; ow=""; t=""; body=0 }
      !body && /^---[ \t]*$/ { body=1; next }
      !body { if (match($0,/^stage:[ \t]*/))  { st=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",st) }
              else if (match($0,/^status:[ \t]*/)) { ss=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",ss) }
              else if (match($0,/^owner:[ \t]*/))  { ow=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",ow) }
              next }
      body && t=="" && $0 !~ /^[ \t]*$/ { t=$0 }
      END { flush() }
    ' "$@"
    ;;
  *) usage ;;
esac
