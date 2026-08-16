#!/usr/bin/env bash
# kanban.sh — a live kanban board whose columns are the harness's own workflow stages.
#
#   ./scripts/kanban.sh                    # view the board in this pane
#   BUILD_DIR=/abs/path ./scripts/kanban.sh
#   BOARD_DIR=/abs/path ./scripts/kanban.sh
#
# Cards are markdown files under build/BOARD/, written with scripts/board.sh (agents and the
# human both use it — see docs/kanban.md for the card format). The six columns are fixed, in
# this order: RESEARCH, PLAN, IMPLEMENTATION, VERIFICATION, HUMAN REVIEW, DONE — the workflow
# stages from docs/monitoring-agents.md.
#
# Same live-TUI approach as team-chat.sh (its header explains why a `tail -f` cannot reflow):
# the whole board repaints on every resize (SIGWINCH), so the columns are rebuilt at the new
# width and never shatter. Columns lay out cleanly from ~90 columns of width; narrower panes
# still render, just with wrapped rows.
#
# Keys: ←→/h/l column · ↑↓/j/k card · p preview the card's markdown · q quit.
# Piped or non-interactive output falls back to a one-shot render.
#
# Put it in its own Herdr tab (build.sh does this automatically):
#   herdr tab create --label kanban --cwd "$PWD"
#   herdr pane run <pane-id> ./scripts/kanban.sh
#
# Verified against Herdr 0.8.0. Bash 3.2 safe.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
BOARD="${BOARD_DIR:-$BUILD/BOARD}"
mkdir -p "$BOARD"

ACCENT="${KANBAN_ACCENT_RGB:-138;190;183}"     # working colour = Atomic intercom accent (#8abeb7)
MARGIN="${KANBAN_MARGIN:-2}"                    # gap from the right edge
PAL="39 213 46 214 123 208 220 141"            # per-owner chip colours — same palette as team-chat.sh
SEP="$(printf '\037')"

CARDS="$(mktemp "${TMPDIR:-/tmp}/kanban-cards.XXXXXX")"

# scan_cards — parse every card under $BOARD into one line each in $CARDS:
#   <column 0-5> US <path> US <status> US <owner> US <title>
# stage maps research/plan/implementation/verification/review/done -> columns 0-5; a missing or
# unknown stage falls into RESEARCH (column 0). The title is the first non-blank line after ---.
scan_cards(){
  : > "$CARDS"
  set -- "$BOARD"/*.md
  [ -f "${1:-}" ] || return 0
  awk -v sep="$SEP" '
    function colof(s){ if(s=="plan")return 1; if(s=="implementation")return 2; if(s=="verification")return 3; if(s=="review")return 4; if(s=="done")return 5; return 0 }
    function flush(){ if(fn!=""){ gsub(sep,"",t); print colof(st) sep fn sep ss sep ow sep t } }
    FNR==1 { flush(); fn=FILENAME; st=""; ss=""; ow=""; t=""; body=0 }
    !body && /^---[ \t]*$/ { body=1; next }
    !body { if (match($0,/^stage:[ \t]*/))  { st=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",st) }
            else if (match($0,/^status:[ \t]*/)) { ss=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",ss) }
            else if (match($0,/^owner:[ \t]*/))  { ow=substr($0,RLENGTH+1); sub(/[ \t\r]+$/,"",ow) }
            next }
    body && t=="" && $0 !~ /^[ \t]*$/ { t=$0 }
    END { flush() }
  ' "$@" > "$CARDS"
}

# render <width> — emit the WHOLE board sized to <width>: six fixed columns side by side, each
# card a small box. Padding uses visible width (ANSI stripped, UTF-8 counted per char) so the
# columns align. The selected card (SELC/SELR, -1 in one-shot mode) gets a white border; the
# selected column's header renders as a reverse-video pill. Card colour reflects status:
# waiting = dim grey, working = teal accent, blocked = yellow (red glyph), done = green.
render(){
  local w="$1"
  scan_cards
  awk -v W="$w" -v margin="$MARGIN" -v sep="$SEP" -v teal="$ACCENT" -v palstr="$PAL" \
      -v selc="${SELC:--1}" -v selr="${SELR:--1}" '
    function ord(ch){ return ORDT[ch]+0 }
    function cwidth(s,   t,i,b,w){ t=s; gsub(reESC,"",t); w=0; for(i=1;i<=length(t);i++){ b=ord(substr(t,i,1)); if(b>=128 && b<192) continue; w++ } return w }
    function pad(n,   s){ s=""; while(n-- > 0) s=s" "; return s }
    function rule(n,   s){ s=""; while(n-- > 0) s=s"─"; return s }
    function chip(name,   i,su,code){ su=0; for(i=1;i<=length(name);i++) su+=ord(substr(name,i,1)); code=PAL[(su % NP)+1]; return E"[1;38;5;16;48;5;" code "m " name " " R }
    function scolor(s){ if(s=="working") return TEAL; if(s=="blocked") return WARN; if(s=="done") return OK; return DIMG }
    function sglyph(s){ if(s=="working") return TEAL "●" R; if(s=="blocked") return BAD "!" R; if(s=="done") return OK "✓" R; return DIMG "○" R }
    function put(c,line){ nl[c]++; L[c,nl[c]]=line }
    function boxline(styled,bord,   v){ v=cwidth(styled); if(v>IN) v=IN; return bord VBAR R " " styled pad(IN-v) " " bord VBAR R }
    function wrap(text,width,arr,   nw,words,i,cur,cnt2){ cnt2=0; cur=""; nw=split(text,words," ");
      for(i=1;i<=nw;i++){ if(cur=="") cur=words[i]; else if(cwidth(cur)+1+cwidth(words[i])<=width) cur=cur" "words[i]; else { arr[++cnt2]=cur; cur=words[i] }
        while(cwidth(cur)>width){ arr[++cnt2]=substr(cur,1,width); cur=substr(cur,width+1) } }
      if(cur!="") arr[++cnt2]=cur; if(cnt2==0) arr[++cnt2]=""; return cnt2 }
    BEGIN{ E=sprintf("%c",27); R=E"[0m"; DIM=E"[2m"; reESC=E"\\[[0-9;]*m";
      GREY=E"[38;5;240m"; WHITE=E"[1;97m"; TEAL=E"[38;2;" teal "m"; WARN=E"[1;33m"; BAD=E"[1;31m"; OK=E"[32m";
      DIMG=E"[2;38;5;250m"; B=E"[1m"; REV=E"[7m"; RO=E"[27m"; VBAR="│";
      NP=split(palstr,PAL," "); for(i=0;i<256;i++) ORDT[sprintf("%c",i)]=i;
      split("RESEARCH|PLAN|IMPLEMENTATION|VERIFICATION|HUMAN REVIEW|DONE", NAME, "|");
      FS=sep; W=W+0; if(W<28) W=80;
      # colw never drops below the longest column name (14), so headers are never truncated —
      # below ~90 columns the rows overrun the pane width instead of losing a column.
      colw=int((W-margin-5)/6); if(colw<14) colw=14; IN=colw-4 }
    { c=$1+1; ss=$3; ow=$4; t=$5;
      if(t==""){ t=$2; sub(/^.*\//,"",t) }                  # bodyless card: fall back to the filename
      sel = (c-1==selc && cnt[c]==selr); cnt[c]++;
      bord = sel ? WHITE : GREY; sc = scolor(ss);
      put(c, bord "╭" rule(colw-2) "╮" R);
      n=wrap(t,IN,LN); if(n>2){ n=2; LN[2]=substr(LN[2],1,IN-1) "…" }
      for(i=1;i<=n;i++) put(c, boxline(sc LN[i] R, bord));
      if(cwidth(ow)>IN-4) ow=substr(ow,1,IN-4);             # keep glyph + chip inside the box
      put(c, boxline(sglyph(ss) " " (ow!="" ? chip(ow) : DIM "—" R), bord));
      put(c, bord "╰" rule(colw-2) "╯" R) }
    END{
      hline=""; uline="";
      for(c=1;c<=6;c++){
        nm=NAME[c];
        if(c-1==selc){ if(length(nm)>colw-2) nm=substr(nm,1,colw-2); h=REV " " nm " " RO }
        else { if(length(nm)>colw) nm=substr(nm,1,colw); h=B nm R }
        hline = hline (c>1?" ":"") h pad(colw-cwidth(h));
        uline = uline (c>1?" ":"") GREY rule(colw) R }
      print hline; print uline;
      maxr=0; for(c=1;c<=6;c++) if(nl[c]>maxr) maxr=nl[c];
      for(r=1;r<=maxr;r++){ line="";
        for(c=1;c<=6;c++){ s=(r<=nl[c])?L[c,r]:""; v=cwidth(s); line=line (c>1?" ":"") s pad(colw-v) }
        print line } }
  ' "$CARDS"
}

# Non-interactive (piped/redirected): no resize or keys to handle — render once and exit.
if [ ! -t 1 ] || [ ! -t 0 ]; then
  SELC=-1; SELR=-1
  render "${COLUMNS:-80}"
  rm -f "$CARDS"
  exit 0
fi

# ---- live TUI ----
TMP="$(mktemp "${TMPDIR:-/tmp}/kanban.XXXXXX")"
cleanup(){ printf '\033[?25h\033[?1049l'; rm -f "$TMP" "$TMP.prev" "$CARDS"; }
trap cleanup EXIT
trap 'printf "\033[?25h\033[?1049l"; exit 0' INT TERM
trap 'RESIZED=1' WINCH
printf '\033[?1049h\033[?25l'                 # alt screen + hide cursor

ROWS=24; COLS=80
term_size(){ local s; s="$(stty size </dev/tty 2>/dev/null)"; ROWS="${s%% *}"; COLS="${s##* }"
  case "$COLS" in ''|*[!0-9]*) COLS="$(tput cols 2>/dev/null || echo 80)";; esac
  case "$ROWS" in ''|*[!0-9]*) ROWS="$(tput lines 2>/dev/null || echo 24)";; esac
  case "$COLS" in ''|*[!0-9]*) COLS=80;; esac; case "$ROWS" in ''|*[!0-9]*) ROWS=24;; esac; }

SELC=0; SELR=0; total=0
count_col(){ awk -F"$SEP" -v c="$1" '$1==c{n++} END{print n+0}' "$CARDS"; }
sel_file(){ awk -F"$SEP" -v c="$SELC" -v r="$SELR" '$1==c{ if(n==r){print $2; exit}; n++ }' "$CARDS"; }
clamp_sel(){ local n
  [ "$SELC" -lt 0 ] && SELC=0; [ "$SELC" -gt 5 ] && SELC=5
  n="$(count_col "$SELC")"
  if [ "$n" -eq 0 ]; then SELR=0; elif [ "$SELR" -ge "$n" ]; then SELR=$((n-1)); fi
  [ "$SELR" -lt 0 ] && SELR=0; }

rerender(){ term_size; render "$COLS" > "$TMP"; total="$(wc -l < "$TMP" | tr -d ' ')"; }
K=$'\033[K'          # clear to end of line
paint(){
  local view=$((ROWS-1)); [ "$view" -lt 3 ] && view=3
  # Flicker-free: home the cursor, redraw each visible line with a clear-to-EOL, clear anything
  # left below, then the status bar — all in ONE write, with NO full-screen clear (that flashes).
  local body
  body="$(sed -n "1,${view}p" "$TMP" | awk -v k="$K" '{print $0 k}')"
  printf '\033[H%s\033[J\033[%d;1H\033[7m kanban  [%sx%s]  ←→/h/l column · ↑↓/j/k card · p preview · q quit \033[0m%s' \
    "$body" "$ROWS" "$COLS" "$K"
}

# render_md <file> <width> — lightweight markdown -> ANSI wrapped to <width>. Handles headings,
# **bold**, *italic*, `code`, - lists, > quotes, --- rules, and ``` fenced code. Dependency-free
# (no glow/pandoc). Same renderer as team-chat.sh, so cards preview exactly like feed documents.
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

# Full-screen, scrollable preview of the selected card's markdown. q/Esc returns to the board.
preview_doc(){
  local f="$1" disp="$2" off=0 total view maxoff key seq src rw=-1 title body
  while :; do
    term_size; view=$((ROWS-2)); [ "$view" -lt 1 ] && view=1
    if [ "$COLS" != "$rw" ]; then render_md "$f" "$COLS" > "$TMP.prev" 2>/dev/null; rw="$COLS"; fi
    src="$TMP.prev"
    total="$(wc -l < "$src" 2>/dev/null | tr -d ' ')"; case "$total" in ''|*[!0-9]*) total=0;; esac
    maxoff=$((total-view)); [ "$maxoff" -lt 0 ] && maxoff=0
    [ "$off" -gt "$maxoff" ] && off=$maxoff; [ "$off" -lt 0 ] && off=0
    title="$(printf '\033[38;5;240m┌─ \033[0m\033[1m%s\033[0m  \033[2m(card)\033[0m%s' "$disp" "$K")"
    body="$(sed -n "$((off+1)),$((off+view))p" "$src" 2>/dev/null | awk -v k="$K" '{print $0 k}')"
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

RESIZED=1; lastsig=""
while :; do
  # Repaint when the terminal resized or any card file changed (name, count, or content).
  sig="$({ ls "$BOARD" 2>/dev/null; cat "$BOARD"/*.md 2>/dev/null; } | cksum 2>/dev/null || echo 0)"
  if [ "$RESIZED" = 1 ] || [ "$sig" != "$lastsig" ]; then
    RESIZED=0; lastsig="$sig"; scan_cards; clamp_sel; rerender; paint
  fi
  key=""; IFS= read -rsn1 -t 1 key </dev/tty || true
  case "$key" in
    q|Q) break ;;
    h) SELC=$((SELC-1)); clamp_sel; rerender; paint ;;      # column left
    l) SELC=$((SELC+1)); clamp_sel; rerender; paint ;;      # column right
    j) SELR=$((SELR+1)); clamp_sel; rerender; paint ;;      # card down
    k) SELR=$((SELR-1)); clamp_sel; rerender; paint ;;      # card up
    p|P) f="$(sel_file)"; if [ -n "$f" ]; then preview_doc "$f" "${f##*/}"; fi; RESIZED=1 ;;
    "$(printf '\033')")
      seq=""; read -rsn2 -t 1 seq </dev/tty || true
      case "$seq" in
        '[A') SELR=$((SELR-1)); clamp_sel; rerender; paint ;;   # ↑
        '[B') SELR=$((SELR+1)); clamp_sel; rerender; paint ;;   # ↓
        '[C') SELC=$((SELC+1)); clamp_sel; rerender; paint ;;   # →
        '[D') SELC=$((SELC-1)); clamp_sel; rerender; paint ;;   # ←
      esac ;;
  esac
done
