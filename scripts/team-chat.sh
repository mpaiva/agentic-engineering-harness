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

# ---- header + legend (the legend spells out each badge in plain words) ----
printf '\033[1mTeam chat\033[0m  \033[2m(%s)\033[0m\n' "$FEED"
printf '\033[2mSEND = a message    ASK = needs a reply    REPLY = an answer\033[0m\n'
printf '\033[2magent messages only — your own typed messages arrive in Phase 2\033[0m\n'

R=$'\033[0m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; YEL=$'\033[33m'
PAL=(39 213 46 214 123 208 220 141)   # stable colour per sender (an extra cue, never the only one)

# Sum the name's bytes to pick a stable palette slot, so a sender keeps one colour.
color_for(){ local n="$1" s=0 i c; for ((i=0; i<${#n}; i++)); do printf -v c '%d' "'${n:i:1}"; s=$((s + c)); done; printf '\033[38;5;%sm' "${PAL[$((s % ${#PAL[@]}))]}"; }
# Badges carry the word (primary cue) on a high-contrast block (secondary cue).
badge_for(){ case "$1" in
    ask)   printf '\033[30;43m ASK \033[0m';;
    reply) printf '\033[30;42m REPLY \033[0m';;
    send)  printf '\033[30;44m SEND \033[0m';;
    *)     printf '\033[30;47m %s \033[0m' "$1";;
  esac; }

# Wrap the body to the pane width with a hanging indent, so long messages read as a tidy
# block instead of a wall that blurs into the next message.
COLS="$(tput cols 2>/dev/null || echo 72)"; case "$COLS" in ''|*[!0-9]*) COLS=72;; esac
BODYW=$((COLS - 4)); [ "$BODYW" -lt 24 ] && BODYW=24

if command -v jq >/dev/null 2>&1; then
  tail -n +1 -f "$FEED" \
  | jq -r --unbuffered '[ (if (.ts|type)=="string" and (.ts|length)>=16 then .ts[11:16] else (.ts//"") end), (.from//"?"), (.to//""), (.action//"?"), (.message//""|gsub("[\n\t]";" ")) ] | join("\u001f")' \
  | while IFS=$'\037' read -r t from to act msg; do
      c="$(color_for "$from")"
      hdr="${DIM}${t}${R} ${c}▌${R} ${c}${BOLD}${from}${R}"
      if [ -n "$to" ]; then hdr="${hdr} ${DIM}→${R} ${BOLD}${to}${R}"; fi
      hdr="${hdr}  $(badge_for "$act")"
      if [ "$act" = "ask" ]; then hdr="${hdr} ${YEL}(needs a reply)${R}"; fi
      printf '\n%s\n' "$hdr"                              # blank line = clear break between messages
      printf '%s\n' "$msg" | fold -s -w "$BODYW" | sed 's/^/    /'
    done
else
  echo "team-chat: install jq for the readable view; showing raw JSON lines" >&2
  tail -n +1 -f "$FEED"
fi
