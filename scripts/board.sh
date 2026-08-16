#!/usr/bin/env bash
# board.sh — create and move cards on the team's kanban board (scripts/kanban.sh renders it).
#
#   ./scripts/board.sh add --title T [--stage S] [--owner R] [--body B]   # prints the new card's id
#   ./scripts/board.sh move <id> <stage> [owner]   # owner defaults to the stage's role
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
  echo "       board.sh move <id> <stage> [owner]  (research|plan|implementation|verification|review|done)" >&2
  echo "       board.sh status <id> <state>    (waiting|working|blocked|done)" >&2
  echo "       board.sh list" >&2
  exit 2
}

valid_stage(){ case "$1" in research|plan|implementation|verification|review|done) return 0;; *) return 1;; esac; }
valid_state(){ case "$1" in waiting|working|blocked|done) return 0;; *) return 1;; esac; }
# stage_owner <stage> — the role that owns a stage, so a card's assignee follows its column as
# work is handed off. `done` is terminal: it returns nothing, leaving whoever finished it as the
# owner. A caller can always override by passing an explicit owner to `move`.
stage_owner(){ case "$1" in
    research) echo researcher ;; plan) echo architect ;; implementation) echo implementer ;;
    verification) echo verifier ;; review) echo lead ;; *) echo "" ;;
  esac; }
# Ids from `add` are [a-z0-9-] slugs, so anything with a `/` or `..` is not a card id — it is a
# path trying to escape build/BOARD/. Reject it before any path is built (contract: this script
# never writes outside build/).
valid_id(){ case "$1" in ""|*/*|*..*) return 1;; *) return 0;; esac; }

# set_field <file> <key> <value> — rewrite one header line in place. If the key is missing from
# the header, insert it just before the `---` separator so `move` works on hand-written cards too.
# Two distinct loud failures: awk's END block exits 3 when the card has NEITHER a `<key>:` line
# NOR a separator (malformed card), while any other non-zero status means the rewrite itself
# failed (e.g. an unwritable directory) — the card format is fine and saying otherwise would
# send the caller chasing the wrong problem. The file is untouched in both cases.
set_field(){
  local f="$1" key="$2" val="$3" tmp="$1.tmp.$$" rc=0
  awk -v k="$key" -v v="$val" '
    body { print; next }
    /^---[ \t\r]*$/ { if (!done) { print k ": " v; done=1 }; body=1; print; next }
    index($0, k ":") == 1 { if (!done) { print k ": " v; done=1 }; next }
    { print }
    END { exit done ? 0 : 3 }
  ' "$f" > "$tmp" || rc=$?
  if [ "$rc" -eq 0 ]; then
    mv "$tmp" "$f"
  elif [ "$rc" -eq 3 ]; then
    rm -f "$tmp"
    echo "card has no '$key:' line and no '---' separator — not updated: $f" >&2; exit 1
  else
    rm -f "$tmp" 2>/dev/null || true
    echo "could not rewrite $f (filesystem error above, the card format is fine) — not updated" >&2; exit 1
  fi
}

cmd="${1:-}"; [ -n "$cmd" ] || usage; shift
case "$cmd" in
  add)
    title=""; stage="research"; owner=""; body=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --title) [ $# -ge 2 ] || { echo "--title needs a value" >&2; exit 2; }; title="$2"; shift ;;
        --stage) [ $# -ge 2 ] || { echo "--stage needs a value" >&2; exit 2; }; stage="$2"; shift ;;
        --owner) [ $# -ge 2 ] || { echo "--owner needs a value" >&2; exit 2; }; owner="$2"; shift ;;
        --body)  [ $# -ge 2 ] || { echo "--body needs a value"  >&2; exit 2; }; body="$2";  shift ;;
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
    id="${1:-}"; stage="${2:-}"; owner="${3:-}"; { [ -n "$id" ] && [ -n "$stage" ]; } || usage
    valid_id "$id" || { echo "invalid card id: $id (ids never contain '/' or '..')" >&2; exit 2; }
    valid_stage "$stage" || { echo "unknown stage: $stage (research|plan|implementation|verification|review|done)" >&2; exit 2; }
    f="$BOARD/$id.md"; [ -f "$f" ] || { echo "no such card: $id" >&2; exit 1; }
    set_field "$f" stage "$stage"
    # The assignee follows the stage: reassign to the stage's role unless the caller named an
    # owner explicitly. An empty mapping (done) leaves the current owner untouched.
    [ -n "$owner" ] || owner="$(stage_owner "$stage")"
    [ -n "$owner" ] && set_field "$f" owner "$owner"
    ;;
  status)
    id="${1:-}"; state="${2:-}"; { [ -n "$id" ] && [ -n "$state" ]; } || usage
    valid_id "$id" || { echo "invalid card id: $id (ids never contain '/' or '..')" >&2; exit 2; }
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
      !body && /^---[ \t\r]*$/ { body=1; next }
      !body { if (match($0,/^stage:[ \t]*/))  { st=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",st) }
              else if (match($0,/^status:[ \t]*/)) { ss=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",ss) }
              else if (match($0,/^owner:[ \t]*/))  { ow=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",ow) }
              next }
      body && t=="" && $0 !~ /^[ \t\r]*$/ { t=$0; sub(/\r$/,"",t) }
      END { flush() }
    ' "$@"
    ;;
  *) usage ;;
esac
