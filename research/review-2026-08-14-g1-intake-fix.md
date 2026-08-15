# Review brief — G1 intake-wait fix + doc updates

Date: 2026-08-14
Scope: uncommitted diff — `build.sh` intake-wait fix (G1), `README.md`, `docs/case-study-ozymandias.md`
Method: 1 fresh-context review round (2 reviewers) + 2 inline fixes. Cap: 1 round, review-only.

## Outcome

Diff is sound. No blockers. The core fix works: `build.sh` replaces the 10-minute
(`for _ in $(seq 1 600)`) intake cap with an unbounded `while [ ! -f IDEA.md ]` loop that
prints a heartbeat every 60s. `bash -n` passes; heartbeat arithmetic, variable definitions,
and the `--resume` no-tick path are all correct.

## Review round (1 of 1)

Two fresh-context reviewers, inspect-only, no main-conversation history:
- `debugger` — shell correctness + failure modes.
- `codebase-analyzer` — doc↔code groundedness (AGENTS.md's core rule).

## Fixes applied this session

1. `docs/case-study-ozymandias.md:209-210` — past tense ("It waited ten minutes… then
   exited"); removed present-tense claim that contradicted the fix noted 7 lines below.
2. `build.sh:307-309` — comment corrected: the `else` branch is a defensive TOCTOU re-check,
   NOT a Ctrl-C guard (debugger proved Ctrl-C/SIGTERM kill the script inside the wait loop).

Validation: `bash -n build.sh` OK; grep confirms no stale "waits ten minutes"/"then exits".

## Open — needs a decision

- **Silent Ctrl-C path.** No `trap` in `build.sh`, so if a human gives up and hits Ctrl-C,
  the script dies at exit 130 in silence while the detached herdr server and live lead keep
  running — the same "stranded live agent" class the fix targeted, relocated to the interrupt
  path. Suggested fix: `trap '…attach guidance…; exit 130' INT TERM` before the wait loop
  (also makes the fix #2 comment fully true). NOT applied — adds new behavior beyond the
  timeout-removal scope.

## Deferred / optional (not blocking)

- `research/gap-assessment-2026-08-14.md:22-30` still lists G1 as open and quotes the removed
  `seq 1 600` loop. Dated static-review snapshot; a one-line "Closed — see build.sh:264-278"
  would prevent a future reader treating it as open.
- `docs/case-study-ozymandias.md:216` "Fixed since this run" → "Fixed in code since this run"
  to match README's precision.
- Non-interactive/CI runs now block forever (no in-repo caller does this today). Optional
  `INTAKE_TIMEOUT` env override, default 0 = unlimited.
- NITs: `(%dm elapsed)` counts loop iterations not wall-clock (~5% slow drift); the
  copy-paste `herdr --session` command sits mid-sentence on the TOCTOU branch.

## Why it stopped

Round cap (1) reached and invocation was review-only. No writer subagent launched; the two
fixes above were trivial inline edits.
