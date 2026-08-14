#!/usr/bin/env bash
# render-demo.sh — regenerates docs/media/build-demo.gif from scratch.
#
#   ./scripts/render-demo.sh
#
# The two GIFs this repo used to ship (see git history) were committed as bare output
# files with no generator. Nobody but their author could tell what had gone stale, and
# nobody could regenerate them after the flow changed. This script is the fix: it is
# the *only* thing committed. The GIF is a build artifact of this script, not a source
# file — re-run it whenever the reconstructed run in docs/case-study-first-run.md changes.
#
# What it does:
#   1. Emits one SVG frame per beat of the case study (real strings from
#      docs/case-study-first-run.md — no invented content).
#   2. Rasterises each SVG to PNG with rsvg-convert (the only renderer that handles
#      SVG <text> correctly here — `magick` fails on SVG text with "unable to read
#      font").
#   3. Assembles the PNGs into a GIF with ffmpeg (palettegen/paletteuse for a small,
#      good-looking palette), respecting a per-frame hold duration so important beats
#      (the answer, the gate, each hire) get more screen time than transitions.
#
# All intermediate frames live in a temp dir that is cleaned up on exit — nothing but
# the final GIF is written outside of it.
#
# Verified against: rsvg-convert (librsvg), ffmpeg. Bash 3.2 safe (macOS default bash).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/docs/media/build-demo.gif"
WIDTH=960
HEIGHT=640
FPS=12

command -v rsvg-convert >/dev/null 2>&1 || { echo "render-demo.sh: rsvg-convert not found (brew install librsvg)" >&2; exit 1; }
command -v ffmpeg       >/dev/null 2>&1 || { echo "render-demo.sh: ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }

TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/render-demo.XXXXXX")"
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

mkdir -p "$REPO_ROOT/docs/media"

# ── Catppuccin Mocha (matches ghostty/config) ──────────────────────────────────────
BASE="#1e1e2e"
MANTLE="#181825"
SURFACE0="#313244"
OVERLAY0="#6c7086"
TEXT="#cdd6f4"
GREEN="#a6e3a1"
BLUE="#89b4fa"
MAUVE="#cba6f7"
PEACH="#fab387"
RED="#f38ba8"
YELLOW="#f9e2af"

FONT="JetBrains Mono, Menlo, monospace"

FRAME_INDEX=0
FRAME_FILES=()
FRAME_DURATIONS=()

# ── low-level SVG helpers ───────────────────────────────────────────────────────────

esc() {
  # NOTE: bash's ${var//pat/repl} treats an unescaped & in `repl` as "the matched
  # text" (like sed) — so the replacement itself must escape its own &.
  local s="$1"
  s="${s//&/\&amp;}"
  s="${s//</\&lt;}"
  s="${s//>/\&gt;}"
  printf '%s' "$s"
}

# line X Y SIZE COLOR WEIGHT [STYLE] TEXT...
line() {
  local x="$1" y="$2" size="$3" color="$4" weight="$5" style="$6"; shift 6
  local text; text="$(esc "$*")"
  printf '<text x="%s" y="%s" font-family="%s" font-size="%s" fill="%s" font-weight="%s" font-style="%s" xml:space="preserve">%s</text>\n' \
    "$x" "$y" "$FONT" "$size" "$color" "$weight" "$style" "$text"
}

rect() {
  # rect X Y W H RX FILL STROKE STROKE_WIDTH
  printf '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" stroke="%s" stroke-width="%s"/>\n' \
    "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$8"
}

circ() {
  printf '<circle cx="%s" cy="%s" r="%s" fill="%s"/>\n' "$1" "$2" "$3" "$4"
}

# cursor_block X Y_BASELINE SIZE COLOR — a solid block, no font glyph dependency.
cursor_block() {
  local x="$1" yb="$2" size="$3" color="$4"
  local w=$(( size*6/10 ))
  local h=$(( size + 2 ))
  local y=$(( yb - size ))
  rect "$x" "$y" "$w" "$h" 0 "$color" none 0
}

# text_width_px SIZE TEXT — monospace approximation (~0.6 em per char).
text_width_px() {
  local size="$1"; shift
  local n=${#1}
  printf '%s' $(( size*6*n/10 ))
}

WINDOW_TITLE=""

# frame DURATION BODY [BORDER_COLOR]
frame() {
  local duration="$1" body="$2" border="${3:-}"
  FRAME_INDEX=$((FRAME_INDEX+1))
  local idx; idx=$(printf "%03d" "$FRAME_INDEX")
  local svgfile="$TMPDIR/frame_${idx}.svg"
  local pngfile="$TMPDIR/frame_${idx}.png"
  local border_rect=""
  if [ -n "$border" ]; then
    border_rect="$(rect 3 3 $((WIDTH-6)) $((HEIGHT-6)) 10 none "$border" 5)"
  fi
  cat > "$svgfile" <<SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" width="$WIDTH" height="$HEIGHT" viewBox="0 0 $WIDTH $HEIGHT">
  <rect width="$WIDTH" height="$HEIGHT" fill="$BASE"/>
  <rect x="0" y="0" width="$WIDTH" height="40" fill="$MANTLE"/>
  <circle cx="24" cy="20" r="6" fill="$RED"/>
  <circle cx="46" cy="20" r="6" fill="$YELLOW"/>
  <circle cx="68" cy="20" r="6" fill="$GREEN"/>
  <text x="$((WIDTH/2))" y="25" font-family="$FONT" font-size="13" fill="$OVERLAY0" text-anchor="middle">$WINDOW_TITLE</text>
$body
$border_rect
</svg>
SVGEOF
  rsvg-convert -w "$WIDTH" "$svgfile" -o "$pngfile"
  FRAME_FILES+=("$pngfile")
  FRAME_DURATIONS+=("$duration")
}

# pane_box X Y W H ROLE STATE [HIGHLIGHT] — one cockpit pane, styled like a Herdr
# sidebar entry. HIGHLIGHT, if given, overrides the state-colored border — used to
# mark a pane as sender/receiver of an in-flight Intercom message.
pane_box() {
  local x="$1" y="$2" w="$3" h="$4" role="$5" state="$6" highlight="${7:-}"
  local border="$OVERLAY0" sw=1 dot="$OVERLAY0"
  if [ "$state" = "working" ]; then border="$BLUE"; sw=2; dot="$GREEN"; fi
  if [ -n "$highlight" ]; then border="$highlight"; sw=3; fi
  rect "$x" "$y" "$w" "$h" 8 "$SURFACE0" "$border" "$sw"
  line $((x+16)) $((y+32)) 18 "$TEXT" bold normal "$role"
  circ $((x+18)) $((y+58)) 5 "$dot"
  line $((x+32)) $((y+63)) 13 "$OVERLAY0" normal normal "$state"
}

# ════════════════════════════════════════════════════════════════════════════════════
# ACT 1 — the question
# ════════════════════════════════════════════════════════════════════════════════════
WINDOW_TITLE="lead — bash"

BODY="$(line 40 90 20 "$TEXT" normal normal '$ ')$(cursor_block 62 90 20 "$TEXT")"
frame 0.6 "$BODY"

BODY="$(line 40 90 20 "$TEXT" normal normal '$ ./build.sh')"
frame 1.0 "$BODY"

BODY="$(line 40 90 20 "$TEXT" normal normal '$ ./build.sh')
$(line 40 140 16 "$OVERLAY0" normal normal 'In a second terminal, attach to the cockpit:')
$(line 40 168 18 "$BLUE" normal normal '  herdr --session harness')"
frame 1.2 "$BODY"

# The intake dialog (build-intake.ts, session_start). Visually a popup: bordered box.
INTAKE_X=90
INTAKE_Y=230
INTAKE_W=780
INTAKE_H=200

intake_frame() {
  local answer="$1" dur="$2" show_cursor="$3"
  local body
  body="$(line 40 90 20 "$TEXT" normal normal '$ ./build.sh')
$(rect $INTAKE_X $INTAKE_Y $INTAKE_W $INTAKE_H 10 "$MANTLE" "$BLUE" 2)
$(line $((INTAKE_X+28)) $((INTAKE_Y+50)) 20 "$TEXT" bold normal 'What do you want to build today?')
$(line $((INTAKE_X+28)) $((INTAKE_Y+110)) 20 "$GREEN" normal normal "> $answer")"
  if [ "$show_cursor" = "1" ]; then
    local aw; aw=$(text_width_px 20 "> $answer")
    body="$body
$(cursor_block $((INTAKE_X+28+aw)) $((INTAKE_Y+110)) 20 "$GREEN")"
  fi
  frame "$dur" "$body"
}

intake_frame "" 1.0 1

# Type the real answer in progressively, a few characters per frame.
intake_frame "a" 0.12 1
intake_frame "an " 0.12 1
intake_frame "an ac" 0.12 1
intake_frame "an acce" 0.12 1
intake_frame "an accessi" 0.12 1
intake_frame "an accessible " 0.12 1
intake_frame "an accessible to" 0.12 1
intake_frame "an accessible to do " 0.12 1
intake_frame "an accessible to do app " 0.12 1
intake_frame "an accessible to do app using " 0.12 1
intake_frame "an accessible to do app using shadcn" 1.8 1

# ════════════════════════════════════════════════════════════════════════════════════
# ACT 2 — refinement and the gate
# ════════════════════════════════════════════════════════════════════════════════════
WINDOW_TITLE="lead — atomic"

BODY="$(line 40 70 13 "$OVERLAY0" normal normal 'Act 2 — refinement')
$(line 40 110 20 "$TEXT" normal normal '$ /skill:prompt-engineer')"
frame 0.9 "$BODY"

BODY="$(line 40 70 13 "$OVERLAY0" normal normal 'Act 2 — refinement')
$(line 40 110 20 "$TEXT" normal normal '$ /skill:prompt-engineer')
$(circ 48 152 4 "$GREEN")
$(line 62 158 18 "$GREEN" normal normal 'build/MISSION.md written')
$(line 40 200 15 "$OVERLAY0" normal italic 'Eleven words became a spec with 10 numbered success criteria')
$(line 40 224 15 "$OVERLAY0" normal italic 'and an explicit Non-goals section.')"
frame 1.8 "$BODY"

# The human gate — made visually distinct: peach canvas border + peach dialog.
WINDOW_TITLE="lead — ask_user_question"
GATE_X=90
GATE_Y=190
GATE_W=780
GATE_H=280

gate_frame() {
  local answer="$1" approved="$2" dur="$3" show_cursor="$4"
  local body
  body="$(rect $GATE_X $GATE_Y $GATE_W $GATE_H 10 "$MANTLE" "$PEACH" 3)
$(rect $((GATE_X+24)) $((GATE_Y+20)) 150 30 6 "$PEACH" none 0)
$(line $((GATE_X+36)) $((GATE_Y+41)) 14 "$MANTLE" bold normal 'HUMAN GATE')
$(line $((GATE_X+24)) $((GATE_Y+92)) 19 "$TEXT" normal normal 'ask_user_question:')
$(line $((GATE_X+24)) $((GATE_Y+122)) 20 "$TEXT" bold normal 'Proceed as written?')
$(line $((GATE_X+24)) $((GATE_Y+186)) 19 "$YELLOW" normal normal "> $answer")"
  if [ "$show_cursor" = "1" ]; then
    local aw; aw=$(text_width_px 19 "> $answer")
    body="$body
$(cursor_block $((GATE_X+24+aw)) $((GATE_Y+186)) 19 "$YELLOW")"
  fi
  if [ "$approved" = "1" ]; then
    body="$body
$(line $((GATE_X+24)) $((GATE_Y+230)) 17 "$GREEN" bold normal '[ approved ] — autonomous spend begins here')"
  fi
  frame "$dur" "$body" "$PEACH"
}

gate_frame "" 0 1.1 1
gate_frame "yes" 0 1.0 1
gate_frame "yes" 1 2.0 0

# ════════════════════════════════════════════════════════════════════════════════════
# ACT 3 — the cockpit grows, and the team talks over Intercom
# ════════════════════════════════════════════════════════════════════════════════════
# All four message exchanges below are verbatim (or near-verbatim, hand-wrapped for
# width) from docs/case-study-first-run.md. No dialogue is invented. One exchange the
# coordinator asked for — a "lead, waiting" line quoting a specific expectation about
# implementer's build report — does not appear anywhere in that document or in this
# repo's git history (checked with `git log --all -S`); it has been dropped rather than
# paraphrased, since a paraphrase would still attribute an unsourced expectation to the
# lead. What *is* documented and IS shown: the lead going idle once it has delegated,
# with the specialists still working and no reply in flight — see the final Act 3 beat.
WINDOW_TITLE="harness — cockpit (herdr --session harness)"

# 2-column x 3-row grid: lead spans the top row alone; the four specialists fill the
# two rows beneath it, matching the real cockpit's layout (lead across the top, then
# implementer/designer, then accessibility/verifier).
GX=40
GROW1_Y=90;  GROW1_H=80
GROW2_Y=186; GROW2_H=90
GROW3_Y=292; GROW3_H=90
GCOL_W=430
GCOL2_X=490
LEAD_W=880
REGION_Y=400

subtitle() { line 40 70 13 "$OVERLAY0" normal normal 'Act 3 — the cockpit grows (build/ROSTER.md)'; }

# grid LEAD_SPEC IMPLEMENTER_SPEC DESIGNER_SPEC ACCESSIBILITY_SPEC VERIFIER_SPEC
# Each *_SPEC is "-" (not hired yet) or "STATE" or "STATE:HIGHLIGHT_COLOR".
grid() {
  local lead="$1" impl="$2" des="$3" a11y="$4" ver="$5"
  local out=""
  local spec state hl
  if [ "$lead" != "-" ]; then
    spec="$lead"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
    out="$out
$(pane_box "$GX" "$GROW1_Y" "$LEAD_W" "$GROW1_H" "lead" "$state" "$hl")"
  fi
  if [ "$impl" != "-" ]; then
    spec="$impl"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
    out="$out
$(pane_box "$GX" "$GROW2_Y" "$GCOL_W" "$GROW2_H" "implementer" "$state" "$hl")"
  fi
  if [ "$des" != "-" ]; then
    spec="$des"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
    out="$out
$(pane_box "$GCOL2_X" "$GROW2_Y" "$GCOL_W" "$GROW2_H" "designer" "$state" "$hl")"
  fi
  if [ "$a11y" != "-" ]; then
    spec="$a11y"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
    out="$out
$(pane_box "$GX" "$GROW3_Y" "$GCOL_W" "$GROW3_H" "accessibility" "$state" "$hl")"
  fi
  if [ "$ver" != "-" ]; then
    spec="$ver"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
    out="$out
$(pane_box "$GCOL2_X" "$GROW3_Y" "$GCOL_W" "$GROW3_H" "verifier" "$state" "$hl")"
  fi
  printf '%s' "$out"
}

skip_lines() {
  local y="$1"
  printf '%s\n%s' \
    "$(line 40 "$y" 13 "$OVERLAY0" normal italic 'Skipped pm/researcher/architect — small, fully-specified single-page app,')" \
    "$(line 40 $((y+18)) 13 "$OVERLAY0" normal italic 'no product ambiguity or unfamiliar tech.')"
}

# banner Y HEADER COLOR LINE...  — a real Intercom exchange: "who -> whom" plus the
# quoted line(s) of the message, hand-wrapped to fit the ~880px content width.
banner() {
  local y="$1" header="$2" color="$3"; shift 3
  local out; out="$(line 40 "$y" 19 "$color" bold normal "$header")"
  local ly=$((y+28))
  local l
  for l in "$@"; do
    out="$out
$(line 40 "$ly" 16 "$TEXT" normal normal "$l")"
    ly=$((ly+24))
  done
  printf '%s' "$out"
}

HIRE_LINE_1="+ implementer — builds the React + shadcn/ui to-do app"
HIRE_LINE_2="+ designer — interaction and information design"
HIRE_LINE_3="+ accessibility — WCAG 2.1 AA conformance"
HIRE_LINE_4="+ verifier — independent fresh-context proof"

# ── the roster fills in, one hire at a time (newly hired = idle, not yet briefed) ──
BODY="$(subtitle)
$(grid working - - - -)"
frame 1.0 "$BODY"

BODY="$(subtitle)
$(grid working idle - - -)
$(line 40 $REGION_Y 16 "$GREEN" normal normal "$HIRE_LINE_1")"
frame 1.0 "$BODY"

BODY="$(subtitle)
$(grid working idle idle - -)
$(line 40 $REGION_Y 16 "$GREEN" normal normal "$HIRE_LINE_1")
$(line 40 $((REGION_Y+24)) 16 "$GREEN" normal normal "$HIRE_LINE_2")"
frame 1.0 "$BODY"

BODY="$(subtitle)
$(grid working idle idle idle -)
$(line 40 $REGION_Y 16 "$GREEN" normal normal "$HIRE_LINE_1")
$(line 40 $((REGION_Y+24)) 16 "$GREEN" normal normal "$HIRE_LINE_2")
$(line 40 $((REGION_Y+48)) 16 "$GREEN" normal normal "$HIRE_LINE_3")"
frame 1.0 "$BODY"

BODY="$(subtitle)
$(grid working idle idle idle idle)
$(line 40 $REGION_Y 15 "$GREEN" normal normal "$HIRE_LINE_1")
$(line 40 $((REGION_Y+22)) 15 "$GREEN" normal normal "$HIRE_LINE_2")
$(line 40 $((REGION_Y+44)) 15 "$GREEN" normal normal "$HIRE_LINE_3")
$(line 40 $((REGION_Y+66)) 15 "$GREEN" normal normal "$HIRE_LINE_4")
$(skip_lines $((REGION_Y+96)))"
frame 1.6 "$BODY"

# ── exchange 1: the lead broadcasts scope to each of the four, in turn ─────────────
# Verbatim, from the lead's own words in the case study: "All four briefed over
# intercom with their scope and told to talk to each other directly rather than
# routing everything through me." Hand-wrapped across two lines to fit the banner.
BC_L1='"All four briefed over intercom with their scope and told to talk to'
BC_L2='each other directly rather than routing everything through me."'

BODY="$(subtitle)
$(grid "working:$BLUE" "working:$BLUE" idle idle idle)
$(skip_lines $REGION_Y)
$(banner $((REGION_Y+50)) 'lead -> implementer' "$BLUE" "$BC_L1" "$BC_L2")"
frame 0.7 "$BODY"

BODY="$(subtitle)
$(grid "working:$BLUE" working "working:$BLUE" idle idle)
$(skip_lines $REGION_Y)
$(banner $((REGION_Y+50)) 'lead -> designer' "$BLUE" "$BC_L1" "$BC_L2")"
frame 0.7 "$BODY"

BODY="$(subtitle)
$(grid "working:$BLUE" working working "working:$BLUE" idle)
$(skip_lines $REGION_Y)
$(banner $((REGION_Y+50)) 'lead -> accessibility' "$BLUE" "$BC_L1" "$BC_L2")"
frame 0.7 "$BODY"

BODY="$(subtitle)
$(grid "working:$BLUE" working working working "working:$BLUE")
$(skip_lines $REGION_Y)
$(banner $((REGION_Y+50)) 'lead -> verifier' "$BLUE" "$BC_L1" "$BC_L2")"
frame 0.9 "$BODY"

# ── exchange 2: the lead writes and shares the contract ────────────────────────────
# Verbatim from CONTRACT.md's own opening line, quoted in the case study (Oxford
# comma preserved as written): "shared shape for the to-do app, so implementer,
# designer, and accessibility don't diverge." verifier is not a party to this one.
CT_L1='"shared shape for the to-do app, so implementer, designer, and'
CT_L2="accessibility don't diverge\""

BODY="$(subtitle)
$(grid "working:$YELLOW" "working:$YELLOW" "working:$YELLOW" "working:$YELLOW" working)
$(skip_lines $REGION_Y)
$(banner $((REGION_Y+50)) 'lead -> implementer, designer, accessibility' "$YELLOW" "$CT_L1" "$CT_L2")"
frame 2.0 "$BODY"

# ── exchange 3: accessibility avoids duplicating verifier's tooling, unprompted ────
# The best evidence in the whole run: one agent catching a collision with another
# agent's work through the contract, without being told to. Verbatim from A11Y.md,
# quoted in the case study (semicolon preserved as written). Longest hold in the GIF.
A11Y_L1='"coordinate with verifier before adding a second, duplicate'
A11Y_L2='tooling setup; see build/CONTRACT.md"'

BODY="$(subtitle)
$(grid working working working "working:$RED" "working:$RED")
$(skip_lines $REGION_Y)
$(banner $((REGION_Y+50)) 'accessibility -> verifier' "$RED" "$A11Y_L1" "$A11Y_L2")"
frame 2.9 "$BODY"

# ── Act 3 close: the lead goes idle once it has delegated. Specialists — including
# verifier — are still working. No message is in flight and no reply is animated:
# the case study is explicit that implementer's build report never arrived; the run
# was stopped before it finished. This is the honest state to end on, not a quoted
# line that isn't in the source. ──────────────────────────────────────────────────
BODY="$(subtitle)
$(grid idle working working working working)
$(skip_lines $REGION_Y)"
frame 1.6 "$BODY"

# ════════════════════════════════════════════════════════════════════════════════════
# FINAL — honesty
# ════════════════════════════════════════════════════════════════════════════════════
WINDOW_TITLE="reconstruction note"

BODY="$(rect 0 40 "$WIDTH" $((HEIGHT-40)) 0 "$MANTLE" none 0)
$(line 60 280 20 "$TEXT" bold normal 'Reconstructed from a real run — see docs/case-study-first-run.md.')
$(line 60 320 18 "$OVERLAY0" normal normal 'That run was stopped before it finished; no success criterion was')
$(line 60 346 18 "$OVERLAY0" normal normal 'independently verified.')"
frame 2.7 "$BODY"

# ── assemble the GIF ─────────────────────────────────────────────────────────────────
CONCAT="$TMPDIR/concat.txt"
: > "$CONCAT"
i=0
n=${#FRAME_FILES[@]}
while [ "$i" -lt "$n" ]; do
  printf "file '%s'\nduration %s\n" "${FRAME_FILES[$i]}" "${FRAME_DURATIONS[$i]}" >> "$CONCAT"
  i=$((i+1))
done
# ffmpeg's concat demuxer ignores the last entry's duration unless the file is
# repeated once more without one.
printf "file '%s'\n" "${FRAME_FILES[$((n-1))]}" >> "$CONCAT"

PALETTE="$TMPDIR/palette.png"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" \
  -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff" \
  "$PALETTE"

ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" -i "$PALETTE" \
  -lavfi "fps=$FPS,scale=$WIDTH:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 \
  "$OUT"

echo "wrote $OUT"
ls -lh "$OUT"
