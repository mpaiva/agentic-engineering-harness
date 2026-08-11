# Run transcript — feature-development example

Captured from `./examples/feature-development/run.sh` on macOS with Herdr 0.8.0,
Atomic 0.9.12, Node 22. This is real output: a headless Herdr session, real pane/state
transitions, and real `node --test` verification. The "agents" are the script's
deterministic steps (see README — "What is real vs. simulated").

```text

── objective ──
Add a URL-safe slugify() utility with tests (accepts arbitrary text, WCAG-safe slugs)
panes: research=w1:p2 planner=w1:p3 frontend=w1:p4 test=w1:p5 verifier=w1:p6 

── phase 1 · research (parallel) ──

EE-1428 Employee Event Slug   [workspace: ○ IDLE]
  ○ research         IDLE     w1:p2
  ○ frontend         IDLE     w1:p4
  ○ test             IDLE     w1:p5

Attend to BLOCKED / UNKNOWN. WORKING needs nothing from you.

── phase 2 · plan ──

── gate 1 · human plan review ──

EE-1428 Employee Event Slug   [workspace: ! BLOCKED]
  ○ research         IDLE     w1:p2
  ○ frontend         IDLE     w1:p4
  ○ test             IDLE     w1:p5
  ! planner          BLOCKED  w1:p3   ◄── attention

Attend to BLOCKED / UNKNOWN. WORKING needs nothing from you.
→ [human] plan looks good; approving.

── phase 3 · implementation (parallel) ──
implemented: src/slugify.js  ·  test/slugify.test.js

── phase 4 · verification (real evidence) ──
checks ran → # pass 5 # fail 0 
independent verdict: passed

── gate 2 · final human review ──

EE-1428 Employee Event Slug   [workspace: ! BLOCKED]
  ○ research         IDLE     w1:p2
  ○ planner          IDLE     w1:p3
  ○ frontend         IDLE     w1:p4
  ○ test             IDLE     w1:p5
  ! verifier         BLOCKED  w1:p6   ◄── attention

Attend to BLOCKED / UNKNOWN. WORKING needs nothing from you.
→ [human] evidence is real and complete; approving. (PR step is create_pr-gated; not run here.)

── done ──
status: completed (verified, human-approved). Artifacts:
  research/{codebase,accessibility,test-strategy}.md
  specs/implementation-plan.md
  artifacts/{evidence.txt,verification.md}

Inspect live:  herdr --session ee-1428        (attach the TUI from Ghostty)
Stop server:   herdr --session ee-1428 server stop
```
