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

# Detect the pane's real width. tput often falls back to 80 inside a multiplexer pane, which
# then overflows the box; stty size reads the actual ioctl and is more reliable. Fall back
# tput -> 80. The detected width is shown in the header so a wrong value is easy to spot.
SEP="$(printf '\037')"
COLS="$(stty size </dev/tty 2>/dev/null | awk '{print $2}')"
case "$COLS" in ''|*[!0-9]*) COLS="$(tput cols 2>/dev/null || echo 80)";; esac
case "$COLS" in ''|*[!0-9]*) COLS=80;; esac

# ---- header + legend (the legend spells out each badge in plain words) ----
printf '\033[1mTeam chat\033[0m  \033[2m(%s)\033[0m  \033[2m[width %s]\033[0m\n' "$FEED" "$COLS"
printf '\033[2mSEND = a message    ASK = needs a reply    REPLY = an answer\033[0m\n'
printf '\033[2magent messages only — your own typed messages arrive in Phase 2\033[0m\n'

# Body uses Atomic's intercom "accent" colour so the feed matches how messages render inside a
# session; override TEAMCHAT_ACCENT_RGB for other themes. TEAMCHAT_MARGIN tunes the gap to the edge.

# One awk pass draws each message as a dark-grey box: top border, a header line (sender colour
# chip, → target, action badge, time), then the word-wrapped body in the accent colour with the
# first sentence bold and file paths / URLs underlined. Padding is computed from *visible* width
# (ANSI stripped, UTF-8 counted by character) so the right border stays aligned. awk (not sed)
# because BSD sed cannot emit ESC.
if command -v jq >/dev/null 2>&1; then
  tail -n +1 -f "$FEED" \
  | jq -r --unbuffered '[ (if (.ts|type)=="string" and (.ts|length)>=16 then .ts[11:16] else (.ts//"") end), (.from//"?"), (.to//""), (.action//"?"), (.message//""|gsub("[\n\t]";" ")) ] | join("\u001f")' \
  | awk -v W="$COLS" -v margin="${TEAMCHAT_MARGIN:-2}" -v sep="$SEP" -v teal="${TEAMCHAT_ACCENT_RGB:-138;190;183}" -v palstr="39 213 46 214 123 208 220 141" '
    function ord(ch){ return ORDT[ch]+0 }
    # visible column count: strip ANSI, then count UTF-8 lead bytes (continuation bytes 0x80-0xBF skipped)
    function cwidth(s,   t,i,b,w){ t=s; gsub(reESC,"",t); w=0; for(i=1;i<=length(t);i++){ b=ord(substr(t,i,1)); if(b>=128 && b<192) continue; w++ } return w }
    function pad(n,   s){ s=""; while(n-- > 0) s=s" "; return s }
    function rule(n,   s){ s=""; while(n-- > 0) s=s"─"; return s }
    function chip(name,   i,su,code){ su=0; for(i=1;i<=length(name);i++) su+=ord(substr(name,i,1)); code=PAL[(su % NP)+1]; return E"[1;38;5;16;48;5;" code "m " name " " R }
    function badge(a){ if(a=="ask") return E"[1;30;43m ASK " R; else if(a=="reply") return E"[1;30;42m REPLY " R; else if(a=="send") return E"[1;30;44m SEND " R; else return E"[1;30;47m " a " " R }
    function ul(s){ gsub(/((https?|file):\/\/[^ )]+)|([A-Za-z0-9_.~{}-]*\/[A-Za-z0-9_.~{},\/-]*\.[A-Za-z0-9]+)/, U "&" UO, s); return s }
    function boxline(styled,   v){ v=cwidth(styled); if(v>INNER) v=INNER; return GREY VBAR R " " styled pad(INNER-v) " " GREY VBAR R }
    function wrap(text,width,arr,   nw,words,i,cur,cnt){ cnt=0; cur=""; nw=split(text,words," ");
      for(i=1;i<=nw;i++){ if(cur=="") cur=words[i]; else if(cwidth(cur)+1+cwidth(words[i])<=width) cur=cur" "words[i]; else { arr[++cnt]=cur; cur=words[i] }
        while(cwidth(cur)>width){ arr[++cnt]=substr(cur,1,width); cur=substr(cur,width+1) } }
      if(cur!="") arr[++cnt]=cur; if(cnt==0) arr[++cnt]=""; return cnt }
    BEGIN{ E=sprintf("%c",27); R=E"[0m"; reESC=E"\\[[0-9;]*m";
      GREY=E"[38;5;240m"; MSG=E"[38;2;" teal "m"; B=E"[1m"; BO=E"[22m"; U=E"[4m"; UO=E"[24m"; VBAR="│";
      NP=split(palstr,PAL," "); for(i=0;i<256;i++) ORDT[sprintf("%c",i)]=i;
      FS=sep; W=W+0; if(W<28) W=80; BW=W-(margin+0); if(BW<20) BW=20; INNER=BW-4; if(INNER<12) INNER=12 }
    { t=$1; from=$2; to=$3; act=$4; msg=$5;
      print "";                                         # blank line = clear gap between boxes
      print GREY "╭" rule(BW-2) "╮" R;                  # top border
      h=chip(from);
      if(to!="") h=h" "E"[2m→"R" "B to BO;              # dim arrow + bold target
      h=h"  "badge(act);
      if(act=="ask") h=h" "E"[33m(needs a reply)"R;
      h=h"  "E"[2m"t R;                                 # dim time
      print boxline(h);                                 # header line
      inFirst=1; n=wrap(msg,INNER,LN);
      for(li=1; li<=n; li++){ plain=LN[li]; styled=plain;
        if(inFirst){ if(match(plain,/[.!?]( |$)/)){ p=RSTART; styled=B substr(plain,1,p) BO substr(plain,p+1); inFirst=0 } else styled=B plain BO }
        styled=ul(styled); styled=MSG styled R;         # accent-coloured body, first sentence bold, paths underlined
        print boxline(styled) }
      print GREY "╰" rule(BW-2) "╯" R }                 # bottom border
  '
else
  echo "team-chat: install jq for the readable view; showing raw JSON lines" >&2
  tail -n +1 -f "$FEED"
fi
