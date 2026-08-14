#!/usr/bin/env bash
# assemble-demo.sh — cut the screenshots from a real run into docs/media/build-demo.gif.
#
# The exact command that produced the committed GIF:
#
#   ./scripts/assemble-demo.sh --frames .captures/run \
#       --edit docs/media/build-demo.edit.tsv --crop 2936x1835+2+75
#
# …and the stills on docs/case-study-ozymandias.md:
#
#   ./scripts/assemble-demo.sh --frames .captures/run \
#       --edit docs/media/steps.tsv --stills docs/media/steps \
#       --crop 2936x1835+2+75 --width 1400
#
# The other half of scripts/capture-demo.sh. That one photographs the screen during a run;
# this one crops, scales, orders and times the frames into the GIF (or into PNGs, with
# --stills). The pair replaced scripts/render-demo.sh, which drew a re-creation of a run
# frame by frame in SVG. That was labelled honestly, but it was still an illustration, and
# it could only ever show the story its author already knew. These show what happened.
#
# Why an edit list instead of "every frame in order": a real run is mostly waiting. The
# frames that matter are the question, the typed answer, the mission, the approval, each
# hire appearing in the sidebar, and the verdict. --edit points at a TSV of exactly which
# frames to use and how long to hold each one, so the cut is a reviewable file in git
# rather than a decision buried in a script.
#
#   edit TSV:  <frame filename>  <hold seconds>  [# comment]
#              blank lines and lines starting with # are ignored
#
# With no --edit, every frame in the manifest is used at --default-hold seconds each,
# which is the right thing for a first look at what you captured.
#
# --crop takes an ImageMagick geometry in CAPTURE pixels (Retina, so 2x the points you
# see). Frames are full-display grabs; the crop is what turns them into "a terminal
# window". Find the numbers by opening one frame and reading off the window edges, or
# leave it off to keep the whole screen.
#
# Verified against: ffmpeg, ImageMagick 7 (`magick`). Bash 3.2 safe (macOS default bash).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/docs/media/build-demo.gif"
FRAMES=""
EDIT=""
CROP=""
WIDTH=1200
FPS=6
COLORS=128
DEFAULT_HOLD=0.5
STILLS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --frames)       FRAMES="$2"; shift ;;
    --edit)         EDIT="$2"; shift ;;
    --crop)         CROP="$2"; shift ;;
    --width)        WIDTH="$2"; shift ;;
    --fps)          FPS="$2"; shift ;;
    --colors)       COLORS="$2"; shift ;;
    --default-hold) DEFAULT_HOLD="$2"; shift ;;
    --out)          OUT="$2"; shift ;;
    --stills)       STILLS="$2"; shift ;;
    -h|--help)      sed -n '2,38p' "$0"; exit 0 ;;
    *) echo "assemble-demo.sh: unknown arg: $1" >&2; exit 2 ;;
  esac; shift
done

[ -n "$FRAMES" ] || { echo "assemble-demo.sh: --frames <dir> is required" >&2; exit 2; }
[ -d "$FRAMES" ] || { echo "assemble-demo.sh: no such frames directory: $FRAMES" >&2; exit 2; }
command -v ffmpeg >/dev/null || { echo "assemble-demo.sh: ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }
command -v magick >/dev/null || { echo "assemble-demo.sh: magick not found (brew install imagemagick)" >&2; exit 1; }

TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/assemble-demo.XXXXXX")"
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

# ── stills mode ─────────────────────────────────────────────────────────────────────
# Same frames, same crop, but written out one PNG per beat for prose that needs to point
# at a specific moment. The second column of the edit list is the output basename here
# instead of a hold time, so a stills list reads:
#
#   frame-00189.png   04-the-gate   # what this shows
#
# 128-colour PNG8 because a terminal screenshot has maybe forty distinct colours in it;
# full-depth PNG triples the size of a file that is going in git for nothing.
if [ -n "$STILLS" ]; then
  [ -n "$EDIT" ] || { echo "assemble-demo.sh: --stills needs --edit <list>" >&2; exit 2; }
  [ -f "$EDIT" ] || { echo "assemble-demo.sh: no such stills list: $EDIT" >&2; exit 2; }
  mkdir -p "$STILLS"
  N=0
  while IFS=$'\t' read -r NAME BASE _; do
    case "$NAME" in ''|'#'*) continue ;; esac
    [ -n "$BASE" ] || { echo "assemble-demo.sh: no output name for $NAME" >&2; exit 2; }
    SRC="$FRAMES/$NAME"
    [ -f "$SRC" ] || { echo "assemble-demo.sh: missing frame $SRC" >&2; exit 2; }
    if [ -n "$CROP" ]; then
      magick "$SRC" -crop "$CROP" +repage -resize "${WIDTH}x" -colors "$COLORS" "PNG8:$STILLS/$BASE.png"
    else
      magick "$SRC" -resize "${WIDTH}x" -colors "$COLORS" "PNG8:$STILLS/$BASE.png"
    fi
    N=$((N + 1))
  done < "$EDIT"
  echo "wrote $N stills to $STILLS"
  du -sh "$STILLS"
  exit 0
fi

# ── work out the running order ──────────────────────────────────────────────────────
PLAN="$TMPDIR/plan.tsv"
: > "$PLAN"
if [ -n "$EDIT" ]; then
  [ -f "$EDIT" ] || { echo "assemble-demo.sh: no such edit list: $EDIT" >&2; exit 2; }
  # Strip comments and blanks; keep the first two fields.
  awk -F'\t' '!/^[[:space:]]*#/ && NF >= 1 && $1 !~ /^[[:space:]]*$/ {
        hold = ($2 == "" ? "'"$DEFAULT_HOLD"'" : $2); print $1 "\t" hold }' "$EDIT" > "$PLAN"
else
  MANIFEST="$FRAMES/manifest.tsv"
  [ -f "$MANIFEST" ] || { echo "assemble-demo.sh: $MANIFEST is missing — was this directory written by capture-demo.sh?" >&2; exit 2; }
  awk -F'\t' 'NR > 1 && $1 != "" { print $1 "\t'"$DEFAULT_HOLD"'" }' "$MANIFEST" > "$PLAN"
fi

COUNT="$(wc -l < "$PLAN" | tr -d ' ')"
[ "$COUNT" -gt 0 ] || { echo "assemble-demo.sh: the running order is empty" >&2; exit 2; }

# ── crop and scale each frame once ──────────────────────────────────────────────────
# Cropping here rather than in ffmpeg keeps the concat list simple, and lets a frame
# appear more than once in the running order without being re-processed... which it is
# not, but the cost is one file per line and the clarity is worth it.
echo "assemble-demo.sh: preparing $COUNT frames"
i=0
CONCAT="$TMPDIR/concat.txt"
: > "$CONCAT"
LAST_PREPARED=""
while IFS=$'\t' read -r NAME HOLD; do
  SRC="$FRAMES/$NAME"
  [ -f "$SRC" ] || { echo "assemble-demo.sh: missing frame $SRC (named in the running order)" >&2; exit 2; }
  DST="$(printf '%s/prep-%05d.png' "$TMPDIR" "$i")"
  if [ -n "$CROP" ]; then
    magick "$SRC" -crop "$CROP" +repage "$DST"
  else
    cp "$SRC" "$DST"
  fi
  printf "file '%s'\nduration %s\n" "$DST" "$HOLD" >> "$CONCAT"
  LAST_PREPARED="$DST"
  i=$((i + 1))
done < "$PLAN"

# ffmpeg's concat demuxer ignores the last entry's duration unless the file is repeated
# once more without one.
printf "file '%s'\n" "$LAST_PREPARED" >> "$CONCAT"

# ── assemble ────────────────────────────────────────────────────────────────────────
# A screenshot of a terminal is nearly flat colour, so a small palette costs almost nothing
# visually and saves a lot of bytes. 128 is the point where the browser page's antialiased
# serif text still looks right; drop lower and it starts to band.
PALETTE="$TMPDIR/palette.png"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" \
  -vf "fps=$FPS,scale=$WIDTH:-2:flags=lanczos,palettegen=max_colors=$COLORS:stats_mode=diff" \
  "$PALETTE"

ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" -i "$PALETTE" \
  -lavfi "fps=$FPS,scale=$WIDTH:-2:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 \
  "$OUT"

echo "wrote $OUT"
ls -lh "$OUT"
