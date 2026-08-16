#!/usr/bin/env bash
# team-chat.sh — a live, reflowing viewer for the team's intercom feed.
#
#   ./scripts/team-chat.sh                 # view the feed in this pane
#   TEAMCHAT_FEED=/abs/path ./scripts/team-chat.sh
#
# The feed is written by the intercom-bridge extension (atomic/extensions/intercom-bridge.ts),
# loaded in each teammate with `atomic -e .../intercom-bridge.ts`. Each session appends its own
# outbound intercom sends, so the feed shows the agents' side of the chat. You take part by
# pressing `i` to compose: scripts/team-chat-client.mjs (the "human" peer) sends your line to the
# team and mirrors both directions into the same feed. See specs/2026-08-14-intercom-team-chat-pane.md.
#
# WHY A LIVE TUI (and not `tail -f`)
#
# Atomic's own intercom message box reflows when you resize the pane or change the font size
# because it is a live component that RE-RENDERS at the current width. Text printed once into a
# terminal's scrollback cannot do that — the terminal reflows the raw characters and any drawn
# box breaks. So this viewer does what Atomic does: it repaints the whole feed on every resize
# (SIGWINCH), so the boxes are rebuilt at the new width and never shatter.
#
# Trade-off: it uses the alternate screen with its own scrollback, so Herdr's native pane scroll
# does not apply while it runs. Keys: j/k or ↓/↑ scroll · Space/b page · g/G bottom/top · q quit.
# Piped or non-interactive output falls back to a one-shot render.
#
# Put it in its own Herdr pane:
#   herdr pane split --current --direction right
#   herdr pane run <new-pane-id> ./scripts/team-chat.sh
#
# Verified against Atomic 0.9.13 and Herdr 0.8.0. Bash 3.2 safe.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
FEED="${TEAMCHAT_FEED:-$BUILD/team-chat.log}"
mkdir -p "$(dirname "$FEED")"
touch "$FEED"

ACCENT="${TEAMCHAT_ACCENT_RGB:-138;190;183}"   # body colour = Atomic intercom accent (#8abeb7)
MARGIN="${TEAMCHAT_MARGIN:-2}"                  # gap from the right edge
PAL="39 213 46 214 123 208 220 141"            # per-sender chip colours
GROUP="${ATOMIC_INTERCOM_GROUP:-harness}"      # same default as scripts/team.sh — the broker drops cross-group sends
SEP="$(printf '\037')"

have_jq=0; command -v jq >/dev/null 2>&1 && have_jq=1

# render <width> — emit the WHOLE feed as dark-grey boxes sized to <width>.
# Padding uses visible width (ANSI stripped, UTF-8 counted per char) so the right border aligns.
render() {
  local w="$1"
  if [ "$have_jq" != 1 ]; then cat "$FEED"; return; fi
  jq -r '[ (if (.ts|type)=="string" and (.ts|length)>=16 then .ts[11:16] else (.ts//"") end), (.from//"?"), (.to//""), (.action//"?"), (.message//""|gsub("[\n\t]";" ")) ] | join("\u001f")' "$FEED" 2>/dev/null \
  | awk -v W="$w" -v margin="$MARGIN" -v sep="$SEP" -v teal="$ACCENT" -v palstr="$PAL" '
    function ord(ch){ return ORDT[ch]+0 }
    function cwidth(s,   t,i,b,w){ t=s; gsub(reESC,"",t); w=0; for(i=1;i<=length(t);i++){ b=ord(substr(t,i,1)); if(b>=128 && b<192) continue; w++ } return w }
    function pad(n,   s){ s=""; while(n-- > 0) s=s" "; return s }
    function rule(n,   s){ s=""; while(n-- > 0) s=s"─"; return s }
    function chip(name,   i,su,code){ su=0; for(i=1;i<=length(name);i++) su+=ord(substr(name,i,1)); code=PAL[(su % NP)+1]; return E"[1;38;5;16;48;5;" code "m " name " " R }
    function badge(a){ if(a=="ask") return E"[1;30;43m ASK " R; else if(a=="reply") return E"[1;30;42m REPLY " R; else if(a=="send") return E"[1;38;5;250;48;5;238m SEND " R; else return E"[1;30;47m " a " " R }
    function ul(s){ gsub(/((https?|file):\/\/[^ )]+)|([A-Za-z0-9_.~{}-]*\/[A-Za-z0-9_.~{},\/-]*\.[A-Za-z0-9]+)/, U "&" UO, s); return s }
    function boxline(styled,   v){ v=cwidth(styled); if(v>INNER) v=INNER; return GREY VBAR R " " styled pad(INNER-v) " " GREY VBAR R }
    function wrap(text,width,arr,   nw,words,i,cur,cnt){ cnt=0; cur=""; nw=split(text,words," ");
      for(i=1;i<=nw;i++){ if(cur=="") cur=words[i]; else if(cwidth(cur)+1+cwidth(words[i])<=width) cur=cur" "words[i]; else { arr[++cnt]=cur; cur=words[i] }
        while(cwidth(cur)>width){ arr[++cnt]=substr(cur,1,width); cur=substr(cur,width+1) } }
      if(cur!="") arr[++cnt]=cur; if(cnt==0) arr[++cnt]=""; return cnt }
    BEGIN{ E=sprintf("%c",27); R=E"[0m"; DIM=E"[2m"; reESC=E"\\[[0-9;]*m";
      GREY=E"[38;5;240m"; MSG=E"[38;2;" teal "m"; WHITE=E"[1;97m"; B=E"[1m"; BO=E"[22m"; U=E"[4m"; UO=E"[24m"; VBAR="│";
      NP=split(palstr,PAL," "); for(i=0;i<256;i++) ORDT[sprintf("%c",i)]=i;
      FS=sep; W=W+0; if(W<28) W=80; BW=W-(margin+0); if(BW<20) BW=20; INNER=BW-4; if(INNER<12) INNER=12 }
    { t=$1; from=$2; to=$3; act=$4; msg=$5;
      print "";
      print GREY "╭" rule(BW-2) "╮" R;
      # header pieces, trimmed from the right if the pane is too narrow to fit them all
      pt = (to!="") ? " " DIM "→" R " " chip(to) : "";      # recipient gets the same per-name colour pill as the sender
      pb = "  " badge(act);
      pr = (act=="ask") ? " " E"[33m(needs a reply)" R : "";
      ptime = "  " DIM t R;
      h = chip(from) pt pb pr ptime;
      if(cwidth(h)>INNER) h = chip(from) pt pb pr;          # drop the time
      if(cwidth(h)>INNER) h = chip(from) pt pb;             # drop the (needs a reply) note
      if(cwidth(h)>INNER) h = chip(from) pb;                # drop the target
      print boxline(h);
      # body: underline paths on PLAIN first (so the regex cannot eat into the bold code), THEN
      # bold the first sentence. B is only ever prepended/inserted, never gsub-scanned afterwards.
      inFirst=1; n=wrap(msg,INNER,LN);
      # First sentence renders bold WHITE (a skimmable summary); the rest of the body is the
      # teal accent. Underline paths on plain first so the regex cannot eat into a colour code.
      for(li=1; li<=n; li++){ s=ul(LN[li]);
        if(inFirst){ if(match(s,/[.!?]( |$)/)){ p=RSTART; s=WHITE substr(s,1,p) R MSG substr(s,p+1) R; inFirst=0 } else s=WHITE s R }
        else s=MSG s R;
        print boxline(s) }
      print GREY "╰" rule(BW-2) "╯" R }
  '
}

# Non-interactive (piped/redirected): no resize to handle — render once and exit.
if [ ! -t 1 ] || [ ! -t 0 ]; then
  render "${COLUMNS:-80}"
  exit 0
fi

# ---- live TUI ----
TMP="$(mktemp "${TMPDIR:-/tmp}/teamchat.XXXXXX")"
LINKS="$(mktemp "${TMPDIR:-/tmp}/teamchat-links.XXXXXX")"
cleanup(){ printf '\033[?25h\033[?1049l'; [ -n "${CLIENT_PID:-}" ] && kill "$CLIENT_PID" 2>/dev/null; rm -f "$TMP" "$TMP.prev" "$TMP.links" "$LINKS" "$FEED.outbox"; }
trap cleanup EXIT
trap 'printf "\033[?25h\033[?1049l"; exit 0' INT TERM
trap 'RESIZED=1' WINCH
printf '\033[?1049h\033[?25l'                 # alt screen + hide cursor

# Start the human's chat peer (registers as `human`, Phase 2) so you can take part — press i to
# compose. It sends your lines to the team and mirrors both directions into this same feed.
# Runs under bun or node; if neither is present, the viewer is read-only.
CLIENT_PID=""
if command -v bun >/dev/null 2>&1; then RT=bun; elif command -v node >/dev/null 2>&1; then RT=node; else RT=""; fi
if [ -n "$RT" ] && [ -f "$HERE/scripts/team-chat-client.mjs" ]; then
  : > "$FEED.outbox"
  TEAMCHAT_FEED="$FEED" ATOMIC_INTERCOM_GROUP="$GROUP" "$RT" "$HERE/scripts/team-chat-client.mjs" >/dev/null 2>&1 &
  CLIENT_PID=$!
fi

ROWS=24; COLS=80
term_size(){ local s; s="$(stty size </dev/tty 2>/dev/null)"; ROWS="${s%% *}"; COLS="${s##* }"
  case "$COLS" in ''|*[!0-9]*) COLS="$(tput cols 2>/dev/null || echo 80)";; esac
  case "$ROWS" in ''|*[!0-9]*) ROWS="$(tput lines 2>/dev/null || echo 24)";; esac
  case "$COLS" in ''|*[!0-9]*) COLS=80;; esac; case "$ROWS" in ''|*[!0-9]*) ROWS=24;; esac; }

offset=0; total=0
rerender(){ term_size; render "$COLS" > "$TMP"; total="$(wc -l < "$TMP" | tr -d ' ')"; }
K=$'\033[K'          # clear to end of line
paint(){
  local view=$((ROWS-1)); [ "$view" -lt 3 ] && view=3
  local maxoff=$((total - view)); [ "$maxoff" -lt 0 ] && maxoff=0
  [ "$offset" -gt "$maxoff" ] && offset=$maxoff; [ "$offset" -lt 0 ] && offset=0
  local end=$((total - offset)); local start=$((end - view + 1)); [ "$start" -lt 1 ] && start=1
  # Flicker-free: home the cursor, redraw each visible line with a clear-to-EOL, clear anything
  # left below, then the status bar — all in ONE write, with NO full-screen clear (that flashes).
  local body
  body="$(sed -n "${start},${end}p" "$TMP" | awk -v k="$K" '{print $0 k}')"
  printf '\033[H%s\033[J\033[%d;1H\033[7m team-chat  [%sx%s]  j/k · space/b · g/G · p preview · i send · q quit \033[0m%s' \
    "$body" "$ROWS" "$COLS" "$ROWS" "$K"
}

# Collect previewable document links from the feed: path-like tokens that resolve to an existing
# local file. Relative paths resolve against the repo root; URLs are skipped (they open externally,
# not in a modal). Writes "abspath<TAB>display" lines to $LINKS and sets LINKCOUNT.
build_links(){
  : > "$LINKS"; LINKCOUNT=0
  local tok abs
  { [ "$have_jq" = 1 ] && jq -r '.message // ""' "$FEED" 2>/dev/null || cat "$FEED"; } \
  | grep -oE '([A-Za-z0-9_.~{}-]*/[A-Za-z0-9_.~{},/-]*\.[A-Za-z0-9]+)' 2>/dev/null \
  | sort -u > "$TMP.links" 2>/dev/null || true
  while IFS= read -r tok; do
    [ -n "$tok" ] || continue
    case "$tok" in /*) abs="$tok" ;; *) abs="$HERE/$tok" ;; esac
    if [ -f "$abs" ]; then LINKCOUNT=$((LINKCOUNT+1)); printf '%s\t%s\n' "$abs" "$tok" >> "$LINKS"; fi
  done < "$TMP.links"
  rm -f "$TMP.links"
}

# render_md <file> <width> — lightweight markdown -> ANSI wrapped to <width>. Handles headings,
# **bold**, *italic*, `code`, - lists, > quotes, --- rules, and ``` fenced code. Dependency-free
# (no glow/pandoc). Wrapping is on plain text (inline styling adds zero-width ANSI), so lines fit.
render_md(){
  awk -v W="$2" -v teal="$ACCENT" '
  function inl(s,   r,i,L,j,inner){ r=""; i=1; L=length(s)
    while(i<=L){
      if(substr(s,i,2)=="**"){ j=index(substr(s,i+2),"**"); if(j>0){ inner=substr(s,i+2,j-1); r=r B inner BO; i=i+j+3; continue } }
      if(substr(s,i,1)=="`"){ j=index(substr(s,i+1),"`"); if(j>0){ inner=substr(s,i+1,j-1); r=r CODE inner CODEO; i=i+j+1; continue } }
      if(substr(s,i,1)=="*"){ j=index(substr(s,i+1),"*"); if(j>0){ inner=substr(s,i+1,j-1); r=r IT inner ITO; i=i+j+1; continue } }
      r=r substr(s,i,1); i++ }
    return r }
  function sp(k,   s){ s=""; while(k-- > 0) s=s" "; return s }
  function emit(text,width,pre,cont,style,   nw,words,i,cand,cur,first){ nw=split(text,words," "); cur=""; first=1
    for(i=1;i<=nw;i++){ cand=(cur==""?words[i]:cur" "words[i]); if(length(cand)<=width) cur=cand; else { print (first?pre:cont) style inl(cur) R; first=0; cur=words[i] } }
    if(cur!="") print (first?pre:cont) style inl(cur) R; else if(nw==0) print "" }
  BEGIN{ E=sprintf("%c",27); R=E"[0m"; BOLD=E"[1m"; DIM=E"[2m"; GREY=E"[38;5;240m";
    WHITE=E"[1;97m"; ACC=E"[38;2;" teal "m"; B=E"[1m"; BO=E"[22m"; IT=E"[3m"; ITO=E"[23m"; CODE=E"[7m"; CODEO=E"[27m";
    W=W+0; if(W<8) W=80; HR=""; for(i=0;i<W-1;i++) HR=HR"─" }
  { line=$0
    if(line ~ /^[ \t]*```/){ incode=!incode; print GREY (incode?"┄┄┄ code ┄┄┄":"┄┄┄┄┄┄┄┄┄┄┄") R; next }
    if(incode){ print GREY "  " line R; next }
    if(match(line,/^### +/)){ print BOLD substr(line,RLENGTH+1) R; next }
    if(match(line,/^## +/)){ print BOLD ACC substr(line,RLENGTH+1) R; next }
    if(match(line,/^# +/)){ print WHITE substr(line,RLENGTH+1) R; next }
    if(line ~ /^([-*_] *){3,}$/){ print GREY HR R; next }
    if(match(line,/^> ?/)){ emit(substr(line,RLENGTH+1), W-3, GREY "│ " R, GREY "│ " R, DIM); next }
    if(match(line,/^[ \t]*[-*+] +/)){ emit(substr(line,RLENGTH+1), W-3, ACC "• " R, "  ", ""); next }
    if(match(line,/^[ \t]*[0-9]+\. +/)){ n=substr(line,1,RLENGTH); sub(/^[ \t]*/,"",n); emit(substr(line,RLENGTH+1), W-length(n)-1, ACC n R, sp(length(n)), ""); next }
    if(line ~ /^[ \t]*$/){ print ""; next }
    emit(line, W-1, "", "", "") }
  ' "$1"
}

# Full-screen, scrollable preview of one document. q/Esc returns to the feed.
preview_doc(){
  local f="$1" disp="$2" off=0 total view maxoff key seq src ismd=0 rw=-1 title body meta
  case "$f" in *.md|*.markdown|*.mdown) ismd=1 ;; esac
  while :; do
    term_size; view=$((ROWS-2)); [ "$view" -lt 1 ] && view=1
    if [ "$ismd" = 1 ]; then
      if [ "$COLS" != "$rw" ]; then render_md "$f" "$COLS" > "$TMP.prev" 2>/dev/null; rw="$COLS"; fi
      src="$TMP.prev"; meta="markdown"
    else
      src="$f"; meta="text"
    fi
    total="$(wc -l < "$src" 2>/dev/null | tr -d ' ')"; case "$total" in ''|*[!0-9]*) total=0;; esac
    maxoff=$((total-view)); [ "$maxoff" -lt 0 ] && maxoff=0
    [ "$off" -gt "$maxoff" ] && off=$maxoff; [ "$off" -lt 0 ] && off=0
    title="$(printf '\033[38;5;240m┌─ \033[0m\033[1m%s\033[0m  \033[2m(%s)\033[0m%s' "$disp" "$meta" "$K")"
    if [ "$ismd" = 1 ]; then
      body="$(sed -n "$((off+1)),$((off+view))p" "$src" 2>/dev/null | awk -v k="$K" '{print $0 k}')"
    else
      body="$(sed -n "$((off+1)),$((off+view))p" "$src" 2>/dev/null | cut -c "1-$((COLS-1))" | awk -v k="$K" '{print $0 k}')"
    fi
    printf '\033[H%s\n%s\033[J\033[%d;1H\033[7m preview: %s   j/k ↓/↑ · space/b · g/G · q/Esc back \033[0m%s' \
      "$title" "$body" "$ROWS" "$disp" "$K"
    key=""; IFS= read -rsn1 key </dev/tty || true
    case "$key" in
      q|Q) return ;;
      j) off=$((off+1)) ;;
      k) off=$((off-1)) ;;
      ' ') off=$((off+view)) ;;
      b|B) off=$((off-view)) ;;
      g) off=0 ;;
      G) off=$total ;;
      "$(printf '\033')")
        seq=""; read -rsn2 -t 1 seq </dev/tty || true
        case "$seq" in
          '') return ;;                                        # bare Esc closes
          '[A') off=$((off-1)) ;;
          '[B') off=$((off+1)) ;;
          '[5') read -rsn1 -t 1 _ </dev/tty || true; off=$((off-view)) ;;
          '[6') read -rsn1 -t 1 _ </dev/tty || true; off=$((off+view)) ;;
        esac ;;
    esac
  done
}

# Modal: list document links, let the user pick one by number, then preview it.
pick_link(){
  build_links
  if [ "$LINKCOUNT" -eq 0 ]; then
    printf '\033[%d;1H\033[7m no document links in the feed — press any key \033[0m' "$ROWS"; IFS= read -rsn1 _ </dev/tty || true; return
  fi
  printf '\033[H\033[2J\033[1mPreview which document?\033[0m\n\n'
  local i=1 abs disp
  while IFS="$(printf '\t')" read -r abs disp; do
    [ "$i" -gt 9 ] && break
    printf '  \033[7m %d \033[0m  \033[4m%s\033[0m\n' "$i" "$disp"; i=$((i+1))
  done < "$LINKS"
  printf '\n\033[2mtype a number (1-%d), or Esc to cancel\033[0m' "$((i-1))"
  local key=""; IFS= read -rsn1 key </dev/tty || true
  # Pick the Nth link with sed (NOT a `while read < $LINKS` loop — that would steal preview_doc's stdin).
  case "$key" in
    [1-9]) if [ "$key" -le "$((i-1))" ]; then
             local sel; sel="$(sed -n "${key}p" "$LINKS")"
             [ -n "$sel" ] && preview_doc "${sel%%$'\t'*}" "${sel#*$'\t'}"
           fi ;;
  esac
}

# Compose: read a target and a message from /dev/tty (cooked, echoed) and queue them for the chat
# client to send. The client mirrors the sent line back into the feed, so it appears in the view.
compose(){
  if [ -z "${CLIENT_PID:-}" ]; then
    printf '\033[%d;1H\033[7m chat client not running (needs bun or node) — any key \033[0m' "$ROWS"; IFS= read -rsn1 _ </dev/tty || true; return
  fi
  local to msg
  printf '\033[%d;1H\033[K\033[?25h' "$ROWS"
  printf 'to (default lead): '; IFS= read -r to </dev/tty || true; [ -z "$to" ] && to="lead"
  printf '\033[%d;1H\033[Kmessage (empty cancels): ' "$ROWS"; IFS= read -r msg </dev/tty || true
  printf '\033[?25l'
  [ -n "$msg" ] && printf '%s\t%s\n' "$to" "$msg" >> "$FEED.outbox"
}

RESIZED=1; lastsize=-1
while :; do
  sz="$(wc -c < "$FEED" 2>/dev/null || echo 0)"; sz="${sz// /}"
  if [ "$RESIZED" = 1 ] || [ "$sz" != "$lastsize" ]; then
    RESIZED=0; lastsize="$sz"; rerender; paint
  fi
  key=""; IFS= read -rsn1 -t 1 key </dev/tty || true
  case "$key" in
    q|Q) break ;;
    j) offset=$((offset-1)); paint ;;                       # down / toward latest
    k) offset=$((offset+1)); paint ;;                       # up / older
    ' ') offset=$((offset-(ROWS-2))); paint ;;              # page down
    b|B) offset=$((offset+(ROWS-2))); paint ;;              # page up
    g) offset=$((total)); paint ;;                          # top (clamped)
    G) offset=0; paint ;;                                   # bottom / follow
    p|P) pick_link; RESIZED=1 ;;                            # preview a document link
    i|I) compose; RESIZED=1 ;;                              # compose and send a message
    "$(printf '\033')")
      seq=""; read -rsn2 -t 1 seq </dev/tty || true
      case "$seq" in
        '[A') offset=$((offset+1)); paint ;;                # ↑
        '[B') offset=$((offset-1)); paint ;;                # ↓
        '[5') read -rsn1 -t 1 _ </dev/tty || true; offset=$((offset+(ROWS-2))); paint ;;   # PgUp
        '[6') read -rsn1 -t 1 _ </dev/tty || true; offset=$((offset-(ROWS-2))); paint ;;   # PgDn
      esac ;;
  esac
done
