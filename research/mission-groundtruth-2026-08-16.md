# Ground-truth audit — follow-up pass (2026-08-16)

Researcher agent. Continues from `research/mission-groundtruth-2026-08-15.md`. Installed
versions re-checked this session: `herdr 0.8.0`, `atomic 0.9.13`, `Ghostty 1.3.1` —
**unchanged** from the 2026-08-15 audit, so no new drift is possible without a re-check
of every claim (done below).

## 1. Re-verified all 24 claims from the 2026-08-15 audit — all still VERIFIED

```
$ herdr --version && atomic --version && ghostty --version
herdr 0.8.0
0.9.13
Ghostty 1.3.1
```

| Claim area | Command run | Result |
|---|---|---|
| `herdr agent` subcommands | `herdr agent --help` | VERIFIED — `list, get, read, send-keys, prompt, rename, focus, wait, attach, start, explain` |
| `herdr agent wait --until/--timeout` | `herdr agent wait --help` | VERIFIED — `--until <STATUS>`, `--timeout <MS>`, waits indefinitely without `--timeout` |
| `herdr integration install <agent>` targets | `herdr integration install --help` | VERIFIED — `claude, codex, copilot, devin, droid, kimi, opencode, ...` |
| `herdr agent explain` | `herdr agent explain --help` | VERIFIED |
| `herdr agent rename` | `herdr agent rename --help` | VERIFIED |
| `herdr worktree` subcommands | `herdr worktree --help` | VERIFIED — `list, create, open, remove` |
| `herdr --session <name>` | `herdr --help` | VERIFIED |
| `herdr pane send-text` | `herdr pane --help` | VERIFIED |
| `ghostty/config` keys all valid | `ghostty +validate-config --config-file=ghostty/config` | VERIFIED — exit 0 |
| `atomic -p` print mode | `atomic --help` | VERIFIED — `--print, -p` |
| `atomic install` | `atomic install --help` | VERIFIED |
| `atomic auth` subcommands | `atomic auth --help` | VERIFIED — `print-api-key`, `print-bearer-token`, `check` |

No new NOT-VERIFIED or STALE items surfaced. The two prior "not independently verifiable"
items (herdrdev/herdr repo slug; Atomic's `/workflow ...` slash commands, which are
interactive TUI commands not exposed via `--help`) remain unverifiable by non-interactive
command audit — unchanged status, not a regression.

**Correction (2026-08-16, later same day, flagged by `docs`):** row 4 in this table
(`herdr agent explain`) and its 08-15 source row both marked VERIFIED on the strength of
`herdr agent explain --help` succeeding. That only proves the subcommand exists and its
help text renders — it does not prove the documented invocation (`herdr agent explain
<agent-name-or-pane-id>`, per `docs/monitoring-agents.md:52`) actually works. `docs`
ran the real command and found both documented forms fail on Herdr 0.8.0
(`herdr agent explain <role-name>` → `agent_not_found`; `herdr agent explain <pane-id>`
→ `agent_explain_unavailable`); same failure pattern for role-name targeting on
`get`/`read`/`wait`. Full evidence: `build/PRE-RELEASE-CHECK.md` §6. Fixed across 4 docs
files in commit `c14ea50`. **Methodology lesson for future audits:** for a claim of the
shape "command X does Y", `--help` proves X *exists*; it does not prove Y *happens*.
Future audit tables should carry a distinct "invocation verified" column, not just
"exists verified" folded into one VERIFIED label.

## 2. DRIFT fix — already applied, confirmed

`atomic/README.md:5` previously read "Verified against Atomic `0.9.12`" while installed
was `0.9.13` (label drift only — every command from that file still worked under 0.9.13).

```
$ grep -n "0.9.1" atomic/README.md
5:> Verified against Atomic `0.9.13`. Command surfaces here are copied from the installed
  binary (`atomic --help`) and Atomic's bundled workflow docs
  (`$(npm root -g)/@bastani/atomic/docs/workflows.md`).
```

**Already fixed to `0.9.13`** — someone (docs/implementer) applied this between the
2026-08-15 audit and now. No action needed. If `atomic --version` ever reports something
other than `0.9.13` at final sign-off, re-flag as DRIFT.

## 3. G2 / G3 — still open, cannot be closed without a human-driven live run

Searched for any evidence created after `research/gap-assessment-2026-08-14.md` that
might address either gap:
```
$ find research -newer research/gap-assessment-2026-08-14.md -name "*.md"
research/mission2-graphview-2026-08-15.md
research/phase0-broker-client-spike-2026-08-15.md
```
Both files are unrelated to G2/G3 (one is about Atomic's own graph-view doc claim, the
other an intercom-broker client spike for a different mission thread). No evidence exists
that either gap has been closed. Per mission non-goals, I am not fabricating a run to
close them.

### G2 — `--resume` on genuinely unfinished work

Currently unproven: `--resume` has only been shown to re-attach an already-**complete**
run. Whether it correctly resumes a genuinely half-done stage is untested.

What a live human run must do to prove/disprove it:
1. Start a real multi-step `atomic` task per `docs/getting-started.md`.
2. Interrupt it partway (SIGTERM / Ctrl-C / pane kill) while a stage is genuinely
   mid-flight — not between stages.
3. Confirm via `herdr agent explain <agent>` or `/workflow status <run-id>` that the
   stage was incomplete at interrupt time; capture that output as evidence.
4. Run the resume flag (re-check `atomic --help` at run time for its exact current name).
5. Show the previously-incomplete stage actually continues — not a full restart from
   stage 1, and not a silent no-op.
6. Record before/after state and exact commands in `build/EVIDENCE.md`.

### G3 — a bigger job completing end to end

Currently unproven: the largest job tried so far stopped early. No evidence exists of a
multi-stage Atomic workflow run completing from kickoff through every stage to a reported
terminal state.

What a live human run must do to prove/disprove it:
1. Kick off a live, paid, multi-stage Atomic workflow run larger than any prior attempt.
2. Let it run through every stage without early stop.
3. Capture the transcript or run log showing terminal state (completed/failed/etc.) with
   no stage skipped or abandoned.
4. Record the run id, transcript path, and terminal status in `build/EVIDENCE.md`.

**Disposition:** logged to `build/BLOCKED.md` (already written this session) with these
exact steps, per mission criterion 4(b) — "left open with a clearly labeled
`build/BLOCKED.md` ... explaining exactly what a human run would need to prove."

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

## Summary for implementer / docs

- No command-claim fixes needed anywhere — everything re-checked clean.
- `atomic/README.md:5` version label already correct (`0.9.13`); no further edit needed
  there.
- `build/BLOCKED.md` exists with the exact G2/G3 human-run requirements — link to it from
  wherever docs surfaces "known open gaps" (mission criterion 4).
- Full detail also in `build/RESEARCH.md` (same findings, written earlier this session).
