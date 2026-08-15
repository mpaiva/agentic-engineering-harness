#!/usr/bin/env bash
# team-chat.sh — watch the team's intercom conversation as one live feed.
#
#   ./scripts/team-chat.sh                 # tail the feed in this pane
#   TEAMCHAT_FEED=/abs/path ./scripts/team-chat.sh
#
# The feed is written by the intercom-bridge extension (atomic/extensions/intercom-bridge.ts),
# loaded in each teammate with `atomic -e .../intercom-bridge.ts`. Each session appends its own
# outbound intercom sends, so this tail shows the AGENT side of the chat (Phase 1 of
# specs/2026-08-14-intercom-team-chat-pane.md). Human overlay sends are not here yet — that is
# Phase 2 (a `chat` intercom client).
#
# Put it in its own Herdr pane:
#   herdr pane split --current --direction right
#   herdr pane run <new-pane-id> ./scripts/team-chat.sh
#
# Verified against Atomic 0.9.13 and Herdr 0.8.0. Bash 3.2 safe.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
FEED="${TEAMCHAT_FEED:-$BUILD/team-chat.log}"

# The extension and this viewer must agree on the path. If a launcher exports TEAMCHAT_FEED for
# the agents, export the SAME value here. We print the resolved path so a mismatch is obvious.
mkdir -p "$(dirname "$FEED")"
touch "$FEED"

echo "team-chat: tailing $FEED"
echo "team-chat: (agent sends only — human overlay sends arrive in Phase 2)"
echo "──────────────────────────────────────────────────────────────────────"

# Pretty-print when jq is present (no dependency is added: we degrade to raw JSON without it).
if command -v jq >/dev/null 2>&1; then
  tail -n +1 -f "$FEED" | jq -rc --unbuffered '
    "\(.ts[11:19])  \(.from)\(if .to then " → "+.to else "" end)  [\(.action)]  \(.message)"
  ' 2>/dev/null
else
  echo "team-chat: install jq for a formatted view; showing raw JSON lines" >&2
  tail -n +1 -f "$FEED"
fi
