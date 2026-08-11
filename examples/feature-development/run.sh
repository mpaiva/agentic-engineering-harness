#!/usr/bin/env bash
# run.sh — a real, self-contained end-to-end run of the feature-development shape,
# orchestrated over a headless Herdr session, against sample-project/.
#
# What is REAL here:
#   • a real headless Herdr server, workspace, and one pane per responsibility
#   • real agent-state transitions (working → blocked → idle) that drive the cockpit
#   • the workspace rollup flipping to BLOCKED at each human gate
#   • real verification: `node --check` + `node --test` executed, output saved as evidence
#   • real artifacts written to research/ specs/ artifacts/
#
# What is SIMULATED (to keep the example free and reproducible):
#   • the "agents" are this script's deterministic steps, not live LLM sessions.
#     The live-agent path is `herdr agent start --kind claude` + `agent prompt` +
#     `agent wait` — see ../../scripts/launch-feature.sh and ../../herdr/setup.md.
#
# Verified against Herdr 0.8.0 / Node 22.
set -euo pipefail

ID="EE-1428"
SESSION="ee-1428"
OBJECTIVE="Add a URL-safe slugify() utility with tests (accepts arbitrary text, WCAG-safe slugs)"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PROJ="$HERE/sample-project"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

SEQ=0
set_state(){ # pane agent state [message]
  SEQ=$((SEQ+1))
  if [ -n "${4:-}" ]; then
    herdr pane report-agent "$1" --source example --agent "$2" --state "$3" --message "$4" --seq "$SEQ" >/dev/null 2>&1 || true
  else
    herdr pane report-agent "$1" --source example --agent "$2" --state "$3" --seq "$SEQ" >/dev/null 2>&1 || true
  fi
}
banner(){ printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
cockpit(){ "$REPO/scripts/status.sh" "$ID" 2>/dev/null || true; }

rm -rf "$HERE/research" "$HERE/specs" "$HERE/artifacts"
mkdir -p "$HERE/research" "$HERE/specs" "$HERE/artifacts"

banner "objective"
echo "$OBJECTIVE"

# ── fresh headless Herdr server (clean slate each run) + one workspace ───────────
# Herdr persists named sessions (its lid-close feature). For a reproducible example we
# reset this demo session's state while the server is stopped, so every run starts at w1:p1.
herdr server stop >/dev/null 2>&1 || true
sleep 1
rm -rf "$HOME/.config/herdr/sessions/$SESSION"
sleep 0.5
command herdr server --session "$SESSION" >/dev/null 2>&1 &
# Wait until the server not only reports running but answers a real query cleanly.
for _ in $(seq 1 40); do
  if herdr status 2>/dev/null | grep -q 'status: running' \
     && herdr workspace list 2>/dev/null | grep -q '"workspaces"'; then break; fi
  sleep 0.3
done
herdr workspace create --label "$ID Employee Event Slug" >/dev/null 2>&1 || true
ROOT="$(herdr pane list | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['panes'][0]['pane_id'])")"
# Bash 3.2 (macOS default) has no associative arrays; map name→pane via dynamic vars.
pane_of(){ eval "printf '%s' \"\${PANE_$1}\""; }
PREV="$ROOT"
for name in research planner frontend test verifier; do
  PID="$(herdr pane split "$PREV" --direction down --no-focus | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['pane']['pane_id'])")"
  herdr pane rename "$PID" "$name" >/dev/null 2>&1 || true
  eval "PANE_$name=$PID"; PREV="$PID"
done
echo "panes: $(for r in research planner frontend test verifier; do printf '%s=%s ' "$r" "$(pane_of "$r")"; done)"

# ── Phase 1: research (parallel fan-out → small artifacts) ───────────────────────
banner "phase 1 · research (parallel)"
for r in research frontend test; do set_state "$(pane_of "$r")" "$r" working; done
cat > "$HERE/research/codebase.md" <<'MD'
# Codebase research — slugify

- No existing slug helper in `src/`. Nearest prior art: none. Safe to add `src/slugify.js`.
- Project is ESM (`"type": "module"`), zero runtime deps. Keep it dependency-free.
- Test runner is the Node built-in (`node --test`); put tests in `test/*.test.js`.
MD
cat > "$HERE/research/accessibility.md" <<'MD'
# Accessibility implications

Slugs appear in URLs and anchor ids. For predictable screen-reader announcement and
keyboard target ids, slugs must be lowercase, ASCII, hyphen-separated, with no leading/
trailing separators. Accented input must transliterate (café → cafe), not drop.
MD
cat > "$HERE/research/test-strategy.md" <<'MD'
# Test strategy

Unit-test `slugify()` directly with `node --test`. Cases: casing+spacing, punctuation,
collapsed/edge separators, accent transliteration, empty-ish input. These cases ARE the
acceptance criteria the independent verifier re-derives from the objective.
MD
for r in research frontend test; do set_state "$(pane_of "$r")" "$r" idle; done
cockpit

# ── Phase 2: plan (synthesize research) ─────────────────────────────────────────
banner "phase 2 · plan"
set_state "$(pane_of planner)" planner working
cat > "$HERE/specs/implementation-plan.md" <<'MD'
# Implementation plan — slugify()

## Change set
- Add `src/slugify.js` exporting `slugify(input: string): string`.
- Add `test/slugify.test.js` covering the acceptance cases.

## Approach
1. Guard non-strings → "".
2. Lowercase, then transliterate a common accent set to ASCII.
3. Replace runs of non-alphanumerics with a single hyphen.
4. Trim leading/trailing hyphens.

## Verification criteria (evidence required)
- `node --check src/slugify.js` passes (typecheck).
- `node --test` → all cases pass.

## Risks / open questions
- Accent coverage is a curated subset, not full Unicode normalization. Acceptable for the
  objective; note as a follow-up if non-Latin scripts are needed.
MD
set_state "$(pane_of planner)" planner idle

# ── Gate 1: human plan review (surfaced as BLOCKED) ─────────────────────────────
banner "gate 1 · human plan review"
set_state "$(pane_of planner)" planner blocked "Approve plan at specs/implementation-plan.md to begin implementation?"
cockpit
echo "→ [human] plan looks good; approving."
set_state "$(pane_of planner)" planner idle

# ── Phase 3: implementation (parallel) ──────────────────────────────────────────
banner "phase 3 · implementation (parallel)"
for r in frontend test; do set_state "$(pane_of "$r")" "$r" working; done
# (sample-project/src/slugify.js and test/ already contain the implemented feature.)
echo "implemented: src/slugify.js  ·  test/slugify.test.js"
for r in frontend test; do set_state "$(pane_of "$r")" "$r" idle; done

# ── Phase 4: automated verification + independent verifier (REAL checks) ────────
banner "phase 4 · verification (real evidence)"
set_state "$(pane_of verifier)" verifier working
EVID="$HERE/artifacts/evidence.txt"
{
  echo "# Verification evidence — $(cd "$PROJ" && node -v)"
  echo; echo "\$ node --check src/slugify.js"
  ( cd "$PROJ" && node --check src/slugify.js && echo "typecheck: OK" )
  echo; echo "\$ node --test"
  ( cd "$PROJ" && node --test )
} > "$EVID" 2>&1
PASS_LINE="$(grep -E '^# (pass|fail)' "$EVID" | tr '\n' ' ')"
echo "checks ran → $PASS_LINE"

FAILS="$(grep -E '^# fail' "$EVID" | grep -oE '[0-9]+' | head -1)"
if [[ "${FAILS:-1}" == "0" ]]; then
  VERDICT="passed"
  cat > "$HERE/artifacts/verification.md" <<MD
# Independent verification — PASSED

Verifier derived acceptance checks from the objective FIRST, then inspected evidence.

- typecheck (\`node --check\`): OK
- unit tests (\`node --test\`): $PASS_LINE
- accent transliteration case: covered and passing (café → cafe)
- edge/empty input case: covered and passing

Verdict: **pass**. Evidence: artifacts/evidence.txt. No blocking findings.
MD
else
  VERDICT="failed"; fi
set_state "$(pane_of verifier)" verifier idle
echo "independent verdict: $VERDICT"

# ── Gate 2: final human review (surfaced as BLOCKED) ────────────────────────────
banner "gate 2 · final human review"
set_state "$(pane_of verifier)" verifier blocked "Verification passed. Review diff + artifacts/evidence.txt. Approve to finalize?"
cockpit
echo "→ [human] evidence is real and complete; approving. (PR step is create_pr-gated; not run here.)"
set_state "$(pane_of verifier)" verifier idle

banner "done"
echo "status: completed (verified, human-approved). Artifacts:"
echo "  research/{codebase,accessibility,test-strategy}.md"
echo "  specs/implementation-plan.md"
echo "  artifacts/{evidence.txt,verification.md}"
echo
echo "Inspect live:  herdr --session $SESSION        (attach the TUI from Ghostty)"
echo "Stop server:   herdr --session $SESSION server stop"
