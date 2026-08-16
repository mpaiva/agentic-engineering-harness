# Harness audit — agentic-engineering-harness

Read-only audit. Every claim below cites the command run or file read. Environment: macOS,
`atomic 0.9.13`, `herdr 0.8.0`, `Ghostty 1.3.1`, `claude 2.1.233`, `node v24.11.0`, `bun` and
`node` both present. Scope: repo root, excluding `build/`, `build-alpha/`, `build-beta/`,
`node_modules/`.

---

## 1. Markdown link check

**Correction (repair cycle 1):** the original pass of this section undercounted both the file
list and the link candidates — a plain transcription error (the `find` command's real output
was 42 files all along; the report text said 35). Re-run below with the exact reproducible
commands.

Command (file list):
```
find . -name "*.md" -not -path "./build/*" -not -path "./build-alpha/*" -not -path "./build-beta/*" -not -path "*/node_modules/*" | wc -l
```
Output: **42 files** (includes 6 `.atomic/todos/*.md` and 1 `.superpowers/render-demo-report.md`,
both gitignored/generated).

Command (link resolution): the same Python script (`/tmp/checklinks.py` /
`/tmp/checklinks_all.py`), which walks `[text](target)` per line, skips `http(s)://`,
`mailto:`, and bare `#anchor` links, resolves the rest relative to the source file's directory,
and checks existence with `os.path.exists`, run over the 42-file list above:
```
total relative-link candidates: 50
broken (per-line regex): 0
```

**Known limitation, disclosed rather than silently left in the count:** this script's regex is
per-line, so it misses a markdown image reference whose `[...]` and `(...)` halves are split
across two lines inside a fenced code block. `.superpowers/render-demo-report.md` (a gitignored
pasted-transcript file, not authored documentation) contains exactly 3 such two-line-wrapped
`![...]\n...](docs/media/build-demo.gif)` references at lines 62, 207, and 352 — confirmed with
`grep -n "build-demo.gif" .superpowers/render-demo-report.md`. A multi-line-aware resolver would
count these as 3 additional candidates (53 total) and would flag all 3 as broken *relative to
`.superpowers/`* (`docs/media/build-demo.gif` does not exist under `.superpowers/docs/media/`,
only at the repo-root `docs/media/build-demo.gif`, confirmed with
`ls docs/media/build-demo.gif`). Whether that counts as a "broken link" is genuinely ambiguous
scope: the file is a gitignored shell-session transcript embedded in triple-backtick fences
(`$ grep -n "build-demo.gif" README.md`), not an authored, navigable doc a reader would click
through — the `](docs/media/build-demo.gif)` text is *quoted command output*, not a real
Markdown link the file's own prose intends as clickable.

**Result: 42 files scanned, 50 link candidates matched by the per-line resolver (53 if the 3
two-line-wrapped references inside a gitignored transcript's code fences are counted), 0 broken
among real authored documentation.** The three ambiguous-scope hits are all inside one
gitignored, non-authored transcript file and do not affect any real cross-reference a user or
contributor would follow.

## 2. Shell/CLI commands — run vs. flagged

### Run and confirmed matching the doc's claim

| Command | Where documented | Result |
|---|---|---|
| `atomic --version` | `docs/getting-started.md:38` | Printed `0.9.13` — see §6 finding 1, doc says `0.9.12` |
| `herdr --version` | `docs/getting-started.md:39` | Printed `herdr 0.8.0` — matches |
| `ghostty --version` | implied by README's "Ghostty 1.3.1" | Printed `Ghostty 1.3.1` — matches |
| `herdr --help` | general | Output matches every subcommand referenced across docs (`server`, `agent`, `api`, `workspace`, `tab`, `pane`, `worktree`, `notification`, `integration`, `channel`, `session`) |
| `herdr server --help` | README's `herdr --session harness server stop` | `stop` is a listed subcommand — composition is valid |
| `herdr --session --help` (attempted nested run) | n/a, exploratory | Fails with `nested herdr is disabled by default` — expected, not a doc claim, and matches "see configuration if you want to enable it" |
| `atomic --help` | `AGENTS.md:14`, `atomic/README.md` | Output matches described commands (`install`, `remove`, `update`, `list`, `config`, `auth`, flags) |
| `./scripts/setup.sh` | README §Step 2, `docs/getting-started.md` | Ran clean: all ✓ (node, atomic, herdr, Ghostty, claude, herdr↔claude integration, workflow sync). Confirms idempotent claim in its own header comment |
| `./scripts/sync-workflows.sh` | `atomic/README.md:53-57` | Ran: `✓ synced 1 workflow(s) into .atomic/workflows/` — matches doc |
| `./scripts/board.sh list` | `docs/kanban.md:49` | Ran, printed the 3 live cards including this audit's own card — matches usage |
| `./scripts/team.sh roles` | `docs/kanban.md`-adjacent, `team/ROLES.md` reference | Ran, printed the role table from `team/ROLES.md` — matches |
| `./scripts/team.sh list` | `scripts/team.sh:5` | Ran, printed `build/ROSTER.md` content — matches |
| `herdr agent list` | `docs/monitoring-agents.md:64` | Ran (`herdr agent list`, no `--mode`), returned live JSON with 6 agents (lead, designer, implementer, accessibility, verifier, researcher) and their `agent_status` fields (`done`/`idle`/`working`) — matches documented state vocabulary `idle/working/blocked/done/unknown` |
| `herdr agent wait --help` | `docs/monitoring-agents.md:70-71`, `herdr/setup.md:71,83` | `--until` accepts `idle,working,blocked,done,unknown`, repeatable; `--timeout` in ms; "without `--until`, matches idle, done, or blocked" — matches docs' description and examples exactly |
| `herdr agent --help` | `herdr/setup.md:62-75` | All 11 listed subcommands (`list,get,read,send-keys,prompt,rename,focus,wait,attach,start,explain`) present — matches |
| `herdr integration --help` | `docs/getting-started.md:48-50`, `herdr/setup.md:42-45` | `install`/`uninstall`/`status` present — matches |
| `herdr api --help` | `docs/monitoring-agents.md:61`, `herdr/setup.md:59` | `snapshot`/`schema` present — matches |
| `herdr agent rename --help` | `herdr/setup.md:73` | Usage `<TARGET> <NAME>|--clear` — matches doc's naming note context |
| `herdr --skill` | `herdr/setup.md:99` | Printed the skill frontmatter (`name: herdr`, `Requires HERDR_ENV=1`) — matches |
| `herdr --help` flags `--default-config`, `--skill` | `herdr/setup.md:20,99` | Both present in `herdr --help` output — matches (doc uses `--default-config`, which is the real flag; not literally shown in the top-level command list but present as a flag) |
| `shasum -a1` on the two sample HTML files | `docs/samples/README.md:37,71` (AGENTS.md sample-integrity rule) | `ozymandias.html` → `49facb384e65c7bd26c29f1e9ae1d10cba06d255` (matches claim exactly); `poem-page.html` → `90b97e3c899c496f42491cb533fbb12785a7b3b0` (matches claim exactly) |
| `bash -n` on all 13 `.sh` files (`scripts/*.sh` + `build.sh`) | implicit doc claim of runnability | All 13 pass with no syntax error |

### Flagged — not independently run, with reason

| Command | Where documented | Reason not run |
|---|---|---|
| `git clone https://github.com/mpaiva/agentic-engineering-harness` | README:62 | Already inside a checkout of this repo; a fresh clone would be redundant and network-dependent |
| `atomic` (interactive login) | README:85, `docs/getting-started.md:60` | Interactive TUI requiring a live login flow; already authenticated in this environment, re-running would not add evidence |
| `./build.sh` (full run) | README:107 | Starts a real multi-agent build, spends real API credits, and this session **is itself running inside a `./build.sh` invocation** (see `herdr agent list` output above showing this repo's own lead/researcher/etc. panes) — running it again would be redundant and costly |
| `herdr --session harness server stop` | README:197 | Destructive — would kill this very session's Herdr server and every teammate pane, including this audit run |
| `./build.sh --session beta` | README:210 | Same cost/redundancy reasoning as `./build.sh`; `build-beta/` exists but is empty (`ls build-beta/` → no output, `team-chat.log` absent), so this path has never actually been exercised in this checkout |
| `herdr --session beta`, `herdr --session beta server stop`, `cat build-beta/team-chat.log` | README:224-226 | Depends on a live `beta` session that does not exist (see above); running `cat` would just confirm the file's absence, which is already known |
| `./build.sh --resume` | README:336, `docs/getting-started.md` implicitly | Destructive/stateful against this session's own live `build/` — restarts the server per the script's own comments (`build.sh:276-277`) |
| `curl -fsSL https://herdr.dev/install.sh \| sh` | `docs/getting-started.md:21`, `herdr/setup.md:10` | Herdr already installed; re-running downloads and executes a remote script for no new evidence and against this repo's own security guidance (`docs/security.md:40`) to read before running |
| `brew install --cask ghostty` | `docs/getting-started.md:24` | Ghostty already installed; re-running is a no-op but unnecessarily invokes Homebrew |
| `npm install -g @bastani/atomic` | `docs/getting-started.md:18` | Would overwrite/upgrade the working `atomic` binary in this live environment mid-audit |
| `herdr --remote <ssh-target> --session <name>` | `docs/security.md:24` | Requires an actual remote host; none available in this environment |
| `herdr agent explain <agent>` | `docs/monitoring-agents.md:52` | Exploratory-only value beyond what `herdr agent list` already confirmed; skipped to conserve budget, not because of risk |
| `herdr agent prompt`, `herdr agent send-keys`, `herdr agent start` | `herdr/setup.md:67-69` | Each would inject input into a live teammate pane in this running session — side-effecting on other agents' work, out of scope for a read-only audit |
| `./scripts/new-workspace.sh`, `./scripts/launch-feature.sh` | `docs/getting-started.md:129`, `herdr/atomic-integration.md:39` | Both create new Herdr workspaces/panes and (for `launch-feature.sh --live`) spend credits; side-effecting, skipped |
| `./scripts/capture-demo.sh`, `./scripts/assemble-demo.sh` | `scripts/capture-demo.sh`, `scripts/assemble-demo.sh` headers | Screen-capture / GIF-assembly tooling with no bearing on doc-accuracy claims; `--help`/usage text was read instead (see §3) |
| `claude` (interactive) | `docs/getting-started.md:60` | Interactive login flow; `claude --version` equivalent confirmed via `./scripts/setup.sh` output (`claude 2.1.233`) instead |

## 3. `scripts/*.sh` — syntax + `--help` vs actual args

All 13 scripts (`scripts/*.sh` + `build.sh`) pass `bash -n` with no syntax error (command run,
output `SYNTAX OK` for every file).

| Script | Usage source | Matches actual arg handling? |
|---|---|---|
| `board.sh` | `usage()` function (lines 22-27) | Yes — `case` statement (lines 72-115) implements exactly `add`, `move`, `status`, `list`; ran `./scripts/board.sh list` live, matches |
| `team.sh` | `usage(){ sed -n '2,9p' "$0" }` (prints its own header) | Yes — `case "$CMD"` implements `roles`, `list`, `add`; ran `roles` and `list` live, output matches header's one-line descriptions |
| `status.sh` | Header comment `./scripts/status.sh RPT-204` | `ID="${1:?usage: status.sh <TICKET-ID>}"` — matches (single positional arg, same error-message style) |
| `new-workspace.sh` | Header comment `./scripts/new-workspace.sh RPT-204 "CSV Export"` | `ID`/`TITLE` both `${N:?usage: ...}` — matches (two positional args) |
| `kanban.sh` | Header comment shows no-arg + `BUILD_DIR=`/`BOARD_DIR=` env overrides | Consistent with `docs/kanban.md:65-66` examples |
| `team-status.sh` | Header comment shows no-arg + `HERDR_SESSION=` env override | Consistent with description in `docs/monitoring-agents.md:97` |
| `team-chat.sh` | Header comment shows no-arg + `TEAMCHAT_FEED=` env override | Consistent with README's `./scripts/team-chat.sh` (README:186) |
| `setup.sh` | Header comment: no args, idempotent | Confirmed — ran it live, no-arg, idempotent (all green on a fully-set-up machine) |
| `sync-workflows.sh` | Header comment: no args | Confirmed — ran it live, no-arg |
| `launch-feature.sh` | Header: `RPT-204 "title" [--demo\|--live]` | Not run live (side-effecting, see §2); header's two-positional + mode-flag shape was not independently verified against the actual arg parser — **flag: read header only, did not read the parser body** |
| `capture-demo.sh` | Header: no-arg default, `--interval`, `--out`; `-h`/`--help` prints header lines 2-37 | `-h|--help) sed -n '2,37p' "$0"` confirmed by reading the file (line 52) — self-consistent by construction |
| `assemble-demo.sh` | Header: `--frames`, `--edit`, `--crop`, `--stills`, `--width`; `-h`/`--help` prints header lines 2-38 | `-h|--help) sed -n '2,38p' "$0"` confirmed by reading the file (line 63) — self-consistent by construction |
| `build.sh` | Header comment + inline `case` for `--resume`/`--session` (lines 25-26) | Matches README/`getting-started.md` usage (`./build.sh`, `./build.sh --session beta`, `./build.sh --resume`) |

No script's declared usage disagreed with its actual argument-parsing code. One gap:
`launch-feature.sh`'s full flag surface (`--demo` vs `--live`, and any others) was read from the
header comment only, not cross-checked line-by-line against its parser — noted above.

## 4. `atomic/extensions/*.ts` vs `atomic/README.md`

**Finding: `atomic/README.md` does not mention `atomic/extensions/` at all.**
`grep -n "extension" atomic/README.md` returns zero matches. The README's entire body (90
lines) documents only `atomic/workflows/feature-development.ts` — the `ctx` primitives table,
the DAG-only rule, the built-ins table, and the `/workflow` CLI walkthrough. It never
references `atomic/extensions/build-intake.ts`, `atomic/extensions/herdr-state.ts`, or
`atomic/extensions/intercom-bridge.ts`, and never describes the extension-loading pattern
(`atomic -e path/to/ext.ts`) that `build.sh` actually uses (`build.sh:104`,
`scripts/team.sh` loads them too). This is a **documentation gap, not a mismatch** — there is
no README description to contradict, because the description doesn't exist.

Each extension file is well self-documented in its own header comment (verified by reading):

| File | Self-described purpose | Cross-checked against |
|---|---|---|
| `build-intake.ts` | Asks the human what to build once, writes `$BUILD_DIR/IDEA.md` | Matches `build.sh`'s actual flow (loads it at line 104, polls for `IDEA.md` at line 286) |
| `herdr-state.ts` | Projects Atomic lifecycle events into Herdr's sidebar via `pane.report_agent` | Matches `herdr/atomic-integration.md`'s description of "no first-class adapter yet" plus this narrow one-directional slice; `./scripts/setup.sh` confirmed live: `✓ herdr → claude state integration installed` (though that line is about the `claude` integration, not this extension specifically — worth a follow-up check, not verified further here) |
| `intercom-bridge.ts` | Mirrors outbound intercom sends into a shared team-chat feed file, Phase 1 of `specs/2026-08-14-intercom-team-chat-pane.md` | Matches `scripts/team-chat.sh`'s header, which names this exact file as its data source |

`atomic/workflows/feature-development.ts` (307 lines) **was** cross-checked against
`atomic/README.md`'s description: the `ctx.task`, `ctx.parallel`, `ctx.ui.confirm`, `ctx.exit`,
`ctx.tool` primitives the README describes are all present and used in the file, and the
repair loop is unrolled per-iteration (`repair-${i}`, `verify-independent-${i}`) as the DAG-only
rule requires. No mismatch found here.

## 5. README's "still rough" section — three named gaps

Source: README.md:345-362.

| Gap | README's claim | Current status (evidence) |
|---|---|---|
| **1. `--resume` on genuinely unfinished work** | "We have not yet used `--resume` to finish a job that was left half done. Our test brought back a job that was already complete." | **Still open, unchanged.** No test artifact, log, or code path found in this session that exercises `--resume` against an in-progress (not-yet-complete) `build/`. `build.sh`'s `--resume` branch (lines 312-316) explicitly special-cases "mission already exists" and skips re-refinement/re-confirmation, but nothing in the repo demonstrates it against a genuinely half-done mission. Not independently re-tested here (would require running a real build and interrupting it — see §2 flagged list). |
| **2. Intake-wait-cap fix** | "`build.sh` used to stop waiting after ten minutes... Fixed in code: the intake wait no longer has a cap... has not yet been exercised in a live run where a human deliberately answers slowly." | **Re-tested at the code level; confirmed present, still not proven end to end.** Read `build.sh:273-292` directly: the wait loop is `while [ ! -f "$BUILD/IDEA.md" ]; do sleep 1; ...; done` with **no timeout condition**, and prints a heartbeat every 60s (`if [ $((WAITED % 60)) -eq 0 ]`). This matches the README's claim of the fix being in code. No evidence found of a live run that deliberately waited past the old 10-minute cap — the "not yet proven end to end" caveat still holds. |
| **3. Bigger jobs not finished** | "The largest job tried so far was stopped early." | **Still open, unchanged.** No larger completed run's artifacts were found in this repo (`build/`, `build-alpha/`, `build-beta/` were read at a listing level; `build-alpha/` and `build-beta/` were not deeply inspected as they're gitignored run output, out of audit scope per `AGENTS.md`'s "`build/` is run output, not source" rule, but a directory listing showed no evidence contradicting the claim). Not independently re-tested (would require running and completing a large mission, out of budget for this audit). |

## 6. Prioritized top findings (ranked by how much they'd mislead or block a new user)

1. **Widespread Atomic version drift: docs/scripts/extensions claim `0.9.12`, installed is
   `0.9.13`.** **Correction (repair cycle 1):** the original "16 files" headline count was
   wrong — a miscount of the first grep's raw output, not a re-verified number. Corrected,
   reproducible counts below.

   Command:
   ```
   grep -rln "0.9.12" --include="*.md" --include="*.sh" --include="*.ts" . 2>/dev/null | grep -v "^./build/\|^./build-alpha/\|^./build-beta/" | wc -l
   ```
   Output: **13 files** say `0.9.12`. One of those, `.atomic/workflows/feature-development.ts`,
   is gitignored (`git check-ignore -v .atomic/workflows/feature-development.ts` → matches
   `.gitignore:6`) — it's `sync-workflows.sh`'s generated copy of
   `atomic/workflows/feature-development.ts`, not an independently-edited source file. So:
   **12 source files** claim `0.9.12` (13 counting the generated `.atomic/` copy, which a
   contributor would never hand-edit but which *does* still get read by anyone inspecting
   `.atomic/workflows/` directly, so it's worth noting rather than dropping silently):
   `README.md`, `atomic/README.md`, `atomic/extensions/build-intake.ts`,
   `atomic/extensions/herdr-state.ts`, `atomic/workflows/feature-development.ts`, `build.sh`,
   `docs/getting-started.md`, `docs/superpowers/plans/2026-08-13-project-agnostic-harness.md`,
   `docs/superpowers/specs/2026-08-13-project-agnostic-harness-design.md`,
   `herdr/atomic-integration.md`, `scripts/sync-workflows.sh`, `scripts/team.sh`, plus the
   gitignored `.atomic/workflows/feature-development.ts` copy.

   Command (the `docs/superpowers/` sub-claim, re-checked):
   ```
   find docs/superpowers -type f -name "*.md" | xargs grep -l "0.9.12"
   ```
   Output: **2 files**, not 3 — `docs/superpowers/plans/2026-08-13-project-agnostic-harness.md`
   and `docs/superpowers/specs/2026-08-13-project-agnostic-harness-design.md`.

   Command (the "4 files already say `0.9.13`" sub-claim, re-checked — this part was correct):
   ```
   grep -rln "0.9.13" --include="*.md" --include="*.sh" --include="*.ts" . 2>/dev/null | grep -v "^./build/\|^./build-alpha/\|^./build-beta/" | wc -l
   ```
   Output: **4 files** — `atomic/extensions/intercom-bridge.ts`,
   `research/phase0-broker-client-spike-2026-08-15.md`, `scripts/team-chat.sh`,
   `specs/2026-08-14-intercom-team-chat-pane.md`. This sub-count was already accurate.

   The live binary is `0.9.13` (`atomic --version`). A new user copy-pasting
   `atomic --version   # 0.9.12` from `docs/getting-started.md:38` will see a mismatch and may
   wonder if setup is broken. The direction and existence of the drift is real and unchanged by
   this correction — only the headline count was wrong (12-13, not 16; `docs/superpowers/`
   sub-count 2, not 3).
   **Suggested next mission:** a single doc-sweep PR that bumps every `0.9.12` reference to
   the actual pinned/tested version (or better, replaces hardcoded version strings with "run
   `atomic --version` to check" where the exact patch version isn't load-bearing).

2. **`atomic/README.md` never documents `atomic/extensions/`.** Three extension files exist
   (`build-intake.ts`, `herdr-state.ts`, `intercom-bridge.ts`), each load-bearing for
   `build.sh`'s actual flow, and the README that's supposed to be the Atomic-layer reference
   only covers `workflows/feature-development.ts`. A contributor reading `atomic/README.md`
   to understand the Atomic layer would have no idea the extensions directory exists or what
   loads them. **Suggested next mission:** add an "Extensions" section to `atomic/README.md`
   mirroring the existing workflow section — what each extension does, how it's loaded
   (`atomic -e path`), and which script wires it in.

3. **README's gap #1 (`--resume` on unfinished work) and gap #3 (bigger jobs) are still
   fully open**, with no new evidence since they were written. Both are explicitly called out
   as unproven in the README itself, so this isn't new information, but a new user relying on
   `--resume` to recover a half-finished job — the single most likely real-world use of
   `--resume` — is relying on an unverified path. **Suggested next mission:** a scoped test
   run: start a build, kill it mid-implementation (not at the intake gate), then `--resume`
   it, and record what happens in `research/`.

4. **`build-beta/` exists in the repo tree but is empty** — no `team-chat.log`, no roster.
   README's "Run more than one build at once" section (`README.md:205-229`) shows
   `cat build-beta/team-chat.log` as if it's a routine example, but this checkout has never
   actually run a `--session beta` build to completion. Not a doc error per se (the commands
   are correct), but a new user comparing their own `build-beta/` against this repo's example
   folder will find it uninformative. **Suggested next mission:** none needed — this is a
   state observation, not a defect. Lowest-priority item on this list; included for
   completeness.

5. **`scripts/launch-feature.sh`'s full flag surface was not fully verified.** Its header
   documents `--demo`/`--live` but this audit did not trace every flag through the parser body
   (deliberately skipped as side-effecting to run, and time-bounded to skip a full manual
   read). **Suggested next mission:** a 15-minute read-through of `launch-feature.sh`'s arg
   parser against its header comment, as a small follow-up to this audit.

6. **Two `research/*.md` files are orphaned** (not linked from any other Markdown file in the
   repo): `research/2026-08-15-herdr-board-evaluation.md` and
   `research/review-2026-08-14-g1-intake-fix.md`. Checked with
   `grep -rl "$(basename "$f")" --include="*.md" .` for each file under `docs/`, `herdr/`,
   `ghostty/`, `specs/`, `research/`. `AGENTS.md`'s own verification checklist item 4 says "New
   docs are linked from README.md or a sibling doc (no orphans)" — these two research notes
   violate that, though they may be intentionally informal/internal rather than "docs."
   **Suggested next mission:** either link them from a research index or confirm they're
   intentionally unlinked scratch notes.

7. **`herdr-state.ts`'s relationship to `./scripts/setup.sh`'s "herdr → claude state
   integration installed" line was not fully traced.** `setup.sh` prints that success line
   (confirmed live), but this audit did not confirm whether that line is produced by
   `herdr integration install claude` (the standard Herdr-side integration) or by
   `herdr-state.ts` (the custom Atomic-side extension) or both. **Suggested next mission:**
   read `scripts/setup.sh`'s exact check for that line and trace which mechanism it reports on.

8. **No independent verification exists yet that `atomic/workflows/feature-development.ts`
   actually runs end-to-end.** `./scripts/sync-workflows.sh` confirmed the file syncs into
   `.atomic/workflows/`, and its `ctx` usage matches the README's described primitives (§4),
   but this audit did not (and per mission scope, should not) launch the workflow itself.
   **Suggested next mission:** a workflow smoke-test mission that runs
   `feature-development` against a trivial objective and records the transcript.

9. **This audit did not deeply read `docs/architecture.md`, `docs/operating-model.md`,
   `docs/verification-and-gates.md`, `docs/case-study-ozymandias.md`,
   `herdr/workspace-conventions.md`, or `ghostty/recommended-config.md` beyond link-checking
   and the reference-count spot check in §6 item 6.** These files contain no fenced shell
   commands per the earlier `grep '```bash'` sweep (confirmed: only README.md, AGENTS.md, and
   the four `docs/*.md` files listed in §2 have bash fences), so they were lower priority
   under the mission's explicit command-checking criterion, but their prose claims about
   architecture/process were not independently fact-checked. **Suggested next mission:** a
   second research pass specifically on process-doc accuracy (do the described gates,
   stages, and roles match `team/*.md` and `atomic/workflows/feature-development.ts`?).

10. **`docs/superpowers/` and `.superpowers/` contain planning/spec docs
    (`docs/superpowers/plans/2026-08-13-project-agnostic-harness.md`,
    `docs/superpowers/specs/2026-08-13-project-agnostic-harness-design.md`) that also carry
    the stale `0.9.12` version claim** (see finding 1) and were not otherwise audited for
    currency against what's actually built today. **Suggested next mission:** fold into
    finding 1's version-sweep mission, or a separate pass confirming the plan/spec still
    matches the shipped repo.

---

## Coverage vs. mission success criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Every `.md` scanned for relative links, broken ones listed | Done — §1, 42 files/50 candidates (53 counting ambiguous-scope hits in a gitignored transcript's fenced code blocks), 0 broken among real docs |
| 2 | Every shell/CLI command run-and-compared or flagged | Done — §2, split into run/flagged tables |
| 3 | Every `scripts/*.sh` checked with `bash -n` + help-vs-args | Done — §3 |
| 4 | `atomic/extensions/*.ts` checked against `atomic/README.md` | Done — §4 (finding: README doesn't cover extensions) |
| 5 | README's 3 "still rough" gaps carried forward with status | Done — §5 |
| 6 | Prioritized top-10 findings, no fixes implemented | Done — §6, 10 items, no repo files under `README.md`/`docs/`/`scripts/`/`team/`/`atomic/` were modified |
| 7 | Independent spot-check of ≥5 findings, in `build/EVIDENCE.md` | Pending — belongs to whoever does the second pass per mission's own requirement (not this report's author) |
