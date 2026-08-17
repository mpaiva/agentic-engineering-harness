# Mission criteria — synthesis (lead, 2026-08-16)

Maps `build/MISSION.md`'s 7 success criteria to evidence. All 7 have real, on-disk
evidence; the mission's stop rule ("every criterion has a line here or in
`build/BLOCKED.md`") is met.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Ground-truth command re-verification | PASS | `research/mission-groundtruth-2026-08-16.md` — all claims re-verified, `atomic/README.md:5` version drift fixed |
| 2 | `bash -n` / shellcheck clean | PASS | §"Static checks" below — 13/13 scripts clean, 2 real bugs found+fixed (commit `3f8f664`), 0 warnings after |
| 3 | 0 broken links across tracked docs | PASS | §"Link check" below — 40 files, 76 targets, 0 broken |
| 4 | G2/G3 closed or clearly logged blocked | PASS | G3 CLOSED (§ below, disk-verified); G2 honestly left open in `build/BLOCKED.md` with sharp diagnostics (real `DBOS` resume race found, not a shrug) |
| 5 | New reader can self-serve on timeout/stuck-pane/resume | PASS | `docs/troubleshooting.md`, linked from `README.md:256,300` and `docs/getting-started.md:139` |
| 6 | `docs/troubleshooting.md` exists, covers required topics, linked | PASS | Same file — covers intake timeout, stuck pane, unclear agent state, reading `BLOCKED.md` |
| 7 | This file records command + output per criterion | PASS | This document |

**Mission disposition: COMPLETE**, with one deliberately-open item (G2) carried forward
in `build/BLOCKED.md` rather than fabricated closed, per the mission's explicit non-goal.

---

# Evidence — live paid runs closing G2/G3 (2026-08-16)

Researcher agent. Human authorized a live paid run to close the two gaps logged in
`build/BLOCKED.md`. Both runs executed in an **isolated scratch environment**: separate
`--session-dir`, separate throwaway git-init'd scratch project directories under `/tmp`,
and `ATOMIC_INTERCOM_GROUP` / `ATOMIC_INTERCOM_SESSION_ID` / session-id env vars explicitly
unset on every spawned `atomic` subprocess so nothing joined the team's `harness` intercom
group or touched a Herdr pane. Raw JSONL run logs saved under
`build/evidence-g2-g3/` for reproducibility (git-ignored `build/`, kept here as backing
evidence for this session).

**Caveat on isolation:** both scratch runs used the default (shared)
`ATOMIC_CODING_AGENT_DIR` so the `atomic` CLI could find real provider credentials — this
means the workflow durable state was written to the same shared embedded-Postgres DBOS
instance (`atomic_workflows_dbos_sys` on `127.0.0.1:5439`) the team's live sessions use.
No Herdr pane or intercom group was touched, but the scratch runs are not
100%-storage-isolated from the team's shared DBOS backend. Flagging this for transparency
rather than silently claiming full isolation.

---

## G3 — CLOSED: a multi-stage workflow run completed end to end

**Claim now proven:** a real, live, multi-stage Atomic `goal` workflow run went from
kickoff through every stage to a `completed` terminal state, larger (more stages) than
any prior attempt recorded in `research/gap-assessment-2026-08-14.md`.

### Setup
```
$ mkdir -p /tmp/g3-scratch-1786862610/{sessions,project}
$ cd /tmp/g3-scratch-1786862610/project && git init -q && echo "# scratch project for G3 completion test" > README.md && git add -A && git commit -qm init
```

### Launch command
```
$ env -u ATOMIC_INTERCOM_GROUP -u ATOMIC_INTERCOM_SESSION_ID -u ATOMIC_SESSION_ID \
    -u ATOMIC_SESSION_FILE -u PI_SESSION_FILE -u PI_SESSION_ID \
  atomic --mode json --session-dir /tmp/g3-scratch-1786862610/sessions -p \
  '/workflow goal objective="Create a file named hello.txt in the repository root containing exactly the single line: Hello from the G3 evidence run." acceptance_criteria="hello.txt exists at repo root and contains exactly the line: Hello from the G3 evidence run." create_pr=false'
```
Run id: `449ebe1e-ae8d-4853-8840-5658b21600f2`. Full raw JSONL output (191KB):
`build/evidence-g2-g3/g3-full-run.jsonl`.

### Stages executed (from `workflow.stage.start`/`workflow.stage.end` events)
| Stage | Result |
|---|---|
| `orchestrator-1` | completed |
| `completion-reviewer-1` | completed |
| `evidence-reviewer-1` | completed |
| `risk-reviewer-1` | completed |

Orchestrator ran first, then three parallel reviewers dispatched, then the run reached a
reducer-gated terminal decision — 4 real stages, not a single-turn print.

### Terminal state (extracted from `workflow.run.end`)
```
status: completed
runId: 449ebe1e-ae8d-4853-8840-5658b21600f2
durationMs: 333523   (≈5.6 minutes wall time)
result.status: complete
result.approved: True
result.turns_completed: 1
Final decision: "Reviewer quorum met: 3/2 reviewers independently reported
  stop_review_loop=true with no reviewer execution errors."
Remaining work if incomplete: none
```

### Effect verified on disk
```
$ cat /tmp/g3-scratch-1786862610/project/hello.txt
Hello from the G3 evidence run.

$ git -C /tmp/g3-scratch-1786862610/project log --oneline -5
d037790 Add hello.txt for G3 evidence run
4a791f1 init
```
File content matches acceptance criteria exactly; the orchestrator stage made a real git
commit. No early stop, no stage skipped, run reached `completed` on its own.

**G3 disposition: CLOSED.** Removing from `build/BLOCKED.md`.

---

## G2 — STILL OPEN: crash detection proven, resume execution not proven

**What was proven:** Atomic's crash detection and resumability labeling behave exactly as
`atomic/docs/workflows.md` describes.

**What was NOT proven:** that `/workflow resume` actually continues a genuinely
interrupted run rather than restarting or no-op'ing — every attempt to execute resume
failed or was inconclusive. This gap remains open; the evidence below is what a future
attempt should build on.

### Setup + genuine mid-stage crash
```
$ mkdir -p /tmp/g2-scratch-1786862073/{agent-dir,sessions,project}
$ cd /tmp/g2-scratch-1786862073/project && git init -q && ... && git commit -qm init
$ env -u ATOMIC_INTERCOM_GROUP -u ATOMIC_INTERCOM_SESSION_ID -u ATOMIC_SESSION_ID \
    -u ATOMIC_SESSION_FILE -u PI_SESSION_FILE -u PI_SESSION_ID \
  nohup atomic --mode json --session-dir /tmp/g2-scratch-1786862073/sessions -p \
  '/workflow goal objective="Create step1.txt...step2.txt...step3.txt..." ...' &
```
Run id: `28cf824a-214a-49f2-acb4-603ae84cd576`. Waited 8s (process alive, `orchestrator-1`
stage `running`, no files created yet — confirmed via `ps` + `ls`), then:
```
$ kill -9 40564   # SIGKILL mid-stage, before any tool call completed
$ ps -p 40564          → no such process (confirmed dead)
$ ls /tmp/g2-scratch-1786862073/project   → only README.md/.git, no step*.txt
```
This is a genuine crash: no `workflow.stage.end` or `workflow.run.end` event was ever
written for this run — the process died with the stage still open.

### Crash correctly detected via fresh-process inspection
Immediately after (24s post-kill): `/workflow status <id>` from a **fresh** `atomic`
process reported `state: ● running`, `ownerActiveElsewhere: true`, `resumable: false` —
correct, because Atomic's foreign-liveness window
(`FOREIGN_LIVE_WORKFLOW_WINDOW_MS = 120_000` in
`durable/resume-eligibility.ts`) hadn't elapsed yet.

After waiting >120s from the crash (measured: 2m58s elapsed since stage start), the same
inspection command from a fresh process correctly flipped state:
```
$ atomic --mode json --session-dir <fresh-dir> -p "/workflow status 28cf824a-214a-49f2-acb4-603ae84cd576"
```
Result (full JSONL: `build/evidence-g2-g3/g2-status-crashed.jsonl`):
```
state          ✗ crashed · resumable
elapsed        2m 58s
guidance       This workflow appears to have crashed and is resumable. Resume it
               explicitly with /workflow resume 28cf824a-214a-49f2-acb4-603ae84cd576.
STAGES         ● orchestrator-1 running   2m 58s
```
**This half of G2 is proven**: Atomic accurately distinguishes a live-elsewhere run from
a genuinely crashed one using a real (not simulated) process kill, and correctly marks it
resumable.

### Resume attempts — all failed or were inconclusive

**Attempt 1-6, headless `-p` mode (fresh session-dirs, retries, multi-message warm-up,
`--continue`):** every single invocation of
`atomic --mode json --session-dir <dir> -p "/workflow resume 28cf824a-..."` failed
immediately with:
```
Extension error (command:workflow): DBOS workflow durability is not ready.
Await initializeDurableBackend() before accessing workflows.
```
(full text: `build/evidence-g2-g3/g2-resume-headless-error.log`). This reproduced 100% of
the time across 6 attempts, including one where a full prior model turn (`"say the word
ready"`) completed successfully in the same process first — ruling out "just needs more
wall-clock time before the command fires." This looks like a real race/gap in headless
`/workflow resume` command dispatch: it doesn't await backend readiness the way
`/workflow status` and the initial `/workflow <name>` launch do.

**Attempt 7-8, interactive TUI via `tmux` (not a Herdr pane — isolated):** started
`atomic --session-dir <fresh-dir>` interactively, waited for the prompt, typed
`/workflow resume 28cf824a-...` (confirmed the exact text appeared in the input box before
pressing Enter), waited up to 15s. No error, no new content, no graph overlay appeared in
the captured pane — the screen looked unchanged from before the command. A follow-up
`/workflow status <id>` in the same interactive session also showed no run
(`no workflow runs in current session`, ignoring the explicit id), inconsistent with the
headless CLI's exact-id hydration behavior for the identical id.

**Final check — did any attempt actually advance the run?** Re-queried status headless
after all attempts:
```
$ atomic --mode json --session-dir <fresh-dir> -p "/workflow status 28cf824a-..."
```
Result (`build/evidence-g2-g3/g2-status-still-crashed-after-resume-attempts.jsonl`):
```
state     ✗ crashed · resumable
elapsed   8m 4s
STAGES    ● orchestrator-1 running   8m 4s
```
**Unchanged.** No step1.txt/step2.txt/step3.txt were ever created in
`/tmp/g2-scratch-1786862073/project`. None of the 8 resume attempts (6 headless + 2
interactive) advanced the run past its crashed checkpoint.

### G2 disposition: still open

**Recommendation: keep G2 open in `build/BLOCKED.md`**, now with a much sharper
description of what's blocking it — not "nobody tried a live run" but "a live run was
tried and resume itself did not visibly execute." What would change this: either (a) a
successful interactive resume with `herdr agent explain`/pane inspection available to
watch it live (this session deliberately avoided Herdr panes per the isolation
constraint, which may have hidden a rendering/timing detail an attached pane would show),
or (b) confirmation from the Atomic maintainers/docs on whether headless `/workflow
resume` is expected to work at all, since the `--mode json --session-dir <dir> -p
'/workflow <name> ...'` pattern in the docs is demonstrated only for **launching** named
workflows, not documented with a resume example.

## Commands run this session (reproducibility)
```
mkdir -p /tmp/g2-scratch-*/{agent-dir,sessions,project}; git init; git commit
env -u ATOMIC_INTERCOM_GROUP -u ATOMIC_INTERCOM_SESSION_ID -u ATOMIC_SESSION_ID \
  -u ATOMIC_SESSION_FILE -u PI_SESSION_FILE -u PI_SESSION_ID \
  atomic --mode json --session-dir <dir> -p '/workflow goal objective="..." ...'
kill -9 <pid>
atomic --mode json --session-dir <fresh-dir> -p "/workflow status <run-id>"
atomic --mode json --session-dir <fresh-dir> -p "/workflow resume <run-id>"    (x6, all failed)
tmux new-session ...; tmux send-keys "/workflow resume <run-id>" Enter        (x2, inconclusive)
pgrep -laf atomic   # confirmed shared embedded-postgres DBOS backend at :5439
```

---

## Static checks (card: link-check-shellcheck-bash-n-sweep) — verifier

Independent evidence for mission criterion 2 (bash -n / shellcheck) and criterion 3
(link check). Every line below is my own command output, re-run in this session.

### `bash -n` — build.sh + every script under scripts/

Command:
```
cd /Users/mp/git-repos/agentic-engineering-harness
for f in build.sh scripts/*.sh; do echo "$f: $(bash -n "$f" 2>&1; echo exit=$?)"; done
```

Output:
```
build.sh: exit=0
scripts/assemble-demo.sh: exit=0
scripts/board.sh: exit=0
scripts/capture-demo.sh: exit=0
scripts/kanban.sh: exit=0
scripts/launch-feature.sh: exit=0
scripts/new-workspace.sh: exit=0
scripts/setup.sh: exit=0
scripts/status.sh: exit=0
scripts/sync-workflows.sh: exit=0
scripts/team-chat.sh: exit=0
scripts/team-status.sh: exit=0
scripts/team.sh: exit=0
```

**PASS** — `bash -n` clean on all 13 files (build.sh + 12 scripts under scripts/). Note:
`scripts/team-chat-client.mjs` is Node, not bash — not applicable to `bash -n`.

### `shellcheck` (updated after implementer commit 3f8f664)

Initially not installed on this machine. implementer installed shellcheck and fixed 2
flagged bugs in commit `3f8f664`: `scripts/setup.sh:8` unchecked `cd` (SC2164 →
`cd ... || exit 1`), `scripts/team-chat.sh:139-140` printf with 5 `%`-specifiers but 4
args, silently dropping the trailing clear-to-EOL escape (SC2183). I independently
re-ran both checks after the fix, twice, on separate requests — did not take
implementer's word for it.

Command:
```
which shellcheck && shellcheck --version
```
Output:
```
/usr/local/bin/shellcheck
ShellCheck - shell script analysis tool
version: 0.11.0
```

Command:
```
shellcheck -S warning build.sh scripts/*.sh; echo "exit=$?"
```
Output:
```
exit=0
```
**PASS — 0 warnings/errors** at warning severity or above, repo-wide.

### Update 2026-08-16 (later): cockpit.sh discovered, SC1087 errors found and fixed

`docs`'s pre-release sweep (`build/PRE-RELEASE-CHECK.md`) found `cockpit.sh` — a script not
covered by my original pass — had **6 error-severity** shellcheck findings (SC1087, unbraced
array-like expansions `$E[0m` etc. in the ANSI palette at `cockpit.sh:20`). implementer fixed
it in commit `7386410` (braced all 6 to `${E}[0m`-style). I independently re-ran both checks
against the full, now-correct file set (`build.sh cockpit.sh scripts/*.sh`) — did not take
implementer's word for it.

Command:
```
for f in build.sh cockpit.sh scripts/*.sh; do bash -n "$f" || echo "FAIL $f"; done; echo "all parsed"
```
Output:
```
all parsed
```

Command:
```
shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -c "error:"
shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -c "warning:"
```
Output:
```
0
0
```
**PASS — 0 errors, 0 warnings**, now covering all 14 shell files (build.sh, cockpit.sh, 12
scripts under scripts/). Mission criterion 2 confirmed met on the full file set.

### Update 2026-08-16 (later still): cockpit.sh "0 agent(s)" bug fixed and re-verified

docs' pre-release sweep also found `cockpit.sh` header always reported "0 agent(s)" live,
even with agents attached. Root cause: the embedded `python3 -c` snippet used `json`/`sys`
without importing them, and a bare `except Exception` swallowed the resulting `NameError`,
silently falling through to an empty agent list. implementer fixed in commit `ebc224d`
(added `import json,sys`; narrowed the except to `(ValueError, KeyError)` so a real bug
fails loud instead of hiding as "no agents"). I independently re-ran both the isolated
snippet and the full script live — did not take implementer's word for it.

Command:
```
herdr agent list 2>/dev/null | python3 -c "
import json,sys
try: a=json.load(sys.stdin)['result'].get('agents',[])
except (ValueError, KeyError): a=[]
w=sum(1 for x in a if x.get('agent_status')=='working')
b=sum(1 for x in a if x.get('agent_status') in ('blocked','unknown'))
print('AGENTS=%d;WORKING=%d;BLOCKED=%d'%(len(a),w,b))
"
```
Output:
```
AGENTS=4;WORKING=2;BLOCKED=0
```

Command:
```
./cockpit.sh 2>&1 | head -5
```
Output:
```
HARNESS  session harness
  cockpit   ● running  ·  4 agent(s), 2 working
  mission   ✓ At the end, a senior engineer who has never seen this repo
  archived  2 previous run(s) (build.prev-*)
```
**PASS** — header now correctly reads live agent counts (was "0 agent(s)" before the fix).

Command:
```
bash -n cockpit.sh && echo "bash -n: OK"
shellcheck -f gcc cockpit.sh | grep -c "error:"
shellcheck -f gcc cockpit.sh | grep -c "warning:"
```
Output:
```
bash -n: OK
0
0
```
`bash -n` clean, 0 errors, 0 warnings after this fix too.

### Update 2026-08-16 (thread 1): build.sh root_pane() occupied-pane hijack fixed and re-verified

docs' pre-release sweep found `root_pane()` in `build.sh` could select an already-occupied
pane (reproduced live: it would have hijacked the team-chat side-tab pane and started a
second Atomic lead inside it). implementer fixed in commit `c425783`: switched from
terminal-title matching (unreliable — Herdr truncates long titles) to `tab_id`-based
filtering, since every `_open_side_tab` call opens a distinct tab that can never be the
main tab. I independently re-verified by extracting the exact `python3 -c` body executed
inside `root_pane()` (byte-for-byte from `build.sh:205-226` via `sed`) and feeding it
synthetic `herdr pane list`-shaped JSON for all 3 cases implementer described, plus a live
run — did not take implementer's word for it.

Command (extraction, confirms python body matches the committed diff exactly):
```
sed -n '/^root_pane(){/,/^}/p' build.sh | sed -n '/python3 -c "/,/^"$/p' | sed '1d;$d' > /tmp/root_pane_body.py
```

**Case A — fresh single free pane, no labels, no side tabs:**
```
$ echo '{"result":{"panes":[{"pane_id":"w1:p1","tab_id":"w1:t1","label":null,"agent_status":"unknown"}]}}' | python3 -c "$(cat /tmp/root_pane_body.py)"
w1:p1
exit=0
```
Expected: found. **PASS.**

**Case B — resume: free main-tab pane alongside an unlabelled side-tab pane (different tab_id):**
```
$ echo '{"result":{"panes":[{"pane_id":"w1:p1","tab_id":"w1:t1","label":"lead","agent_status":"idle"},{"pane_id":"w1:p2","tab_id":"w1:t1","label":null,"agent_status":"unknown"},{"pane_id":"w1:p3","tab_id":"w1:t2","label":null,"agent_status":"unknown"}]}}' | python3 -c "$(cat /tmp/root_pane_body.py)"
w1:p2
exit=0
```
Expected: main-tab pane `w1:p2` found, side-tab `w1:p3` ignored. **PASS.**

**Case C — only-side-tab-free (the exact bug repro): main tab fully occupied, side tab free:**
```
$ echo '{"result":{"panes":[{"pane_id":"w1:p1","tab_id":"w1:t1","label":"lead","agent_status":"idle"},{"pane_id":"w1:p2","tab_id":"w1:t1","label":"implementer","agent_status":"working"},{"pane_id":"w1:p3","tab_id":"w1:t2","label":null,"agent_status":"unknown"}]}}' | python3 -c "$(cat /tmp/root_pane_body.py)"
exit=1
```
Expected: no match — side tab must NOT be selected. **PASS** (this is the exact bug the fix
closes: before the fix this case would have returned `w1:p3` and hijacked the side tab).

**Live run against the current, fully-occupied session:**
```
$ herdr pane list 2>/dev/null | python3 -c "$(cat /tmp/root_pane_body.py)"
live exit=1
```
Expected: no candidate, since every main-tab pane in this live session is already occupied
by a labelled agent. **PASS.**

Command:
```
bash -n build.sh && echo "bash -n: OK"
shellcheck -f gcc build.sh | grep -c "error:"
shellcheck -f gcc build.sh | grep -c "warning:"
```
Output:
```
bash -n: OK
0
0
```

**All 4 cases confirm the fix: `root_pane()` never selects an occupied main-tab pane or a
side-tab pane, and still finds a genuinely free main-tab pane when one exists.**

### Update 2026-08-16: launch-feature.sh --live doc advice fixed (herdr agent name-vs-pane)

docs' pre-release finding: `docs/troubleshooting.md` already documents that `herdr agent
get/read/wait/explain <role-name>` return `agent_not_found` and only `<pane-id>` resolves
(section 6 of `build/PRE-RELEASE-CHECK.md`, reproduced live there). `scripts/launch-feature.sh`'s
`--live` mode heredoc advice repeated the broken `<name>` form for `prompt`/`wait`.
implementer fixed in commit `5b8db8d`: descriptive text only (the branch exits before
executing), changed to `<pane>` with an explanatory note. Confirmed via `git show
5b8db8d` — diff matches exactly what the commit message describes, and is consistent
with docs' independently-reproduced live finding. Low-risk (doc text, not executed
code) — re-checked build integrity, not live herdr behavior again (already proven
elsewhere in this file).

Command:
```
bash -n scripts/launch-feature.sh && echo "bash -n: OK"
shellcheck -f gcc scripts/launch-feature.sh | grep -c "error:"
shellcheck -f gcc scripts/launch-feature.sh | grep -c "warning:"
```
Output:
```
bash -n: OK
0
0
```
**PASS.**





Command (full severity, including info-level style notes):
```
shellcheck build.sh scripts/*.sh
```
Output (only info-level notes remain, none blocking):
```
scripts/team.sh:84  SC2012 (info): Use find instead of ls to better handle non-alphanumeric filenames.
scripts/team.sh:92  SC2012 (info): Use find instead of ls to better handle non-alphanumeric filenames.
scripts/team.sh:114 SC2016 (info): Expressions don't expand in single quotes, use double quotes for that.
scripts/team.sh:115 SC2016 (info): Expressions don't expand in single quotes, use double quotes for that.
scripts/team.sh:159 SC2016 (info): Expressions don't expand in single quotes, use double quotes for that.
exit=0
```
3 info-level notes (ls-vs-find, single-quote literal), 0 warning/error-level issues.
Re-ran `bash -n` on all 13 files after the fix too — still 13/13 clean.

**Mission criterion 2: PASS.**

### Link check — relative Markdown links, `<img src>`, `href` across the repo

Method: Python script scanning every tracked `*.md` file (git-ignored dirs excluded —
`build/`, `build-*/`, `.superpowers/`, `.atomic/`, `.git/`, `node_modules/`), extracting
`[text](target)`, `<img src="target">`, `href="target"`, skipping absolute URLs/mailto/
anchors, resolving the rest relative to each file's own directory (or repo root for a
leading `/`), and checking existence on disk.

Command:
```
python3 /tmp/linkcheck.py
```

Output:
```
Files scanned: 40
Link/img/href targets checked (relative only): 76
Broken: 0
```

**PASS** — 0 broken relative links/images/hrefs across all 40 tracked Markdown files
(README.md, docs/*.md, herdr/*.md, atomic/README.md, ghostty/*.md, research/*.md,
specs/*.md, team/*.md, AGENTS.md).

Note: an earlier scan pass that did not exclude `.superpowers/` (git-ignored, not
committed source — confirmed via `git check-ignore -v .superpowers/render-demo-report.md`)
found 3 "broken" hits in `.superpowers/render-demo-report.md`, a captured terminal-log
report referencing `docs/media/build-demo.gif` as CWD-relative shell output, not a real
repo-relative Markdown link. Excluded as out of scope (not a tracked doc); real path
`docs/media/build-demo.gif` exists and resolves fine from every actual doc reference.

**Mission criterion 3: PASS.**

---

# Team tab — hired profiles + available-unhired roles (2026-08-16)

Card `team-tab-hired-available-unhired-profile`. Spec: `build/VISUAL-COMMS-SPEC.md` §3.
Researcher drafted and tested the logic; implementer lands the edit into
`scripts/team-status.sh`. Tested block saved at `build/team-tab-rollup.draft.py`.

## §3.1 — one-line profile per hired crew member (role, owns, task, status)

```
$ herdr --session harness agent list 2>/dev/null \
    | COLUMNS=100 HERE="$PWD" BUILD="$PWD/build" python3 build/team-tab-rollup.draft.py
  ON THE JOB — hired for this mission

  ● researcher   WORKING  w1:p3  Decision-ready evidence: p… │ team tab: hired + available-unhir…
  ● implementer  WORKING  w1:p4  Writing the actual code     │ kanban tab: per-member task track…
  ● docs         WORKING  w1:p5  README, usage docs, exampl… │ chat tab: plain-language status l…
  ○ lead         IDLE     w1:pB  Mission, delegation, sign-… │ (last card done)
  ○ verifier     IDLE     w1:p6  Independent, fresh-context… │ (last card done)
```
Four required fields present on one line each: role (chip), status, owns, current task.
Sources are live, not assumed — role/status/pane from `herdr agent list` JSON; `owns` from
the `team/ROLES.md` Owns column; current task from `build/BOARD/*.md` cards matched on
`owner:`, ranked working > blocked > waiting > done.

Re-rendered at a narrow side-tab width to confirm the layout degrades rather than wraps:
```
$ ... | COLUMNS=70 ... python3 build/team-tab-rollup.draft.py
  ● researcher   WORKING  w1:p3  Decision-rea… │ team tab: hired +…
  ○ lead         IDLE     w1:pB  Mission, del… │ (last card done)
```

## §3.2 — available-but-not-hired section with a one-line "when to hire"

```
  AVAILABLE, NOT HIRED — in the role library, not on this mission

  ○ pm             hire when  The mission has real product judgment in it — competing features, u…
  ○ architect      hire when  More than two components must agree on a shape, or the design has a…
  ○ designer       hire when  The mission has a human-facing surface: a UI, a CLI's ergonomics, a…
  ○ accessibility  hire when  The mission builds a graphical user interface.
  ○ devops         hire when  The mission says how it must be built, packaged, deployed, or run i…
```
Each line's text is the first sentence of that role's "Hire when" column in
`team/ROLES.md` — grounded in the role library, not paraphrased.

## §3.3 — the two sections never overlap

Section 2 is computed as `set(ROLES.md roles) − set(hired agent names)`, so disjointness
is structural, not a convention. Verified against live data:
```
$ herdr --session harness agent list | python3 -c "<set-difference check>"
ROLES.md roles      : ['pm','researcher','architect','implementer','designer','accessibility','verifier','devops','docs']
hired (agent list)  : ['docs','implementer','lead','researcher','verifier']
section2 (available): ['pm','architect','designer','accessibility','devops']
OVERLAP             : []          <- must be empty
lead in ROLES.md?   : False       (lead is not a hireable specialist role)
```
`lead` appears in `agent list` but not in `team/ROLES.md`, so it is special-cased with a
fixed "Mission, delegation, sign-off" owns string and can never fall into section 2.

**Status: logic verified by researcher against live data; awaiting implementer's edit to
`scripts/team-status.sh` and verifier's independent re-run of the shipped script.**

---

# §2 Kanban tab — per-member task tracking (card: kanban-tab-per-member-task-tracking, implementer)

## §2.3 — cards missing an owner are impossible to create

The spec assumed `board.sh add` already required `--owner`. Confirming against the shipped
script showed it did **not** — an ownerless card was creatable. Fixed (commit `2cf6f7c`),
then re-verified:

**Before (pre-2cf6f7c) — ownerless card created silently:**
```
$ BOARD_DIR=$(mktemp -d)/BOARD ./scripts/board.sh add --title "test no owner"
test-no-owner                      # exit 0
$ cat .../test-no-owner.md
stage: research
status: waiting
owner:                             # <- blank owner, no error
---
test no owner
```

**After (2cf6f7c) — `--owner` required:**
```
$ BOARD_DIR=$(mktemp -d)/BOARD ./scripts/board.sh add --title "orphan card"
add needs --owner (every card must name a crew member)
exit=2
$ BOARD_DIR=$(mktemp -d)/BOARD ./scripts/board.sh add --title "owned card" --owner researcher
owned-card
exit=0
```

## §2.1 — every card shows its owner in the view without opening the file

`scripts/kanban.sh` already renders an owner chip on every card (`kanban.sh` render awk:
`put(c, boxline(sglyph(ss) " " (ow!="" ? chip(ow) : DIM "—" R), bord));`). Confirmed live —
cards display coloured owner chips (`implem`, `verifi`, `lead`, …) alongside the status
glyph. No change needed for this criterion.

## §2.2 — a stakeholder can answer "what is X working on right now" from the board alone

Added a `NOW` view (commit `2cf6f7c`): a pinned one-line strip in the live TUI and a
labelled block in the piped/non-interactive render, both listing `owner -> task` for every
`working`-status card. Live piped output against the current board:
```
$ ./scripts/kanban.sh | sed 's/\033\[[0-9;]*m//g' | grep -A5 "NOW WORKING"
NOW WORKING  (3 in progress)
  docs -> chat tab: plain-language status lines
  implementer -> kanban tab: per-member task tracking
  implementer -> team tab: hired + available-unhired profiles
```

## Static checks
```
$ bash -n scripts/board.sh scripts/kanban.sh          # exit 0 both
$ shellcheck -f gcc scripts/board.sh scripts/kanban.sh | grep -Ec "error:|warning:"
0
```

## §2 — verifier independent re-run (2026-08-16)

I re-ran every claim above myself against commit `2cf6f7c` — did not take implementer's
word for it. Used an isolated `BOARD_DIR` so the live team board was never touched
(confirmed: still 12 cards after testing).

**Claim 1 — `board.sh add` now requires `--owner`:**
```
$ TMPB=$(mktemp -d)/BOARD
$ BOARD_DIR="$TMPB" ./scripts/board.sh add --title "no owner test"
add needs --owner (every card must name a crew member)
exit=2

$ BOARD_DIR="$TMPB" ./scripts/board.sh add --title "owner test" --owner verifier
owner-test
exit=0

$ BOARD_DIR="$TMPB" ./scripts/board.sh list
owner-test                       research        waiting  verifier     owner test
```
**PASS** — ownerless card refused with exit 2 and a clear message; owned card created.

**Real board untouched during testing:**
```
$ ls build/BOARD/ | wc -l
12
```
**PASS.**

**Claim 2 — NOW view, cross-checked against the board (not just eyeballed):**
```
$ ./scripts/kanban.sh | sed 's/\x1b\[[0-9;]*m//g' | grep -A8 "NOW WORKING"
NOW WORKING  (3 in progress)
  docs -> chat tab: plain-language status lines
  verifier -> kanban tab: per-member task tracking
  implementer -> team tab: hired + available-unhired profiles

$ ./scripts/board.sh list | awk '$3=="working"'
chat-tab-plain-language-status-lines     implementation working docs        chat tab: plain-language status lines
kanban-tab-per-member-task-tracking      verification   working verifier    kanban tab: per-member task tracking
team-tab-hired-available-unhired-profile implementation working implementer team tab: hired + available-unhired profiles
```
**PASS** — the NOW view's 3 owner→task pairs match the board's 3 `working` cards exactly.
Count in the header (`3 in progress`) matches too. This is a real cross-check, not a
re-read of the same render.

**Owner chip per card (criterion 1) — confirmed present in the live render:**
```
│ kanban     │  │ re-verify  │  │ link-check │
│ tab:…      │  │ ground-tr… │  │ +…         │
│ ●  verifi  │  │ ✓  verifi  │  │ ✓  verifi  │
```
Every card carries a status glyph + owner. **PASS.**

**`now_line` (pinned TUI strip) exists as claimed, not just the piped block:**
```
$ grep -n "now_line\|now_block" scripts/kanban.sh
140:now_line(){
147:now_block(){
163:  now_block
223:  now="NOW  $(now_line)"; now="$(printf '%s' "$now" | cut -c1-"$COLS")"
```
Line 223 pins it above the status bar in the interactive path; line 163 appends the block
in the piped path. **PASS** (code path confirmed; interactive TUI rendering itself not
re-driven — piped output verified directly above).

**Static checks re-run:**
```
$ bash -n scripts/board.sh && bash -n scripts/kanban.sh && echo "bash -n: OK both"
bash -n: OK both
$ shellcheck -f gcc scripts/board.sh scripts/kanban.sh | grep -c "error:"
0
$ shellcheck -f gcc scripts/board.sh scripts/kanban.sh | grep -c "warning:"
0
```
**PASS.**

**§2 disposition: VERIFIED.** All claims independently reproduced.

---

# Chat tab — plain-language status lines (card `chat-tab-plain-language-status-lines`)

Owner: `docs`. Spec: `build/VISUAL-COMMS-SPEC.md` §1. Date: 2026-08-16.
Verified against Herdr 0.8.0, Atomic 0.9.13, jq present, macOS awk.

## What changed

`scripts/team-chat.sh` `render()` now emits a **plain-language summary line** as the first line
of each message box: one sentence naming who acted, on whom, and what happened, with every
identifier glossed. The raw message prints underneath, unmodified, whenever it carries anything
the summary does not — so the box shows the raw event beside its rendered line (§1 criterion 2)
and the original wording is never hidden.

## §1 criterion 2 — raw event beside its rendered line

Raw feed event (one line of `build/team-chat.log`, JSONL):

```json
{"ts":"2026-08-16T09:02:00Z","from":"docs","to":"lead","action":"reply","message":"Card chat-tab-plain-language-status-lines is done in c425783. Verified against w1:p6 after agent_not_found; see docs/troubleshooting.md:42 or rerun with --resume."}
```

Rendered BEFORE this change (`git show HEAD:scripts/team-chat.sh`, same feed, COLUMNS=100):

```text
│  docs  →  lead    REPLY   09:02                                                                │
│ Card chat-tab-plain-language-status-lines is done in c425783. Verified against w1:p6 after     │
│ agent_not_found; see docs/troubleshooting.md:42 or rerun with --resume.                        │
```

Rendered AFTER:

```text
│  docs  →  lead    REPLY   09:02                                                                │
│ docs replied to lead: Card "chat tab plain language status lines" is done in change c425783.   │
│ ────────────────────────────────────────────────────────────────────────────────────────────── │
│ Card chat-tab-plain-language-status-lines is done in c425783. Verified against w1:p6 after     │
│ agent_not_found; see docs/troubleshooting.md:42 or rerun with --resume.                        │
```

The first line is now readable by someone who does not know what a sha, a pane id, or a card
slug is. The raw line is still there, one line below.

## §1 criterion 1 — every gloss rule, exercised

Synthetic feed covering all seven rules, rendered at COLUMNS=104:

| Raw token | Rendered as | Rule |
|---|---|---|
| `c425783` | `change c425783` | commit sha (7–40 hex, must contain a digit) |
| `0617ce5c-32e0-…-bfd9f0f724c6` | `a run id` | run uuid |
| `w1:p6` | `pane w1:p6` | herdr pane id |
| `--resume` | `the --resume option` | cli flag |
| `docs/troubleshooting.md:42` | `docs/troubleshooting.md line 42` | file:line |
| `agent_not_found` | `"agent not found"` | snake_case error code |
| `chat-tab-plain-language-status-lines` | `"chat tab plain language status lines"` | card/stage slug (3+ hyphens) |

```text
│ lead told docs: Run ./build.sh the --resume option to recover; see docs/troubleshooting.md line 42 │
│ verifier asked lead: Run a run id failed with "agent not found" on pane w1:p6.                     │
│ docs replied to lead: Card "chat tab plain language status lines" is done in change c425783.       │
│ pm told human: This is plain-English prose with read-only hyphens and no jargon at all.            │
```

The fourth line is the negative control: ordinary hyphenated English (`plain-English`,
`read-only`, 1 hyphen each) is left alone by the 3-hyphen slug threshold, and because glossing
changed nothing the redundant raw body is suppressed.

**Honest note:** `Run ./build.sh the --resume option` reads slightly clumsily in that synthetic
sentence. It is unambiguous and non-technical, which is the criterion, but the phrasing is not
elegant in every grammatical context.

## No false positives on live data

Every sha the renderer glossed across the real 106-message feed was checked against git:

```
$ COLUMNS=200 ./scripts/team-chat.sh | grep -oE "change [0-9a-f]{7,}" | sort -u \
    | while read -r _ s; do git cat-file -t "$s" >/dev/null 2>&1 && echo "$s real" || echo "$s FALSE POSITIVE"; done
2cf6f7c real   374c111 real   3f8f664 real   7386410 real
c14ea50 real   c425783 real   ebc224d real
```

7/7 real commits, 0 false positives.

## Rendering integrity across the whole live feed

```
$ COLUMNS=92 ./scripts/team-chat.sh 2>&1 >/dev/null | head -3
                                    (empty — no awk errors on any of the 106 messages)

$ COLUMNS=92 ./scripts/team-chat.sh | <strip ANSI> | <count visible chars of every box line>
{90: 1378}                          (all 1378 box lines exactly 90 wide — borders align)
```

Two defects were found and fixed during this work, both introduced by the first draft:

1. **`towc: multibyte conversion failure`** — the script's `cwidth()` counts UTF-8 continuation
   bytes by hand, i.e. it was written for a byte locale, but awk was running multibyte. A
   `substr()` could then yield half a character, and regex-matching that byte aborted the
   record. Fixed by running the awk stage under `LC_ALL=C`, which restores the contract the
   surrounding code already assumed.
2. **Leading punctuation defeated the gloss** — `(c14ea50,` never matched the sha rule because
   only trailing punctuation was stripped. Now stripped from both ends and reattached.

## Degradation paths

```
$ TEAMCHAT_FEED=<empty file> ./scripts/team-chat.sh      → exit 0
$ TEAMCHAT_FEED=<missing path> ./scripts/team-chat.sh    → exit 0 (feed created on demand)
$ PATH=<no jq> ./scripts/team-chat.sh                    → falls back to raw feed, exit 0
$ ./scripts/team-chat.sh | cat                           → renders once and exits (unchanged)
```

## Static checks

```
$ bash -n scripts/team-chat.sh                                  → clean
$ shellcheck -f gcc scripts/team-chat.sh | grep -cE "error:|warning:"
0
```

## Pre-existing defect found, NOT fixed here (out of card scope)

One malformed line blanks the entire chat tab. `jq` aborts at the first parse error and emits
nothing after it:

```
$ printf 'not json\n{"ts":"…","from":"a","action":"send","message":"ok c425783 here."}\n' > m.log
$ jq -r '[(.from//"?"),(.message//"")]|join("|")' m.log
jq: parse error: Invalid numeric literal at line 1, column 4
                                    (the valid second line is never rendered)
```

This is pre-existing — the `jq` invocation is unchanged by this card (my diff touches the awk
stage and adds `LC_ALL=C`). Reported to `lead` rather than fixed, since script hardening is
`implementer`'s lane. Contained fix would be reading raw lines and skipping unparseable ones
(`jq -R -r 'fromjson? | …'`).

## §1 — verifier independent re-run (2026-08-16)

I re-ran every claim above myself against commit `9a9907b` — did not take docs' numbers as
given. The live feed grew from 106 to 114 messages between docs' run and mine, so counts
scale accordingly; that is expected, not drift.

**Static checks:**
```
$ bash -n scripts/team-chat.sh && echo "bash -n: OK"
bash -n: OK
$ shellcheck -f gcc scripts/team-chat.sh | grep -c "error:"
0
$ shellcheck -f gcc scripts/team-chat.sh | grep -c "warning:"
0
```
**PASS.**

**No awk errors across the whole live feed:**
```
$ wc -l < build/team-chat.log
114
$ COLUMNS=92 ./scripts/team-chat.sh 2>&1 >/dev/null | head -5
                                    (empty — no awk/stderr output on any of the 114 messages)
```
**PASS** — docs' "106 messages, no awk errors" reproduces at 114.

**Box-line rendering integrity:**
```
$ COLUMNS=92 ./scripts/team-chat.sh | <strip ANSI> | grep -E '^[│╭╰]' | <count visible chars>
{90: 1449}
```
**PASS** — all 1449 box lines exactly 90 visible chars, single width, borders align.
(docs measured 1378 at 106 messages; 1449 at 114 is the same invariant on a longer feed.)

**Every glossed sha is a real commit:**
```
$ COLUMNS=200 ./scripts/team-chat.sh | grep -oE "change [0-9a-f]{7,}" | sort -u \
    | while read -r _ s; do git cat-file -t "$s" >/dev/null 2>&1 && echo "$s real ($(git cat-file -t $s))" || echo "$s FALSE-POSITIVE"; done
2cf6f7c real (commit)   374c111 real (commit)   3f8f664 real (commit)
7386410 real (commit)   c14ea50 real (commit)   c425783 real (commit)
ebc224d real (commit)
```
**PASS** — 7/7 real commits, 0 false positives, independently confirmed via `git cat-file`.

**Degradation paths:**
```
$ TEAMCHAT_FEED=<empty file> ./scripts/team-chat.sh     → exit 0, no crash
```
**PASS.**

### NEW FINDING (non-blocking, cosmetic): double-glossing when the source word is already there

Not caught in docs' write-up. The gloss inserts its plain-language word without checking
whether the message already used it, producing a redundant pair:

```
$ grep -coE "change [0-9a-f]{7,}" <render>          # all glossed shas
14
$ grep -coE "commit change [0-9a-f]{7,}" <render>   # …of which read "commit change <sha>"
6

$ grep -coE "pane w1:p[0-9]+" <render>              # all glossed pane ids
7
$ grep -coE "pane pane w1:p[0-9]+" <render>         # …of which read "pane pane w1:pN"
1
```
Live examples from the rendered feed:
```
│ …after your commit change 3f8f664 — setup.sh unchecked cd…
│ …running these two commands via Bash: herdr pane send-text pane w1:p1 "/name lead"
```
6 of 14 sha glosses and 1 of 7 pane glosses read redundantly. **Non-blocking:** the spec
criterion is that no bare id is left unglossed, and that still holds — every id is glossed,
none are missed, and the meaning is never wrong, only wordy. Owner is `docs`; a contained
fix would skip the gloss word when the preceding token already supplies it.

### Confirmed docs' reported pre-existing jq defect — and sharpened the repro

docs reported that one malformed line blanks the tab. Confirmed, with the ordering
dependency made explicit:
```
# malformed line FIRST:
$ printf 'not json\n{"ts":"x","from":"a","action":"send","to":"b","message":"ok c425783 here."}\n' > m.log
$ TEAMCHAT_FEED=m.log ./scripts/team-chat.sh
                                    (completely blank — the valid line is never rendered; exit 0)

# malformed line SECOND:
$ printf '{"ts":"x","from":"a","action":"send","to":"b","message":"ok"}\nNOT VALID JSON\n' > m2.log
$ TEAMCHAT_FEED=m2.log ./scripts/team-chat.sh
╭──────────────────────────────────────────────╮
│  a  →  b    SEND   x                         │
│ a told b: ok                                 │
╰──────────────────────────────────────────────╯
```
So it is worse than "one bad line drops one message": a bad line **first** silently blanks
the entire tab and still exits 0. Pre-existing (`jq` invocation untouched by this card),
`implementer`'s lane to fix. Exit 0 on a blank render is the dangerous part — nothing
signals failure.

**§1 disposition: VERIFIED.** All of docs' claims reproduce independently. Two follow-ups
logged above (1 new cosmetic gloss defect, 1 confirmed+sharpened pre-existing jq defect),
neither blocking this card.

---

# §4 Workflows tab — ETA + complexity forecast (card: workflows-tab-eta-complexity-forecast, implementer)

Implemented in `scripts/workflow-tab.sh` (commit `0510e35`). The tab already showed each
stage's status + duration and the real `parentIds` topology; this adds the forecast.

## §4.2 — detailed stage-by-stage status + §4.1 forecast, live against the 3 registered runs

```
$ ./scripts/workflow-tab.sh | sed 's/\033\[[0-9;]*m//g'
  RUN                                   NAME               STATUS      DURATION  STAGES   LAUNCHED BY
  ────────────────────────────────────  ─────────────────  ──────────  ────────  ───────  ──────────────────
> 1) 679f494d-e3b0-4650-b794-1f632d9fb1  classify-and-act   ✓ completed  17s       2/2      lead
  2) 449ebe1e-ae8d-4853-8840-5658b21600  goal               ✓ completed  5m 34s    4/4      researcher (scratch, G3 evidence)
  3) 28cf824a-214a-49f2-acb4-603ae84cd5  goal               ✗ crashed    0s        0/1      researcher (scratch, G2 evidence)

    forecast: 2/2 stages done   |   0 remaining   |   ETA complete in 17s
    ✓ classifier  completed  5s  [low]
         └─ ✓ action-factual  completed  12s  [med]

    forecast: 4/4 stages done   |   0 remaining   |   ETA complete in 5m 34s
    ✓ orchestrator-1  completed  2m 3s  [med]
         ├─ ✓ completion-reviewer-1  completed  2m 36s  [med]
         ├─ ✓ evidence-reviewer-1  completed  3m 30s  [med]
         └─ ✓ risk-reviewer-1  completed  2m 14s  [med]

    forecast: 0/1 stages done   |   1 remaining   |   ETA run crashed, no further stages
    ● orchestrator-1  running  0s
```
Every stage shows glyph + status + real elapsed time (§4.2 — not just an overall %); a
`STAGES done/total` column is added to the list; each run carries a forecast line (§4.1).

## §4.3 — ETA is derived from real data, never fabricated

No registered run is currently mid-flight, so the ETA-extrapolation and zero-data paths
cannot be shown from the live runs above (all are terminal). Proven instead against the
**exact shipped python** (extracted from `scripts/workflow-tab.sh` with `awk`, `$SEP`
replaced by `|`) fed synthetic `message_end` JSON:

```
# TEST A — running run, 3 of 5 stages completed (durations 10s, 45s, 20s):
$ ... | python3 <shipped query_one python> demo-runid
FCAST| forecast: 3/5 stages done   |   2 remaining   |   ETA ~50s (avg 25s/stage x 2 left)
TREE | ✓ stage-a  completed  10s  [low]
TREE |      ├─ ✓ stage-b  completed  45s  [high]
TREE |      ├─ ✓ stage-c  completed  20s  [med]
TREE |      ├─ ● stage-d  running  0s
TREE |      └─ ○ stage-e  pending  0s

# TEST B — running run, 0 stages completed:
FCAST| forecast: 0/2 stages done   |   2 remaining   |   ETA no data yet (0 stages completed)
TREE | ● stage-a  running  0s
TREE |      └─ ○ stage-b  pending  0s
```
- ETA in Test A = mean of real completed durations ((10+45+20)/3 = 25s) × 2 remaining = 50s
  — extrapolated from actual elapsed time, labeled as an average estimate.
- Test B has no completed stage, so it reports `no data yet` rather than any fixed number
  (§4.3 — never fabricated).
- Complexity is relative to the median completed duration (20s): 10s ≤ 0.5× → low, 45s ≥ 2×
  → high, 20s → med. Pending/running stages with no measured elapsed time get **no** label.

## Static checks
```
$ bash -n scripts/workflow-tab.sh                                      # exit 0
$ shellcheck -f gcc scripts/workflow-tab.sh | grep -Ec "error:|warning:"
0
```

**Status: implemented + self-verified (commit 0510e35). Awaiting verifier's independent
re-run against the live registry.**

## Follow-up (lead, non-blocking): redundant double-glossing — FIXED

Lead reported the gloss repeating a noun the author already wrote: `commit change 3f8f664`
(6/14 sha glosses) and `pane pane w1:p1` (1/7). Measured before the fix:

```
$ COLUMNS=200 ./scripts/team-chat.sh | <strip ANSI> | grep -oiE "[a-z]+ (change [0-9a-f]{7,}|pane w[0-9]+:p[0-9A-Za-z]+)" | sort | uniq -c
   3 commit change 3f8f664      2 pane pane w1:p1
   1 in change c425783          1 into pane w1:p1      ← these read correctly, must NOT change
```

**Fix.** `glosstok()` now receives the preceding and following token. A rule adds its noun only
when the sentence does not already supply it. Only exact synonyms suppress it, so `in c425783`
→ `in change c425783` is deliberately left alone.

| Rule | Suppressed when | Result |
|---|---|---|
| sha | previous word is `commit`/`change`/`sha`/`revision` | `in commit 3f8f664` |
| pane id | previous word is `pane` | `Check pane w1:p1` |
| run uuid | previous word is `run` | `See run id` |
| cli flag | previous is `the` and/or next is `option`/`flag`/`switch` | `Use the --resume option` |

Verified on a synthetic feed exercising both the redundant and the non-redundant form of every
rule in one sentence each:

```text
│ a told b: Fixed in commit 3f8f664 and also at change c14ea50 plus in change 374c111.        │
│ a told b: Check pane w1:p1 and send keys pane w1:p4 then look into pane w1:p6.              │
│ a told b: Use the --resume option or just the --resume option alone.                        │
│ a told b: Commit 9a9907b landed; sha ebc224d too.                                           │
│ a told b: See run id and a run id again.                                                    │
```

Every redundant case is suppressed; every case where the noun was genuinely missing still gets
it.

**A bug found while fixing it:** `next` is an awk keyword, so `function glosstok(t,prev,next,…)`
is a syntax error that blanks the entire tab (`awk: syntax error … 11 missing ]'s`). Renamed to
`nxt`. This is exactly the failure mode where a summary-only check would have passed while the
tab rendered nothing — caught by running it.

### Post-fix state, live 106-message feed

```
$ COLUMNS=92 ./scripts/team-chat.sh 2>&1 >/dev/null | head -3
                              (empty — no awk errors)
$ <count visible chars of every box line>
{90: 1550}                    (all 1550 box lines exactly 90 wide)
$ <count redundant phrasings in summary lines only>
0
$ <check every glossed sha against git cat-file>
                              (no false positives)
```

The two live matches for `commit change` / `pane pane` that remain in the rendered output are
inside the bodies of the lead's and verifier's own messages *reporting this defect* — quoted
text, not new glosses. Confirmed by matching summary lines only.

```
$ bash -n scripts/team-chat.sh                                  → clean
$ shellcheck -f gcc scripts/team-chat.sh | grep -cE "error:|warning:"
0
```

## §4 — verifier independent re-run (2026-08-16)

I re-ran every §4 claim myself against commit `0510e35` — did not take implementer's
numbers as given.

**Static checks:**
```
$ bash -n scripts/workflow-tab.sh && echo "bash -n: OK"
bash -n: OK
$ shellcheck -f gcc scripts/workflow-tab.sh | grep -c "error:"
0
$ shellcheck -f gcc scripts/workflow-tab.sh | grep -c "warning:"
0
```
**PASS.**

**Live render against the 3 registered runs:**
```
$ ./scripts/workflow-tab.sh | sed 's/\x1b\[[0-9;]*m//g'
  RUN                                   NAME               STATUS      DURATION  STAGES   LAUNCHED BY
> 1) 679f494d-e3b0-4650-b794-1f632d9fb1  classify-and-act   ✓ completed  17s       2/2      lead
  2) 449ebe1e-ae8d-4853-8840-5658b21600  goal               ✓ completed  5m 34s    4/4      researcher (scratch, G3 evidence)
  3) 28cf824a-214a-49f2-acb4-603ae84cd5  goal               ✗ crashed    0s        0/1      researcher (scratch, G2 evidence)

    forecast: 2/2 stages done   |   0 remaining   |   ETA complete in 17s
    ✓ classifier  completed  5s  [low]
         └─ ✓ action-factual  completed  12s  [med]

    forecast: 4/4 stages done   |   0 remaining   |   ETA complete in 5m 34s
    ✓ orchestrator-1  completed  2m 3s  [med]
         ├─ ✓ completion-reviewer-1  completed  2m 36s  [med]
         ├─ ✓ evidence-reviewer-1  completed  3m 30s  [med]
         └─ ✓ risk-reviewer-1  completed  2m 14s  [med]

    forecast: 0/1 stages done   |   1 remaining   |   ETA run crashed, no further stages
    ● orchestrator-1  running  0s
```
**PASS** — STAGES done/total column, per-run forecast line, and per-stage complexity all
render as claimed.

**Cross-checks against independent facts (not just re-reading the tab's own output):**
- Run 1 arithmetic: stages 5s + 12s = 17s, matches the DURATION column and `ETA complete in 17s`.
- Run 2 topology: orchestrator 2m3s then 3 parallel reviewers (longest 3m30s) → 123s+210s ≈ 334s
  = the reported 5m 34s. Consistent with a fan-out, i.e. the durations are real, not summed blindly.
- Run 3 matches `researcher`'s independent G2 evidence in this same file exactly: run
  `28cf824a…`, `orchestrator-1` left `running`, run crashed, 0 stages completed.

**Untested ETA paths — re-proved against the EXACT shipped python, not a reimplementation.**
Extracted the real 114-line `query_one` python body straight out of the script and fed it
synthetic Atomic-shaped JSON:
```
$ sed -n '/^query_one(){/,/^}/p' scripts/workflow-tab.sh \
    | sed -n '/python3 -c "/,/^" "\$run_id"/p' | sed '1d;$d' > /tmp/wf_body.py   # 114 lines
```

*Test A (my reconstruction — see retraction below; I used durs 20s/25s/30s, NOT implementer's
documented 10s/45s/20s), 3/5 stages done, 2 remaining:*
```
TEST-A|synthetic|running|75000|5|3|2
FCAST|forecast: 3/5 stages done   |   2 remaining   |   ETA ~50s (avg 25s/stage x 2 left)
TREE|✓ stage-1  completed  20s  [med]
TREE|     └─ ✓ stage-2  completed  25s  [med]
TREE|         └─ ✓ stage-3  completed  30s  [med]
TREE|             └─ ● stage-4  running  0s
TREE|                 └─ ○ stage-5  pending  0s
```
**PASS** — extrapolation path produces exactly `ETA ~50s (avg 25s/stage x 2 left)` as claimed.
Note running/pending stages correctly carry **no** complexity label.

*Test B — running run, 0 completed stages:*
```
TEST-B|synthetic-b|running|4000|2|0|2
FCAST|forecast: 0/2 stages done   |   2 remaining   |   ETA no data yet (0 stages completed)
```
**PASS** — says "no data yet", never invents a number (§4.3 honoured).

*Test C (mine, an additional third case) — low/med/high spread:*
```
TEST-C|spread|completed|112000|4|3|1
FCAST|forecast: 3/4 stages done   |   1 remaining   |   ETA complete in 1m 52s
TREE|✓ tiny-stage  completed  2s  [low]
TREE|     └─ ✓ mid-stage  completed  20s  [med]
TREE|         └─ ✓ huge-stage  completed  1m 30s  [high]
TREE|             └─ ○ never-ran  pending  0s
```
Median basis of [2s, 20s, 90s] = 20s; `≤10s → low`, `≥40s → high`, else `med`; pending gets
no label. **PASS** — all three labels reachable and correctly thresholded.

### RETRACTION — my correction of implementer's Test A was WRONG

I originally wrote here that implementer's "low/med/high spread" claim for Test A was
inaccurate. **That was my error, and I am retracting it.** I reconstructed Test A's stage
durations by inferring them from its `avg 25s/stage` ETA line rather than reading the
durations they actually documented at §4.3 above (`10s, 45s, 20s`). My inferred set
(20/25/30) shares the same 25s mean but no spread, so it comes out all-`med` — an artifact
of my reconstruction, not a defect in their test.

Re-ran implementer's **documented** durations through the same shipped python:
```
demo-runid|demo|running|75000|5|3|2
FCAST|forecast: 3/5 stages done   |   2 remaining   |   ETA ~50s (avg 25s/stage x 2 left)
TREE|✓ stage-a  completed  10s  [low]
TREE|     ├─ ✓ stage-b  completed  45s  [high]
TREE|     ├─ ✓ stage-c  completed  20s  [med]
TREE|     ├─ ● stage-d  running  0s
TREE|     └─ ○ stage-e  pending  0s
```
Median of [10s, 45s, 20s] = 20s → `10s ≤ 0.5×` low, `45s ≥ 2×` high, `20s` med. **This
matches §4.3's documented output line for line.** implementer's original Test A claim was
correct as written; my correction was not. Both sets are individually true: 20/25/30 → all
`med`, 10/45/20 → low/med/high. Test C stands as a useful third case, but it did not close
a gap — there was no gap.

**Lesson for my own method:** when re-running someone else's test, use the inputs they
documented, not inputs back-inferred from one of their outputs.

**Note on live re-query flakiness (non-blocking, environmental):** querying
`/workflow status <id>` directly in a fresh scratch session-dir returned no `message_end`
detail on 2 of 2 bare attempts, while `workflow-tab.sh` itself succeeded. Same class of
DBOS backend warm-up raciness `researcher` documented for `/workflow resume` in the G2
section above. Not caused by this card; the tab's own path works.

**§4 disposition: VERIFIED.** All implementer claims reproduce, including the Test A
complexity spread. One added case (Test C) retained as supplementary coverage; my earlier
"inaccurate detail" finding is retracted above as verifier error.

---

## Verification method for tab scripts — static checks are NOT sufficient

`docs` hit this the hard way (`next` used as an awk parameter name silently blanked the whole
tab): **`bash -n` and `shellcheck` cannot see inside an embedded `awk`/`python3 -c` program.**
To those tools it is just a quoted string, so a tab script can pass both cleanly and still
render nothing at runtime. Every tab verification in this file therefore includes a live run
and an inspection of real rendered output, not just static checks:

| Tab | Static | Live run performed | Output cross-checked against an independent source |
|---|---|---|---|
| chat (§1) | `bash -n`, shellcheck 0/0 | `./scripts/team-chat.sh` on the real 114-msg feed | glossed shas checked against `git cat-file`; box widths counted |
| kanban (§2) | `bash -n`, shellcheck 0/0 | `./scripts/kanban.sh` piped render | NOW view's owner→task pairs cross-checked against `board.sh list` `status=working` cards |
| workflows (§4) | `bash -n`, shellcheck 0/0 | `./scripts/workflow-tab.sh` against 3 real runs | stage arithmetic + fan-out topology + `researcher`'s independent G2 evidence |

**Checklist item adopted for any remaining tab work (team tab included):**
1. `bash -n` + `shellcheck` — necessary, never sufficient.
2. Actually run the script and look at the rendered output.
3. Check stderr is empty and the output is non-empty (a blank tab can still exit 0).
4. Cross-check at least one rendered number/label against a source outside the script itself.

### Runtime re-check of `team-chat.sh` after docs' follow-up fix (commit `4d0c4f3`)

`lead` marked this informational, but the fix landed *after* my §1 verification and is exactly
the failure mode above, so I ran it rather than assuming:
```
$ bash -n scripts/team-chat.sh                                → OK
$ shellcheck -f gcc scripts/team-chat.sh | grep -cE "error:|warning:"
0
$ COLUMNS=92 ./scripts/team-chat.sh   → stdout 1747 lines, stderr 0 lines   (renders, no awk abort)
```
Double-gloss defect I reported in §1 is fixed, and the gloss was not merely deleted:
```
$ grep -coE "commit change [0-9a-f]{7,}"   → 2      (was 6)
$ grep -coE "pane pane w1:p[0-9]+"         → 2      (was 1… now only quoted text)
$ grep -coE "change [0-9a-f]{7,}"          → 12     (glossing still active)
$ grep -coE "pane w1:p[0-9]+"              → 10     (glossing still active)
```
All 4 remaining occurrences are inside **quoted message bodies of the messages that report
the defect** (`lead`'s report at render line 1067, my own report at 1058, docs' before/after
description at 1129) — not new glosses. docs' claim on this point is accurate.
**Confirmed fixed.**

---

# §3 Team tab — hired profiles + available-not-hired roles (card: team-tab-hired-available-unhired-profile, implementer)

Landed in `scripts/team-status.sh` (commit `7fce8c9`) from researcher's tested drop-in
(`build/team-tab-rollup.draft.py`). Verified live at two widths.

## §3.1 hired crew profiles + §3.2 available roles — live at COLUMNS=100
```
$ COLUMNS=100 ./scripts/team-status.sh | sed 's/\033\[[0-9;]*m//g'
  ON THE JOB — hired for this mission
  ●  docs         WORKING  w1:p5  README, usage docs, exampl… │ four-tab stakeholder comms: plan…
  ●  implementer  WORKING  w1:p4  Writing the actual code     │ team tab: hired + available-unhir…
  ●  verifier     WORKING  w1:p6  Independent, fresh-context… │ workflows tab: ETA + complexity f…
  ○  lead         IDLE     w1:pB  Mission, delegation, sign-… │ (last card done)
  ○  researcher   IDLE     w1:p3  Decision-ready evidence: p… │ (no card)
  AVAILABLE, NOT HIRED — in the role library, not on this mission
  ○ pm             hire when  The mission has real product judgment in it…
  ○ architect      hire when  More than two components must agree on a shape…
  ○ designer       hire when  The mission has a human-facing surface…
  ○ accessibility  hire when  The mission builds a graphical user interface.
  ○ devops         hire when  The mission says how it must be built…
```
Each hired member (§3.1): status glyph, name, live state, pane, what the role OWNS
(team/ROLES.md), and current task (top kanban card). Each unhired role (§3.2): its
`hire when` from ROLES.md. Also verified at COLUMNS=70 (wraps cleanly, no overrun).

## §3.3 the two sections never overlap (live set-difference)
```
hired      : ['docs', 'implementer', 'lead', 'researcher', 'verifier']
ROLES.md   : ['pm','researcher','architect','implementer','designer','accessibility','verifier','devops','docs']
section2   : ['pm', 'architect', 'designer', 'accessibility', 'devops']
OVERLAP    : []          <- must be empty
lead in ROLES.md? False  (lead is not a hireable role — special-cased owns string)
```
Section 2 = set(ROLES.md) − set(hired), so disjointness is structural. `lead` is not a
ROLES.md role, so it can never appear in section 2.

## Static checks
```
$ bash -n scripts/team-status.sh                                      # exit 0
$ shellcheck -f gcc scripts/team-status.sh | grep -Ec "error:|warning:"
0
```

**Status: implemented + self-verified (commit 7fce8c9). Awaiting verifier's independent
re-run.**

---

# §1 follow-up — chat tab: malformed feed line blanked the whole tab (found by docs, sharpened by verifier)

Separate from §3, flagged for traceability to docs' find. Fixed in `scripts/team-chat.sh`
(commit `7212217`).

**Root cause:** `render()`'s `jq -r '[...]' "$FEED"` read the feed as a JSON stream; the
first unparseable line aborted jq, `2>/dev/null` hid the error, awk got empty input, the
whole tab went blank at exit 0. Ordering-dependent (bad first line = total blank; bad
middle = truncation from that point). `build_links()`'s `jq -r '.message'` had the same bug
(silently dropping preview links after a bad line).

**Fix:** `jq -R -r 'fromjson? | ...'` — parse each line independently, skip only the bad
ones, any ordering. Plus a guard: a non-empty feed yielding zero parseable rows prints a
notice instead of a silent blank.

**Verified against crafted feeds (valid + malformed in every ordering):**
```
bad line FIRST   -> 2/2 valid boxes render   (before fix: 0 — whole tab blank)
bad line MIDDLE  -> 2/2 valid boxes render
all lines valid  -> 2/2 boxes
all lines bad    -> 0 boxes + explicit notice (not a silent blank)
empty feed       -> nothing, no false notice
$ bash -n scripts/team-chat.sh ; shellcheck -f gcc scripts/team-chat.sh | grep -Ec "error:|warning:"
0
```
**Status: fixed + self-verified (commit 7212217). Both malformed orderings handled.**

## §3 + §1-followup — verifier independent re-run (2026-08-16)

Re-ran both against commits `7fce8c9` (team tab) and `7212217` (jq fix). Static checks first,
then the runtime + external cross-check the checklist above requires.

```
$ bash -n scripts/team-chat.sh && bash -n scripts/team-status.sh && echo "bash -n OK both"
bash -n OK both
$ shellcheck -f gcc scripts/team-chat.sh scripts/team-status.sh | grep -cE "error:|warning:"
0
```

### §1 follow-up — malformed-feed fix (the defect I reported) is genuinely fixed

Crafted feeds with 2 valid messages + 1 malformed line in each position:
```
$ TEAMCHAT_FEED=<feed> ./scripts/team-chat.sh | grep -c "╭"
bad-first   : 2 boxes      (before fix: 0 — entire tab blank, exit 0)
bad-middle  : 2 boxes
bad-last    : 2 boxes
all-bad     : 0 boxes
empty       : 0 boxes
```
**PASS — 2,2,2,0 exactly as claimed.** Both orderings I flagged are fixed.

Box count alone could pass on empty frames, so I confirmed real content renders:
```
$ TEAMCHAT_FEED=<bad-first feed> ./scripts/team-chat.sh
╭────────────────────────────────────────────────────────────────────────────╮
│  a  →  b    SEND   t1                                                      │
│ a told b: first valid                                                      │
╰────────────────────────────────────────────────────────────────────────────╯
```
**PASS.**

all-bad vs empty are correctly distinguished — the dangerous "blank tab, exit 0" case now
explains itself:
```
$ TEAMCHAT_FEED=<all-bad> ./scripts/team-chat.sh
  (the chat feed has lines but none parse as JSON yet — nothing to render. Raw feed: …/all-bad.log)
$ TEAMCHAT_FEED=<empty> ./scripts/team-chat.sh
  []                       (nothing, no false notice)
```
**PASS.**

### §3 team tab — live render + external cross-checks

`COLUMNS=100` and `COLUMNS=70` both render, stderr empty in both.

**§3.3 disjointness, computed against the true source (ROLES.md table rows, not the
script's own output):**
```
$ grep -E '^\| `' team/ROLES.md | sed -E 's/^\| `([^`]+)`.*/\1/' | sort
accessibility architect designer devops docs implementer pm researcher verifier    (9 roles)
  lead present? NO   ← implementer's claim confirmed

section1 (hired, per script) : docs implementer lead researcher verifier
section2 (available)          : accessibility architect designer devops pm
expected = ROLES.md − hired   : accessibility architect designer devops pm
=> MATCH
overlap section1 ∩ section2   : []
```
**PASS** — sections are exactly disjoint and section2 is exactly the set difference.

**Profile data cross-checked against sources outside the script:**
```
panes per script : verifier w1:p6, lead w1:pB, researcher w1:p3, docs w1:p5, implementer w1:p4
panes per build/.launch/*.pane : identical  ✓

current-task column vs ./scripts/board.sh list:
  verifier    → "team tab: hired + available-unhired profiles"   (its only non-done card, status=working)  ✓
  docs        → "four-tab stakeholder comms: plan + prompt"      (its only non-done card, status=waiting)  ✓
  researcher  → "(no card)"                                       (owns zero cards on the board)            ✓
  lead        → "(last card done)"                                (all lead cards done)                     ✓
  implementer → "(last card done)"                                (all implementer cards done)              ✓
```
**PASS** — every pane id and task label matches an independent source, and the
working/waiting/done priority ordering is applied correctly.

`lead`'s "owns" text is a deliberate in-script fallback (`team-status.sh:105`) since `lead`
is intentionally absent from the ROLES.md library — not fabricated data.

### NEW FINDING (cosmetic, non-blocking): one line overflows at narrow width

At `COLUMNS=70`, exactly one line exceeds the target width — measured by **visible** columns
(a naive byte count reports 10, but the rows contain multibyte `●`/`│`/`…` glyphs):
```
$ COLUMNS=70 ./scripts/team-status.sh | <strip ANSI> | <count east-asian-aware visible width>
 72 visible cols:   hire   scripts/team.sh add <role> --reason "why this mission needs it"
--- 1 lines over 70 visible cols ---
```
Every data row (crew profiles, available roles) truncates correctly with `…`; the overflow is
the fixed `controls` help string, which does not participate in width-aware truncation. It
soft-wraps in a real terminal, so this is cosmetic. Owner `implementer` if worth tightening.

#### Follow-up: implementer's fix (commit `b2afb11`) — verified, reported case closed

The `hire` controls line now wraps its `--reason` example onto its own indented line.
Re-measured by visible width:
```
$ COLUMNS=70 ./scripts/team-status.sh | <strip ANSI> | <east-asian-aware width>
widest visible line: 68
lines over 70: 0                        (was 72 / 1 line over)
stderr: 0 lines
$ bash -n scripts/team-status.sh → OK ; shellcheck 0 errors/0 warnings
```
Wrapped output is still readable and correctly indented:
```
── controls ──
  hire   scripts/team.sh add <role>
         --reason "why this mission needs it"
  roles  scripts/team.sh roles      list  scripts/team.sh list
```
**PASS — the reported COLUMNS=70 overflow is fixed.**

Swept a width range to check for regressions:
```
COLUMNS=60  -> widest=66  over=4
COLUMNS=70  -> widest=68  over=0
COLUMNS=80  -> widest=78  over=0
COLUMNS=100 -> widest=98  over=0
COLUMNS=120 -> widest=118 over=0
COLUMNS=200 -> widest=158 over=0
```
No regression at any width ≥70.

**Residual (same cosmetic class, still open, NOT a regression):** at `COLUMNS=60` four lines
still overflow, because the fix targeted the one line I reported rather than the general
cause — three other hardcoded strings are still not width-aware, plus one data row overshoots
by a single column:
```
 61:   ○  docs         IDLE     w1:p5  README, usa… │ four-tab st…     ← data row, 1 col over
 65:   AVAILABLE, NOT HIRED — in the role library, not on this mission  ← fixed section header
 62:   roles  scripts/team.sh roles      list  scripts/team.sh list     ← fixed controls line
 66:  Attend to ! BLOCKED / ? UNKNOWN. ● WORKING needs nothing from you. ← fixed footer legend
```
Still cosmetic (all soft-wrap in a real terminal) and 60 cols is a narrow split pane, so I am
not raising this as blocking. Recorded so the residual is not mistaken for fully closed.

**§3 + §1-followup disposition: SUPERSEDED — see the regression section immediately below.
My original §3 sign-off was WRONG.**

---

## §3 REGRESSION — literal `033[K` in the live team tab (my sign-off missed a real bug)

Reported by the human from a live Herdr screenshot; escalated by `lead`. **Reproduced.**
I signed off on `7fce8c9`/`b2afb11` and this bug was present in the code I signed off on.

### Reproduction (live pane, not piped)
```
$ herdr pane read w1:p8 --lines 60          # w1:p8 = the team tab
TEAM  session harness033[K
033[K
  ●  implementer  WORKING  w1:p4  fix stale docs/commands…033[KKbefore docs are touched033[K[K
  ○  lead         IDLE     w1:pB033[K independent evidence for every…033[K senior-engineer audience033[K
033[Kntrols ──033[K
── controls ──033[Kam.sh add <role> --reason "why this mission needs it"033[K
033[Kd to ! BLOCKED / ? UNKNOWN. ● WORKING needs nothing from you.033[K
Attend to ! BLOCKED / ? UNKNOWN. ● WORKING needs nothing from you.033[K
```
13 lines carrying literal `033[` in the live pane. Matches the human's screenshot exactly.

### Root cause — proven, one line

`scripts/team-status.sh:160` as committed in `b2afb11`:
```
paint(){ render > "$TMP"; printf '\033[H'; sed 's/$/\033[K/' "$TMP"; printf '\033[J'; }
```
**This platform's sed (BSD/macOS) does not interpret `\033`** — it emits the literal text
`033[K`. GNU sed would; BSD sed does not. Demonstrated side by side:
```
$ printf 'line one\n' | sed 's/$/\033[K/' | cat -v
line one033[K                        ← literal text, no ESC byte

$ K=$'\033[K'; printf 'line one\n' | awk -v k="$K" '{print $0 k}' | cat -v
line one^[[K                         ← real escape
$ ... | xxd
00000000: 781b 5b4b 0a    x.[K.      ← 0x1b = real ESC byte
```

**Both reported symptoms share this single cause.** The literal `033[K` is the escape printed
as text; the "duplicated/garbled lines" follow from it — clear-to-EOL never executes, so
longer text from previous refresh frames is never erased and bleeds through under shorter
new lines. That is also why the pane looks like it is missing the new §3 content: it is not
missing, it is buried under un-erased remnants of earlier frames.

### Blast radius — team tab only

```
team-status:   BSD-BROKEN sed
kanban:        OK  ($'\033[K' ANSI-C quoting)
team-chat:     OK  ($'\033[K' ANSI-C quoting)
workflow-tab:  OK  ($'\033[K' ANSI-C quoting)

live literal-033[ counts:  w1:p7 kanban 0 · w1:pA workflows 0 · w1:p8 team 13
```
`team-status.sh` was the only script using the `sed` variant; the other three already used
bash ANSI-C quoting. (`w1:p2` team-chat shows 3 hits, but those are chat messages *quoting*
the string `033[K` while discussing this bug — verified by reading them, not a second
instance.)

### Fix state — code FIXED and committed (`f131ab2`), live pane STILL BROKEN

`implementer` committed the corrected `paint()` as `f131ab2` while I was writing this up:
```
K=$'\033[K'
paint(){ render > "$TMP"; printf '\033[H'; awk -v k="$K" '{print $0 k}' "$TMP"; printf '\033[J'; }
```

**The fixed code is sound** — exercised the committed `paint()` logic in isolation:
```
$ TMP=…; K=$'\033[K'
$ { printf '\033[H'; awk -v k="$K" '{print $0 k}' "$TMP"; printf '\033[J'; } | cat -v
^[[HTEAM  session harness^[[K
  ● verifier WORKING^[[K
^[[J
$ … | grep -c '033\['
0                                    ← 0 literal escapes; all real ESC bytes
```

**But the live tab is still broken right now:**
```
$ herdr pane read w1:p8 --lines 60 | grep -c '033\['
13                                   ← unchanged, still the human's reported symptom
```
**The running pane process is still executing the pre-fix code.** Committing a fix does not
restart a long-lived pane process; `team-status.sh` was started at cockpit boot and loops in
place. Until that pane is restarted, the human keeps seeing the broken tab regardless of what
is in git.

**Operational conclusion: "committed" ≠ "fixed for the human."** This card is not closeable
on the commit alone — it needs a pane restart followed by a live re-read showing
`literal 033[ count: 0`. Pane lifecycle is not my lane (per `TRANSPORT.md` I do not send keys
to or restart other panes), so I am reporting rather than acting. I will re-verify live on
request once the pane has been restarted.

### FINAL VERIFICATION — pty harness + live pane, both clean

`lead` asked for independent confirmation in a real pty/TTY and a repo-wide sweep for the
same pattern. I wrote **my own** pty harness rather than reusing implementer's
(`/tmp/verifier_pty2.py`: `pty.fork`, a real window size via `TIOCSWINSZ`, feed `q`, then
count literal `033[` vs real `0x1b` bytes in the captured stream).

**Harness validated against a known-bad control first** — a harness that cannot detect the
bug proves nothing:
```
BROKEN (b2afb11, checked out to /tmp):
  literal "033[" : 20     real ESC[K : 0      VERDICT: FAIL
FIXED  (HEAD, f131ab2):
  literal "033[" : 0      real ESC[K : 24     VERDICT: PASS
```
Independently reproduces implementer's before/after numbers (20/0 → 0/24) with a
separately-written harness.

**All four tab scripts under a real pty (120x40):**
```
scripts/team-status.sh   literal 0   ESC 276   ESC[K 48   PASS
scripts/kanban.sh        literal 0   ESC 358   ESC[K 34   PASS
scripts/team-chat.sh     literal 6*  ESC 271   ESC[K 40   *false positive — see below
scripts/workflow-tab.sh  literal 0   ESC  11   ESC[K  1   PASS
```
\*The 6 hits in `team-chat.sh` are **chat message bodies quoting the string** `033[K` — this
very investigation is in the feed. Verified by dumping the surrounding bytes: each sits
inside real rendered escapes (`\x1b[38;2;138;190;183m…`), i.e. the renderer is emitting
correct escapes around text that happens to contain the literal characters. Not a defect.

**Repo-wide sweep for the broken pattern (lead's ask) — isolated to the one file:**
```
$ grep -rnE "sed [^|]*s/[^/]*/[^/]*\\\\(033|e\[|x1b)" --include=*.sh .     → none
$ grep -rn "sed" --include=*.sh . | grep 033                               → only the explanatory comment at team-status.sh:160
$ grep -rnE "\[K" --include=*.sh .
  team-status.sh:163   K=$'\033[K'          ✓ ANSI-C quoting
  kanban.sh:193        K=$'\033[K'          ✓
  workflow-tab.sh:273  K=$'\033[K'          ✓
  team-chat.sh:206     K=$'\033[K'          ✓
  team-chat.sh:346,348 printf '…\033[K…'    ✓ printf DOES interpret \033
```
No other script used the `sed` variant. The bug was genuinely isolated to
`team-status.sh:160`.

**Live pane, after the pane was restarted by its owner:**
```
$ herdr pane read w1:p8 --lines 60 | grep -c '033\['
0                                    ← was 13
```
and the tab now renders the full §3 content that was previously buried under un-erased
frame remnants:
```
TEAM  session harness
  ON THE JOB — hired for this mission
  ●  verifier     WORKING  w1:p6  Independent, fresh-context proof…  │ (last card done)
  ○  lead         IDLE     w1:pB  Mission, delegation, sign-off      │ (last card done)
  …
  AVAILABLE, NOT HIRED — in the role library, not on this mission
  ○ pm  ○ architect  ○ designer  ○ accessibility  ○ devops
── controls ──
```

**§3 REGRESSION disposition: CLOSED — verified in a real pty AND on the live pane.**
Code fixed (`f131ab2`), pattern confirmed isolated, live tab clean, human-visible symptom
gone.

### Independent close-out re-read (verifier, after lead's pane restart)

`lead` restarted `w1:p8` and reported it clean. Re-read it myself rather than accepting that.
Because the original defect was a **refresh-loop** bug (remnants accumulated frame over
frame), one clean frame proves little — sampled across several refresh cycles instead:
```
$ for i in 1 2 3; do herdr pane read w1:p8 --lines 60 | grep -c '033\['; sleep 3; done
sample 1: literal-033[ = 0 | non-empty lines = 18
sample 2: literal-033[ = 0 | non-empty lines = 18
sample 3: literal-033[ = 0 | non-empty lines = 18
```
Zero literal escapes and a **stable** line count across ~9s of refreshes — no accumulating
garbling, which is precisely how the old bug manifested. Full content renders correctly
(hired profiles with live status/task, available-not-hired section, wrapped controls).

Confirmed independently by the human on the live tab. **Loop closed.**
### Why my verification missed it — method gap, my error

`paint()` runs **only in the live TUI path**. Piped/non-interactive output calls `render`
directly and never touches `paint()`, so every check I ran — `./scripts/team-status.sh |
sed …`, the `COLUMNS=60..200` width sweep, stderr checks — exercised a code path that cannot
expose this bug. I wrote the "actually run it and look at rendered output" checklist earlier
in this file and then satisfied it with *piped* output, which is precisely the gap the
checklist was meant to close.

**Checklist corrected — for any full-screen/TUI script, piped output is NOT sufficient:**
1. `bash -n` + `shellcheck` — necessary, never sufficient.
2. Run it piped and check rendered content.
3. **Inspect the live pane itself** (`herdr pane read <pane-id>`) — the alt-screen/refresh
   path (`paint`, clear-to-EOL, cursor homing) exists only there.
4. **Grep the live pane for literal escape text** (`033[`, `[0m`, `\e[`) — a leaked escape is
   invisible in piped output and unmistakable in the pane.
5. Cross-check a rendered value against a source outside the script.
6. Prefer `$'\033'` (bash ANSI-C quoting) over `\033` inside `sed` — BSD and GNU sed differ,
   and the BSD failure mode is silent literal text.

---

# §3 LIVE REGRESSION FIX — team tab printed literal `033[K` and garbled in Herdr (commit f131ab2)

Human screenshotted the live Herdr team tab: literal `033[K` text, duplicated/garbled lines,
content unreadable. Verifier's sign-off and all prior tests used the **piped** path
(`./scripts/team-status.sh | sed ...`), which calls `render` directly and exits — it never
runs the interactive `paint()` loop. The live Herdr pane is a real TTY, so it runs `paint()`.

**Root cause:** `paint()` cleared each line with `sed 's/$/\033[K/'`. This platform's sed does
not interpret `\033`, so it wrote the literal bytes `30 33 33 5b 4b` (`"033[K"`) instead of a
real ESC. The clear-to-EOL never happened; the 2s repaint loop printed literal `033[K` per
line and never cleared stale rows → the garble in the screenshot. Pre-existing (the sed paint
predates the §3 rework); surfaced now because the tab is watched live and the taller
two-section content makes it obvious.

**Reproduced in a real pseudo-TTY (pty), not piped:**
```
# before fix (old sed paint):
literal '033[K' occurrences: 20      real ESC [K clear-lines: 0
# after fix (f131ab2, K=$'\033[K' + awk):
literal '033[K' occurrences: 0       real ESC [K clear-lines: 24
  contains ON THE JOB: True   contains AVAILABLE, NOT HIRED: True   contains owns/task sep: True
```
Byte proof the fix emits a real escape:
```
$ K=$'\033[K'; printf 'line1\n' | awk -v k="$K" '{print $0 k}' | xxd
00000000: 6c69 6e65 311b 5b4b 0a                   line1.[K.   # 1b 5b 4b = real ESC [K
```

**Fix:** emit the clear-to-EOL via `K=$'\033[K'` appended in awk — the same approach
`scripts/team-chat.sh:206` and `scripts/kanban.sh:193` already use. Grep confirmed
team-status.sh was the ONLY script with the broken `sed '\033'` pattern.

```
$ bash -n scripts/team-status.sh ; shellcheck -f gcc scripts/team-status.sh | grep -Ec "error:|warning:"
0
```

**Process note:** this class of bug (interactive-only, invisible to piped tests) is why the
team-tab paint path needs a live/pty check, not just a piped render, before sign-off.

**Status: fixed + verified in a pseudo-TTY (commit f131ab2). Needs a real Herdr-pane
confirmation by the human/verifier to fully close.**
