# Research — re-verify ground-truth claims + G2/G3 status

Date: 2026-08-16. Researcher agent. Installed versions (re-checked this session):
`herdr 0.8.0`, `atomic 0.9.13`, `Ghostty 1.3.1` — identical to the 2026-08-15 audit, so
no version drift occurred between audits.

## Decision 1: All 24 claims from `research/mission-groundtruth-2026-08-15.md` — re-verified, still current

**Recommendation: no doc changes needed for command claims.** Re-ran every `--help`/
`--version`/`+validate-config`/`man` check from the prior audit; every result matches.
Rationale: repo and installed tool versions are unchanged since the last audit, so a
byte-for-byte re-run is sufficient evidence — no drift can occur without a version bump.

Evidence (this session):
```
$ herdr --version && atomic --version && ghostty --version
herdr 0.8.0
0.9.13
Ghostty 1.3.1
```
- `herdr agent --help` → `list, get, read, send-keys, prompt, rename, focus, wait, attach, start, explain` — VERIFIED
- `herdr agent wait --help` → `--until <STATUS>`, `--timeout <MS>`, waits indefinitely without `--timeout` — VERIFIED
- `herdr integration install --help` → `claude, codex, copilot, devin, droid, kimi, opencode, ...` — VERIFIED
- `herdr agent explain --help`, `herdr agent rename --help` → both exit OK — VERIFIED
- `herdr worktree --help` → `list, create, open, remove` — VERIFIED
- `herdr --help` → `--session <name>` documented — VERIFIED
- `herdr pane --help` → `send-text` present — VERIFIED
- `ghostty +validate-config --config-file=ghostty/config` → exit 0 — VERIFIED
- `atomic --help` → `--print, -p` present — VERIFIED
- `atomic install --help`, `atomic auth --help` (`print-api-key`, `print-bearer-token`,
  `check`) — VERIFIED

## Decision 2: The one DRIFT finding is already fixed

**Recommendation: no action.** `atomic/README.md:5` previously said "Verified against
Atomic `0.9.12`" while installed was `0.9.13` (DRIFT, not a functional break). Re-checked
this session:
```
$ grep -n "0.9.1" atomic/README.md
5:> Verified against Atomic `0.9.13`. ...
```
Already reads `0.9.13`, matching installed. Someone (docs or implementer) fixed this
between the 2026-08-15 audit and now. Confirmed via `grep`, not eyeballing. Would change
my mind: if `atomic --version` reports anything other than `0.9.13` at final sign-off,
re-flag as DRIFT again.

## Decision 3: G2 and G3 remain open — no evidence either closed since 2026-08-14

**Recommendation: leave both open, write `build/BLOCKED.md` documenting exactly what a
human-driven run needs to prove.** Rationale: mission non-goals explicitly forbid
fabricating a live run to close these; I searched for any new evidence file created after
`research/gap-assessment-2026-08-14.md` and found none addressing G2/G3 (the two newer
files, `mission2-graphview-2026-08-15.md` and `phase0-broker-client-spike-2026-08-15.md`,
are about an unrelated prior mission — Atomic's graph-view doc claim and an intercom
broker spike — not about `--resume` or a completed large job). `build/BLOCKED.md` does
not exist yet.

What would change my mind: a timestamped research file or `EVIDENCE.md` entry showing (a)
for G2, a genuinely interrupted `atomic` run that `--resume` picked back up mid-task
(not just re-attaching a finished run), with before/after state; (b) for G3, a full
end-to-end large-job transcript that didn't stop early.

**G2 — `--resume` on genuinely unfinished work.** Needs: start a real multi-step Atomic
task, interrupt it partway (SIGTERM/Ctrl-C or pane kill) while a stage is genuinely
mid-flight, confirm via `herdr agent explain` or workflow status that the stage was
incomplete at interrupt time, then run `--resume` (or the appropriate Atomic
resume flag — `atomic --help` should be re-checked for the exact flag name at run time)
and show the interrupted stage actually continues rather than the whole run restarting
from scratch or silently no-op'ing.

**G3 — a bigger job completing end to end.** Needs: a live, paid, multi-stage Atomic
workflow run (larger than what's been tried so far) taken from kickoff through every
stage to a completed/reported terminal state, with the transcript or `EVIDENCE.md`-style
log showing no early stop.

Both require a human to authorize spend and drive the run — outside what I can produce
autonomously per mission constraints ("Ground every claim in an actually-run command" +
non-goal "No closing G2/G3 by fabricating a run").

## Commands run this session (reproducibility)

```
herdr --version; atomic --version; ghostty --version
herdr agent --help
herdr agent wait --help
herdr integration install --help
herdr agent explain --help
herdr agent rename --help
herdr worktree --help
herdr --help
herdr pane --help
ghostty +validate-config --config-file=ghostty/config
atomic --help
atomic install --help
atomic auth --help
grep -n "0.9.1" atomic/README.md
find research -newer research/gap-assessment-2026-08-14.md -name "*.md"
```
