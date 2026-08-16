# Project-Agnostic Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this repo from "a harness demonstrated on an HRIS" into one that builds whatever the user asks for: `./build.sh` opens a popup asking what to build, the lead refines the answer with Atomic's `prompt-engineer` skill into a generated `build/MISSION.md`, then hires only the roles that mission needs and drives the build over Intercom.

**Architecture:** One Herdr session hosts one Atomic session per agent. `build.sh` (humans) creates a single `lead` pane; `scripts/team.sh add <role>` (the lead) grows the team pane by pane. Two Atomic extensions do the non-conversational work: `build-intake.ts` asks the opening question, `herdr-state.ts` (already built) pushes each session's lifecycle state into Herdr's sidebar. Agents coordinate over Atomic Intercom and may run `/workflow feature-development` on their own slices.

**Tech Stack:** Bash 3.2 (macOS default), TypeScript (Atomic extensions), Markdown (role briefs/docs), Herdr 0.8.0 socket API, Atomic 0.9.12.

**Spec:** `docs/superpowers/specs/2026-08-13-project-agnostic-harness-design.md`

## Global Constraints

- **Bash 3.2 safe.** macOS ships bash 3.2; no `declare -A`, no `mapfile`, no `${var^^}`.
- **Verification is command-based, not test-framework-based.** This repo has no test suite. Per `AGENTS.md`, "done" means: markdown links resolve, every CLI snippet has been run or copied verbatim from `--help`, and claims are backed by real output. Each task below states the exact command and expected result.
- **Ground truth over assumption.** Before documenting any `herdr`/`atomic` flag, run `--help`. Do not describe capabilities that do not exist; label unimplemented targets as **future / not implemented**.
- **`feature-development` is BOTH a surviving workflow AND a deleted example directory.** Delete only `examples/feature-development/`. Every reference to the *workflow* (`atomic/workflows/feature-development.ts`, `/workflow feature-development`, `scripts/launch-feature.sh`) stays.
- **Intercom ordering is load-bearing.** `/name <role>` must be sent before a session makes any Intercom call. A session that connects unnamed registers as `subagent-chat-<id>` and is unaddressable by role for its entire life.
- **Intercom group is all-or-none.** Cross-group sends are rejected by the broker, so a partially-propagated `ATOMIC_INTERCOM_GROUP` produces a silent split-brain.
- **Never `exec` Atomic in a pane launcher.** Keep a shell wrapping it so the exit status reaches the scrollback, and tee stderr to a log.
- **Model default:** `claude-sonnet-5`, provider `anthropic`.
- **Commit convention:** `<area>: <imperative summary>`, body explains why.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `build.sh` | Human entry point. Creates the Herdr session, one `lead` pane, boots Atomic, hands off to the popup. |
| `scripts/team.sh` | Agent entry point. `add <role>` splits a pane, boots that role, records the hire. |
| `atomic/extensions/build-intake.ts` | Asks "What do you want to build today?" and writes `build/IDEA.md`. |
| `team/TRANSPORT.md` | Intercom protocol + deadlock rules + never-kill-your-pane rule. Appended to every agent's system prompt. |
| `team/lead.md` | Orchestrator brief: refine → gate → compose → delegate → converge. |
| `team/ROLES.md` | Role index with explicit "hire when…" conditions. The lead reads this to compose. |
| `team/{pm,researcher,architect,implementer,designer,accessibility,verifier,devops,docs}.md` | Nine domain-neutral role briefs. |
| `docs/case-study-first-run.md` | Recorded first real run — replaces the deleted examples as the repo's evidence. |

**Modified:** `.gitignore`, `README.md`, `docs/getting-started.md`, `herdr/atomic-integration.md`, `scripts/setup.sh`, `atomic/README.md`, `AGENTS.md`.

**Deleted:** `examples/` (all four), `atomic/workflows/hcm-stack-research.ts`, `atomic/workflows/hcm-model-design.ts`, `atomic/workflows/hcm-feature-build.ts`, `atomic/workflows/intercom-team.ts`.

**Unchanged:** `atomic/extensions/herdr-state.ts`, `atomic/workflows/feature-development.ts`, `scripts/launch-feature.sh`, `scripts/new-workspace.sh`, `scripts/sync-workflows.sh`, `scripts/status.sh`, `ghostty/`, `docs/architecture.md`, `docs/operating-model.md`, `docs/monitoring-agents.md`, `docs/verification-and-gates.md`, `docs/security.md`.

---

# PHASE 1 — Cleanup

### Task 1: Delete the examples and domain-specific workflows

**Files:**
- Delete: `examples/` (entire tree), `atomic/workflows/hcm-stack-research.ts`, `atomic/workflows/hcm-model-design.ts`, `atomic/workflows/hcm-feature-build.ts`, `atomic/workflows/intercom-team.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a repo with no `examples/` directory and a root-level `/build/` ignore rule that later tasks write into.

⚠️ **Gate before starting:** `examples/agentic-hris/build/` is git-ignored and holds a complete artifact set from a real run (`PRD.md`, `RESEARCH.md`, `DESIGN.md`, `A11Y.md`, `CONTRACT.md`, `FIXTURES.md`, `EVIDENCE.md`, plus a Next.js scaffold). Deleting it is **permanent and unrecoverable from git history**. Confirm with the user that it may go, or copy it elsewhere first. Also stop any running session: `herdr --session agentic-hris-atomic server stop`.

- [ ] **Step 1: Confirm nothing is running and record what will be lost**

```bash
herdr --session agentic-hris-atomic server stop 2>/dev/null || true
herdr --session agentic-hris server stop 2>/dev/null || true
ls examples/agentic-hris/build/*.md 2>/dev/null
```
Expected: the server stop commands succeed or report "not running"; the `ls` prints the artifact list you just confirmed may be deleted.

- [ ] **Step 2: Verify the current ignore rule, then replace it**

```bash
grep -n "build" .gitignore
```
Expected: shows `examples/agentic-hris/build/` (around line 27).

Replace that line with a root-level rule. The run directory moves to `build/`, and without this the generated product **and its `node_modules`** would be committed:

```
/build/
```

- [ ] **Step 3: Delete the examples and the domain-specific workflows**

```bash
git rm -r --quiet examples/
git rm --quiet atomic/workflows/hcm-stack-research.ts \
                atomic/workflows/hcm-model-design.ts \
                atomic/workflows/hcm-feature-build.ts \
                atomic/workflows/intercom-team.ts
rm -rf examples/
```

- [ ] **Step 4: Verify the surviving workflow is intact and untouched**

```bash
ls atomic/workflows/
git status --short atomic/workflows/feature-development.ts
```
Expected: `ls` prints exactly `feature-development.ts`. The `git status` prints **nothing** — this file must not be modified.

- [ ] **Step 5: Verify the ignore rule works**

```bash
mkdir -p build && echo test > build/scratch.txt
git status --porcelain build/
rm -rf build
```
Expected: `git status --porcelain build/` prints **nothing** (the directory is ignored).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "cleanup: remove the domain-specific examples and workflows

The harness argued its case through four worked examples, two of them HR-domain, which
tied a domain-neutral operating model to a domain nobody else is building. They are
replaced by a generic builder that produces its own worked example on every run.

Deleted: examples/ entirely, and the hcm-* and intercom-team workflows. Kept:
feature-development.ts, which is already domain-neutral and is the workflow agents will
trigger on their own slices. The gitignore entry moves with the run directory to a
root-level /build/, without which a generated product and its node_modules would be
committed."
```

---

### Task 2: Rewrite README.md

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the deletions from Task 1.
- Produces: the repo's front door describing `./build.sh` as the entry point. Later tasks implement what it documents, so **it will describe commands that do not exist yet** — that is expected within this phase and resolved by Task 7 and Task 10.

- [ ] **Step 1: Find every broken reference**

```bash
grep -n -E "examples/|herdr-demo\.gif|hcm-graph|agentic-hris|atomic-intercom" README.md
```
Expected: matches in the "See it run" section (an image pointing at `examples/agentic-hris/herdr-demo.gif`), the repository-layout tree, reading-order items 3 and 4, the Quick start, and the Status section.

- [ ] **Step 2: Replace the "See it run" section**

The GIF file is deleted, so the image link is broken. Replace the whole section with:

```markdown
## See it run

```bash
./build.sh
```

You are asked one question — **"What do you want to build today?"** — and the answer becomes
the project. A lead agent refines it into a mission, hires the roles that mission actually
needs, and drives the build. A Rust CLI gets a small team; a web app gets a larger one. You
watch the cockpit grow from one pane to N, and `build/ROSTER.md` records who was hired and why.
```

- [ ] **Step 3: Replace the repository-layout tree**

```markdown
```text
atomic-cockpit/
├── README.md                     ← you are here
├── AGENTS.md                     ← rules for coding agents working in THIS repo
├── build.sh                      ← the one command you run
├── team/
│   ├── ROLES.md                  ← the role library index: what to hire, and when
│   ├── TRANSPORT.md              ← how agents talk to each other (Atomic Intercom)
│   ├── lead.md                   ← the orchestrator's brief
│   └── *.md                      ← one brief per role, domain-neutral
├── atomic/
│   ├── README.md                 ← how workflows are defined and run
│   ├── extensions/
│   │   ├── build-intake.ts       ← asks what to build; writes build/IDEA.md
│   │   └── herdr-state.ts        ← projects Atomic session state into Herdr's sidebar
│   └── workflows/
│       └── feature-development.ts← the reference feature workflow (process spec)
├── docs/
│   ├── architecture.md           ← the three-layer model, in depth
│   ├── getting-started.md        ← install + first build
│   ├── operating-model.md        ← goal/scope/context/constraints/verification/approval
│   ├── monitoring-agents.md      ← supervision by exception, agent states
│   ├── verification-and-gates.md ← independent verification + human review gates
│   ├── security.md               ← least privilege + isolation
│   └── case-study-first-run.md   ← a real run, start to finish
├── herdr/                        ← setup, workspace conventions, Atomic integration
├── ghostty/                      ← recommended terminal config
└── scripts/
    ├── team.sh                   ← the lead hires with this: team.sh add <role>
    ├── setup.sh                  ← install Atomic + Herdr + Ghostty
    ├── new-workspace.sh          ← create a Herdr workspace for an outcome
    ├── launch-feature.sh         ← drive the feature-development workflow across panes
    ├── sync-workflows.sh         ← make repo workflows discoverable by Atomic
    └── status.sh                 ← roll up agent states (supervision by exception)
```
```

- [ ] **Step 4: Replace the Quick start section**

```markdown
## Quick start

```bash
./scripts/setup.sh    # installs Atomic + Herdr + Ghostty, wires state + syncs workflows
claude                # run once to log in (optional; only if you use Claude Code directly)
atomic                # run once, then /login → Claude Pro/Max
./build.sh            # asks what to build, then builds it
```
```

- [ ] **Step 5: Fix the reading order**

Reading-order items 3 and 4 point at deleted examples. Replace both with a single item:

```markdown
4. **`docs/case-study-first-run.md`** — one real run end to end: the question, the refined mission, the roster the lead chose and why, and the evidence it finished with.
```

- [ ] **Step 6: Fix the Status section**

Remove the bullets describing `examples/hcm-graph` and the recorded `goal` run. Replace the "pointed at a real product" bullet with:

```markdown
- **The harness builds whatever you point it at.** `./build.sh` asks what you want, refines it with Atomic's `prompt-engineer` skill into a mission, and composes a team to build it. See `docs/case-study-first-run.md` for a recorded run.
```

- [ ] **Step 7: Verify no broken references remain**

```bash
grep -n -E "examples/|herdr-demo\.gif|hcm-graph|agentic-hris|atomic-intercom" README.md
```
Expected: **no output.**

- [ ] **Step 8: Verify every relative link in README resolves**

```bash
grep -o '](\([^)#]*\.md\)' README.md | sed 's/](//' | while read -r p; do
  [ -e "$p" ] || echo "BROKEN: $p"
done
```
Expected: only `BROKEN: docs/case-study-first-run.md` (created in Task 11). Any other broken path is a defect to fix now.

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs: rewrite the README around ./build.sh

The front door described four examples that no longer exist. It now describes the single
command a reader runs and what happens after they answer the opening question. The layout
tree gains team/ and atomic/extensions/, and the reading order points at a recorded run
instead of at deleted case studies."
```

---

### Task 3: Fix the remaining documentation references

**Files:**
- Modify: `docs/getting-started.md`, `herdr/atomic-integration.md`, `scripts/setup.sh`, `atomic/README.md`, `AGENTS.md`

**Interfaces:**
- Consumes: Task 1's deletions.
- Produces: a repo where every markdown link resolves and no snippet points at a deleted path.

⚠️ Do **not** rewrite references to the `feature-development` *workflow* — it survives. Only `examples/feature-development` paths are broken.

- [ ] **Step 1: Fix `docs/getting-started.md`**

```bash
grep -n "examples/" docs/getting-started.md
```
Expected: one match, `cd examples/feature-development` (~line 108).

Replace that block's walkthrough with the generic entry point:

```markdown
```bash
./build.sh
```

Answer the question it asks. The lead refines your answer into `build/MISSION.md`, shows it
to you for confirmation, then hires its team and starts building.
```

- [ ] **Step 2: Fix `herdr/atomic-integration.md`**

```bash
grep -n -E "examples/|employee event" herdr/atomic-integration.md
```
Expected: a link to `../examples/feature-development/README.md` (~line 39) and an HR-flavoured objective (~line 31).

Replace the HR objective with a domain-neutral one, in both places it appears:

```
atomic -p '/workflow feature-development objective="Add CSV export to the report view"'
```

In the line-39 sentence, drop the `and what the example (at ../examples/feature-development/README.md) runs` clause, keeping the reference to `../scripts/launch-feature.sh`, which still exists.

- [ ] **Step 3: Fix `scripts/setup.sh`**

```bash
grep -n -E "agentic-hris|examples/" scripts/setup.sh
```
Expected: matches around lines 62-68 in the closing instructions.

Replace that closing block with:

```bash
cat <<'EOF'

Next:
  ./build.sh                      # asks what to build, then builds it
  herdr --session harness         # attach and watch the cockpit

See README.md before your first run (cost, autonomy, isolation).
EOF
```

- [ ] **Step 4: Genericize the example objective in `atomic/README.md`**

```bash
grep -n "employee event" atomic/README.md
```
Expected: one match (~line 63).

Replace with:

```
/workflow feature-development objective="Add CSV export to the report view"
```

- [ ] **Step 5: Add the new conventions to `AGENTS.md`**

`AGENTS.md` line ~50 mentions the `feature-development` workflow in a commit-message example — that is still valid, leave it. Add to the "Scope and guardrails" section:

```markdown
- **`build/` is run output, not source.** It is git-ignored and recreated by `./build.sh`. Never commit anything from it; never treat its contents as repo documentation.
- **Role briefs in `team/` must stay domain-neutral.** They are appended to agent system prompts for *any* project. A brief that assumes a web app, a language, or a domain is a defect — the mission supplies the domain, the brief supplies the discipline.
```

- [ ] **Step 6: Verify every markdown link in the repo resolves**

```bash
find . -name '*.md' -not -path './.git/*' -not -path './build/*' | while read -r f; do
  d=$(dirname "$f")
  grep -o '](\([^)#][^)]*\.md\)' "$f" 2>/dev/null | sed 's/](//' | while read -r p; do
    case "$p" in http*) continue;; esac
    [ -e "$d/$p" ] || echo "BROKEN in $f -> $p"
  done
done
```
Expected: only references to `docs/case-study-first-run.md` (created in Task 11). Fix anything else.

- [ ] **Step 7: Verify no snippet points at a deleted path**

```bash
grep -rn -E "examples/" --include="*.md" --include="*.sh" --include="*.ts" . | grep -v "^./docs/superpowers/"
```
Expected: **no output.**

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: repoint the remaining references at ./build.sh

getting-started, atomic-integration, and setup.sh walked the reader into example
directories that no longer exist, and two snippets used an HR-flavoured objective in a
repo that is no longer HR-flavoured. References to the feature-development *workflow* are
deliberately untouched: the workflow survives, only the example directory was deleted.

AGENTS.md gains two rules the new layout needs — build/ is run output and never committed,
and role briefs must stay domain-neutral because they are appended to system prompts for
any project."
```

---

# PHASE 2 — Intake and lead

### Task 4: Write the transport brief

**Files:**
- Create: `team/TRANSPORT.md`

**Interfaces:**
- Produces: `team/TRANSPORT.md`, appended verbatim to **every** agent's system prompt by `build.sh` (Task 7) and `scripts/team.sh` (Task 10).

This content is not new prose — it is the transport brief proven in the previous Atomic team run, promoted from generated-at-launch to a versioned file.

- [ ] **Step 1: Create `team/TRANSPORT.md`**

```markdown
# How this team communicates

You are one of several Atomic sessions running side by side in a Herdr cockpit. You talk to
your teammates with Atomic's **intercom** tool. Do NOT use `herdr agent prompt` — it cannot
reach these agents.

  Delegate / notify / hand off :  intercom({ action: "send",  to: "<name>", message: "..." })
  Ask a BLOCKING question      :  intercom({ action: "ask",   to: "<name>", message: "..." })
  Answer a question sent to you:  intercom({ action: "reply", message: "..." })
  See who is live              :  intercom({ action: "list" })

Teammates are addressed by role name (`lead`, `verifier`, …). Run `intercom({action:"list"})`
to see who has been hired so far — the roster grows as the lead hires.

## Rules that keep this team from deadlocking — follow them exactly

1. **The lead delegates with `send`, never `ask`.** Only one `ask` may be outstanding per
   session; a lead blocked inside an `ask` cannot be reached by anyone else.
2. Use `ask` only when you genuinely cannot proceed without the answer. Otherwise `send`.
3. If a message arrives asking you something, **`reply` promptly** — a teammate is blocked
   waiting on you. Answer decisively; do not start a long task before replying.
4. A session appears in `list` only after it has used intercom at least once, so an empty
   roster means your teammates are still booting — not that you are working alone.
5. When you finish a task, `send` the result to whoever asked for it. Artifacts are files
   under `build/` — reference them by path rather than pasting them.

## Never terminate your own pane or session

Do not run `exit`, `herdr pane close`, `herdr server stop`, or anything else that closes a
pane or stops the Herdr session — not on yourself and not on a teammate. A closed pane takes
its scrollback with it, so the human loses the record of what you did, and the team loses an
agent it cannot get back. `herdr` commands cannot reach these agents anyway — that is what
intercom is for — so you have no reason to run one. If you believe your work is finished, say
so and stop generating; the human decides when this team shuts down.

## Your working directory

All work happens under `build/`. Never touch anything outside it.
```

- [ ] **Step 2: Verify the file is complete and self-contained**

```bash
grep -c "intercom" team/TRANSPORT.md
grep -n "never\|Never" team/TRANSPORT.md
```
Expected: several `intercom` matches; the "never `ask`" rule and the "Never terminate" heading both present.

- [ ] **Step 3: Commit**

```bash
git add team/TRANSPORT.md
git commit -m "team: add the intercom transport brief

Promoted from generated-at-launch to a versioned file, because it is project-agnostic and
every agent needs it verbatim. The deadlock rules are empirical: only one ask may be
outstanding per session, so a lead that asks instead of sends becomes unreachable by the
rest of the team. The never-terminate-your-own-pane rule exists because an agent did."
```

---

### Task 5: Build the intake extension

**Files:**
- Create: `atomic/extensions/build-intake.ts`

**Interfaces:**
- Consumes: env `ATOMIC_ROLE`, env `BUILD_DIR`; Atomic's `ctx.ui.input(label, placeholder)` which returns `string | undefined` (`undefined` on cancel).
- Produces: `$BUILD_DIR/IDEA.md`, which Task 6 (`team/lead.md`) and Task 7 (`build.sh`) both depend on by that exact path. Also registers the `/build-intake` command to reopen the popup.

- [ ] **Step 1: Verify the API before writing against it**

```bash
grep -n "ui.input" /Users/mp/.bun/install/global/node_modules/@bastani/atomic/docs/extensions.md
grep -n "input() returns" /Users/mp/.bun/install/global/node_modules/@bastani/atomic/docs/extensions.md
```
Expected: confirms `ctx.ui.input("Name:", "placeholder")` and that `input()` returns `undefined` on cancel. If either has changed in your installed Atomic, follow the installed docs, not this plan.

- [ ] **Step 2: Determine whether an extension can self-start a turn**

```bash
grep -n -E "submitPrompt|sendMessage|startTurn|ctx\.(agent|session)\." /Users/mp/.bun/install/global/node_modules/@bastani/atomic/docs/extensions.md | head -20
```

This decides one branch of the design:
- **If an API exists** to submit a prompt programmatically, use it at the end of `session_start` so the lead begins refining immediately.
- **If not** (expected), the extension only writes `IDEA.md`, and `build.sh` (Task 7) polls for that file and sends the kickoff line with `herdr pane send-text`. This fallback is already proven in this repo.

Record which branch you took in the commit message.

- [ ] **Step 3: Write the extension**

```typescript
/**
 * build-intake — ask the human what to build, once, at the start of a run.
 *
 * This is the harness's front door. It fires in the lead's pane before any tokens are
 * spent, so the opening question cannot be skipped by the model deciding not to ask it.
 *
 * Writes the answer verbatim to $BUILD_DIR/IDEA.md. The lead then refines that raw answer
 * into build/MISSION.md with Atomic's bundled `prompt-engineer` skill. Keeping the raw
 * answer on disk matters: refinement can widen scope, and MISSION.md embeds the original
 * so drift stays visible.
 *
 * Verified against Atomic 0.9.12.
 */
import type { ExtensionAPI } from "@bastani/atomic";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROLE = process.env.ATOMIC_ROLE ?? "";
const BUILD_DIR = process.env.BUILD_DIR ?? "build";
const IDEA_PATH = join(BUILD_DIR, "IDEA.md");

const QUESTION = "What do you want to build today?";
const PLACEHOLDER = "e.g. a CLI that converts CSV to JSON, with tests";

async function askAndRecord(ctx: any): Promise<boolean> {
  const answer = await ctx.ui.input(QUESTION, PLACEHOLDER);

  // Escape/cancel returns undefined. Write nothing — a half-captured idea is worse than
  // none, because the lead would build against it.
  if (answer === undefined || String(answer).trim() === "") {
    ctx.ui.notify("No idea captured. Run /build-intake to try again.", "warn");
    return false;
  }

  mkdirSync(dirname(IDEA_PATH), { recursive: true });
  writeFileSync(
    IDEA_PATH,
    `# Raw idea\n\nCaptured verbatim from the opening question. Do not edit — \`MISSION.md\`\nis the refined version, and this file is what it is checked against.\n\n> ${QUESTION}\n\n${String(answer).trim()}\n`,
    "utf8",
  );
  ctx.ui.notify(`Captured. Refining into ${BUILD_DIR}/MISSION.md…`, "info");
  return true;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Only the orchestrator asks. Without this guard every specialist pops a dialog at boot.
    if (ROLE !== "lead") return;

    // A restarted lead must resume, not re-ask and clobber the mission it already has.
    if (existsSync(IDEA_PATH)) return;

    await askAndRecord(ctx);
  });

  // Manual re-trigger, so a cancelled or mistyped answer is recoverable without relaunching.
  pi.registerCommand("build-intake", {
    description: "Ask what to build and (re)write build/IDEA.md",
    handler: async (_args, ctx) => {
      await askAndRecord(ctx);
    },
  });
}
```

- [ ] **Step 4: Verify it loads without error outside Herdr**

```bash
cd /tmp && ATOMIC_ROLE=specialist atomic -e /Users/mp/git-repos/atomic-cockpit/atomic/extensions/build-intake.ts -p "reply with the single word: loaded"
```
Expected: prints `loaded` with no extension error and **no popup** — the `ROLE !== "lead"` guard suppresses it. This proves the guard works and the module parses.

- [ ] **Step 5: Verify the no-op-on-existing-idea guard**

```bash
mkdir -p /tmp/intake-test/build && echo "existing" > /tmp/intake-test/build/IDEA.md
cd /tmp/intake-test && ATOMIC_ROLE=lead BUILD_DIR=/tmp/intake-test/build \
  atomic -e /Users/mp/git-repos/atomic-cockpit/atomic/extensions/build-intake.ts \
  -p "reply with the single word: resumed"
cat /tmp/intake-test/build/IDEA.md
```
Expected: prints `resumed`, no popup appears, and `IDEA.md` still contains exactly `existing` — proving a lead restart cannot clobber a mission in progress.

- [ ] **Step 6: Commit**

```bash
git add atomic/extensions/build-intake.ts
git commit -m "atomic: add the build-intake popup extension

The harness's front door. Fires on session_start in the lead's pane and asks what to build
before a token is spent, so the opening question cannot be skipped by model discretion.

Three guards, each earned: it fires only when ATOMIC_ROLE=lead (otherwise every specialist
pops a dialog at boot), it no-ops when IDEA.md already exists (so a restarted lead resumes
instead of clobbering its mission), and cancel writes nothing while registering
/build-intake to reopen the popup."
```

---

### Task 6: Write the lead brief

**Files:**
- Create: `team/lead.md`

**Interfaces:**
- Consumes: `build/IDEA.md` (Task 5), `team/ROLES.md` and `scripts/team.sh` (Task 9/10 — referenced by exact path, created later in the plan).
- Produces: the behaviour contract for `build/MISSION.md`, `build/ROSTER.md`, and `build/EVIDENCE.md`.

- [ ] **Step 1: Create `team/lead.md`**

```markdown
# Role: Lead — orchestrator

You are a principal engineer and multi-agent orchestrator. You own the outcome. You write
little of the code yourself — you turn a human's one-line idea into a mission, hire the team
that mission needs, and drive it to done.

## 1. Refine the idea into a mission

`build/IDEA.md` holds the human's raw answer, captured verbatim. Your first act is to turn it
into a mission using Atomic's bundled prompt-engineering skill:

```
/skill:prompt-engineer
```

Refine the raw idea into `build/MISSION.md` with these sections:

- **Raw idea** — `build/IDEA.md` reproduced verbatim, unedited. This is the anchor.
- **Goal** — one paragraph: what exists at the end, in the user's terms.
- **Success criteria** — a numbered list, each independently checkable by someone who did not
  build it. "Works well" is not a criterion; "`csv2json fixtures/simple.csv` prints the
  documented JSON and exits 0" is.
- **Constraints** — language, stack, platform, dependencies, anything the human specified.
- **Non-goals** — what you are deliberately not building. Refinement widens scope if you let
  it; this section is where you hold the line.
- **Stop rules** — when the team stops, and what "done" requires as evidence.

**Do not widen the request.** A sharper prompt is the goal; a bigger project is not. If the
idea says "a CLI that converts CSV to JSON", the mission is that CLI — not a plugin
architecture, not a web UI, not a format-conversion framework. When you genuinely need a
decision the idea does not settle, put it in the mission's Constraints as an explicit
assumption rather than inventing scope.

## 2. Human gate — confirm before spending

Before hiring anyone, show the human the mission and wait:

```
ask_user_question({ ... })
```

Present the Goal, the Success criteria, and the Non-goals, and ask whether to proceed as
written. This is the last cheap moment to correct course: everything after it is autonomous
spend across several agents. If the human amends the mission, rewrite `build/MISSION.md`
first, then continue.

## 3. Compose the team

Read `team/ROLES.md`. It lists every available role and the condition under which each is
worth hiring. Choose the roles **this** mission needs — not a standard set. A small CLI may
need three agents; a web application may need eight. Hiring a role with nothing to do wastes
money and adds coordination cost.

Hire one at a time:

```bash
scripts/team.sh add <role> --reason "<why this mission needs it>"
```

Each call splits a pane, boots that role with its brief, and appends the hire to
`build/ROSTER.md`. Rules:

- **Always hire `verifier`.** Nothing is done because you say it is; evidence decides.
- The team is capped at 8. If you want more, you are probably decomposing badly.
- Hire when you have work to hand over, not in advance.

## 4. Delegate and converge

Coordinate over intercom per `TRANSPORT.md` — delegate with `send`, never `ask`.

1. **Contract first.** Fix the shared shape (interfaces, data model, file layout) in
   `build/CONTRACT.md` so parallel builders do not diverge, and broadcast it.
2. **Parallelize** independent work; **synthesize** before integrating.
3. **Verify each slice.** Task `verifier` to re-run checks and report evidence. Never accept
   "done" without command output.
4. **Bounded repair.** Route findings back to the owning agent. Max ~3 cycles per slice, then
   write `build/BLOCKED.md` and stop for the human rather than grinding.
5. **Converge.** Drive to the mission's success criteria, write `build/EVIDENCE.md` recording
   which criterion passed and by what command, then stop.

Any agent — including you — may run a workflow on its own slice when the work fits one:

```
/workflow feature-development objective="..."
```

## Principles

- **Evidence over claims.** You verify through `verifier` and real command output.
- **The mission is the contract.** If work drifts from it, the work is wrong.
- **Escalate rather than guess** on product questions the mission does not settle.
- **Never terminate your own pane or a teammate's** (see `TRANSPORT.md`).
```

- [ ] **Step 2: Verify the brief references only real commands**

```bash
grep -n -E "skill:prompt-engineer|ask_user_question|team\.sh add|workflow feature-development" team/lead.md
ls /Users/mp/.bun/install/global/node_modules/@bastani/atomic/dist/builtin/workflows/skills/prompt-engineer/SKILL.md
ls atomic/workflows/feature-development.ts
```
Expected: the brief's four commands are present; both referenced assets exist. `scripts/team.sh` does not exist until Task 10 — that is expected ordering.

- [ ] **Step 3: Commit**

```bash
git add team/lead.md
git commit -m "team: add the lead orchestrator brief

Defines the four acts of a run: refine the raw idea into build/MISSION.md with the
prompt-engineer skill, gate on human confirmation before spending, compose a team from the
role library, then delegate and converge on evidence.

The 'do not widen the request' instruction and the mandatory Non-goals section are the
guard against refinement drift: prompt-engineer makes prompts sharper, which is also how a
CSV converter quietly becomes a plugin architecture."
```

---

### Task 7: Build the human entry point

**Files:**
- Create: `build.sh`

**Interfaces:**
- Consumes: `team/lead.md`, `team/TRANSPORT.md`, `atomic/extensions/build-intake.ts`, `atomic/extensions/herdr-state.ts`.
- Produces: a running `lead` pane in Herdr session `harness`; exports `BUILD_DIR`, `ATOMIC_ROLE`, `ATOMIC_INTERCOM_GROUP` into every agent process; writes `build/.launch/lead.sh`, which Task 10 mirrors for other roles.

- [ ] **Step 1: Write `build.sh`**

```bash
#!/usr/bin/env bash
# build.sh — ask what to build, then build it.
#
#   ./build.sh                  # start a run
#   ./build.sh --dry-run        # print the plan, touch nothing
#   ./build.sh --resume         # re-attach a lead to an existing build/ run
#   ./build.sh --model claude-opus-5
#
# Creates ONE pane running the lead agent. The lead asks what to build (via the
# build-intake extension), refines the answer into build/MISSION.md, and then hires its own
# team with scripts/team.sh — so the cockpit grows from one pane to N as it decides.
#
# Verified against Atomic 0.9.12 and Herdr 0.8.0. Bash 3.2 safe.
set -euo pipefail

SESSION="harness"
GROUP="harness"
PROVIDER="anthropic"
MODEL="claude-sonnet-5"
MODE="run"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) MODE="dry-run" ;;
    --resume)  MODE="resume" ;;
    --session) SESSION="$2"; shift ;;
    --model)   MODEL="$2"; shift ;;
    --provider) PROVIDER="$2"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac; shift
done

HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="$HERE/build"
LAUNCHDIR="$BUILD/.launch"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

if [ "$MODE" = "dry-run" ]; then
  echo "════════════════════════════════════════════════════════════"
  echo " DRY RUN — nothing launched."
  echo " Session: $SESSION   ·   Intercom group: $GROUP"
  echo " Model:   $PROVIDER/$MODEL"
  echo " Build:   $BUILD"
  echo "════════════════════════════════════════════════════════════"
  echo "Would create ONE pane named 'lead' running Atomic with:"
  echo "  -e $HERE/atomic/extensions/herdr-state.ts"
  echo "  -e $HERE/atomic/extensions/build-intake.ts"
  echo "  --append-system-prompt <team/lead.md>"
  echo "  --append-system-prompt <team/TRANSPORT.md>"
  echo
  echo "The lead would then ask: \"What do you want to build today?\""
  echo "and hire its team with: scripts/team.sh add <role>"
  exit 0
fi

command -v herdr >/dev/null || { echo "herdr not found on PATH (run ./scripts/setup.sh)" >&2; exit 1; }
command -v atomic >/dev/null || { echo "atomic not found on PATH (run ./scripts/setup.sh)" >&2; exit 1; }
if ! atomic auth print-bearer-token --model "$MODEL" --provider "$PROVIDER" >/dev/null 2>&1; then
  echo "atomic has no usable credential for $PROVIDER/$MODEL — run 'atomic' then '/login'." >&2
  exit 1
fi

if [ "$MODE" = "run" ] && [ -f "$BUILD/IDEA.md" ]; then
  echo "build/ already holds a run (IDEA.md exists)." >&2
  echo "Use --resume to continue it, or move build/ aside to start fresh." >&2
  exit 1
fi

mkdir -p "$BUILD" "$LAUNCHDIR"

# One launcher script per agent, so the pane only ever receives a SINGLE LINE of text.
# Pasting a multi-line brief into a TUI would submit at the first newline; briefs travel as
# --append-system-prompt arguments instead.
#
# Deliberately NOT `exec`: keep a shell wrapping Atomic so an exit status reaches the
# scrollback, and tee stderr to a log, because a pane that dies takes its scrollback with it.
{
  echo '#!/usr/bin/env bash'
  echo "# generated by build.sh — starts the 'lead' agent"
  echo "export ATOMIC_ROLE=lead"
  echo "export ATOMIC_INTERCOM_GROUP=$GROUP"
  echo "export BUILD_DIR=$BUILD"
  echo "cd \"$HERE\""
  printf 'atomic -e %q -e %q --provider %q --model %q -n lead \\\n' \
    "$HERE/atomic/extensions/herdr-state.ts" \
    "$HERE/atomic/extensions/build-intake.ts" "$PROVIDER" "$MODEL"
  printf '  --append-system-prompt "$(cat %q)" \\\n' "$HERE/team/lead.md"
  printf '  --append-system-prompt "$(cat %q)" \\\n' "$HERE/team/TRANSPORT.md"
  printf '  2> >(tee -a %q >&2)\n' "$LAUNCHDIR/lead.stderr.log"
  echo 'status=$?'
  echo "echo; echo \"[harness] the lead session exited (status \$status). Pane kept open.\""
  echo "echo \"[harness] stderr: $LAUNCHDIR/lead.stderr.log\""
  echo "echo \"[harness] restart with: bash $LAUNCHDIR/lead.sh\""
} > "$LAUNCHDIR/lead.sh"
chmod +x "$LAUNCHDIR/lead.sh"

herdr server stop >/dev/null 2>&1 || true
sleep 1
[ "$MODE" = "run" ] && rm -rf "$HOME/.config/herdr/sessions/$SESSION"
sleep 0.5
( cd "$HERE" && command herdr server --session "$SESSION" >/dev/null 2>&1 & )
for _ in $(seq 1 40); do
  herdr workspace list 2>/dev/null | grep -q '"workspaces"' && break
  sleep 0.3
done
herdr workspace create --label "Harness" >/dev/null 2>&1 || true

# The root shell pane is NOT reliably panes[0]: Herdr plugin panes carry labels ("Sidebar",
# "Explorer", …) and may register first. Select on the ABSENCE of a label.
root_pane(){
  herdr pane list 2>/dev/null | python3 -c "
import sys,json
try: panes=json.load(sys.stdin)['result']['panes']
except Exception: sys.exit(1)
shells=[p for p in panes if not p.get('label')]
if not shells: sys.exit(1)
print(sorted(shells,key=lambda p:p['pane_id'])[0]['pane_id'])
"
}
LEAD=""
for _ in $(seq 1 40); do
  LEAD="$(root_pane || true)"
  [ -n "$LEAD" ] && break
  sleep 0.5
done
[ -n "$LEAD" ] || { echo "could not find a shell pane to start the lead in" >&2; exit 1; }

herdr pane rename "$LEAD" lead >/dev/null 2>&1 || true
echo "$LEAD" > "$LAUNCHDIR/lead.pane"

herdr pane send-text "$LEAD" "bash $LAUNCHDIR/lead.sh" >/dev/null
herdr pane send-keys "$LEAD" Enter >/dev/null

for _ in $(seq 1 60); do
  if herdr pane list 2>/dev/null | python3 -c "
import sys,json
p=[x for x in json.load(sys.stdin)['result']['panes'] if x['pane_id']=='$LEAD']
sys.exit(0 if p and (p[0].get('terminal_title_stripped') or '').startswith('atomic') else 1)
" 2>/dev/null; then break; fi
  sleep 1
done

# ORDER MATTERS: /name must land BEFORE the session's first intercom call. A session that
# connects to the broker unnamed registers a subagent-chat-<id> alias and stays unaddressable
# by role for the rest of its life.
herdr pane send-text "$LEAD" "/name lead" >/dev/null
herdr pane send-keys "$LEAD" Enter >/dev/null
sleep 2

# The popup is now up in the lead's pane. Wait for the human to answer it, then kick the lead
# into refining. (If a future Atomic lets an extension self-start a turn, this poll becomes
# unnecessary — see atomic/extensions/build-intake.ts.)
echo "Waiting for you to answer the popup in the cockpit…"
for _ in $(seq 1 600); do
  [ -f "$BUILD/IDEA.md" ] && break
  sleep 1
done

if [ -f "$BUILD/IDEA.md" ]; then
  herdr pane send-text "$LEAD" "Begin. Read $BUILD/IDEA.md, refine it into $BUILD/MISSION.md with /skill:prompt-engineer, show me the mission for confirmation, then hire your team with scripts/team.sh add <role>." >/dev/null
  herdr pane send-keys "$LEAD" Enter >/dev/null
else
  echo "No IDEA.md after 10 minutes. Answer the popup, or run /build-intake in the lead pane." >&2
fi

cat <<EOF

════════════════════════════════════════════════════════════
 The lead is live. It will ask what to build, then hire.
════════════════════════════════════════════════════════════
 WATCH:    herdr --session $SESSION
 ROSTER:   cat $BUILD/ROSTER.md
 MISSION:  cat $BUILD/MISSION.md
 STOP:     herdr --session $SESSION server stop

 Output lands in: $BUILD
EOF
```

- [ ] **Step 2: Verify syntax and the dry run**

```bash
chmod +x build.sh
bash -n build.sh && echo "syntax ok"
./build.sh --dry-run
```
Expected: `syntax ok`, then the dry-run banner naming both extensions and both system-prompt files. Nothing is launched and `build/` is not created.

- [ ] **Step 3: Verify the guard against clobbering an existing run**

```bash
mkdir -p build && echo "x" > build/IDEA.md
./build.sh; echo "exit=$?"
rm -rf build
```
Expected: refuses with "build/ already holds a run (IDEA.md exists)" and `exit=1`.

- [ ] **Step 4: Run it for real and confirm the popup**

```bash
./build.sh
```
Expected: a Herdr session starts with one pane named `lead`; Atomic boots; **the popup appears asking "What do you want to build today?"**. Answer: `a CLI that converts CSV to JSON, with tests`.

- [ ] **Step 5: Verify the intake and refinement chain**

```bash
cat build/IDEA.md
herdr --session harness pane list | python3 -c "
import sys,json
for p in json.load(sys.stdin)['result']['panes']:
    if p.get('label')=='lead': print('lead state =', p.get('agent_status'))
"
```
Expected: `IDEA.md` holds your answer verbatim; the lead's state is `working` — proving both the popup wrote the file and the `herdr-state` adapter is reporting.

- [ ] **Step 6: Verify the mission and the human gate**

Wait for the lead to finish refining, then:

```bash
cat build/MISSION.md
```
Expected: contains **Raw idea** (your text verbatim), **Goal**, **Success criteria**, **Constraints**, **Non-goals**, **Stop rules** — and the lead has asked you to confirm before hiring. Confirm it.

- [ ] **Step 7: Stop the run and commit**

```bash
herdr --session harness server stop
git add build.sh
git commit -m "harness: add build.sh, the human entry point

Creates one pane running the lead, boots it with both extensions and both briefs, then
waits for the popup to be answered before kicking the lead into refinement.

Carries forward four mechanics the previous launcher established by failing first: select
the unlabeled pane (plugin panes carry labels and may register first), no exec so a dead
session leaves an exit status and a stderr log, /name before any intercom call, and
fail-fast on auth before booting anything. Refuses to start over an existing build/ run."
```

---

# PHASE 3 — Role library and hiring

### Task 8: Write the role library index

**Files:**
- Create: `team/ROLES.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the index the lead reads in step 3 of `team/lead.md`. Every role name here MUST have a matching `team/<role>.md` from Task 9, and MUST be accepted by `scripts/team.sh` in Task 10.

- [ ] **Step 1: Create `team/ROLES.md`**

```markdown
# The role library

The lead reads this to compose a team for **this** mission. Hire the roles the mission needs
and no others: an idle agent costs money and adds coordination overhead. Team cap: 8.

Every role is domain-neutral. The mission supplies the domain; the brief supplies the
discipline.

| Role | Owns | Hire when |
|---|---|---|
| `pm` | Scope, priorities, product acceptance | The mission has real product judgment in it — competing features, unclear priorities, a "what does done mean" question you should not answer alone. Skip for a small, fully-specified utility. |
| `researcher` | Decision-ready evidence: prior art, libraries, formats, standards | The mission depends on facts you do not have — an unfamiliar library, a spec, a format, a platform constraint. Skip when the stack is obvious and the domain is familiar. |
| `architect` | Interfaces, data model, module boundaries | More than two components must agree on a shape, or the design has a hard-to-reverse decision in it. Skip for a single-module program. |
| `implementer` | Writing the actual code | Always, for anything that ships code. Hire a second one **only** when two work streams are genuinely independent — the contract is fixed and they touch different files. |
| `designer` | User-facing interaction and information design | The mission has a human-facing surface: a UI, a CLI's ergonomics, an output format people read. Skip for a library or an internal API. |
| `accessibility` | WCAG conformance, keyboard and assistive-tech behavior | The mission builds a graphical user interface. **Never hire for a CLI, a library, or a service** — there is no interface to make accessible. |
| `verifier` | Independent, fresh-context proof that the criteria are met | **Always.** This is the floor of trust: the agent that wrote the code is not the one who decides it is correct. |
| `devops` | Build, packaging, CI, release, runtime environment | The mission says how it must be built, packaged, deployed, or run in CI. Skip when running it locally is the whole story. |
| `docs` | README, usage docs, examples for the built product | The mission's audience is other people who must operate what you built. Skip when the success criteria never mention documentation. |

## Composition examples

- **A CLI that converts CSV to JSON** → `implementer`, `verifier`, and `docs` if usage
  documentation is a success criterion. Three agents. No designer, no accessibility, no pm.
- **A web app with a database** → `pm`, `researcher`, `architect`, `implementer` ×2,
  `designer`, `accessibility`, `verifier`. Eight agents.
- **A library with an unfamiliar spec** → `researcher`, `architect`, `implementer`,
  `verifier`. Four agents.

If you find yourself hiring every role, re-read the mission — you are probably building
something smaller than the roster implies.
```

- [ ] **Step 2: Verify every listed role will resolve**

```bash
grep -oE '^\| `[a-z]+`' team/ROLES.md | tr -d '|` ' | sort > /tmp/roles-listed.txt
cat /tmp/roles-listed.txt
```
Expected: exactly `accessibility architect designer devops docs implementer pm researcher verifier` (9 roles). Task 9 must create a brief for each.

- [ ] **Step 3: Commit**

```bash
git add team/ROLES.md
git commit -m "team: add the role library index

The lead reads this to compose a team for the mission in front of it rather than a standard
roster. Each role carries an explicit 'hire when' condition, and several carry an explicit
'skip when' — accessibility in particular must never be hired for a CLI or a library, where
there is no interface to make accessible.

The composition examples are the point: a CSV converter gets three agents, a web app gets
eight. A roster that is always nine means the library is not doing its job."
```

---

### Task 9: Write the nine role briefs

**Files:**
- Create: `team/pm.md`, `team/researcher.md`, `team/architect.md`, `team/implementer.md`, `team/designer.md`, `team/accessibility.md`, `team/verifier.md`, `team/devops.md`, `team/docs.md`

**Interfaces:**
- Consumes: `team/ROLES.md` role names (Task 8) — filenames must match exactly.
- Produces: nine briefs, each appended as a system prompt by `scripts/team.sh` (Task 10).

Every brief uses this exact structure. Write the file by substituting the role's row from the table below into the template — no section may be omitted.

**Template:**

```markdown
# Role: <Title>

<Identity paragraph: two sentences. What you are world-class at, and what you own.>

## Your mission
Read `build/MISSION.md` in full — it is the definition of done, and it was written for this
specific project. All work happens under `build/`; never touch anything outside it.

## What you own
<Owns bullets>

## What you produce
<Produces: exact artifact path(s) and what they must contain>

## How you verify your own work
<Verify bullets — the checks this role runs before reporting done>

## When to escalate
<Escalate bullets — what this role must not decide alone, and who to ask>

## Principles
- **Stay in your lane.** Another agent owns what you do not; `send` them the question.
- **Artifacts over conversation.** Write files under `build/`, reference them by path.
- **Evidence over claims.** Report the command you ran and what it printed.
- **Never terminate your own pane or a teammate's** (see `TRANSPORT.md`).
```

**Per-role content:**

| Role | Identity | Owns | Produces | Verifies | Escalates |
|---|---|---|---|---|---|
| `pm` (Product) | Product manager, world-class at scope discipline and acceptance criteria. You own *what and why*; the lead owns *how*. | Priorities, scope boundaries, product acceptance | `build/PRD.md`: v1 scope, non-goals, numbered acceptance criteria each checkable from the running product. Open questions with a **provisional decision** each, in `build/QUESTIONS.md`, so nobody stalls. | Every acceptance criterion is checkable by someone who did not build it, without reading source | Never silently cut a stated success criterion from `MISSION.md` — take it to the lead |
| `researcher` (Evidence) | Research engineer, world-class at turning open questions into decision-ready evidence fast. | Prior art, library and format choices, standards, platform constraints | `build/RESEARCH.md`: findings as decisions with a recommendation and a one-line rationale each, plus a source for every factual claim | Every claim cites a source or a command you ran; recommendations state what would change your mind | When two options are genuinely equivalent, present both and let the lead choose rather than picking silently |
| `architect` (Design) | Software architect, world-class at interfaces and boundaries that keep parallel work from diverging. | Module boundaries, data model, public interfaces, hard-to-reverse decisions | `build/CONTRACT.md`: the shape every builder codes against — types, signatures, file layout, data model | Two implementers could work from it in parallel without talking; every hard-to-reverse decision is named as such | Any decision that changes the mission's constraints goes to the lead before you write it down |
| `implementer` (Build) | Senior engineer, world-class at small, verifiable increments and tests that fail for the right reason. | Writing the code that satisfies the contract | Working code under `build/`, plus its tests. Update `build/CONTRACT.md` if reality forces a change — and `send` that change to everyone affected | You ran the build and the tests; you report the exact command and its output. A claim with no command is a gap | Contract ambiguity goes to `architect` (or the lead if none was hired) — do not guess a shape others depend on |
| `designer` (Experience) | Product designer, world-class at interaction and information design across GUIs and CLIs alike. | User-facing interaction, information hierarchy, output and error ergonomics | `build/DESIGN.md`: the interaction spec — states, flows, copy, error and empty cases, and for a CLI the argument surface and output format | Every state a user can reach is specified, including failure and empty states | Product scope questions go to `pm`; do not expand the surface to make it nicer |
| `accessibility` (A11y) | Accessibility specialist, world-class at WCAG 2.2 AA and assistive-technology behavior. | Conformance, keyboard operability, assistive-technology semantics | `build/A11Y.md`: acceptance checks tied to specific criteria, each with the exact way to test it | Checks are runnable (axe, keyboard walk, screen-reader behavior) and name the criterion they enforce | If the mission has no graphical interface, say so immediately and ask the lead to release you rather than inventing work |
| `verifier` (Proof) | Independent QA engineer with deliberately fresh context. You are the floor of trust. | Proving the mission's success criteria are met — or are not | `build/EVIDENCE.md`: pass/fail per numbered criterion, each with the exact command and its real output | You re-ran everything yourself. You did not read the builders' explanations for what the code does — you read the code and ran the product | Report blocking findings precisely (file:line, repro) to the owning agent; distinguish blocking from non-blocking and say which |
| `devops` (Runtime) | Build and release engineer, world-class at making a thing run identically on someone else's machine. | Build, packaging, CI, release, runtime environment | `build/RUNBOOK.md`: how to build, test, run, and release, with each command verified | You ran every command in the runbook from a clean state and they worked | Dependency or platform choices that constrain implementers go to `architect` first |
| `docs` (Documentation) | Technical writer, world-class at documentation that a stranger can follow without asking a question. | The built product's README, usage docs, and examples | The product's own `README.md` under `build/`, plus runnable examples | Every command in the documentation has been executed and produced what the docs claim | If the product's behavior contradicts the mission, report it — do not paper over it in prose |

- [ ] **Step 1: Write all nine briefs**

Create each file from the template, substituting that role's row. Keep each brief under ~40 lines — a brief that rambles dilutes the instruction.

- [ ] **Step 2: Verify all nine exist and match the index**

```bash
ls team/*.md | xargs -n1 basename | sed 's/\.md$//' | grep -v -E '^(ROLES|TRANSPORT|lead)$' | sort > /tmp/roles-files.txt
diff /tmp/roles-listed.txt /tmp/roles-files.txt && echo "index and files agree"
```
Expected: `index and files agree`. Any difference means a role in `ROLES.md` has no brief, or vice versa — the lead would hit a hiring failure.

- [ ] **Step 3: Verify every brief has all required sections**

```bash
for f in team/pm.md team/researcher.md team/architect.md team/implementer.md \
         team/designer.md team/accessibility.md team/verifier.md team/devops.md team/docs.md; do
  for s in "## Your mission" "## What you own" "## What you produce" \
           "## How you verify your own work" "## When to escalate" "## Principles"; do
    grep -q "$s" "$f" || echo "MISSING '$s' in $f"
  done
done
echo "section check done"
```
Expected: no `MISSING` lines.

- [ ] **Step 4: Verify the briefs are domain-neutral**

```bash
grep -rn -i -E "HRIS|employee|Next\.js|React|HR |payroll" team/*.md
```
Expected: **no output.** A brief that assumes a stack or domain is a defect — it is appended to system prompts for every project.

- [ ] **Step 5: Commit**

```bash
git add team/*.md
git commit -m "team: add the nine domain-neutral role briefs

Each brief states what the role owns, the artifact it produces by path, how it verifies its
own work, and what it must not decide alone. They are appended to system prompts for any
project, so none may assume a stack, a language, or a domain — the mission supplies that.

Two briefs carry explicit self-limiting instructions: accessibility must ask to be released
if the mission has no graphical interface, and verifier is told not to read the builders'
explanations of what the code does. The floor of trust only works if it is genuinely
independent."
```

---

### Task 10: Build the hiring helper

**Files:**
- Create: `scripts/team.sh`

**Interfaces:**
- Consumes: `team/<role>.md` and `team/ROLES.md` (Tasks 8/9); `build/.launch/lead.pane` and the launcher-script pattern from `build.sh` (Task 7); env `HERDR_SESSION`, `BUILD_DIR`, `ATOMIC_INTERCOM_GROUP` exported by `build.sh`.
- Produces: `build/ROSTER.md` (append-only hire log) and one running Atomic session per hired role.

- [ ] **Step 1: Write `scripts/team.sh`**

```bash
#!/usr/bin/env bash
# team.sh — the lead hires its team with this.
#
#   scripts/team.sh roles                                  # what roles exist, and when to hire them
#   scripts/team.sh add verifier --reason "prove the CLI"  # hire one
#   scripts/team.sh list                                   # who is hired so far
#
# `add` splits a pane, boots that role's Atomic session with its brief, names it for
# intercom, and appends the hire (with the lead's reason) to build/ROSTER.md.
#
# Verified against Atomic 0.9.12 and Herdr 0.8.0. Bash 3.2 safe.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
LAUNCHDIR="$BUILD/.launch"
SESSION="${HERDR_SESSION:-harness}"
GROUP="${ATOMIC_INTERCOM_GROUP:-harness}"
PROVIDER="${ATOMIC_PROVIDER:-anthropic}"
MODEL="${ATOMIC_MODEL:-claude-sonnet-5}"
MAX_AGENTS=8
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

usage(){ sed -n '2,12p' "$0"; exit "${1:-0}"; }
[ $# -gt 0 ] || usage 2

CMD="$1"; shift

case "$CMD" in
  roles)
    cat "$HERE/team/ROLES.md"
    exit 0
    ;;
  list)
    if [ -f "$BUILD/ROSTER.md" ]; then cat "$BUILD/ROSTER.md"; else echo "No one hired yet."; fi
    exit 0
    ;;
  add) : ;;
  *) echo "unknown command: $CMD" >&2; usage 2 ;;
esac

ROLE="${1:-}"; shift || true
REASON=""
while [ $# -gt 0 ]; do
  case "$1" in
    --reason) REASON="$2"; shift ;;
    --force)  MAX_AGENTS=99 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac; shift
done

[ -n "$ROLE" ] || { echo "usage: team.sh add <role> --reason \"...\"" >&2; exit 2; }
[ -f "$HERE/team/$ROLE.md" ] || {
  echo "no such role: $ROLE" >&2
  echo "available: $(ls "$HERE/team" | sed 's/\.md$//' | grep -v -E '^(ROLES|TRANSPORT|lead)$' | tr '\n' ' ')" >&2
  exit 2; }
[ -n "$REASON" ] || { echo "--reason is required: say why this mission needs a $ROLE" >&2; exit 2; }
[ -f "$BUILD/MISSION.md" ] || { echo "no $BUILD/MISSION.md yet — refine the idea before hiring" >&2; exit 2; }

# Refuse duplicates: two sessions with the same name are unaddressable over intercom.
if [ -f "$LAUNCHDIR/$ROLE.pane" ]; then
  echo "$ROLE is already hired (pane $(cat "$LAUNCHDIR/$ROLE.pane"))." >&2
  exit 2
fi

HIRED=$(ls "$LAUNCHDIR"/*.pane 2>/dev/null | wc -l | tr -d ' ')
if [ "$HIRED" -ge "$MAX_AGENTS" ]; then
  echo "team is at its cap of $MAX_AGENTS agents. Decompose, or re-run with --force." >&2
  exit 2
fi

# Split the most recently created pane, alternating right/down, so the grid stays roughly
# square as the team grows.
LAST_PANE="$(ls -t "$LAUNCHDIR"/*.pane 2>/dev/null | head -1)"
TARGET="$(cat "${LAST_PANE:-$LAUNCHDIR/lead.pane}")"
if [ $((HIRED % 2)) -eq 1 ]; then DIRECTION=down; else DIRECTION=right; fi

PANE=$(herdr pane split "$TARGET" --direction "$DIRECTION" --no-focus --cwd "$HERE" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['pane']['pane_id'])")
herdr pane rename "$PANE" "$ROLE" >/dev/null 2>&1 || true
echo "$PANE" > "$LAUNCHDIR/$ROLE.pane"

{
  echo '#!/usr/bin/env bash'
  echo "# generated by team.sh — starts the '$ROLE' agent"
  echo "export ATOMIC_ROLE=$ROLE"
  echo "export ATOMIC_INTERCOM_GROUP=$GROUP"
  echo "export BUILD_DIR=$BUILD"
  echo "cd \"$HERE\""
  printf 'atomic -e %q --provider %q --model %q -n %q \\\n' \
    "$HERE/atomic/extensions/herdr-state.ts" "$PROVIDER" "$MODEL" "$ROLE"
  printf '  --append-system-prompt "$(cat %q)" \\\n' "$HERE/team/$ROLE.md"
  printf '  --append-system-prompt "$(cat %q)" \\\n' "$HERE/team/TRANSPORT.md"
  printf '  2> >(tee -a %q >&2)\n' "$LAUNCHDIR/$ROLE.stderr.log"
  echo 'status=$?'
  echo "echo; echo \"[harness] the '$ROLE' session exited (status \$status). Pane kept open.\""
  echo "echo \"[harness] restart with: bash $LAUNCHDIR/$ROLE.sh\""
} > "$LAUNCHDIR/$ROLE.sh"
chmod +x "$LAUNCHDIR/$ROLE.sh"

herdr pane send-text "$PANE" "bash $LAUNCHDIR/$ROLE.sh" >/dev/null
herdr pane send-keys "$PANE" Enter >/dev/null

for _ in $(seq 1 60); do
  if herdr pane list 2>/dev/null | python3 -c "
import sys,json
p=[x for x in json.load(sys.stdin)['result']['panes'] if x['pane_id']=='$PANE']
sys.exit(0 if p and (p[0].get('terminal_title_stripped') or '').startswith('atomic') else 1)
" 2>/dev/null; then break; fi
  sleep 1
done

# ORDER MATTERS: /name before the session's first intercom call, or it registers as
# subagent-chat-<id> and is unaddressable by role forever.
herdr pane send-text "$PANE" "/name $ROLE" >/dev/null
herdr pane send-keys "$PANE" Enter >/dev/null
sleep 2

herdr pane send-text "$PANE" "You are the \"$ROLE\" agent. Read $BUILD/MISSION.md and your role brief. Then your FIRST action must be: intercom send to \"lead\" with the message \"$ROLE ready\" — this registers you with the broker so the lead can reach you. Then wait; the lead will assign your work." >/dev/null
herdr pane send-keys "$PANE" Enter >/dev/null

if [ ! -f "$BUILD/ROSTER.md" ]; then
  printf '# Roster\n\nWho was hired for this mission, and why.\n\n| Role | Pane | Reason |\n|---|---|---|\n' > "$BUILD/ROSTER.md"
fi
printf '| `%s` | %s | %s |\n' "$ROLE" "$PANE" "$REASON" >> "$BUILD/ROSTER.md"

echo "✓ hired $ROLE in pane $PANE"
```

- [ ] **Step 2: Verify syntax and the zero-token subcommands**

```bash
chmod +x scripts/team.sh
bash -n scripts/team.sh && echo "syntax ok"
scripts/team.sh roles | head -5
scripts/team.sh list
```
Expected: `syntax ok`; `roles` prints the library index; `list` prints `No one hired yet.`

- [ ] **Step 3: Verify every guard rejects correctly**

```bash
scripts/team.sh add nosuchrole --reason "x"; echo "exit=$?"
scripts/team.sh add verifier;               echo "exit=$?"
```
Expected: the first fails with `no such role: nosuchrole` plus the available list, `exit=2`. The second fails with `--reason is required`, `exit=2`. (Both also require `MISSION.md`; whichever guard fires first, the command must refuse with a non-zero exit and a message naming the fix.)

- [ ] **Step 4: Commit**

```bash
git add scripts/team.sh
git commit -m "harness: add team.sh, the hiring helper the lead runs

add splits a pane, boots the role with its brief and the transport brief, names it for
intercom before anything can trigger a broker connection, and appends the hire to
build/ROSTER.md with the lead's stated reason.

Four guards: unknown roles are rejected with the available list, --reason is mandatory so
every hire is justified in the roster, duplicate roles are refused because two sessions
sharing a name are unaddressable over intercom, and the team is capped at 8. A lead with
bash and no ceiling is the difference between a demo and a runaway."
```

---

### Task 11: Run it end to end and record the case study

**Files:**
- Create: `docs/case-study-first-run.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the repo's evidence, replacing the deleted examples. `README.md` and `docs/getting-started.md` already link to this path from Tasks 2 and 3.

- [ ] **Step 1: Run the harness on a small, cheap mission**

```bash
./build.sh
```
Answer the popup with: `a CLI that converts CSV to JSON, with tests`

- [ ] **Step 2: Verify the full chain, recording each result**

```bash
cat build/IDEA.md          # raw answer, verbatim
cat build/MISSION.md       # refined; must contain Raw idea + Goal + Success criteria + Non-goals
cat build/ROSTER.md        # who was hired and why
herdr --session harness pane list | python3 -c "
import sys,json
ps=[p for p in json.load(sys.stdin)['result']['panes'] if p.get('label') and p.get('label') not in ('Sidebar','Explorer')]
print(len(ps),'agents:')
for p in sorted(ps,key=lambda x:x['pane_id']): print('  %-14s %s' % (p.get('label'), p.get('agent_status')))
"
```
Expected: `IDEA.md` verbatim; `MISSION.md` with all six sections; `ROSTER.md` listing a **small** team (a CSV converter should hire roughly `implementer`, `verifier`, maybe `docs` — **not** `accessibility`, which has no interface to check); every pane showing a real state, not `unknown`.

- [ ] **Step 3: Verify the agents actually found each other**

In the lead's pane, have it run `intercom({action:"list"})`.
Expected: every hired role appears **by role name** (not `subagent-chat-<id>`), all in the same group. A `subagent-chat-` alias means the `/name`-ordering rule was violated — fix `team.sh` before continuing.

- [ ] **Step 4: Let it finish, then verify the product**

```bash
cat build/EVIDENCE.md
```
Expected: pass/fail per numbered success criterion, each with the exact command and its real output. Run one of those commands yourself and confirm it reproduces.

- [ ] **Step 5: Write the case study**

Create `docs/case-study-first-run.md` containing, in order:

1. **The question and the answer** — the popup, and the raw idea verbatim from `IDEA.md`.
2. **The refined mission** — `MISSION.md`'s Goal, Success criteria, and Non-goals, shown beside the raw idea so a reader can see exactly what refinement added and what it deliberately refused to add.
3. **The roster** — `ROSTER.md` verbatim, plus one paragraph on which roles the lead declined to hire and why that is the correct answer for this mission.
4. **The run** — what the agents did, with real intercom exchanges quoted from the panes.
5. **The evidence** — `EVIDENCE.md`, and confirmation that you re-ran one check yourself.
6. **What went wrong** — anything that failed, stalled, or needed a nudge. A case study with no failures is not credible; the previous team lost its lead mid-run and that was worth documenting.

- [ ] **Step 6: Verify the links that were dangling now resolve**

```bash
find . -name '*.md' -not -path './.git/*' -not -path './build/*' | while read -r f; do
  d=$(dirname "$f")
  grep -o '](\([^)#][^)]*\.md\)' "$f" 2>/dev/null | sed 's/](//' | while read -r p; do
    case "$p" in http*) continue;; esac
    [ -e "$d/$p" ] || echo "BROKEN in $f -> $p"
  done
done
```
Expected: **no output.** The `docs/case-study-first-run.md` links from Tasks 2 and 3 now resolve.

- [ ] **Step 7: Stop the run and commit**

```bash
herdr --session harness server stop
git add docs/case-study-first-run.md
git commit -m "docs: record the first project-agnostic run

Replaces the deleted examples as the repo's evidence. Shows the raw idea beside the refined
mission so refinement drift is visible, the roster the lead chose with the roles it declined
to hire, real intercom exchanges, and the verifier's evidence with one check reproduced by
hand.

Includes what went wrong. A case study with no failures is not credible, and the failure
modes are the most useful thing a reader takes from it."
```

---

## Self-Review

**Spec coverage:** every spec section maps to a task — cleanup §Implementation-phases-1 → Tasks 1-3; intake popup §Components → Task 5; lead brief and human gate §The-human-gate → Task 6; `build.sh` §Components → Task 7; role library §Components → Tasks 8-9; `team.sh` §Components → Task 10; verification §Verification and evidence §Evidence → Task 11. The `.gitignore` gap the spec flagged is Task 1 Step 2.

**Placeholders:** none. Every code step contains the file's real content; the nine role briefs are specified as a verbatim template plus a complete per-role content table, so no wording is left to invention.

**Type/name consistency:** `BUILD_DIR`, `ATOMIC_ROLE`, `ATOMIC_INTERCOM_GROUP`, and `HERDR_SESSION` are exported by `build.sh` (Task 7) and consumed with the same names by `build-intake.ts` (Task 5) and `team.sh` (Task 10). Role names in `ROLES.md` (Task 8), the brief filenames (Task 9), and `team.sh`'s validation (Task 10) are cross-checked by the `diff` in Task 9 Step 2. Artifact paths (`build/IDEA.md`, `MISSION.md`, `ROSTER.md`, `EVIDENCE.md`) are identical across the lead brief, both scripts, and the case study.

**Known ordering wrinkle:** Tasks 2 and 6 reference `build.sh` and `scripts/team.sh` before Tasks 7 and 10 create them, and Task 2's link check deliberately expects one dangling link until Task 11. This is called out in each affected step rather than left to surprise a reviewer.
