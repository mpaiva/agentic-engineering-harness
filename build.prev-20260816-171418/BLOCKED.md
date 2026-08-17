# Blocked — one mission gap remains open after a live paid run

Human authorized a live paid run on 2026-08-16 to close G2/G3 from
`research/gap-assessment-2026-08-14.md`. **G3 is now closed** (evidence below). **G2
remains open** — a real attempt was made and did not succeed; see
`build/EVIDENCE.md` for the full run log and what specifically failed.

## G3 — CLOSED ✅

A live multi-stage `goal` workflow run (id `449ebe1e-ae8d-4853-8840-5658b21600f2`)
completed end to end: `orchestrator-1` → 3 parallel reviewers
(`completion-reviewer-1`, `evidence-reviewer-1`, `risk-reviewer-1`) → terminal
`status: completed`, `result.status: complete`, `result.approved: true`. Verified on
disk (file created with exact required content, real git commit made). Full evidence:
`build/EVIDENCE.md` § G3, raw JSONL at `build/evidence-g2-g3/g3-full-run.jsonl`.

## G2 — STILL OPEN

**What was proven this session:** crash detection works exactly as documented. A real
`atomic` process running a `goal` workflow was SIGKILLed genuinely mid-stage (no
`stage.end`/`run.end` event ever written). A fresh `atomic` process's
`/workflow status <id>` correctly reported it as live-elsewhere for the first 120s
(`FOREIGN_LIVE_WORKFLOW_WINDOW_MS`), then correctly flipped to `✗ crashed · resumable`
once the heartbeat window elapsed.

**What was NOT proven:** that `/workflow resume` actually continues the crashed run.
8 attempts across 2 modes all failed or were inconclusive:
- 6 headless (`atomic --mode json -p "/workflow resume <id>"`) attempts all failed
  immediately with `DBOS workflow durability is not ready.
  Await initializeDurableBackend() before accessing workflows.` — 100% reproducible,
  including after a full prior model turn completed in the same process (ruling out a
  simple "wait longer" fix).
- 2 interactive-TUI attempts (via isolated `tmux`, not a Herdr pane) showed no visible
  effect — no error, no graph overlay, no state change.
- Final status re-check after all 8 attempts: still `crashed · resumable`, still no
  output files created. Nothing advanced the run.

**What would close this:**
1. Retry interactive resume with a Herdr pane attached so `herdr agent explain` can be
   compared against the TUI's own state in real time (this session avoided Herdr panes
   entirely per the isolation constraint, which may have hidden a rendering/timing
   detail).
2. Or get confirmation from Atomic's own maintainers/docs on whether headless
   (`--mode json -p`) `/workflow resume` is actually supported — the documented
   headless pattern (`atomic --mode json --session-dir <dir> -p '/workflow <name> ...'`)
   is demonstrated only for **launching** a named workflow, never shown with `resume`.
3. Repeat the exact steps in `build/EVIDENCE.md` § G2 with either fix applied, and
   confirm the previously-incomplete stage actually continues (not restarts, not a
   silent no-op).

Full command-by-command evidence, raw JSONL logs, and the exact error text are in
`build/EVIDENCE.md` and `build/evidence-g2-g3/`.

## Why G2 isn't closed by this session

This was a genuine, good-faith live-run attempt, not a skipped one — the resume path
itself did not work when driven from this isolated environment. Per mission rules,
that is reported honestly rather than fabricated as a pass. Mission non-goal:
"No closing G2/G3 by fabricating a run" — G2 stays open with sharp diagnostic detail
rather than a false close.
