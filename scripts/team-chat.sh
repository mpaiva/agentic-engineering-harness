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

printf '\033[1mteam-chat\033[0m  \033[2m%s\033[0m\n' "$FEED"
printf '\033[2magent sends only — human overlay sends arrive in Phase 2\033[0m\n'

# Pretty-print when jq is present (no dependency is added: we degrade to raw JSON without it).
# Each message becomes a card: a dim rule (top border) + a left colour bar in the sender's
# colour, a header (dim time · bold sender → bold target · action badge), then the body.
if command -v jq >/dev/null 2>&1; then
  fmt='
    ["\u001b[38;5;39m","\u001b[38;5;213m","\u001b[38;5;46m","\u001b[38;5;214m","\u001b[38;5;123m","\u001b[38;5;208m","\u001b[38;5;220m","\u001b[38;5;141m"] as $pal |
    "\u001b[0m" as $R | "\u001b[2m" as $DIM | "\u001b[1m" as $BOLD |
    (.from // "?") as $from |
    $pal[ ((($from | explode | add) // 0) % ($pal | length)) ] as $c |
    (if (.ts | type) == "string" and (.ts | length) >= 19 then .ts[11:19] else (.ts // "") end) as $t |
    (.action // "?") as $act |
    (if $act == "ask" then "\u001b[30;43m ASK \u001b[0m"
     elif $act == "reply" then "\u001b[30;42m REPLY \u001b[0m"
     else "\u001b[30;44m SEND \u001b[0m" end) as $badge |
    ($c + "▌" + $R) as $bar |
    (if (.to // "") != "" then " " + $DIM + "→" + $R + " " + $BOLD + .to + $R else "" end) as $arrow |
    ($DIM + "╶──────────────────╴" + $R) as $rule |
    $rule + "\n"
      + $bar + " " + $DIM + $t + $R + "  " + $c + $BOLD + $from + $R + $arrow + "  " + $badge + "\n"
      + $bar + " " + (.message // "" | gsub("\n"; " "))
  '
  tail -n +1 -f "$FEED" | jq -r --unbuffered "$fmt" 2>/dev/null
else
  echo "team-chat: install jq for the colour view; showing raw JSON lines" >&2
  tail -n +1 -f "$FEED"
fi
