# A real Atomic `goal` run (not simulated)

This documents an **actual, paid, autonomous Atomic workflow run** — the built-in `goal` workflow driving real Claude agents to add a `truncate()` utility to [`sample-project/`](sample-project/). Unlike [run.sh](run.sh) (whose "agents" are scripted steps), every stage here was a live model agent. Raw evidence is committed under [`atomic-run/`](atomic-run/).

## What was run

```bash
atomic -p --model anthropic/claude-sonnet-4-5 \
  '/workflow goal objective="…add a truncate utility…all tests must pass…add only these two files" \
     max_turns=6 create_pr=false base_branch=main'
```

- **Run id:** `7076c025-d35a-4412-b062-48f5df190b9f`
- **Model:** `anthropic/claude-sonnet-4-5`
- **Duration:** ~8 minutes (13:23 → 13:31), 1 orchestrator turn.
- **Result:** `status: complete` (reducer-gated).

## What `goal` actually did

`goal` persists the objective + immutable acceptance criteria to a durable **ledger**, delegates implementation through bounded orchestrator turns, records **receipts**, then asks **independent reviewers** to inspect the real delta. A TypeScript reducer decides `complete` / `blocked` / `needs_human` — it does not trust free-form "done" claims.

1. **Orchestrator** delegated to a `worker` subagent that worked **test-first**: the test file failed with `ERR_MODULE_NOT_FOUND` (red), then implementation made it green (10/10). The orchestrator then **self-verified** with an 8-row acceptance matrix and committed `aef2119` — *exactly* the two files requested, `git status` clean. Full receipt: [atomic-run/orchestrator-receipt.md](atomic-run/orchestrator-receipt.md).

2. **Three fresh-context reviewers** (`completion-reviewer`, `evidence-reviewer`, `risk-reviewer`) each **re-ran the commands themselves** rather than trusting the receipt — `git show --name-status`, live ESM probes, `node --test`. All three: *"patch is correct"*, confidence 0.95. Verdicts: [atomic-run/reviews.md](atomic-run/reviews.md).

3. **Reducer** recorded the quorum (`3/2 stop_review_loop=true`, no blocking findings) → `decision: complete`.

## The payoff: independent verification caught a real bug the tests missed

The worker's implementation passed its own 5 tests. But **two reviewers independently** found the same genuine edge case (both rated P3 / non-blocking, so the run still completed):

> **Output can exceed `maxLen` when `maxLen < suffix.length`.** At `src/truncate.js` the shortening path was `str.slice(0, maxLen - suffix.length) + suffix`. When `maxLen < suffix.length` the slice endpoint goes negative and JS reinterprets it as an offset from the end — so the result is *longer* than `maxLen`. Observed: `truncate("abcdefgh", 2)` → `"abcdefg..."` (length 10).

This is exactly what the harness is for: **a fresh verifier re-derives correctness from evidence and finds what the author's own passing tests did not.** A reviewer also caught that this repo's committed [RUN-TRANSCRIPT.md](RUN-TRANSCRIPT.md) still said `# pass 5` after the suite grew — a real staleness catch.

### The loop closed

Acting on the reviewers' finding (see commit following the run), the edge case was fixed and a **regression test** added:

```js
if (maxLen <= suffix.length) return suffix.slice(0, maxLen); // never exceed maxLen
```

`node --test` now reports **11 pass / 0 fail**. That is the full arc the harness exists to make routine: implement → independent verification → evidence → repair.

## Notes on autonomy and cost

- `goal` **committed to `main` on its own** (`create_pr=false` means "don't open a PR", not "don't commit"). The commit was clean and correctly scoped — but this is why the [security guidance](../../docs/security.md) recommends running highly autonomous work in an isolated environment/worktree (`goal` supports `git_worktree_dir`).
- Harness usage on a Claude subscription is billed per-token as "extra usage", so a fan-out run spends real tokens. Keep `max_turns` bounded and scope objectives tightly.

## Reproduce

Needs a logged-in Atomic provider (`atomic` → `/login`). Then, from the repo root:

```bash
atomic -p --model anthropic/claude-sonnet-4-5 \
  '/workflow goal objective="<your objective with acceptance criteria>" max_turns=6 create_pr=false base_branch=main'
```

Watch it via the ledger at `~/.atomic/workflows/runs/<run-id>/**/goal-ledger.json`, or `/workflow status <run-id>` inside Atomic.
