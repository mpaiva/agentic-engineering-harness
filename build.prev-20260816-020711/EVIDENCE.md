# Evidence

Verified independently by `verifier` on 2026-08-15, after implementer and docs reported
their slices done. Every command below was re-run by this agent — none of it is copied from
a builder's self-report.

## 1. Every relative link, `<img src>`, and `href` in every `.md` file resolves

**PASS**

Command: custom link scanner (`/tmp/linkcheck.py`) walking `git ls-files '*.md'` (35 files),
resolving every markdown link, `<img src>`, and `href` (excluding `http(s)://`, `mailto:`,
bare `#anchor`) against the filesystem relative to each file's directory.

```
$ python3 /tmp/linkcheck.py
Total broken: 0
```

`git ls-files '*.md' | wc -l` → `35`, matching implementer's claimed scope.

## 2. Every shell script in `scripts/` and `build.sh` passes `bash -n`; shellcheck where available

**PASS**

```
$ bash -n build.sh && echo OK
OK
$ for f in scripts/*.sh; do bash -n "$f" && echo "OK: $f"; done
OK: scripts/assemble-demo.sh
OK: scripts/board.sh
OK: scripts/capture-demo.sh
OK: scripts/kanban.sh
OK: scripts/launch-feature.sh
OK: scripts/new-workspace.sh
OK: scripts/setup.sh
OK: scripts/status.sh
OK: scripts/sync-workflows.sh
OK: scripts/team-chat.sh
OK: scripts/team-status.sh
OK: scripts/team.sh
$ which shellcheck
(not found — confirmed not installed, so "no unaddressed error-level finding" is
vacuously satisfied per MISSION.md wording "where shellcheck is available")
```

## 3. G1 (build.sh 10-minute intake timeout) closed

**PASS**

```
$ git log -S"seq 1 600" --oneline -- build.sh
6797834 build.sh: remove intake-wait timeout and guide the user on interrupt
69b51dd harness: add build.sh, the human entry point
$ grep -n "seq 1 600" build.sh
(no output — cap absent from HEAD)
$ sed -n '284p' build.sh
trap 'printf "\n[harness] Interrupted before you answered. The lead is still live in its pane.\n  Attach with:  herdr --session %s\n  Answer the question, then re-run: ./build.sh --resume\n  Or stop the run: herdr --session %s server stop\n" "$SESSION" "$SESSION" >&2; exit 130' INT TERM
```

Trap present, unbounded wait with heartbeat confirmed in `build.sh:273-293`.
`research/gap-assessment-2026-08-14.md` G1 entry marked `Status: CLOSED`, cites commit
`6797834` and `research/review-2026-08-14-g1-intake-fix.md` — file exists and is current.

## 4. poem-page inconsistency resolved and documented

**PASS**

```
$ shasum -a 1 docs/samples/poem-page.html
90b97e3c899c496f42491cb533fbb12785a7b3b0  docs/samples/poem-page.html
```

Matches the checksum stated in `docs/samples/README.md` exactly:
`90b97e3c899c496f42491cb533fbb12785a7b3b0`.

Decision: commit `431bee1` ("docs: remove the first-run and poem-page case studies") removed
the prose case-study write-ups (no screenshots ever existed for that run) and removed every
link to them, while keeping the built artifact (`docs/samples/poem-page.html`) and its entry
in `docs/samples/README.md` as evidence, with an explicit "This file is an exact copy" note
and checksum. One deliberate resolution, documented in the commit message and in
`docs/samples/README.md`.

## 5. TypeScript under `atomic/workflows/` and `atomic/extensions/` consistent with `atomic/README.md`

**PASS**

```
$ ls atomic/workflows/ atomic/extensions/
atomic/extensions/:
build-intake.ts  herdr-state.ts  intercom-bridge.ts
atomic/workflows/:
feature-development.ts
```

`atomic/README.md` documents all 3 extensions in its Extensions table
(`extensions/build-intake.ts`, `extensions/herdr-state.ts`, `extensions/intercom-bridge.ts`)
and the 1 workflow (`workflows/feature-development.ts`), explicitly labeled a "teaching
reference," not part of the primary flow.

```
$ grep -n "build-intake\|herdr-state\|intercom-bridge" build.sh
59:  echo "  -e $HERE/atomic/extensions/herdr-state.ts"
60:  echo "  -e $HERE/atomic/extensions/build-intake.ts"
61:  echo "  -e $HERE/atomic/extensions/intercom-bridge.ts"
103-105: (wired into the atomic launch command)
```

All 3 extensions are wired into `build.sh`'s primary flow and all 3 are documented.
`feature-development.ts` is correctly not claimed as part of the `build.sh` flow (it isn't
referenced there) and is labeled as a teaching reference in `atomic/README.md`. No
described-but-missing workflow, no undocumented extension.

Version label: `atomic/README.md:5` states "Verified against Atomic `0.9.13`."

```
$ atomic --version
0.9.13
```

Matches installed binary.

## 6. `team/*.md` role briefs stay domain-neutral

**PASS**

```
$ grep -in "react\|vue\|angular\|django\|rails\|npm install\|node\.js\|frontend\|backend\|css\b\|html\b\|javascript\|python\|web app\|webapp" team/*.md
team/ROLES.md:27:- **A web app with a database** → `pm`, `researcher`, `architect`, `implementer`, ...
team/lead.md:52:need three agents; a web application may need the lead plus 7 specialists. Hiring a role with nothing to do wastes
```

Both hits are explicit worked examples of mission→roster sizing ("if the mission is X, hire
Y"), not baked-in assumptions about what this repo builds — matching the `AGENTS.md` carve-out
("A brief that assumes a web app... is a defect — the mission supplies the domain"). No role
brief assumes a language, framework, or domain as the subject of the work itself.

## 7. Senior-engineer skim path: README → getting-started → architecture → operating-model

**PASS**

Read all four documents in sequence. Findings:

- Version strings consistent and match installed tools:
  ```
  $ herdr --version
  herdr 0.8.0
  $ ghostty --version
  Ghostty 1.3.1
  $ claude --version
  2.1.233 (Claude Code)
  $ atomic --version
  0.9.13
  ```
  `docs/getting-started.md:12` states "Verified against: Atomic 0.9.13, Herdr 0.8.0, Ghostty
  1.3.1, Claude Code 2.1.x" — all four match the installed binaries exactly.

- Stale version grep, scoped to the 4-doc path only:
  ```
  $ grep -n "0\.9\.12" README.md docs/getting-started.md docs/architecture.md docs/operating-model.md
  (no output — 0 hits)
  ```
  (Other files outside this path — `docs/superpowers/plans/*.md`,
  `herdr/atomic-integration.md` — retain `0.9.12` as a deliberate historical/versioned fact,
  out of criterion 7's scope, not a stale claim about current state.)

- README's "Learn more" section (`README.md:279-292`) links
  `docs/getting-started.md`, `docs/architecture.md`, and `docs/operating-model.md`, all
  present and all resolve (see criterion 1's link scan).

- Cross-doc anchor check: `docs/architecture.md:131` links
  `operating-model.md#maturity-model`; confirmed the heading exists:
  ```
  $ grep -n "^## Maturity model" docs/operating-model.md
  107:## Maturity model
  ```

- Read for contradictions between the four docs: none found. Command examples
  (`npm install -g @bastani/atomic`, `herdr integration install claude`, `./build.sh`,
  `herdr --session harness`) match `--help` output shape and are consistent with
  `atomic/README.md` and `herdr/setup.md` conventions referenced elsewhere.

## 8. `build/EVIDENCE.md` exists

**PASS** — this file.

## Non-goals, explicitly not attempted (per `MISSION.md`)

- **G2** (`--resume` mid-run correctness): requires a live, human-driven paid run.
  **Not attempted**, per `MISSION.md` non-goals. No claim of correctness is made.
- **G3** (large end-to-end job completion): requires a live, human-driven paid run.
  **Not attempted**, per `MISSION.md` non-goals. No claim of completion is made.

## Summary

All 8 numbered success criteria: **PASS**, independently re-verified. G2/G3 explicitly
logged as out of autonomous reach per the mission's own non-goals — not silently skipped.
