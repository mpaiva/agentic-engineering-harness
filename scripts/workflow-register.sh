#!/usr/bin/env bash
# workflow-register.sh — register a named-workflow run so it shows up in the 'workflows' tab
# (scripts/workflow-tab.sh). There is no cross-process "list every run" query in Atomic (see
# specs/2026-08-16-graph-tab.md), so any agent that launches a named workflow and wants it
# visible there must register it explicitly, right after launch.
#
#   ./scripts/workflow-register.sh <run-id> <workflow-name> [launched-by]
#
# launched-by defaults to $ATOMIC_ROLE (set for every hired teammate) or "unknown".
# Appends one line to build/WORKFLOW-RUNS.md. Never edits or removes existing entries.
#
# Bash 3.2 safe.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: workflow-register.sh <run-id> <workflow-name> [launched-by]" >&2
  exit 2
fi

RUN_ID="$1"
NAME="$2"
LAUNCHED_BY="${3:-${ATOMIC_ROLE:-unknown}}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
REGISTRY="$BUILD/WORKFLOW-RUNS.md"
mkdir -p "$BUILD"

case "$RUN_ID" in *"|"*|*$'\n'*) echo "run-id must not contain '|' or a newline" >&2; exit 2;; esac
case "$NAME" in *"|"*|*$'\n'*) echo "workflow-name must not contain '|' or a newline" >&2; exit 2;; esac
case "$LAUNCHED_BY" in *"|"*|*$'\n'*) echo "launched-by must not contain '|' or a newline" >&2; exit 2;; esac

if [ ! -f "$REGISTRY" ]; then
  cat > "$REGISTRY" <<'HDR'
# Workflow runs — registry for the `workflows` Herdr tab

One line per named workflow run launched by any teammate. Append, never edit past entries.
`scripts/workflow-tab.sh` reads this file and queries each run-id's live status headlessly
(`/workflow status <run-id>` — confirmed to work cross-process against Atomic's shared
durable backend, unlike `/workflow connect`; see specs/2026-08-16-graph-tab.md).

Format (pipe-separated, one per line, no header row below this point):
`<run-id>|<workflow-name>|<launched-by>|<launched-at ISO8601>`
HDR
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s|%s|%s|%s\n' "$RUN_ID" "$NAME" "$LAUNCHED_BY" "$TS" >> "$REGISTRY"
echo "Registered $RUN_ID ($NAME, by $LAUNCHED_BY) in $REGISTRY"
