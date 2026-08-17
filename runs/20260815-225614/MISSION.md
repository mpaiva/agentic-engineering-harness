# Mission

## Raw idea

> What do you want to build today?

new mission: help finish building atomic cockpit

(Human clarified: start with a general audit of the repo — read through it and report
what's incomplete, broken, or undocumented — rather than jumping straight to a fix.)

## Goal

A written audit report (`build/artifacts/cockpit-audit/AUDIT.md`) of the
`atomic-cockpit` repository itself: every place where a claim in the docs does
not match what the installed tools/scripts actually do, every broken cross-reference, every
script that doesn't run as documented, and every gap README's own "This is still rough"
section already names. The report is the deliverable — it does not itself fix anything. Each
finding is a checkable claim ("`docs/X.md` links to `Y.md`, which does not exist" / "`scripts/
Z.sh --flag` fails with <error>"), not an impression.

## Success criteria

1. Every Markdown file in the repo (`*.md`, excluding `build/` and `node_modules`) has been
   scanned for relative links; every broken link is listed in AUDIT.md with the source file,
   line, and target.
2. Every shell/CLI command shown in `README.md`, `docs/*.md`, and `AGENTS.md` has either been
   run and its real output compared to the doc's claim, or is flagged in AUDIT.md as
   "not independently run" with a reason (e.g. destructive, requires credentials).
3. Every `.sh` script under `scripts/` has been checked for: does it run without a syntax
   error (`bash -n`), does `--help`/usage text match what the script actually accepts. Findings
   listed per script.
4. Every `.ts` file under `atomic/extensions/` (or wherever Atomic workflow/extension code
   lives) has been checked against `atomic/README.md`'s description of it for consistency;
   mismatches listed.
5. README's own "This is still rough" section (3 named gaps: `--resume` on genuinely
   unfinished work, the intake-wait-cap fix, bigger jobs) is carried into AUDIT.md as three
   explicit open items, each with current status (unchanged / re-tested / still open) rather
   than silently dropped.
6. AUDIT.md ends with a prioritized, numbered list of the top findings (cap ~10, ranked by
   how much they'd mislead or block a new user), each with a suggested next mission-sized fix
   — but no fix is implemented in this mission.
7. A second, independent pass (not by whoever wrote AUDIT.md) has spot-checked at least 5
   of the report's findings against the actual repo state and confirmed they are accurate
   (not fabricated or stale), recorded in `build/EVIDENCE.md`.

## Constraints

- Read-only against the repo's actual content — this mission produces a report, it does not
  edit `README.md`, `docs/`, `scripts/`, `team/`, or `atomic/`. Any fix belongs to a follow-up
  mission the human explicitly approves.
- Ground every claim in a command that was actually run or a file that was actually read —
  per this repo's own `AGENTS.md` rule ("Ground truth over assumption"). No claim without
  evidence.
- Output lives under `build/artifacts/cockpit-audit/` (the report) and `build/EVIDENCE.md`
  (the independent spot-check), per this repo's convention.

## Non-goals

- Not fixing any of the findings — this mission stops at the report.
- Not a line-by-line style/grammar edit of the docs.
- Not re-litigating design decisions already recorded in `specs/`.
- Not testing on Windows/Linux — `AGENTS.md` already scopes this repo to macOS.

## Stop rules

Done when all 7 success criteria have command-level or check-level evidence recorded in
`build/EVIDENCE.md`, and `build/artifacts/cockpit-audit/AUDIT.md` exists with the findings
and the prioritized top-10 list. Stop and write `build/BLOCKED.md` if a criterion fails 3
repair cycles.
