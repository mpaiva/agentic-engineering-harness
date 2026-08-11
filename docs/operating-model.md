# Operating model

This is the mental shift the harness is built around.

## Old model → new model

```text
Old:  Engineer → Agent → Code
New:  Engineer → Goal → Workflow → Agents → Verification → Review → Merge
```

The engineer increasingly **designs and supervises the execution system** instead of
manually executing every step. The most valuable skill is no longer prompt writing — it
is **orchestration**: decomposing problems, defining agent responsibilities, constraining
scope, managing context, designing workflows, defining verification, setting approval
boundaries, and evaluating evidence.

## Every autonomous task defines six things

When you launch autonomous work you remain responsible for the outcome. Encode these six
in the workflow inputs, not in your head:

### 1. Goal
What must be **true** when the work is complete? State it as a verifiable outcome, not a
task list. "Users can view an employee's event history, keyboard-navigable and WCAG 2.2
AA" — not "add a component."

### 2. Scope
What may agents change? What must they **not** touch? Name the directories, the APIs,
the components that are off-limits.

### 3. Context
What documentation, patterns, components, APIs, or prior implementations matter? Point
agents at them so they don't reinvent or drift.

### 4. Constraints
Typical examples:
- use the approved design system
- follow existing architecture
- do not introduce dependencies without approval
- maintain WCAG 2.2 AA
- preserve existing APIs unless explicitly authorized
- do not modify unrelated code

### 5. Verification
How will we **know** it actually works? Which checks constitute evidence — compile,
typecheck, unit, integration, browser/Playwright, a11y, API responses, architecture
constraints? (See [verification-and-gates.md](verification-and-gates.md).)

### 6. Approval
Which decisions can agents make independently, and which require a human? Place the
human gates where the cost of a wrong decision is high.

## Workflows over mega-prompts

Do not keep retyping *"run the tests, review the code, fix the issues, rerun, continue
until everything passes."* Encode the repeatable process once:

```text
Research → Plan → Implement → Test → Accessibility → UX → Code review → Repair → Human approval
```

Repeated engineering behavior belongs in the harness, versioned and inspectable — not in
a prompt you paste. See [atomic/README.md](../atomic/README.md).

## Parallelize independent work — then synthesize

Good parallel candidates during **research**:

```text
codebase research · API investigation · pattern discovery · a11y analysis · test strategy
```

Good parallel candidates during **implementation**:

```text
frontend · service/API · unit tests · integration tests · documentation
```

A coordinating stage must **synthesize** parallel results before any major decision is
finalized. Do **not** parallelize tightly-coupled work just to increase the agent count —
that manufactures merge conflicts and drift.

## Keep agent context small

Context isolation is a feature, not a limitation. Each agent should receive only what it
needs and return a concise artifact or structured result. The **workflow/orchestrator**
carries the larger context.

```text
Workflow (holds the big picture)
   ├── navigation specialist   → returns navigation-analysis.md
   ├── API specialist          → returns api-findings.md
   ├── accessibility reviewer  → returns a11y-review.md
   ├── design-system reviewer  → returns ds-review.md
   ├── testing specialist      → returns test-strategy.md
   └── implementation agent    → returns a diff + evidence
```

## Artifacts are handoffs

Do not depend on conversational memory. Important findings become files:

```text
research/   navigation-analysis.md
specs/      implementation-plan.md
artifacts/  accessibility-review.md · architecture-review.md · test-results.json
```

Each artifact should capture: what was investigated, what decisions were made, what
evidence exists, and what remains unresolved. Artifacts make autonomous work
inspectable — and they survive context resets.

## Bound every autonomous loop

No agent retries forever. Replace *"keep fixing it until it works"* with an explicit
bound and an escalation path:

```text
Run tests.
If tests fail:  diagnose → repair → rerun.
Maximum repair cycles: 3.
If still failing: stop → produce evidence → request human review.
```

The reference workflow enforces this with a repair bound and Herdr's
`herdr agent wait --until blocked` as the escalation signal.

## Maturity model

Adopt in stages. Do not jump to swarms.

| Level | Shape | What the engineer does |
|-------|-------|------------------------|
| **1** | Engineer → one agent | Operates a single coding agent by hand. |
| **2** | Engineer → primary agent → subagents | One agent delegates some work. |
| **3** | Engineer → harness → many agents + verifiers | Supervises multiple independent workstreams. |
| **4** | Engineer → engineering graph | The process itself is an executable graph: research, plan, implementation, testing, UX, a11y, architecture, security, verification, release. |

This harness is built to move a team toward **Levels 3 and 4** — but only as fast as
observability and verification can keep up (see the core principle below).

## The core principle

> **Do not increase agent autonomy unless observability and verification increase with
> it.** The objective is not "run as many agents as possible." It is "run as much
> engineering work autonomously as we can safely observe, verify, and understand."

Parallel agents raise throughput. They also raise architectural drift, duplicated work,
incorrect assumptions, inaccessible interfaces, inconsistent UX, merge conflicts,
unnecessary code, and security risk. **Pair every increase in parallelism with an
increase in verification.**

## Team principle

The goal is **not** to replace engineers with agents. It is to increase the amount of
engineering work one engineer can safely supervise — the shift from *writing every
change* to *designing, directing, observing, and verifying systems that produce changes.*
