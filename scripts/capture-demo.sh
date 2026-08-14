#!/usr/bin/env bash
# capture-demo.sh — take real screenshots of a real run, on a timer.
#
#   ./scripts/capture-demo.sh                       # start grabbing, Ctrl-C to stop
#   ./scripts/capture-demo.sh --interval 1.5        # a frame every 1.5s (default 2)
#   ./scripts/capture-demo.sh --out /tmp/run-2      # where the frames go
#   touch <out>/STOP                                # stop it from another terminal
#
# This is half of the demo-GIF pipeline. It records; scripts/assemble-demo.sh edits.
# Together they replaced scripts/render-demo.sh, which drew the GIF frame by frame in SVG
# from the case-study text. That was honest about being a re-creation, but it was still a
# drawing. This takes photographs of the screen instead.
#
# What it does, once every --interval seconds:
#   1. `screencapture -x -m` the whole main display to PNG at native (Retina) resolution.
#   2. Fingerprints the frame (a 160px-wide greyscale thumbnail hash). If it matches the
#      frame before it, the new one is deleted. Agent panes sit still for minutes at a
#      time; without this the disk fills with identical pictures.
#   3. Appends a row to manifest.tsv: frame file, unix time, seconds since start.
#
# It grabs the WHOLE display, not a window rect, on purpose:
#   - `screencapture -R` needs the window's bounds, and reading those needs Accessibility
#     permission for whatever process asks (osascript here is not allowed assistive
#     access, and pyobjc/Quartz is not installed). Cropping is a post-step in
#     assemble-demo.sh, which can take the rect as an argument.
#   - The full-display frames double as source material for step-by-step docs, where the
#     surrounding window chrome is the point.
#
# Requires: Screen Recording permission for the terminal running this. Without it macOS
# silently hands back a picture of the desktop wallpaper with no windows in it — so this
# script checks the first frame is not a flat image and aborts if it is.
#
# Safety rails, because this writes ~1 MB a frame to a disk with limited room:
#   --max-frames  (default 3000) hard stop.
#   --min-free-gb (default 3) stop before filling the disk.
#
# Verified against: macOS 14.7.2, screencapture, ImageMagick 7 (`magick`). Bash 3.2 safe.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/.captures/$(date +%Y%m%d-%H%M%S)"
INTERVAL=2
MAX_FRAMES=3000
MIN_FREE_GB=3

while [ $# -gt 0 ]; do
  case "$1" in
    --out)          OUT="$2"; shift ;;
    --interval)     INTERVAL="$2"; shift ;;
    --max-frames)   MAX_FRAMES="$2"; shift ;;
    --min-free-gb)  MIN_FREE_GB="$2"; shift ;;
    -h|--help)      sed -n '2,37p' "$0"; exit 0 ;;
    *) echo "capture-demo.sh: unknown arg: $1" >&2; exit 2 ;;
  esac; shift
done

command -v screencapture >/dev/null || { echo "capture-demo.sh: screencapture not found (macOS only)" >&2; exit 1; }
command -v magick >/dev/null        || { echo "capture-demo.sh: magick not found (brew install imagemagick)" >&2; exit 1; }

mkdir -p "$OUT"
MANIFEST="$OUT/manifest.tsv"
[ -f "$MANIFEST" ] || printf 'frame\tunix_time\tseconds_in\n' > "$MANIFEST"

# NOT a dotfile. `screencapture -t png /path/.staging.png` prints "cannot write file to
# intended destination", writes nothing, and still exits 0 — so a hidden staging file makes
# every grab silently fail while the loop reports success.
STAGING="$OUT/staging.png"
START="$(date +%s)"
LAST_SIG=""
KEPT=0
SHOT=0
MISSES=0

# A 160px greyscale thumbnail, hashed. Coarse enough that a blinking block cursor or a
# one-pixel scroll does not read as a new frame, fine enough that a line of new agent
# output does.
signature() {
  magick "$1" -colorspace Gray -resize 160x -depth 4 -format '%#' info: 2>/dev/null || echo "unreadable-$RANDOM"
}

free_gb() {
  df -g / | awk 'NR==2 {print $4}'
}

STOPPING=0
on_stop() { STOPPING=1; }
trap on_stop INT TERM

finish() {
  rm -f "$STAGING"
  echo
  echo "capture-demo.sh: stopped."
  echo "  frames kept : $KEPT (of $SHOT taken)"
  echo "  directory   : $OUT"
  echo "  manifest    : $MANIFEST"
  echo "  next        : ./scripts/assemble-demo.sh --frames $OUT"
}

echo "capture-demo.sh: grabbing the main display every ${INTERVAL}s into $OUT"
echo "capture-demo.sh: stop with Ctrl-C, or: touch $OUT/STOP"

while [ "$STOPPING" = 0 ]; do
  [ -f "$OUT/STOP" ] && { echo "capture-demo.sh: STOP file seen."; break; }
  [ "$KEPT" -ge "$MAX_FRAMES" ] && { echo "capture-demo.sh: hit --max-frames $MAX_FRAMES." >&2; break; }
  if [ "$(free_gb)" -lt "$MIN_FREE_GB" ]; then
    echo "capture-demo.sh: less than ${MIN_FREE_GB}GB free — stopping before the disk fills." >&2
    break
  fi

  screencapture -x -m -t png "$STAGING" || true
  if [ ! -s "$STAGING" ]; then
    # screencapture exits 0 even when it wrote nothing, so a missing file is the only
    # signal. Never let that fail quietly for the length of a whole run.
    MISSES=$((MISSES + 1))
    if [ "$MISSES" -ge 5 ]; then
      echo "capture-demo.sh: screencapture produced no file $MISSES times in a row — giving up." >&2
      echo "  Destination was: $STAGING" >&2
      break
    fi
    sleep "$INTERVAL"; continue
  fi
  MISSES=0
  SHOT=$((SHOT + 1))

  # First frame doubles as the permission check. A screen recording that macOS has not
  # authorised comes back as the wallpaper alone: no windows, no menu bar text, so the
  # image has almost no distinct greyscale levels. Real screens with terminals in them
  # are nowhere near that flat.
  if [ "$SHOT" = 1 ]; then
    COLORS="$(magick "$STAGING" -colorspace Gray -format '%k' info: 2>/dev/null || echo 0)"
    if [ "${COLORS:-0}" -lt 32 ]; then
      echo "capture-demo.sh: the first frame has only $COLORS grey levels — this looks like" >&2
      echo "  the wallpaper, which is what macOS returns when Screen Recording permission is" >&2
      echo "  missing. Grant it to this terminal in System Settings > Privacy & Security >" >&2
      echo "  Screen Recording, then run this again." >&2
      rm -f "$STAGING"
      exit 1
    fi
  fi

  SIG="$(signature "$STAGING")"
  if [ "$SIG" = "$LAST_SIG" ]; then
    rm -f "$STAGING"
  else
    LAST_SIG="$SIG"
    NOW="$(date +%s)"
    NAME="$(printf 'frame-%05d.png' "$KEPT")"
    mv "$STAGING" "$OUT/$NAME"
    printf '%s\t%s\t%s\n' "$NAME" "$NOW" "$((NOW - START))" >> "$MANIFEST"
    KEPT=$((KEPT + 1))
  fi

  sleep "$INTERVAL"
done

finish
