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
# Body text uses Atomic's intercom "accent" colour so this feed matches how intercom messages
# render inside a session (Atomic paints the whole message box with theme.fg("accent", …)).
# Default is the #8abeb7 teal accent; override TEAMCHAT_ACCENT_RGB="r;g;b" for another theme.
MSG=$'\033[38;2;'"${TEAMCHAT_ACCENT_RGB:-138;190;183}"'m'

# Sum the name's bytes to pick a stable palette slot, so a sender keeps one colour.
idx_for(){ local n="$1" s=0 i c; for ((i=0; i<${#n}; i++)); do printf -v c '%d' "'${n:i:1}"; s=$((s + c)); done; printf '%s' "$((s % ${#PAL[@]}))"; }
# The sender is a bold colour "chip": black text on the sender's colour. High contrast, and
# the name is still spelled out — colour is never the only cue.
chip_for(){ local n="$1"; printf '\033[1;38;5;16;48;5;%sm %s \033[0m' "${PAL[$(idx_for "$n")]}" "$n"; }
# Action badges carry the word (primary cue) on a high-contrast block (secondary cue).
badge_for(){ case "$1" in
    ask)   printf '\033[1;30;43m ASK \033[0m';;
    reply) printf '\033[1;30;42m REPLY \033[0m';;
    send)  printf '\033[1;30;44m SEND \033[0m';;
    *)     printf '\033[1;30;47m %s \033[0m' "$1";;
  esac; }

# Style the body WITHOUT disturbing its accent colour: bold the first sentence (a mini-summary
# you can skim) and underline file paths / URLs. Uses attribute-off codes (22 = bold off,
# 24 = underline off), never a full reset, so the accent colour carries through. awk is used
# because BSD sed (macOS) cannot emit an ESC byte.
style_body(){ printf '%s' "$1" | awk '
    BEGIN { E=sprintf("%c",27); B=E"[1m"; BO=E"[22m"; U=E"[4m"; UO=E"[24m" }
    {
      line=$0
      if (match(line, /[.!?]( |$)/)) { p=RSTART; line=B substr(line,1,p) BO substr(line,p+1) }
      else { line=B line BO }
      gsub(/((https?|file):\/\/[^ )]+)|([A-Za-z0-9_.~{}-]*\/[A-Za-z0-9_.~{},\/-]*\.[A-Za-z0-9]+)/, U "&" UO, line)
      print line
    }'; }

# Deliberately NO hard-wrap and NO indent: the pane wraps the body itself, and an indent
# would be lost on those wrapped lines (and double-wraps if our width guess is off). Flush-left
# body + a blank line between messages keeps long messages readable at any pane width.
if command -v jq >/dev/null 2>&1; then
  tail -n +1 -f "$FEED" \
  | jq -r --unbuffered '[ (if (.ts|type)=="string" and (.ts|length)>=16 then .ts[11:16] else (.ts//"") end), (.from//"?"), (.to//""), (.action//"?"), (.message//""|gsub("[\n\t]";" ")) ] | join("\u001f")' \
  | while IFS=$'\037' read -r t from to act msg; do
      hdr="$(chip_for "$from")"
      if [ -n "$to" ]; then hdr="${hdr} ${DIM}→${R} ${BOLD}${to}${R}"; fi
      hdr="${hdr}  $(badge_for "$act")"
      if [ "$act" = "ask" ]; then hdr="${hdr} ${YEL}(needs a reply)${R}"; fi
      hdr="${hdr}  ${DIM}${t}${R}"
      printf '\n%s\n%s%s%s\n' "$hdr" "$MSG" "$(style_body "$msg")" "$R"   # blank line = break; body = accent
    done
else
  echo "team-chat: install jq for the readable view; showing raw JSON lines" >&2
  tail -n +1 -f "$FEED"
fi
