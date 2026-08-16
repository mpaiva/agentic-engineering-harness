# Evidence — harness repo audit (criterion 7: independent spot-check)

Mission: `build/MISSION.md` — audit report at `build/artifacts/harness-audit/AUDIT.md`.
This file covers only criterion 7: an independent second pass that re-checks AUDIT.md's own
findings against actual repo state. I did not write AUDIT.md (researcher did); every check
below re-ran the underlying command/file-read myself.

Note: an earlier `build/EVIDENCE.md` in this same file, for a prior unrelated mission
(getting-started-page), has been superseded — that mission is complete and archived under
`build/artifacts/getting-started-page/`. This file now covers the current audit mission only.

## Spot-check 1 (priority) — §6 Finding #1: version drift, "16 files" claim

**PARTIALLY INACCURATE — the core claim is true, the count is wrong**

AUDIT claims: "docs/scripts/extensions claim `0.9.12`, installed is `0.9.13`" with "16 files
still saying `Atomic 0.9.12`" (10 named files + "3 files under `docs/superpowers/`") and 4
files already saying `0.9.13`.

Command:
```
atomic --version
```
Output: `0.9.13` — confirms the core drift claim (installed version is indeed 0.9.13, not
0.9.12).

Command:
```
grep -rl "0.9.12" . | grep -v "^\./build/" | grep -v "^\./build-alpha/" | grep -v "^\./build-beta/" | grep -v "/node_modules/"
```
Output (13 files, not 16):
```
./.atomic/workflows/feature-development.ts
./README.md
./atomic/README.md
./atomic/extensions/build-intake.ts
./atomic/extensions/herdr-state.ts
./atomic/workflows/feature-development.ts
./build.sh
./docs/getting-started.md
./docs/superpowers/plans/2026-08-13-project-agnostic-harness.md
./docs/superpowers/specs/2026-08-13-project-agnostic-harness-design.md
./herdr/atomic-integration.md
./scripts/sync-workflows.sh
./scripts/team.sh
```
One of those (`.atomic/workflows/feature-development.ts`) is gitignored (confirmed via
`git check-ignore -v .atomic/workflows/feature-development.ts` → matched
`.gitignore:6`) — it's `sync-workflows.sh`'s generated copy of
`atomic/workflows/feature-development.ts`, not an independent source file a contributor
would edit. Excluding it: **12 source files**, not 16.

Also checked AUDIT's "plus 3 files under `docs/superpowers/`":
```
find docs/superpowers -type f -name "*.md" | xargs grep -l "0.9.12"
```
Output: only 2 files (`plans/2026-08-13-project-agnostic-harness.md`,
`specs/2026-08-13-project-agnostic-harness-design.md`), not 3.

**Verdict:** the drift itself is real and correctly identified — this is a genuine,
important finding. But the flagship top-priority finding's headline number, "16 files," is
stale/wrong on independent re-run: actual count is 12 (source files) or 13 (including one
gitignored generated copy). The `docs/superpowers/` sub-count is also off by one (2, not 3).
This is exactly the kind of inaccuracy criterion 7 exists to catch, in the single
highest-priority item of the report.

## Spot-check 2 — §1 Markdown link check: "35 files... 50 candidates... 0 broken"

**FILE/CANDIDATE COUNTS DO NOT MATCH ON RE-RUN; 3 additional link candidates found**

Command (AUDIT's own described find, re-run verbatim):
```
find . -name "*.md" -not -path "./build/*" -not -path "./build-alpha/*" -not -path "./build-beta/*"
```
Output: **42 files**, not the 35 AUDIT claims (full list captured in session; includes
6 `.atomic/todos/*.md` files as AUDIT itself notes, plus `.superpowers/render-demo-report.md`
which AUDIT's scope note doesn't mention excluding).

Independent link-resolution script (same rules as AUDIT describes: skip `http(s)://`,
`mailto:`, bare `#anchor`; resolve the rest relative to the source file's directory; check
`os.path.exists`) — full source retained in session, run via `python3`:

Output:
```
files scanned: 42
total relative-link candidates: 53
broken: 3
 BROKEN: ('./.superpowers/render-demo-report.md', 'docs/media/build-demo.gif')  (×3, three occurrences in one file)
```

Followed up on the 3 "broken" hits:
```
ls docs/media/build-demo.gif
```
Output: `docs/media/build-demo.gif` — **the file exists at the repo root path**. It does not
exist relative to `.superpowers/` (`ls .superpowers/docs/media/build-demo.gif` → "No such
file or directory"), which is why my resolver flags it. `.superpowers/render-demo-report.md`
is itself gitignored (`.gitignore:31`) and reads as a pasted shell-session transcript/report
(`# render-demo report`, `## Approach`, embedded `$ ls -lh docs/media/build-demo.gif`
command output), not authored navigable documentation — so whether these 3 count as "broken
links" is genuinely ambiguous scope, not a clear-cut miss.

**Verdict:** the "0 broken" conclusion likely still holds for real, authored documentation
(README, docs/, team/, herdr/, specs/) — I found no broken links there either. But AUDIT's
precise counts ("35 files," "50 candidates") do not reproduce on an identical re-run today
(42 files, 53 candidates) — either the repo changed between the audit run and this
spot-check (plausible: `.atomic/todos/` and `research/` grow during a live session), or the
original count itself was off. Either way, the exact numbers in §1 are not currently
verifiable as stated.

## Spot-check 3 — §3: `bash -n` on all 13 scripts, `board.sh` usage vs. actual `case`

**ACCURATE**

Command:
```
for f in scripts/*.sh build.sh; do bash -n "$f" && echo "OK: $f" || echo "FAIL: $f"; done
```
Output: `OK:` for all 13 files (`assemble-demo.sh`, `board.sh`, `capture-demo.sh`,
`kanban.sh`, `launch-feature.sh`, `new-workspace.sh`, `setup.sh`, `status.sh`,
`sync-workflows.sh`, `team-chat.sh`, `team-status.sh`, `team.sh`, `build.sh`) — matches
AUDIT's claim exactly.

Command:
```
sed -n '70,116p' scripts/board.sh
```
Output confirms a `case "$cmd" in add) ... move) ... status) ... list) ...` structure
implementing exactly `add`, `move`, `status`, `list` as AUDIT describes, at line numbers
matching AUDIT's cited range (72-115).

## Spot-check 4 — §4: `atomic/README.md` never mentions `extension`

**ACCURATE**

Command:
```
grep -n "extension" atomic/README.md
```
Output: (empty, exit code 1 — no matches) — confirms AUDIT's claim exactly: the README's
prose never uses the word "extension," so it has no description of `atomic/extensions/`.

## Spot-check 5 — §5 gap #2: `build.sh`'s intake wait loop has no timeout

**ACCURATE**

Command:
```
sed -n '270,295p' build.sh
```
Output confirms: `while [ ! -f "$BUILD/IDEA.md" ]; do sleep 1; WAITED=$((WAITED + 1)); if
[ $((WAITED % 60)) -eq 0 ]; then printf '[harness] still waiting...'; fi; done` — no timeout
condition anywhere in the loop, heartbeat exactly every 60 iterations (60 seconds, since each
iteration sleeps 1s). Matches AUDIT's claim word for word: unbounded wait, 60s heartbeat.
Comments directly above the loop (lines 273-283) independently corroborate the "why" AUDIT
describes (`--resume` is unsafe mid-wait because it restarts the server and discards the
typed answer).

## Re-verification (repair cycle 1) — corrected numbers confirmed to reproduce

Researcher corrected AUDIT.md: §1 now states 42 files / 50 candidates (53 counting 3
ambiguous-scope hits, with the two-line-wrapped-link limitation now disclosed); §6 Finding
#1 now states 13 files with `0.9.12` (12 source + 1 gitignored generated copy, itemized) and
2 files under `docs/superpowers/` (not 3).

Re-ran every corrected number myself, independently, against live repo state:

```
find . -name "*.md" -not -path "./build/*" -not -path "./build-alpha/*" -not -path "./build-beta/*" -not -path "*/node_modules/*" | wc -l
```
Output: `42` — matches corrected §1 file count exactly.

```
grep -rln "0.9.12" --include="*.md" --include="*.sh" --include="*.ts" . 2>/dev/null | grep -v "^./build/\|^./build-alpha/\|^./build-beta/" | wc -l
```
Output: `13` — matches corrected §6 Finding #1 count exactly.

```
find docs/superpowers -type f -name "*.md" | xargs grep -l "0.9.12"
```
Output: 2 files (`plans/2026-08-13-project-agnostic-harness.md`,
`specs/2026-08-13-project-agnostic-harness-design.md`) — matches corrected sub-count exactly.

```
grep -rln "0.9.13" --include="*.md" --include="*.sh" --include="*.ts" . 2>/dev/null | grep -v "^./build/\|^./build-alpha/\|^./build-beta/" | wc -l
```
Output: `4` — the one sub-count that was already correct in the original pass, still holds.

```
git check-ignore -v .atomic/workflows/feature-development.ts
```
Output: `.gitignore:6:.atomic/	.atomic/workflows/feature-development.ts` — confirms
AUDIT's correction correctly identifies this file as gitignored/generated, itemized rather
than silently dropped.

**All 4 corrected numbers reproduce exactly on independent re-run.** The correction also
transparently discloses the per-line-regex limitation behind the original 53-vs-50 candidate
gap and the ambiguous scope of the 3 `.superpowers/` hits, rather than just changing the
number — that matches what I found and reported.

## Summary

| # | AUDIT finding checked | Section | Verdict |
|---|---|---|---|
| 1 | Version drift 0.9.12→0.9.13, file count | §6 Finding #1 (top priority) | **Corrected and confirmed** — was 16 (wrong), now 13 total / 12 source, reproduces exactly |
| 2 | Markdown link check counts | §1 | **Corrected and confirmed** — was 35/50 (wrong), now 42/50 (53 w/ 3 disclosed ambiguous-scope hits), reproduces exactly |
| 3 | `bash -n` all 13 scripts pass; `board.sh` case matches usage | §3 | **Accurate** (no correction needed) |
| 4 | `atomic/README.md` never says "extension" | §4 | **Accurate** (no correction needed) |
| 5 | `build.sh`'s intake wait has no timeout, 60s heartbeat | §5 gap #2 | **Accurate** (no correction needed) |

**5 of 5 spot-checked findings are now accurate.** The two inaccuracies found in the first
pass (Finding #1's file count, §1's link-check counts) were corrected by the researcher in
repair cycle 1, and every corrected number independently reproduces on a fresh re-run today.
No fabricated claims found in either pass — both original issues were miscounts, disclosed
and fixed rather than defended. Criterion 7 is satisfied: at least 5 findings spot-checked
against actual repo state, confirmed accurate, recorded here with commands and real output.
