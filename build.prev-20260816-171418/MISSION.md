# Mission

## Raw idea

> What do you want to build today?

I want you to build a team to help me improve this repository and bring it to a state where a senior engineer will have the best experiece running multiple agents

## Goal

At the end, a senior engineer who has never seen this repo can clone it, read `README.md`,
and within their first `./build.sh` run understand — without guessing or hitting a wall —
how Ghostty, Herdr, and Atomic fit together, what a mission looks like, and how to recover
when something goes wrong (timeout, crash, unclear agent state, stuck pane). Every command
shown in the docs actually works against the installed tool versions. Known rough edges are
labeled as such instead of silently failing.

## Success criteria

1. Every backtick-quoted `herdr`/`atomic`/`ghostty` command claim in `README.md`, `docs/*.md`,
   `herdr/*.md`, `atomic/*.md`, `ghostty/*.md` is re-verified against currently installed
   tool versions (`herdr --version`, `atomic --version`, `ghostty --version`); any DRIFT or
   STALE finding from `research/mission-groundtruth-2026-08-15.md` is either fixed or
   confirmed current, with the audit file updated to reflect final status.
2. `bash -n` and (if available) `shellcheck` pass clean on `build.sh` and every script under
   `scripts/`.
3. All relative Markdown links, `<img src>`, and `href` targets across the repo resolve
   (no orphaned docs, no dead links) — verified by a link-check pass, not eyeballing.
4. The two open, non-autonomously-closable gaps from `research/gap-assessment-2026-08-14.md`
   (G2: `--resume` on genuinely unfinished work; G3: a bigger job completing end to end) are
   each either: (a) closed by a real, evidenced human-in-the-loop run, or (b) left open with
   a clearly labeled `build/BLOCKED.md` / doc callout explaining exactly what a human run
   would need to prove — never silently dropped.
5. A new reader following only `README.md` → `docs/getting-started.md` can identify, without
   asking anyone: what to do when `build.sh` times out, when an agent pane looks stuck, and
   when `--resume` is appropriate vs. not. If today's docs don't answer one of these,
   this mission adds the missing guidance.
6. `docs/troubleshooting.md` (or an equivalent, clearly linked section) exists, covering at
   minimum: intake-answer timeout, stuck/unresponsive agent pane, unclear `herdr agent`
   state, and how to interpret a `build/BLOCKED.md`.
7. `build/EVIDENCE.md` records, per criterion above, the exact command run and its output
   (or the file/line diff) proving it — not a narrative claim.

## Constraints

- Repo is documentation-plus-scripts (Markdown, shell, a little TypeScript for Atomic
  workflows). No application code to build, no test suite to add. See `AGENTS.md`.
- Ground every claim in an actually-run command (`--help`, `--version`, `bash -n`, a link
  checker) — never assert a CLI behavior from memory. `AGENTS.md`'s "ground truth over
  assumption" rule is binding.
- Do not add runtime dependencies or package manifests.
- Do not create a new GitHub remote; push only to the existing `origin`, and only when asked.
- `build/` is run output, git-ignored, and never treated as source; findings go to
  `research/`, docs get edited in place under the repo root.
- This mission builds on, not duplicates, existing research: `research/gap-assessment-2026-08-14.md`
  and `research/mission-groundtruth-2026-08-15.md` are starting inputs, not throwaway context.

## Non-goals

- No new orchestration framework, no replacing Ghostty/Herdr/Atomic, no plugin architecture.
- No web UI, no dashboard beyond what `herdr-board`/kanban already provides.
- No closing G2/G3 by fabricating a run — if a live paid run isn't authorized this session,
  they get documented as open, not marked done.
- No expanding scope to "redesign the harness" — this is a hardening and documentation-fidelity
  pass on the repo that exists today.

## Stop rules

- Stop when every success criterion above has a corresponding line in `build/EVIDENCE.md`
  with command output as proof, or is explicitly logged in `build/BLOCKED.md` with what a
  human needs to unblock it.
- Any repair cycle on a single slice caps at ~3 rounds; beyond that, log to `build/BLOCKED.md`
  and move on rather than grinding.
- Do not push to `origin` until the human confirms the mission is complete.
