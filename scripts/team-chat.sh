#!/usr/bin/env bash
# team-chat.sh — a live, reflowing viewer for the team's intercom feed.
#
#   ./scripts/team-chat.sh                 # view the feed in this pane
#   TEAMCHAT_FEED=/abs/path ./scripts/team-chat.sh
#
# The feed is written by the intercom-bridge extension (atomic/extensions/intercom-bridge.ts),
# loaded in each teammate with `atomic -e .../intercom-bridge.ts`. Each session appends its own
# outbound intercom sends, so this shows the AGENT side of the chat (Phase 1 of
# specs/2026-08-14-intercom-team-chat-pane.md). Human overlay sends are Phase 2.
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
    function badge(a){ if(a=="ask") return E"[1;30;43m ASK " R; else if(a=="reply") return E"[1;30;42m REPLY " R; else if(a=="send") return E"[1;30;44m SEND " R; else return E"[1;30;47m " a " " R }
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
      pt = (to!="") ? " " DIM "→" R " " B to BO : "";
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
cleanup(){ printf '\033[?25h\033[?1049l'; rm -f "$TMP" "$LINKS"; }
trap cleanup EXIT
trap 'printf "\033[?25h\033[?1049l"; exit 0' INT TERM
trap 'RESIZED=1' WINCH
printf '\033[?1049h\033[?25l'                 # alt screen + hide cursor

ROWS=24; COLS=80
term_size(){ local s; s="$(stty size </dev/tty 2>/dev/null)"; ROWS="${s%% *}"; COLS="${s##* }"
  case "$COLS" in ''|*[!0-9]*) COLS="$(tput cols 2>/dev/null || echo 80)";; esac
  case "$ROWS" in ''|*[!0-9]*) ROWS="$(tput lines 2>/dev/null || echo 24)";; esac
  case "$COLS" in ''|*[!0-9]*) COLS=80;; esac; case "$ROWS" in ''|*[!0-9]*) ROWS=24;; esac; }

offset=0; total=0
rerender(){ term_size; render "$COLS" > "$TMP"; total="$(wc -l < "$TMP" | tr -d ' ')"; }
paint(){
  local view=$((ROWS-1)); [ "$view" -lt 3 ] && view=3
  local maxoff=$((total - view)); [ "$maxoff" -lt 0 ] && maxoff=0
  [ "$offset" -gt "$maxoff" ] && offset=$maxoff; [ "$offset" -lt 0 ] && offset=0
  local end=$((total - offset)); local start=$((end - view + 1)); [ "$start" -lt 1 ] && start=1
  printf '\033[H\033[2J'
  sed -n "${start},${end}p" "$TMP"
  printf '\033[%d;1H\033[7m team-chat  [%sx%s]  j/k ↓/↑ · space/b · g/G · p preview · q quit \033[0m' "$ROWS" "$COLS" "$ROWS"
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

# Full-screen, scrollable preview of one document. q/Esc returns to the feed.
preview_doc(){
  local f="$1" disp="$2" off=0 total view maxoff key seq
  total="$(wc -l < "$f" 2>/dev/null | tr -d ' ')"; case "$total" in ''|*[!0-9]*) total=0;; esac
  while :; do
    term_size; view=$((ROWS-2)); [ "$view" -lt 1 ] && view=1
    maxoff=$((total-view)); [ "$maxoff" -lt 0 ] && maxoff=0
    [ "$off" -gt "$maxoff" ] && off=$maxoff; [ "$off" -lt 0 ] && off=0
    printf '\033[H\033[2J'
    printf '\033[38;5;240m┌─ \033[0m\033[1m%s\033[0m  \033[2m(%s lines)\033[0m\n' "$disp" "$total"
    sed -n "$((off+1)),$((off+view))p" "$f" 2>/dev/null | cut -c "1-$((COLS-1))"
    printf '\033[%d;1H\033[7m preview: %s   j/k ↓/↑ · space/b · g/G · q/Esc back \033[0m' "$ROWS" "$disp"
    key=""; IFS= read -rsn1 key || true
    case "$key" in
      q|Q) return ;;
      j) off=$((off+1)) ;;
      k) off=$((off-1)) ;;
      ' ') off=$((off+view)) ;;
      b|B) off=$((off-view)) ;;
      g) off=0 ;;
      G) off=$total ;;
      "$(printf '\033')")
        seq=""; read -rsn2 -t 1 seq || true
        case "$seq" in
          '') return ;;                                        # bare Esc closes
          '[A') off=$((off-1)) ;;
          '[B') off=$((off+1)) ;;
          '[5') read -rsn1 -t 1 _ || true; off=$((off-view)) ;;
          '[6') read -rsn1 -t 1 _ || true; off=$((off+view)) ;;
        esac ;;
    esac
  done
}

# Modal: list document links, let the user pick one by number, then preview it.
pick_link(){
  build_links
  if [ "$LINKCOUNT" -eq 0 ]; then
    printf '\033[%d;1H\033[7m no document links in the feed — press any key \033[0m' "$ROWS"; IFS= read -rsn1 _ || true; return
  fi
  printf '\033[H\033[2J\033[1mPreview which document?\033[0m\n\n'
  local i=1 abs disp
  while IFS="$(printf '\t')" read -r abs disp; do
    [ "$i" -gt 9 ] && break
    printf '  \033[7m %d \033[0m  \033[4m%s\033[0m\n' "$i" "$disp"; i=$((i+1))
  done < "$LINKS"
  printf '\n\033[2mtype a number (1-%d), or Esc to cancel\033[0m' "$((i-1))"
  local key=""; IFS= read -rsn1 key || true
  case "$key" in
    [1-9]) if [ "$key" -le "$((i-1))" ]; then
             local n=0; while IFS="$(printf '\t')" read -r abs disp; do n=$((n+1)); if [ "$n" -eq "$key" ]; then preview_doc "$abs" "$disp"; break; fi; done < "$LINKS"
           fi ;;
  esac
}

RESIZED=1; lastsize=-1
while :; do
  sz="$(wc -c < "$FEED" 2>/dev/null || echo 0)"; sz="${sz// /}"
  if [ "$RESIZED" = 1 ] || [ "$sz" != "$lastsize" ]; then
    RESIZED=0; lastsize="$sz"; rerender; paint
  fi
  key=""; IFS= read -rsn1 -t 1 key || true
  case "$key" in
    q|Q) break ;;
    j) offset=$((offset-1)); paint ;;                       # down / toward latest
    k) offset=$((offset+1)); paint ;;                       # up / older
    ' ') offset=$((offset-(ROWS-2))); paint ;;              # page down
    b|B) offset=$((offset+(ROWS-2))); paint ;;              # page up
    g) offset=$((total)); paint ;;                          # top (clamped)
    G) offset=0; paint ;;                                   # bottom / follow
    p|P) pick_link; RESIZED=1 ;;                            # preview a document link
    "$(printf '\033')")
      seq=""; read -rsn2 -t 1 seq || true
      case "$seq" in
        '[A') offset=$((offset+1)); paint ;;                # ↑
        '[B') offset=$((offset-1)); paint ;;                # ↓
        '[5') read -rsn1 -t 1 _ || true; offset=$((offset+(ROWS-2))); paint ;;   # PgUp
        '[6') read -rsn1 -t 1 _ || true; offset=$((offset-(ROWS-2))); paint ;;   # PgDn
      esac ;;
  esac
done
