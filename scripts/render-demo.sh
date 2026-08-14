#!/usr/bin/env bash
# render-demo.sh — regenerates docs/media/build-demo.gif from scratch.
#
#   ./scripts/render-demo.sh
#
# The two GIFs this repo used to ship (see git history) were committed as bare output
# files with no generator. Nobody but their author could tell what had gone stale, and
# nobody could regenerate them after the flow changed. This script is the fix: it is
# the *only* thing committed. The GIF is a build artifact of this script, not a source
# file — re-run it whenever the reconstructed run changes.
#
# This reconstructs docs/case-study-poem-page.md — the first run that went all the way
# through (question -> plan -> gate -> a two-agent team -> a 19-minute stall -> a fix
# -> 8/8 criteria independently verified). It supersedes an earlier version of this GIF
# that depicted docs/case-study-first-run.md, a run that was stopped before it finished;
# that story is still real and still linked from the README, but it is no longer the
# lead image, because the lead image should not show a run staler than the truth.
#
# What it does:
#   1. Emits one SVG frame per beat of the case study (real strings from
#      docs/case-study-poem-page.md — no invented content; see the comments inline
#      for the few places a quote could not be verified and was dropped rather than
#      paraphrased).
#   2. Rasterises each SVG to PNG with rsvg-convert (the only renderer that handles
#      SVG <text> correctly here — `magick` fails on SVG text with "unable to read
#      font").
#   3. Assembles the PNGs into a GIF with ffmpeg (palettegen/paletteuse for a small,
#      good-looking palette), respecting a per-frame hold duration so important beats
#      (the answer, the gate, each hire, the 8/8 proof) get more screen time than
#      transitions.
#
# All intermediate frames live in a temp dir that is cleaned up on exit — nothing but
# the final GIF is written outside of it.
#
# Verified against: rsvg-convert (librsvg), ffmpeg. Bash 3.2 safe (macOS default bash).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/docs/media/build-demo.gif"
WIDTH=960
HEIGHT=720
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

# wrap_lines TEXT MAXCHARS — greedy word-wrap, newline-separated lines out.
wrap_lines() {
  local text="$1" maxchars="$2"
  local out="" cur="" w
  for w in $text; do
    if [ -z "$cur" ]; then
      cur="$w"
    elif [ $(( ${#cur} + 1 + ${#w} )) -le "$maxchars" ]; then
      cur="$cur $w"
    else
      if [ -n "$out" ]; then out="$out"$'\n'"$cur"; else out="$cur"; fi
      cur="$w"
    fi
  done
  if [ -n "$out" ]; then out="$out"$'\n'"$cur"; else out="$cur"; fi
  printf '%s' "$out"
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

# pane_box X Y W H ROLE STATE [HIGHLIGHT] [CONTENT] — one cockpit pane, rendered as a
# real Herdr pane (a live terminal running Atomic's TUI), not an empty status box.
# STATE is one of working/idle/blocked (the vocabulary herdr-state.ts reports).
# HIGHLIGHT, if given, overrides the state-colored border. CONTENT, if given, is a
# newline-separated list of "COLOR::text" pairs rendered as terminal output inside the
# pane (an empty "text" half renders a blank spacer line); an empty CONTENT falls back
# to a bare prompt, because an empty-but-real pane beats a plausible fake one. The
# `❯` prompt char, `esc to interrupt`, `MCP: 0/1 servers`, and the model/cwd status
# line are real Atomic TUI chrome that appears in every pane — not invented per-pane.
pane_box() {
  local x="$1" y="$2" w="$3" h="$4" role="$5" state="$6" highlight="${7:-}" content="${8:-}"
  local border="$OVERLAY0" sw=1 dot="$OVERLAY0"
  case "$state" in
    working) border="$BLUE"; sw=2; dot="$GREEN";;
    blocked) border="$RED";  sw=2; dot="$RED";;
  esac
  if [ -n "$highlight" ]; then border="$highlight"; sw=3; fi
  local out
  out="$(rect "$x" "$y" "$w" "$h" 8 "$SURFACE0" "$border" "$sw")"
  out="$out
$(line $((x+14)) $((y+24)) 15 "$TEXT" bold normal "$role")
$(circ $((x+16)) $((y+38)) 4 "$dot")
$(line $((x+26)) $((y+42)) 11 "$OVERLAY0" normal normal "$state")"

  # Model/cwd status line — real chrome, truncated with an ellipsis (never paraphrased)
  # if the pane is too narrow for it.
  local modelline="claude-sonnet-5 medium • ~/git-repos/agentic-engineering-harness"
  local budget=$(( (w-28)/6 ))
  if [ ${#modelline} -gt "$budget" ] && [ "$budget" -gt 4 ]; then
    modelline="${modelline:0:$((budget-3))}..."
  fi
  out="$out
$(line $((x+14)) $((y+58)) 10 "$OVERLAY0" normal normal "$modelline")"

  local cy=$((y+80))
  if [ -z "$content" ]; then
    out="$out
$(line $((x+14)) "$cy" 14 "$OVERLAY0" normal normal '❯')
$(cursor_block $((x+30)) "$cy" 14 "$OVERLAY0")"
  else
    local old_ifs="$IFS"
    IFS=$'\n'
    local l color text
    for l in $content; do
      color="${l%%::*}"
      text="${l#*::}"
      if [ -n "$text" ]; then
        out="$out
$(line $((x+14)) "$cy" 13 "$color" normal normal "$text")"
      fi
      cy=$((cy+17))
    done
    IFS="$old_ifs"
  fi

  out="$out
$(line $((x+14)) $((y+h-12)) 10 "$OVERLAY0" normal normal 'esc to interrupt   ·   MCP: 0/1 servers')"
  printf '%s' "$out"
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
frame 1.0 "$BODY"

# The intake dialog (build-intake.ts, session_start). Visually a popup: bordered box.
# Tall enough for a multi-line answer, since this run's real answer is a full sentence.
INTAKE_X=90
INTAKE_Y=180
INTAKE_W=780
INTAKE_H=280
INTAKE_WRAP=58

intake_frame() {
  local answer="$1" dur="$2" show_cursor="$3"
  local body
  body="$(line 40 90 20 "$TEXT" normal normal '$ ./build.sh')
$(rect $INTAKE_X $INTAKE_Y $INTAKE_W $INTAKE_H 10 "$MANTLE" "$BLUE" 2)
$(line $((INTAKE_X+28)) $((INTAKE_Y+50)) 20 "$TEXT" bold normal 'What do you want to build today?')"
  local wrapped; wrapped="$(wrap_lines "> $answer" "$INTAKE_WRAP")"
  local ly=$((INTAKE_Y+100))
  local lastline="" l
  local old_ifs="$IFS"
  IFS=$'\n'
  for l in $wrapped; do
    body="$body
$(line $((INTAKE_X+28)) "$ly" 18 "$GREEN" normal normal "$l")"
    lastline="$l"
    ly=$((ly+26))
  done
  IFS="$old_ifs"
  if [ "$show_cursor" = "1" ]; then
    local aw; aw=$(text_width_px 18 "$lastline")
    body="$body
$(cursor_block $((INTAKE_X+28+aw)) $((ly-26)) 18 "$GREEN")"
  fi
  frame "$dur" "$body"
}

intake_frame "" 0.9 1

# Type the real answer in progressively, a few words per frame. Verbatim from
# docs/case-study-poem-page.md: "What was asked for."
intake_frame "a" 0.10 1
intake_frame "a single HTML" 0.10 1
intake_frame "a single HTML landing page that" 0.10 1
intake_frame "a single HTML landing page that reveals one verse" 0.10 1
intake_frame "a single HTML landing page that reveals one verse of a public-domain" 0.10 1
intake_frame "a single HTML landing page that reveals one verse of a public-domain poem every 10" 0.10 1
intake_frame "a single HTML landing page that reveals one verse of a public-domain poem every 10 seconds until the whole" 0.10 1
intake_frame "a single HTML landing page that reveals one verse of a public-domain poem every 10 seconds until the whole poem is shown, ending with" 0.10 1
intake_frame "a single HTML landing page that reveals one verse of a public-domain poem every 10 seconds until the whole poem is shown, ending with the author signature" 1.6 1

# ════════════════════════════════════════════════════════════════════════════════════
# ACT 2 — refinement and the gate
# ════════════════════════════════════════════════════════════════════════════════════
WINDOW_TITLE="lead — atomic"

BODY="$(line 40 70 13 "$OVERLAY0" normal normal 'Act 2 — refinement')
$(line 40 110 20 "$TEXT" normal normal '$ /skill:prompt-engineer')"
frame 0.8 "$BODY"

BODY="$(line 40 70 13 "$OVERLAY0" normal normal 'Act 2 — refinement')
$(line 40 110 20 "$TEXT" normal normal '$ /skill:prompt-engineer')
$(circ 48 152 4 "$GREEN")
$(line 62 158 18 "$GREEN" normal normal 'build/MISSION.md written')
$(line 40 200 15 "$OVERLAY0" normal italic 'The plan has 8 success criteria — plus two rules nobody asked for:')
$(line 40 224 15 "$OVERLAY0" normal italic 'public domain with the source named, and zero network calls.')"
frame 1.7 "$BODY"

# The human gate — made visually distinct: peach canvas border + peach dialog.
# "Proceed as written?" is verbatim (docs/case-study-poem-page.md, "What the lead did
# with it"). The two constraint bullets are the same document's real content, shown
# as a plain description rather than dressed up as a single quoted sentence, because
# no source preserves the gate's full literal wording verbatim.
WINDOW_TITLE="lead — ask_user_question"
GATE_X=90
GATE_Y=150
GATE_W=780
GATE_H=340

gate_frame() {
  local answer="$1" approved="$2" dur="$3" show_cursor="$4"
  local body
  body="$(rect $GATE_X $GATE_Y $GATE_W $GATE_H 10 "$MANTLE" "$PEACH" 3)
$(rect $((GATE_X+24)) $((GATE_Y+20)) 150 30 6 "$PEACH" none 0)
$(line $((GATE_X+36)) $((GATE_Y+41)) 14 "$MANTLE" bold normal 'HUMAN GATE')
$(line $((GATE_X+24)) $((GATE_Y+92)) 19 "$TEXT" normal normal 'ask_user_question: 8 success criteria, including —')
$(line $((GATE_X+24)) $((GATE_Y+118)) 16 "$OVERLAY0" normal normal '  public domain with the source named, and zero network calls')
$(line $((GATE_X+24)) $((GATE_Y+166)) 22 "$TEXT" bold normal 'Proceed as written?')
$(line $((GATE_X+24)) $((GATE_Y+236)) 19 "$YELLOW" normal normal "> $answer")"
  if [ "$show_cursor" = "1" ]; then
    local aw; aw=$(text_width_px 19 "> $answer")
    body="$body
$(cursor_block $((GATE_X+24+aw)) $((GATE_Y+236)) 19 "$YELLOW")"
  fi
  if [ "$approved" = "1" ]; then
    body="$body
$(line $((GATE_X+24)) $((GATE_Y+284)) 17 "$GREEN" bold normal '[ approved ] — autonomous spend begins here')"
  fi
  frame "$dur" "$body" "$PEACH"
}

gate_frame "" 0 1.0 1
gate_frame "yes" 0 0.9 1
gate_frame "yes" 1 1.8 0

# ════════════════════════════════════════════════════════════════════════════════════
# ACT 3 — a two-agent team
# ════════════════════════════════════════════════════════════════════════════════════
# Only two agents this time — the contrast with the earlier (stopped) run, which hired
# four for a bigger job, is the point: the same role library sizes the team to the work.
WINDOW_TITLE="harness — cockpit (herdr --session harness)"

GX=40
GROW1_Y=90;  GROW1_H=124
GROW2_Y=228; GROW2_H=124
GCOL_W=430
GCOL2_X=490
LEAD_W=880
REGION2_Y=372

subtitle() { line 40 70 13 "$OVERLAY0" normal normal "$1"; }

# grid2 LEAD_SPEC IMPLEMENTER_SPEC VERIFIER_SPEC — lead on its own row, the two
# specialists side by side beneath it. Each *_SPEC is "-" or "STATE[:HIGHLIGHT]".
# Panes are sparse here (chrome only, no content) — there is no sourced pane dump
# for these moments, and a sparse-but-real pane beats an invented one.
grid2() {
  local lead="$1" impl="$2" ver="$3"
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
  if [ "$ver" != "-" ]; then
    spec="$ver"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
    out="$out
$(pane_box "$GCOL2_X" "$GROW2_Y" "$GCOL_W" "$GROW2_H" "verifier" "$state" "$hl")"
  fi
  printf '%s' "$out"
}

# Verbatim from docs/case-study-poem-page.md's roster table.
HIRE_LINE_1A="+ implementer — Ships the single-file HTML/CSS/JS poem reveal page —"
HIRE_LINE_1B="  the entire deliverable."
HIRE_LINE_2="+ verifier — Independent evidence that all 8 success criteria pass."

# Paraphrased from the case study's own sentence ("The lead skipped the designer, the
# researcher, the accessibility agent, and the rest ... a small job gets a small
# team.") — hand-wrapped, not a fabricated quote.
DECLINED_L1="Skipped designer, researcher, accessibility, and the rest —"
DECLINED_L2="a small job gets a small team."

BODY="$(subtitle 'Act 3 — a two-agent team (build/ROSTER.md)')
$(grid2 working - -)"
frame 0.9 "$BODY"

BODY="$(subtitle 'Act 3 — a two-agent team (build/ROSTER.md)')
$(grid2 working idle -)
$(line 40 $REGION2_Y 16 "$GREEN" normal normal "$HIRE_LINE_1A")
$(line 40 $((REGION2_Y+22)) 16 "$GREEN" normal normal "$HIRE_LINE_1B")"
frame 1.1 "$BODY"

BODY="$(subtitle 'Act 3 — a two-agent team (build/ROSTER.md)')
$(grid2 working idle idle)
$(line 40 $REGION2_Y 16 "$GREEN" normal normal "$HIRE_LINE_1A")
$(line 40 $((REGION2_Y+22)) 16 "$GREEN" normal normal "$HIRE_LINE_1B")
$(line 40 $((REGION2_Y+48)) 16 "$GREEN" normal normal "$HIRE_LINE_2")
$(line 40 $((REGION2_Y+84)) 15 "$OVERLAY0" normal italic "$DECLINED_L1")
$(line 40 $((REGION2_Y+106)) 15 "$OVERLAY0" normal italic "$DECLINED_L2")"
frame 1.7 "$BODY"

# ════════════════════════════════════════════════════════════════════════════════════
# ACT 4 — the stall, the fix, and the proof
# ════════════════════════════════════════════════════════════════════════════════════
# Real strings from docs/case-study-poem-page.md's "What went wrong on the way" and
# "The cockpit showed nothing wrong" sections — added to the case study after this
# GIF's first cut showed the stall as `implementer: blocked` in red. That was wrong,
# and wrong in the flattering direction: the real status list during the stall was
# lead=idle, implementer=working, verifier=working. Nothing showed blocked. The
# implementer was in a `sleep 300` loop, and sleeping counts as working; `blocked`
# only appears when an agent asks a question and waits for an answer, and an agent
# that decides to wait quietly never asks. Showing red would have implied the cockpit
# caught the problem. It did not — that is the whole point of this act.

# A vertical stack, not the 2-column grid: the implementer's real pane content (below)
# needs far more room than a sparse pane, and lead/verifier have no sourced content for
# this moment, so they stay compact either side of it.
STK_Y=90
STK_W=880
STK_LEAD_H=124
STK_IMPL_H=232
STK_GAP=14
STK_IMPL_Y=$((STK_Y+STK_LEAD_H+STK_GAP))
STK_VER_Y=$((STK_IMPL_Y+STK_IMPL_H+STK_GAP))
STK_CAPTION_Y=$((STK_VER_Y+STK_LEAD_H+34))

# stack3 LEAD_SPEC IMPLEMENTER_SPEC VERIFIER_SPEC [IMPLEMENTER_CONTENT]
stack3() {
  local lead="$1" impl="$2" ver="$3" implcontent="${4:-}"
  local out=""
  local spec state hl
  spec="$lead"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
  out="$(pane_box "$GX" "$STK_Y" "$STK_W" "$STK_LEAD_H" "lead" "$state" "$hl" "")"
  spec="$impl"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
  out="$out
$(pane_box "$GX" "$STK_IMPL_Y" "$STK_W" "$STK_IMPL_H" "implementer" "$state" "$hl" "$implcontent")"
  spec="$ver"; state="${spec%%:*}"; hl=""; case "$spec" in *:*) hl="${spec#*:}";; esac
  out="$out
$(pane_box "$GX" "$STK_VER_Y" "$STK_W" "$STK_LEAD_H" "verifier" "$state" "$hl" "")"
  printf '%s' "$out"
}

# The implementer's actual pane during the stall, verbatim from the case study's new
# section (one sentence truncated with "..." to fit the pane, per instructions: shorten
# by truncation, never by paraphrase). The ✗ and ❯ glyphs were test-rendered with
# rsvg-convert + JetBrains Mono before use and render correctly at this size.
IMPL_STALL_CONTENT="$TEXT::❯ intercom send lead
$RED::✗ Message to \"lead\" was not delivered: Session not found
$OVERLAY0::
$TEXT::Lead still hasn't come online after ~14 minutes of waiting...
$OVERLAY0::
$TEXT::\$ sleep 300
$OVERLAY0::Elapsed 3m 47s"

BODY="$(subtitle 'Act 4 — the stall')
$(stack3 idle working working "$IMPL_STALL_CONTENT")"
frame 3.2 "$BODY"

BODY="$(subtitle 'Act 4 — the stall')
$(stack3 idle working working "$IMPL_STALL_CONTENT")
$(line 40 $STK_CAPTION_Y 19 "$PEACH" bold normal 'Nothing showed blocked — sleeping counts as working.')
$(line 40 $((STK_CAPTION_Y+26)) 15 "$OVERLAY0" normal italic 'Stalled 19 minutes. The pane had the clue; the status word did not.')"
frame 2.4 "$BODY"

BODY="$(subtitle 'Act 4 — the fix')
$(stack3 "working:$GREEN" working working)
$(line 40 $STK_CAPTION_Y 18 "$GREEN" bold normal 'Fixed: the lead now registers its name the moment')
$(line 40 $((STK_CAPTION_Y+26)) 18 "$GREEN" bold normal 'the question box closes.')"
frame 1.4 "$BODY"

BODY="$(subtitle 'Act 4 — the build')
$(grid2 working working working)"
frame 0.9 "$BODY"

# ── the proof: verifier's own checklist, verbatim from the case study's table ──────
PROOF_ROWS_1="1. Opens from a file, no console errors — PASS"
PROOF_ROWS_2="2. Only the first verse shows on load — PASS"
PROOF_ROWS_3="3. One verse every 10 seconds, in order — PASS"
PROOF_ROWS_4="4. Signature appears last, then the timer stops — PASS"
PROOF_ROWS_5="5. Poem is public domain, and the source is named — PASS"
PROOF_ROWS_6="6. Readable from 375 px to 1920 px, nothing cut off — PASS"
PROOF_ROWS_7="7. No network calls, works offline — PASS"
PROOF_ROWS_8="8. Once a verse appears, it never disappears — PASS"

WINDOW_TITLE="verifier — independent check"
BODY="$(line 40 70 13 "$OVERLAY0" normal normal 'Act 4 — the proof (build/EVIDENCE.md)')
$(line 40 108 15 "$OVERLAY0" normal italic 'independent check — fresh context, file:// load, via playwright-cli:')
$(line 40 140 15 "$GREEN" normal normal "$PROOF_ROWS_1")
$(line 40 162 15 "$GREEN" normal normal "$PROOF_ROWS_2")
$(line 40 184 15 "$GREEN" normal normal "$PROOF_ROWS_3")
$(line 40 206 15 "$GREEN" normal normal "$PROOF_ROWS_4")
$(line 40 228 15 "$GREEN" normal normal "$PROOF_ROWS_5")
$(line 40 250 15 "$GREEN" normal normal "$PROOF_ROWS_6")
$(line 40 272 15 "$GREEN" normal normal "$PROOF_ROWS_7")
$(line 40 294 15 "$GREEN" normal normal "$PROOF_ROWS_8")
$(line 40 336 20 "$GREEN" bold normal 'All 8 passed. No repair cycles were needed.')"
frame 2.6 "$BODY"

# ── the built page itself: real colors and real text from docs/samples/poem-page.html ──
WINDOW_TITLE="poem-page.html — file://"
PAGE_X=140
PAGE_Y=90
PAGE_W=680
PAGE_H=440
PAGE_CREAM="#f6f1e7"
PAGE_INK="#2b2620"
PAGE_TITLE_INK="#4a3f2f"
PAGE_SIG_INK="#6b5d47"
SERIF="Georgia, Times New Roman, serif"

BODY="$(rect $PAGE_X $PAGE_Y $PAGE_W $PAGE_H 10 "$PAGE_CREAM" none 0)
<text x=\"$((WIDTH/2))\" y=\"$((PAGE_Y+60))\" font-family=\"$SERIF\" font-size=\"26\" fill=\"$PAGE_TITLE_INK\" text-anchor=\"middle\">The Road Not Taken</text>
<text x=\"$((PAGE_X+48))\" y=\"$((PAGE_Y+120))\" font-family=\"$SERIF\" font-size=\"17\" fill=\"$PAGE_INK\">Two roads diverged in a yellow wood,</text>
<text x=\"$((PAGE_X+48))\" y=\"$((PAGE_Y+146))\" font-family=\"$SERIF\" font-size=\"17\" fill=\"$PAGE_INK\">And sorry I could not travel both</text>
$(line $((PAGE_X+48)) $((PAGE_Y+190)) 14 "$OVERLAY0" normal italic '(three more verses, one revealed every 10 seconds)')"
frame 1.0 "$BODY"

BODY="$(rect $PAGE_X $PAGE_Y $PAGE_W $PAGE_H 10 "$PAGE_CREAM" none 0)
<text x=\"$((WIDTH/2))\" y=\"$((PAGE_Y+60))\" font-family=\"$SERIF\" font-size=\"26\" fill=\"$PAGE_TITLE_INK\" text-anchor=\"middle\">The Road Not Taken</text>
<text x=\"$((PAGE_X+48))\" y=\"$((PAGE_Y+120))\" font-family=\"$SERIF\" font-size=\"17\" fill=\"$PAGE_INK\">Two roads diverged in a yellow wood,</text>
<text x=\"$((PAGE_X+48))\" y=\"$((PAGE_Y+146))\" font-family=\"$SERIF\" font-size=\"17\" fill=\"$PAGE_INK\">And sorry I could not travel both</text>
<text x=\"$((PAGE_X+PAGE_W-48))\" y=\"$((PAGE_Y+PAGE_H-60))\" font-family=\"$SERIF\" font-size=\"16\" fill=\"$PAGE_SIG_INK\" font-style=\"italic\" text-anchor=\"end\">— Robert Frost, \"The Road Not Taken,\" Mountain Interval (1916, public domain)</text>
$(line $((PAGE_X+48)) $((PAGE_Y+PAGE_H-20)) 13 "$GREEN" normal normal 'timer stopped')
$(line $PAGE_X $((PAGE_Y+PAGE_H+30)) 14 "$OVERLAY0" normal italic '(shown here at rest — the real reveal takes about 40 seconds)')"
frame 2.0 "$BODY"

# ════════════════════════════════════════════════════════════════════════════════════
# FINAL — honesty (updated: this run finished, but it did not go smoothly)
# ════════════════════════════════════════════════════════════════════════════════════
WINDOW_TITLE="reconstruction note"

BODY="$(rect 0 40 "$WIDTH" $((HEIGHT-40)) 0 "$MANTLE" none 0)
$(line 60 250 20 "$TEXT" bold normal 'Reconstructed from a real run — see docs/case-study-poem-page.md.')
$(line 60 292 18 "$OVERLAY0" normal normal 'This run finished: all 8 criteria passed, verified independently,')
$(line 60 318 18 "$OVERLAY0" normal normal 'then checked by a person.')
$(line 60 360 18 "$PEACH" normal normal 'It stalled for 19 minutes — the team could not find its own lead.')
$(line 60 386 18 "$OVERLAY0" normal normal 'That is fixed now.')"
frame 2.3 "$BODY"

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
