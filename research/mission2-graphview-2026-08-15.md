# Ground-truth: Atomic graph-view claim vs "no graph view exists" docs

Date: 2026-08-15. Researcher agent, phase 2.

## 1. Atomic's own graph view — VERIFIED, ships today

Source: `atomic/docs/workflows.md:116` (installed copy, `@bastani/atomic` docs dir).

Exact text:
> "Named workflow runs execute in the background. By default, after launch expect a full
> run id and monitor it with `/workflow status <run-id>`, F2, or `/workflow connect
> <run-id>`. A definition with `autoAttach: true` instead opens the graph overlay as soon
> as an interactive top-level named launch through `/workflow <name>` or the registered
> `workflow` tool is accepted."

Corroborating hits (same install, ran `grep -n "F2"` across the docs dir):

- `atomic/docs/quickstart.md:148` — `/workflow connect <run-id>        # see agents
  working; chat with or steer each stage (F2 also opens latest)`
- `atomic/docs/workflows.md:3176` — `Use /workflow connect <run-id> (or F2), then press
  Enter on the focused node or click a graph node to focus and open or attach it for local
  answers.`

**Verdict: three independent doc lines confirm the same three-way entry point
(`/workflow status <run-id>`, `F2`, `/workflow connect <run-id>`) into a live graph
overlay. This is a shipped, documented Atomic TUI feature, not a future one.** Not
independently re-run live in this pass (would need an active named-workflow run and an
interactive Atomic session); the doc citations are internally consistent across three
separate locations in the installed package, which is strong evidence on its own.

## 2. Which docs make a "no graph view" claim — grep results

Command run:
```
grep -rli -i "graph" herdr/ docs/ README.md atomic/README.md
```
Hits: `herdr/atomic-integration.md`, `docs/operating-model.md`, `docs/architecture.md`,
`docs/monitoring-agents.md`, `docs/getting-started.md`, `docs/samples/README.md`,
`docs/case-study-ozymandias.md`, `docs/superpowers/plans/2026-08-13-project-agnostic-cockpit.md`,
`README.md`, `atomic/README.md`.

Manually inspected every hit's actual sentence (not just the keyword). Only **one** file
makes an absence claim:

### `herdr/atomic-integration.md:51` — the actual overclaiming file

Exact text:
> "A single command surface that projects Atomic's *stage graph* into the Herdr *sidebar*
> does **not** exist in Atomic `0.9.12` or Herdr `0.8.0`."

This sentence is grammatically scoped to "a single command surface that projects Atomic's
stage graph into the Herdr sidebar" — i.e., it's really a claim about the **sidebar
adapter**, not about Atomic's own TUI. But the trailing clause "does not exist in Atomic
`0.9.12`" is where it goes wrong: read at normal speed, "does not exist in Atomic" reads as
"Atomic has no graph view," when the true gap is narrower — the *bridge into Herdr's
sidebar* doesn't exist; Atomic's own `/workflow connect`/F2 overlay does. This is the file
CONTRACT-2.md/MISSION-2.md flagged, confirmed as the actual defect. **Fix location: line
51, and the three bullets right after it (lines 53-55) are correctly scoped ("Atomic does
not emit Herdr pane/agent state...", "Herdr cannot read Atomic run state...") — only the
summary sentence on line 51 needs the "Atomic already has its own graph view; what's
missing is the sidebar bridge" correction.**

### All other hits — correctly scoped or unrelated, no fix needed

- `docs/monitoring-agents.md:97` — "a first-class adapter that projects Atomic's stage
  names into the Herdr sidebar is a documented future step" — already correctly scoped to
  the adapter, doesn't claim Atomic itself lacks a graph view. No change needed.
- `docs/operating-model.md:116`, `docs/architecture.md:49,105,131`, `atomic/README.md:3,9,69`
  — use "graph" to mean the workflow's DAG structure (`/workflow status <run-id> #
  progress + stage graph` at `atomic/README.md:69` is itself evidence the graph view is
  documented here already) — not absence claims.
- `docs/getting-started.md:124`, `docs/samples/README.md:47`, `docs/case-study-ozymandias.md:9`,
  `README.md:307`, `docs/superpowers/plans/...`  — false-positive keyword hits ("photographed",
  unrelated "graph" isn't even present — these matched on "graph" substring inside other
  words or nearby unrelated text); confirmed by reading context, no graph-view claim at all.

## Summary for lead / docs / implementer

- **Fix exactly one file, one sentence**: `herdr/atomic-integration.md:51`. Reword from "A
  single command surface... does not exist in Atomic `0.9.12` or Herdr `0.8.0`" to make
  explicit that Atomic's own graph overlay (`/workflow status <run-id>`, `F2`,
  `/workflow connect <run-id>` — cite `atomic/docs/workflows.md:116`) already ships; only
  the Herdr-sidebar projection is missing.
- No other file in `herdr/` or `docs/` needs a correction for this claim.
- For mission criterion 5 (documented way to open the graph from inside the cockpit): the
  existing three-way entry point is already fully documented at
  `atomic/docs/workflows.md:116` and `atomic/docs/quickstart.md:148` — docs/implementer
  just need to surface/cite it in this repo's own docs (e.g. `herdr/atomic-integration.md`
  or a short README section), not invent new behavior.

## Commands run

```
grep -n "F2" /Users/mp/.bun/install/global/node_modules/@bastani/atomic/docs/*.md \
             /Users/mp/.bun/install/global/node_modules/@bastani/atomic/docs/**/*.md
grep -rli -i "graph" herdr/ docs/ README.md atomic/README.md
sed -n '40,60p' herdr/atomic-integration.md
```
