#!/usr/bin/env bash
# workflow-tab.sh — a live list of named Atomic workflow runs (active + terminal), selectable
# for read-only stage detail. Shown in the 'workflows' Herdr tab.
#
#   ./scripts/workflow-tab.sh
#   BUILD_DIR=/abs/path ./scripts/workflow-tab.sh
#
# Why this exists and why it looks the way it does — see specs/2026-08-16-graph-tab.md:
#
#   - `/workflow connect <run-id>` (Atomic's own live graph overlay) only works INSIDE the
#     exact process that launched the run — live-tested and disproven cross-process (§1).
#   - `/workflow status <run-id>` is different: it reads from Atomic's shared durable Postgres
#     backend, so it DOES work cross-process, read-only, for a KNOWN run-id — including
#     terminal (completed/crashed) runs. Live-tested and confirmed 2026-08-16.
#   - There is no cross-process "list every run" query, so this script needs a registry of
#     known run-ids: build/WORKFLOW-RUNS.md. Register a run with:
#       ./scripts/workflow-register.sh <run-id> <workflow-name> [launched-by]
#     Do this right after launching any named workflow you want visible here.
#
# This is a read-only inspector, not a controller: no resume/steer/answer from here. For
# live interactive control of a run you launched yourself, use `/workflow connect <run-id>`
# or F2 in the pane that actually launched it (see scripts/graph-tab.sh for a focus shortcut
# to that pane — note it only marks Herdr's internal focus state; you still switch tabs
# yourself in Ghostty).
#
# Cost note: each status query spawns a real `atomic -p` process. That's process-startup cost
# (roughly 1-2s per run), not a model turn — `/workflow status` is handled by the workflow
# extension directly, no LLM call. Still: refresh is manual (r), not a 1s auto-loop like
# kanban.sh/team-status.sh, so idling here does not repeatedly spawn processes.
#
# Keys: ↑↓/j/k select run · r refresh (re-queries every run) · q quit.
# The selected run's dependency tree renders automatically below the list — no Enter needed.
# Piped or non-interactive output renders once (using cached data if present) and exits.
#
# Verified against Atomic 0.9.13 / Herdr 0.8.0. Bash 3.2 safe.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
REGISTRY="$BUILD/WORKFLOW-RUNS.md"
mkdir -p "$BUILD"
SCRATCH_DIR="$BUILD/.workflow-tab-scratch"
mkdir -p "$SCRATCH_DIR"
CACHE="$(mktemp "${TMPDIR:-/tmp}/workflow-tab-cache.XXXXXX")"
SEP="$(printf '\037')"

# read_registry — print one line per registered run: <run-id> SEP <name> SEP <launched-by>
# Skips blank lines, comment lines (#), and the format-example line (starts with '`').
read_registry(){
  [ -f "$REGISTRY" ] || return 0
  awk -v sep="$SEP" '
    /^[ \t]*#/ { next }
    /^[ \t]*`/ { next }
    /^[ \t]*$/ { next }
    /\|/ {
      n = split($0, f, "|")
      if (n >= 3) print f[1] sep f[2] sep f[3]
    }
  ' "$REGISTRY"
}

# query_one <run-id> — run `/workflow status <run-id>` headlessly and print a compact summary:
#   line 1: <run-id> SEP <name> SEP <status> SEP <durationMs> SEP <stageCount>
#   line 2+: TREE SEP <pre-rendered, indented tree-topology line for one stage>
# The dependency tree (which stage ran after/parallel to which) is built here in Python from
# each stage's real `parentIds` — the same data Atomic's own graph overlay uses, just
# rendered as plain text since we cannot attach to the live overlay cross-process (see the
# file header and specs/2026-08-16-graph-tab.md). Multi-parent stages (fan-in) render once
# under their first parent by executionOrder, with other parents noted inline.
# Prints nothing (and returns nonzero) if the run truly cannot be found.
query_one(){
  local run_id="$1"
  env -u ATOMIC_INTERCOM_GROUP -u ATOMIC_INTERCOM_SESSION_ID -u ATOMIC_SESSION_ID \
      -u ATOMIC_SESSION_FILE -u PI_SESSION_FILE -u PI_SESSION_ID \
    atomic --mode json --session-dir "$SCRATCH_DIR" -p "/workflow status $run_id" </dev/null 2>/dev/null \
  | python3 -c "
import sys, json
sep = '$SEP'
run_id = sys.argv[1]
detail = None
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        o = json.loads(line)
    except Exception:
        continue
    if o.get('type') == 'message_end':
        msg = o.get('message', {})
        d = msg.get('details', {}).get('detail')
        if d:
            detail = d
if detail is None:
    sys.exit(1)
name = detail.get('name', '?')
status = detail.get('status', '?')
dur = detail.get('durationMs', 0) or 0
stages = detail.get('stages', []) or []

# --- forecast inputs, every number from real stage data (never fabricated) ---
term = status in ('completed', 'crashed', 'failed', 'cancelled')
completed_durs = [int(s.get('durationMs') or 0) for s in stages
                  if s.get('status') == 'completed' and (s.get('durationMs') or 0) > 0]
done_ct = sum(1 for s in stages if s.get('status') == 'completed')
total_ct = len(stages)
remaining_ct = total_ct - done_ct

print(sep.join([run_id, name, status, str(int(dur)), str(total_ct), str(done_ct), str(remaining_ct)]))

def glyph(s):
    return {'completed': '\u2713', 'crashed': '\u2717', 'failed': '\u2717', 'running': '\u25cf'}.get(s, '\u25cb')

def fmt_dur(ms):
    s = int((ms or 0) + 500) // 1000
    return (str(s) + 's') if s < 60 else (str(s // 60) + 'm ' + str(s % 60) + 's')

def mean(xs):
    return (sum(xs) / len(xs)) if xs else 0

def median(xs):
    xs = sorted(xs); n = len(xs)
    return xs[n // 2] if n else 0

# ETA to completion = mean elapsed of completed stages x stages not yet done. A terminal run
# has nothing left to forecast; a run with no completed stage yet has no data to extrapolate
# from, and we say exactly that instead of inventing a number.
if term:
    eta = ('complete in ' + fmt_dur(dur)) if status == 'completed' else ('run ' + status + ', no further stages')
elif remaining_ct <= 0:
    eta = 'all stages done'
elif completed_durs:
    avg = mean(completed_durs)
    eta = '~' + fmt_dur(avg * remaining_ct) + ' (avg ' + fmt_dur(avg) + '/stage x ' + str(remaining_ct) + ' left)'
else:
    eta = 'no data yet (0 stages completed)'

print(sep.join(['FCAST', 'forecast: ' + str(done_ct) + '/' + str(total_ct) + ' stages done   |   '
                + str(remaining_ct) + ' remaining   |   ETA ' + eta]))

# Per-stage complexity, relative to the median elapsed time of THIS run's completed stages.
# Only a stage with real elapsed time (completed, or a running stage that has reported one)
# gets a label; a pending/not-yet-run stage has no measured cost, so it gets none.
comp_basis = median(completed_durs)

def complexity(s):
    d = int(s.get('durationMs') or 0)
    if d <= 0 or s.get('status') not in ('completed', 'running') or comp_basis <= 0:
        return ''
    if d >= 2 * comp_basis:
        return 'high'
    if d <= 0.5 * comp_basis:
        return 'low'
    return 'med'

by_id = {s.get('id'): s for s in stages if s.get('id')}
children = {}
roots = []
for s in stages:
    sid = s.get('id')
    pids = [p for p in (s.get('parentIds') or []) if p in by_id]
    if pids:
        primary = min(pids, key=lambda p: by_id[p].get('executionOrder', 0))
        children.setdefault(primary, []).append(sid)
        extra = [by_id[p].get('name', p) for p in pids if p != primary]
        s['_extra_parents'] = extra
    else:
        roots.append(sid)
roots.sort(key=lambda sid: by_id[sid].get('executionOrder', 0))
for kids in children.values():
    kids.sort(key=lambda sid: by_id[sid].get('executionOrder', 0))

def render(sid, prefix, is_last, is_root):
    s = by_id[sid]
    branch = '' if is_root else (' \u2514\u2500 ' if is_last else ' \u251c\u2500 ')
    line = prefix + branch + glyph(s.get('status')) + ' ' + s.get('name', '?') + '  ' + s.get('status', '?') + '  ' + fmt_dur(s.get('durationMs'))
    c = complexity(s)
    if c:
        line += '  [' + c + ']'
    extra = s.get('_extra_parents') or []
    if extra:
        line += '  (also after: ' + ', '.join(extra) + ')'
    print(sep.join(['TREE', line]))
    kids = children.get(sid, [])
    child_prefix = prefix + ('    ' if (is_root or is_last) else ' \u2502  ')
    for i, kid in enumerate(kids):
        render(kid, child_prefix, i == len(kids) - 1, False)

for i, r in enumerate(roots):
    render(r, '', i == len(roots) - 1, True)
" "$run_id"
}

# refresh_cache — query every registered run, write results to $CACHE. Slow (subprocess per
# run); called on startup and on explicit 'r', never on a timer.
refresh_cache(){
  : > "$CACHE"
  while IFS="$SEP" read -r run_id name launched_by; do
    [ -n "$run_id" ] || continue
    out="$(query_one "$run_id")"
    if [ -n "$out" ]; then
      printf '%s\n' "$out" | { IFS= read -r head; printf 'RUN%s%s%s%s\n' "$SEP" "$launched_by" "$SEP" "$head"; cat; } >> "$CACHE"
    else
      printf 'RUN%s%s%s%s%s?%s?%s0%s0%s0%s0\n' "$SEP" "$launched_by" "$SEP" "$run_id" "$SEP" "$SEP" "$SEP" "$SEP" "$SEP" "$SEP" >> "$CACHE"
    fi
  done < <(read_registry)
}

fmt_dur(){ # fmt_dur <ms> -> "12s" / "3m 4s"
  local ms="$1"
  local s=$(( (ms+500)/1000 ))
  if [ "$s" -lt 60 ]; then printf '%ss' "$s"; else printf '%sm %ss' "$((s/60))" "$((s%60))"; fi
}
status_glyph(){ case "$1" in # bash 3.2: no assoc arrays
  completed) printf '✓';; crashed) printf '✗';; running) printf '●';; failed) printf '✗';; *) printf '○';; esac; }

render(){
  local n=0
  echo "  RUN                                   NAME               STATUS      DURATION  STAGES   LAUNCHED BY"
  echo "  ────────────────────────────────────  ─────────────────  ──────────  ────────  ───────  ──────────────────"
  while IFS="$SEP" read -r tag launched_by run_id name status dur total donec _remaining; do
    [ "$tag" = "RUN" ] || continue
    n=$((n+1))
    local mark=" "
    [ "$n" -eq "${SEL:-1}" ] && mark=">"
    printf '%s %-2s %-34s  %-17s  %s %-9s  %-8s  %-7s  %s\n' \
      "$mark" "$n)" "${run_id:0:34}" "${name:0:17}" "$(status_glyph "$status")" "${status:0:9}" "$(fmt_dur "${dur:-0}")" "${donec:-0}/${total:-0}" "$launched_by"
  done < "$CACHE"
  if [ "$n" -eq 0 ]; then
    echo
    echo "  No runs registered. Register one after launching a named workflow:"
    echo "    ./scripts/workflow-register.sh <run-id> <workflow-name> [launched-by]"
  fi
}

show_detail(){
  local target="$1" n=0
  while IFS="$SEP" read -r tag a _b _c _d _e; do
    if [ "$tag" = "RUN" ]; then
      n=$((n+1))
      cur=$([ "$n" -eq "$target" ] && echo 1 || echo 0)
    elif [ "$tag" = "FCAST" ] && [ "${cur:-0}" = "1" ]; then
      printf '    \033[1m%s\033[0m\n' "$a"
    elif [ "$tag" = "TREE" ] && [ "${cur:-0}" = "1" ]; then
      printf '    %s\n' "$a"
    fi
  done < "$CACHE"
}

refresh_cache
TOTAL="$(grep -c "^RUN$SEP" "$CACHE" 2>/dev/null || echo 0)"

cleanup(){ rm -f "$CACHE"; }
trap cleanup EXIT

# Non-interactive (piped/redirected): render the list, then each run's forecast + stage detail
# (the live TUI shows the selected run's detail on demand; piped output has no selection, so it
# lays every run's forecast out in full for a stakeholder reading the tab or an evidence capture).
if [ ! -t 1 ] || [ ! -t 0 ]; then
  render
  if [ "$TOTAL" -gt 0 ]; then
    i=1
    while [ "$i" -le "$TOTAL" ]; do
      echo
      show_detail "$i"
      i=$((i+1))
    done
  fi
  exit 0
fi

SEL=1
K=$'\033[K'
paint(){
  printf '\033[H\033[J'
  render
  echo
  if [ "$TOTAL" -gt 0 ]; then
    echo "  Selected run — forecast, then stage-by-stage status (real topology + elapsed time):"
    show_detail "$SEL"
  fi
  printf '\n\033[7m workflows  ↑↓/j/k select · r refresh (re-queries) · q quit \033[0m%s\n' "$K"
}

printf '\033[?1049h\033[?25l'
trap 'printf "\033[?25h\033[?1049l"; cleanup; exit 0' INT TERM EXIT
paint
while :; do
  key=""; IFS= read -rsn1 -t 3600 key </dev/tty || true
  case "$key" in
    q|Q) break ;;
    r|R) refresh_cache; TOTAL="$(grep -c "^RUN$SEP" "$CACHE" 2>/dev/null || echo 0)"; paint ;;
    j) [ "$SEL" -lt "$TOTAL" ] && SEL=$((SEL+1)); paint ;;
    k) [ "$SEL" -gt 1 ] && SEL=$((SEL-1)); paint ;;
    "$(printf '\033')")
      seq=""; read -rsn2 -t 1 seq </dev/tty || true
      case "$seq" in
        '[B') [ "$SEL" -lt "$TOTAL" ] && SEL=$((SEL+1)); paint ;;
        '[A') [ "$SEL" -gt 1 ] && SEL=$((SEL-1)); paint ;;
      esac ;;
  esac
done
