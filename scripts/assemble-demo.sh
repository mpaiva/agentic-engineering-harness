#!/usr/bin/env bash
# assemble-demo.sh — cut the screenshots from a real run into docs/media/build-demo.gif.
#
# The exact command that produced the committed GIF:
#
#   ./scripts/assemble-demo.sh --frames .captures/run-2 \
#       --edit docs/media/build-demo.edit.tsv --crop 2940x1779+0+74
#
# …and the stills on docs/case-study-road-not-taken.md:
#
#   ./scripts/assemble-demo.sh --frames .captures/run-2 \
#       --edit docs/media/steps.tsv --stills docs/media/steps \
#       --crop 2940x1779+0+74 --width 1400
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
#   edit TSV:  <frame filename>  <hold seconds>  [crop geometry | # comment]
#              --stills reads the same shape, with an output basename in place of the hold
#              blank lines and lines starting with # are ignored
#
# A third field that looks like an ImageMagick geometry crops that row instead of --crop, in
# both modes. It is there for a set that spans two windows — the cockpit for most of a run
# and a browser at the end, which do not sit at the same place on the display. In GIF mode
# every prepared frame must still come out the SAME WIDTH AND HEIGHT, because the concat
# demuxer will not scale mismatched inputs; a per-row geometry is for moving the crop, not
# resizing it, and the script stops with the offending sizes if that rule is broken.
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
  while IFS=$'\t' read -r NAME BASE THIRD; do
    # Only act on rows that actually name a frame. Testing for a leading '#' instead would
    # send any indented or reflowed comment line into magick as a filename.
    case "$NAME" in frame-*) ;; *) continue ;; esac
    [ -n "$BASE" ] || { echo "assemble-demo.sh: no output name for $NAME" >&2; exit 2; }
    SRC="$FRAMES/$NAME"
    [ -f "$SRC" ] || { echo "assemble-demo.sh: missing frame $SRC" >&2; exit 2; }
    # A third field that looks like a geometry overrides --crop for this row alone. One shot
    # in a set usually wants different framing — the finished page without the browser's
    # toolbar around it, say — and that beats keeping a second list for one line.
    ROW_CROP="$CROP"
    case "$THIRD" in [0-9]*x[0-9]*[+-][0-9]*[+-][0-9]*) ROW_CROP="${THIRD%%[!0-9x+-]*}" ;; esac
    if [ -n "$ROW_CROP" ]; then
      magick "$SRC" -crop "$ROW_CROP" +repage -resize "${WIDTH}x" -colors "$COLORS" "PNG8:$STILLS/$BASE.png"
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
  # Strip comments and blanks; keep frame, hold, and an optional per-row crop.
  # Same rule as stills mode: a row counts only if its first field names a frame. Comment
  # and prose lines in the edit list are then impossible to mistake for filenames.
  #
  # Field 3 is passed through so a single row can be framed differently from the rest —
  # stills mode has always allowed this, and the GIF needs it for the same reason a still
  # does: the browser frames at the end sit in a different window from the cockpit ones,
  # so one --crop cannot serve both. Anything in field 3 that is not a geometry (a `#`
  # note, say) is ignored below, exactly as in stills mode.
  awk -F'\t' '$1 ~ /^frame-/ {
        hold = ($2 == "" ? "'"$DEFAULT_HOLD"'" : $2); print $1 "\t" hold "\t" $3 }' "$EDIT" > "$PLAN"
else
  MANIFEST="$FRAMES/manifest.tsv"
  [ -f "$MANIFEST" ] || { echo "assemble-demo.sh: $MANIFEST is missing — was this directory written by capture-demo.sh?" >&2; exit 2; }
  awk -F'\t' 'NR > 1 && $1 != "" { print $1 "\t'"$DEFAULT_HOLD"'\t" }' "$MANIFEST" > "$PLAN"
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
while IFS=$'\t' read -r NAME HOLD THIRD; do
  SRC="$FRAMES/$NAME"
  [ -f "$SRC" ] || { echo "assemble-demo.sh: missing frame $SRC (named in the running order)" >&2; exit 2; }
  DST="$(printf '%s/prep-%05d.png' "$TMPDIR" "$i")"
  # Same rule as stills mode: a third field that looks like a geometry replaces --crop for
  # this row only. Every prepared frame must still come out the same size, or the concat
  # demuxer scales them against each other — so a per-row geometry is expected to differ in
  # OFFSET, not in width and height. Checked below once all frames are prepared.
  ROW_CROP="$CROP"
  case "$THIRD" in [0-9]*x[0-9]*[+-][0-9]*[+-][0-9]*) ROW_CROP="${THIRD%%[!0-9x+-]*}" ;; esac
  if [ -n "$ROW_CROP" ]; then
    magick "$SRC" -crop "$ROW_CROP" +repage "$DST"
  else
    cp "$SRC" "$DST"
  fi
  printf "file '%s'\nduration %s\n" "$DST" "$HOLD" >> "$CONCAT"
  LAST_PREPARED="$DST"
  i=$((i + 1))
done < "$PLAN"

# Every prepared frame must be identical in size. ffmpeg's concat demuxer does not scale
# mismatched inputs — it takes the first frame's dimensions and then either fails or
# silently produces a corrupt stream, and a GIF that is subtly wrong is worse than one that
# refuses to build. A per-row crop is for moving the window, not resizing it.
SIZES="$(for f in "$TMPDIR"/prep-*.png; do magick "$f" -format '%wx%h\n' info:; done | sort -u)"
if [ "$(printf '%s\n' "$SIZES" | wc -l | tr -d ' ')" -gt 1 ]; then
  echo "assemble-demo.sh: prepared frames are not all the same size:" >&2
  printf '%s\n' "$SIZES" | sed 's/^/  /' >&2
  echo "  A per-row crop in the edit list must keep the same WIDTHxHEIGHT as --crop and" >&2
  echo "  change only the +x+y offset." >&2
  exit 2
fi

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
