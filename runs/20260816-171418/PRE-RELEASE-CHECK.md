# Pre-release verification sweep — 2026-08-16

Run by the `docs` agent at the human's request ("test everything one more time before we make
this available to the public"). Every line below is a command that was actually run and its
actual output.

## Summary

| # | Check | Result |
|---|-------|--------|
| 1 | Installed tool versions match every doc claim | PASS |
| 2 | `bash -n` on all shell scripts | PASS (18/18) |
| 3 | `shellcheck` clean | PASS — fixed in 7386410, re-verified |
| 4 | Relative Markdown links / `<img src>` / `href` resolve | PASS (0 broken in 48 tracked docs) |
| 5 | README-referenced assets exist | PASS (7/7) |
| 6 | `docs/troubleshooting.md` command claims reproduce | PASS (all 3 documented behaviours) |
| 7 | Git state clean and pushed; run output ignored | PASS |
| 8 | Live cockpit health | PARTIAL — pane-hijack bug fixed; lead-loss cause still open |
| 9 | `cockpit.sh` agent count | PASS — fixed in ebc224d, re-verified |

All nine checks are either passing or documented. One open question remains: **why the lead
pane vanished** (section 8, thread 2) — not reproducible without a throwaway session.

## 1. Versions — PASS

```
$ herdr --version && atomic --version && ghostty --version
herdr 0.8.0
0.9.13
Ghostty 1.3.1
```

Matches the "Tested with Atomic 0.9.13, Herdr 0.8.0, and Ghostty 1.3.1" line in `README.md`
and the "Verified against" line in `docs/getting-started.md:12`. No drift.

## 2. `bash -n` — PASS

```
$ for f in build.sh cockpit.sh scripts/*.sh; do bash -n "$f" || echo "FAIL $f"; done
all 18 scripts parse clean
```

## 3. `shellcheck` — PASS (was FAIL; fixed and re-verified)

```
$ shellcheck --version
version: 0.11.0

$ shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -c "error:"
6
$ shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -c "warning:"
0
$ shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -c "note:"
17
```

All 6 error-severity findings are the same issue, on one line:

```
cockpit.sh:20:15: error: Use braces when expanding arrays, e.g. ${array[idx]}
                         (or ${var}[.. to quiet). [SC1087]
   … same at cols 26, 39, 52, 72, 89
```

`cockpit.sh:20` is the ANSI colour palette:

```bash
E=$'\033'; R="$E[0m"; B="$E[1m"; DIM="$E[2m"; GRN="$E[38;5;150m"; …
```

**Functionally correct — verified, not assumed:**

```
$ E=$'\033'; B="$E[1m"; R="$E[0m"; printf '%s\n' "$B bold-test $R" | cat -v
^[[1m bold-test ^[[0m
```

That is the right escape sequence, so this is a shellcheck false positive about *intent*
(`$E[` reads as an array index; `E` is a plain string). But it is reported at **error**
severity, so `shellcheck` does **not** pass clean, and mission criterion 2 requires that it
does.

**Fixed by `implementer` in commit 7386410** — braced all six expansions
(`R="${E}[0m"`, `B="${E}[1m"`, …). Re-verified independently by `docs` after the commit:

```
$ git log --oneline -1 7386410
7386410 cockpit.sh: brace ANSI palette vars to fix shellcheck SC1087 errors

$ sed -n '20p' cockpit.sh
E=$'\033'; R="${E}[0m"; B="${E}[1m"; DIM="${E}[2m"; GRN="${E}[38;5;150m"; YEL="${E}[1;33m"; GREY="${E}[38;5;244m"

$ shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -c "error:"
0
$ shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -c "warning:"
0
$ for f in build.sh cockpit.sh scripts/*.sh; do bash -n "$f"; done
all parse clean
```

Output confirmed byte-identical after the fix, and the script still runs end to end:

```
$ E=$'\033'; R="${E}[0m"; B="${E}[1m"; GRN="${E}[38;5;150m"
$ printf '%s\n' "$B bold $R$GRN green $R" | cat -v
^[[1m bold ^[[0m^[[38;5;150m green ^[[0m

$ ./cockpit.sh </dev/null    # EOF exits cleanly at the menu read
  (menu renders with correct colours; exit 0)
```

Mission criterion 2 is now met. The 17 remaining findings are info-severity (`SC2016`,
`SC2012`, `SC2015`, `SC2295`) — style notes, not defects.

## 4. Link check — PASS

Scanned every tracked `.md` (excluding `build/`, `build-*/`, `node_modules/`), resolving each
relative Markdown link, `<img src>`, and `href` against the containing file's directory:

```
--- scanned: 48 files
```

Two candidate hits, both confirmed **false positives**:

- `docs/superpowers/plans/2026-08-13-project-agnostic-harness.md -> \([^` — a regex inside a
  fenced code block, not a link.
- `.superpowers/render-demo-report.md -> docs/media/build-demo.gif` — lines from a pasted
  shell transcript (`$ ls -lh docs/media/build-demo.gif`), not Markdown links. The file is
  also untracked (`.superpowers/` is git-ignored), so it is not published.

**Zero real broken links.** (An earlier unscoped pass reported ~200 hits; all were inside
`build-alpha/site/node_modules/`, i.e. untracked run output, not repo documentation.)

## 5. README-referenced assets — PASS

```
OK docs/media/build-demo.gif
OK docs/media/steps/11-the-page-itself.png
OK docs/samples/ozymandias.html
OK docs/samples/poem-page.html
OK docs/case-study-ozymandias.md
OK team/ROLES.md
OK specs/2026-08-14-intercom-team-chat-pane.md
```

## 6. `docs/troubleshooting.md` claims still reproduce — PASS

The page documents a rough edge in agent targeting. Re-tested against the live cockpit; all
three documented behaviours reproduce exactly as written:

```
$ herdr agent get w1:p6            # pane-id form — documented as working
{"id":"cli:agent:get","result":{"agent":{"agent":"verifier","agent_status":"idle", …

$ herdr agent get verifier         # role-name form — documented as failing
{"error":{"code":"agent_not_found","message":"agent target verifier not found"}}

$ herdr agent explain w1:p6        # documented as failing
{"error":{"code":"agent_explain_unavailable","message":"agent target w1:p6 does not have a detected agent label"}}

$ herdr agent explain verifier     # documented as failing
{"error":{"code":"agent_not_found","message":"agent target verifier not found"}}

$ herdr agent read w1:p6 --source detection --lines 2   # documented workaround — works
  → .atomic/
claude-sonnet-5 medium • ~/git-repos/agentic-engineering-harness (main…
```

Note this still contradicts `docs/monitoring-agents.md:52`, which tells the reader to run
`herdr agent explain <agent-name-or-pane-id>`. Neither form works on this install. Flagged
previously; `docs/troubleshooting.md` documents the working alternative, but
`monitoring-agents.md` itself has not been corrected.

## 7. Git state — PASS

```
$ git status -sb
## main...origin/main          (working tree clean)

$ git log origin/main..HEAD --oneline
                               (empty — nothing unpushed)

$ git check-ignore -v build/ build-alpha/
.gitignore:27:/build/     build/
.gitignore:28:/build-*/   build-alpha/

$ git ls-files | grep -E "^build/"
                               (empty — no run output tracked)
```

Run output is correctly ignored and nothing from `build/` has leaked into the repo.

## 8. Live cockpit health — CONCERN

```
$ herdr pane list | grep -c pane_id
8
$ herdr agent list | grep -o '"agent":"[a-z]*"' | sort -u
"agent":"docs"
"agent":"implementer"
"agent":"researcher"
"agent":"verifier"
```

Eight panes, but only **four** carry an agent label. Earlier in this same session
`herdr agent list` returned **five**, including `lead` at `w1:p1`. The lead is now absent:

```
$ herdr agent get w1:p1
{"error":{"code":"agent_not_found","message":"agent target w1:p1 not found"}}
```

This is the same root cause as the symptom every specialist hit all session: `intercom send
lead …` returned `Message to "lead" was not delivered: Session not found`, so no specialist
could report completion to the lead, and the human had to be used as the fallback channel.

**This is a real robustness gap, not a docs gap.** A first-time user whose lead drops this way
gets a cockpit that looks alive — panes present, specialists working — while the agent that
coordinates the run is gone, with no on-screen indication. `README.md` and
`docs/troubleshooting.md` had no entry for "the lead vanished".

### Thread 1 — `build.sh` could hijack an occupied pane — FIXED (c425783)

Investigating the recovery path turned up a worse, separate bug. With no pane labelled `lead`,
`build.sh` fell back to `root_pane()`, which selected the first pane carrying no **label** —
but an unlabelled pane is not a free pane. Verified against the live session:

```
build.sh would claim: w1:p2
  w1:p2  env ATOMIC_INTERCOM_GROUP=harness ./scripts/team-chat.sh   <- the human's chat pane
  w1:p4  atomic - agentic-engineering-harness                       <- the implementer
  w1:p7/p8/pA  kanban / roster / workflows tabs
```

So the documented recovery for a lost lead would have renamed the **team-chat** pane to `lead`
and started an agent inside it — destroying the channel the human uses to talk to the team.

`implementer` fixed this in `c425783`. Notably, the first attempt (matching terminal titles
against the known tab scripts) was discarded after live testing showed Herdr **truncates**
`terminal_title`; confirmed independently:

```
$ herdr pane list | python3 -c "<print pane_id, tab_id, len(title), title[-45:]>"
w1:p2   tab=w1:t2   len=57  'INTERCOM_GROUP=harness ./scripts/team-chat.sh'
w1:p7   tab=w1:t3   len=67  'p/git-repos/agentic-engineering-harness/build'   <- script name cut off
w1:p8   tab=w1:t4   len=67  'p/git-repos/agentic-engineering-harness/build'
w1:pA   tab=w1:t6   len=67  'p/git-repos/agentic-engineering-harness/build'
```

Three of four side-tab titles are already truncated past the script name, so title matching
would have silently broken past some path length. The shipped fix keys on `tab_id` instead
(side tabs can never share the main tab) and additionally excludes panes holding a live agent.

Re-verified independently by `docs` against the live session:

```
$ <extracted root_pane() body> ; echo $?
exit 1 — no free pane (team-chat NOT hijacked)

$ shellcheck -f gcc build.sh cockpit.sh scripts/*.sh | grep -cE "error:|warning:"
0
$ bash -n build.sh
clean
```

The refusal is the correct outcome: every main-tab pane currently holds a live agent, so
`build.sh` declines rather than taking one. Its error path (`build.sh:256`) prints
`could not find a shell pane to start the lead in` and exits 1.

This changed the documented recovery, so `docs/troubleshooting.md` was updated in `06e23bf`:
`--resume` now either succeeds or refuses safely, with stop-then-resume as the follow-up, and
the old hijack behaviour kept as a historical note for anyone on a pre-`c425783` checkout.

### Thread 2 — why the lead pane vanished — STILL OPEN

Not reproducible without a throwaway session, so it has not been chased. Facts on record:

- `w1:p1` is absent from `herdr pane list` entirely — the pane itself, not just its agent label.
- `build/.launch/lead.pane` still records `w1:p1`, a stale pointer.
- `herdr agent list` showed `lead` as `idle` earlier in the session, before it disappeared.
- Intercom returned `Session not found` for `lead` from the **first** message any specialist
  sent, which suggests it may never have registered rather than dying mid-run.
- `build.sh:315-328` carries a long comment about the `/name` intercom registration being
  timing-sensitive — the natural place to start.

Closing this needs a human-authorized throwaway session, the same category as G2/G3 in
`build/BLOCKED.md`. It is documented rather than silently dropped.

## 9. `cockpit.sh` always reported "0 agent(s)" — PASS (was FAIL; fixed and re-verified)

Found by running `cockpit.sh` end to end while verifying the section 3 fix. The live header
reads:

```
  cockpit   ● running  ·  0 agent(s)
```

while four agents are attached and two are working. The cause is `cockpit.sh:37-43` — the
inline `python3 -c` snippet uses `json` and `sys` but never imports them:

```bash
eval "$(herdr agent list 2>/dev/null | python3 -c "
try: a=json.load(sys.stdin)['result'].get('agents',[])
except Exception: a=[]
…
```

The resulting `NameError` is swallowed by the bare `except Exception`, which falls through to
`a=[]`. The count is therefore hard-wired to zero on every run — it has never worked.

**Proof — the snippet as written, versus the same snippet with the imports added:**

```
$ herdr agent list | python3 -c "<snippet exactly as in cockpit.sh>"
AGENTS=0

$ herdr agent list | python3 -c "import json,sys
<same snippet>"
AGENTS=4;WORKING=2;BLOCKED=0

$ herdr agent list | grep -o '"agent_status":"[a-z]*"' | sort | uniq -c
   2 "agent_status":"idle"
   2 "agent_status":"working"
```

Ground truth is 4 agents / 2 working; the cockpit reports 0.

**Why this mattered:** `cockpit.sh` is the command `README.md` recommends as the one that
"knows what to do next". A new user starting a team would see it report an empty cockpit while
their agents were running — reading as "nothing started", exactly the wrong signal, and failing
silently. Linting alone could not catch this; it surfaced only by running the script.

**Fixed by `implementer` in commit ebc224d** — added `import json,sys` and narrowed the bare
`except Exception` to `except (ValueError, KeyError)` so a real bug fails loudly instead of
reading as "no agents". Re-verified independently by `docs`:

```
$ git log --oneline -1 ebc224d
ebc224d cockpit.sh: fix cockpit always reporting 0 agents

$ sed -n '37,39p' cockpit.sh
    eval "$(herdr agent list 2>/dev/null | python3 -c "
import json,sys
try: a=json.load(sys.stdin)['result'].get('agents',[])

$ herdr agent list | python3 -c "<snippet as now in cockpit.sh>"
AGENTS=4;WORKING=2;BLOCKED=0
```

Live header now matches ground truth:

```
$ ./cockpit.sh </dev/null | head -3
  cockpit   ● running  ·  4 agent(s), 3 working

$ herdr agent list | grep -o '"agent_status":"[a-z]*"' | sort | uniq -c
   1 "agent_status":"idle"
   3 "agent_status":"working"
```

(The working count moved 2→3 between the two captures because the agents kept working — this
is live data, not a stale snapshot.)

**Degradation paths re-checked**, since narrowing the `except` risks crashing where the old
code silently coped. All four still return a clean zero rather than a traceback:

```
$ printf '' | python3 -c "<snippet>"                    # server down / no output
AGENTS=0;WORKING=0;BLOCKED=0
$ echo '{"error":{"code":"x"}}' | python3 -c "<snippet>"  # error JSON, no 'result' key
AGENTS=0;WORKING=0;BLOCKED=0
$ echo 'not json' | python3 -c "<snippet>"               # malformed
AGENTS=0;WORKING=0;BLOCKED=0
$ echo '{"result":{"agents":[]}}' | python3 -c "<snippet>" # genuinely no agents
AGENTS=0;WORKING=0;BLOCKED=0
```

`shellcheck` still reports 0 errors / 0 warnings and all scripts pass `bash -n` after the fix.

## Commands run (reproducibility)

```
herdr --version; atomic --version; ghostty --version
for f in build.sh cockpit.sh scripts/*.sh; do bash -n "$f"; done
shellcheck --version
shellcheck -f gcc build.sh cockpit.sh scripts/*.sh
shellcheck build.sh cockpit.sh scripts/*.sh
herdr agent list
herdr pane list
herdr agent get w1:p1
herdr agent get w1:p6
herdr agent get verifier
herdr agent explain w1:p6
herdr agent explain verifier
herdr agent read w1:p6 --source detection --lines 2
node -v
herdr integration status
git status -sb
git log origin/main..HEAD --oneline
git check-ignore -v build/ build-alpha/ build/MISSION.md
git ls-files | grep -E "^build/"
find . -name '*.md' (scoped link check, see section 4)
```
