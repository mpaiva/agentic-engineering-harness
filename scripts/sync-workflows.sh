#!/usr/bin/env bash
# sync-workflows.sh — make the repo's Atomic workflows runnable.
#
#   ./scripts/sync-workflows.sh
#
# The authored, version-controlled workflows live in atomic/workflows/ (readable, in git).
# Atomic only discovers workflows from .atomic/workflows/ (with the dot), so this copies
# them there. The .atomic/ copies are derived/gitignored — re-run this after editing a
# workflow, then run `/workflow reload` inside Atomic (or restart it) to pick up changes.
# Verified against Atomic 0.9.12.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .atomic/workflows
cp atomic/workflows/*.ts .atomic/workflows/
echo "✓ synced $(ls atomic/workflows/*.ts | wc -l | tr -d ' ') workflow(s) into .atomic/workflows/"
echo "  now, inside Atomic:  /workflow reload   (then /workflow list)"
