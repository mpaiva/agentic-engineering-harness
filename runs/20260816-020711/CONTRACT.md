# Contract

Mission: `build/MISSION.md`. Read it first — success criteria and non-goals are binding.

## Work split (no overlap)

- **researcher**: verify every ground-truth claim in `README.md`, `docs/*.md`, `herdr/*.md`,
  `ghostty/*.md`, `atomic/README.md` against actual installed tool output (`herdr --help`,
  `herdr --skill`, `atomic --help`, `ghostty +show-config --default`, `man 5 ghostty`).
  Write findings to `research/mission-groundtruth-2026-08-15.md`: one row per claim, verified
  or stale, with the exact command run. Do NOT edit docs yourself — hand findings to `docs`
  and `implementer`.
- **implementer**: fix mechanics — broken links, `bash -n` failures, `shellcheck` errors,
  close G1 (`build.sh` intake timeout, see `research/gap-assessment-2026-08-14.md`), decide
  and execute the poem-page inconsistency (either restore a short case-study note or remove
  the stale artifact/reference — pick one, document the decision in the commit message and
  in `docs/samples/README.md` if that dir has one), check `atomic/workflows/` and
  `atomic/extensions/` consistency with `atomic/README.md`.
- **docs**: once researcher's findings land, fix any stale prose/commands in
  `README.md` → `docs/getting-started.md` → `docs/architecture.md` → `docs/operating-model.md`
  so they read as one coherent path. Spot-check `team/*.md` briefs stay domain-neutral
  (criterion 6).
- **verifier**: re-run every check independently after implementer/docs report done. Report
  pass/fail with actual command output per criterion in `build/MISSION.md`. Do not trust
  self-reports.

## Sequencing

1. researcher runs first, reports findings (don't block others — mechanical fixes in
   parallel).
2. implementer starts mechanical fixes immediately (link scan, bash -n, shellcheck, G1,
   poem-page) — doesn't need to wait on researcher.
3. docs waits for researcher's findings file before final coherence pass, but may pre-read
   the four docs now.
4. verifier runs last per slice — ping lead when a slice is ready to check.

## Board

Every task gets a card: `scripts/board.sh add --title "..." --owner <role> --stage plan`,
then `status`/`move` as it progresses through `plan → implementation → verification →
review → done`.

## Reporting

`send` results to `lead` when a task completes. Reference files by path. If blocked >3
repair cycles on one item, `send` lead immediately rather than grinding.
