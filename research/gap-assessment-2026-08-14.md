# Gap assessment — agentic-engineering-harness

Date: 2026-08-14. Author: review-and-fix loop (Atomic session).
Method: static review only. No live harness run was performed (that costs money and
needs a human in the loop). Claims below are backed by the tool results noted.

## What the repo is

A reference harness that wires Ghostty (terminal) + Herdr (workspace/panes) + Atomic
(agent orchestration). Mostly Markdown, plus shell (`build.sh`, `scripts/*.sh`) and a
little TypeScript (`atomic/extensions/*.ts`, `atomic/workflows/feature-development.ts`).
No application to build, no test suite. Success = clarity, accuracy, groundedness.

## Static health (verified this session)

- All relative Markdown links, `<img src>`, and `href` targets resolve. (link scan, passed)
- All shell scripts pass `bash -n`: build.sh + 8 scripts. (bash -n, all OK)
- `shellcheck` is not installed locally, so lint-level shell issues were not checked.

## Gaps, by whether they can be closed autonomously

### G1 — build.sh abandons the run after 10 minutes (CLOSABLE, static)
README "What is finished and what is not" flags this as **Not fixed yet**.
`build.sh:264` polls `for _ in $(seq 1 600); do [ -f IDEA.md ] && break; sleep 1; done`.
If the human takes >10 min to answer the intake popup, the loop exits with no IDEA.md.
The kickoff sends (`/name lead`, then "Begin…"/resume prompt) are gated on IDEA.md
existing, so they never fire. The agent stays live with the question on screen but never
gets the two messages that move it, and `--resume` restarts the server, discarding the
typed answer. Fix is a shell change: wait effectively indefinitely (with heartbeats)
for IDEA.md rather than capping at 600s. Correctness-shaped -> `debugger`.

**Status: CLOSED.** Fixed in commit `6797834` ("build.sh: remove intake-wait timeout and
guide the user on interrupt") — `build.sh` now waits unbounded for `IDEA.md` with a 60s
heartbeat and a Ctrl-C/SIGTERM trap that prints reattach guidance instead of dying silently.
Reviewed in `research/review-2026-08-14-g1-intake-fix.md`. Verified 2026-08-15: `bash -n
build.sh` passes; `git log -S"seq 1 600" -- build.sh` shows the capped loop only in earlier
commits, absent from HEAD.

### G2 — --resume finishing genuinely unfinished work (NOT autonomously closable)
README: resume has only been proven to re-attach an already-complete run; picking up
half-done work is unproven. Requires a real interrupted run to validate. Needs human +
paid run.

### G3 — bigger jobs completing end to end (NOT autonomously closable)
Largest job tried so far was stopped early. Requires live paid runs. Needs human.

## Possible consistency item (low confidence)

- Commit 431bee1 "remove the first-run and poem-page case studies" removed case-study
  writeups, but `docs/samples/poem-page.html` and its `docs/samples/README.md` section
  remain, and README:272-274 still cites poem-page as an "earlier run." This may be
  intentional (keep the artifact, drop the writeup). Not treated as a defect without a
  human decision.

**Decision (2026-08-15, implementer): keep the artifact, drop the standalone case study —
confirmed as the deliberate outcome, not a defect.** Commit 431bee1 removed
`docs/case-study-poem-page.md` on purpose (no screenshots were ever captured for that run,
so it could never match the Ozymandias write-up's evidence) while keeping `poem-page.html`
as a byte-identical artifact (checksum verified against `docs/samples/README.md:71`) plus a
condensed inline write-up in `docs/samples/README.md:39-71`. Verified 2026-08-15: `git show
431bee1 -- docs/samples/README.md` shows the section was rewritten in place, not left
dangling — it dropped only the dead link to the removed case-study file, not the content.
No reference in the repo (`README.md:319-321`, `docs/samples/README.md`) points at a
missing file. No action needed; this was already resolved, just under-documented here.

## Recommendation

Close G1 (the only flagged, statically-verifiable gap) via a `debugger` writer pass,
then a fresh-context review round on the diff. Flag G2/G3 as requiring a live run the
human must drive. Do not fabricate evidence for G2/G3.
