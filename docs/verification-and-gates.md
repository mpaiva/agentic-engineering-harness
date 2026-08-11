# Verification and human gates

Autonomy without verification is just faster mistakes. This is the half of the harness that keeps parallel agents trustworthy.

## Independent verification

> An implementation agent should not be the only agent deciding whether its own work is correct.

The pattern — **author/verifier separation** with a fresh-context verifier:

```text
Author Agent → Implementation → Fresh Verifier → Evidence → Pass / Repair
```

The verifier starts with a **clean context**. It does not inherit the author's assumptions, its optimism, or its narrative. It re-derives correctness from evidence. Atomic builds this into its runtime (fresh-context verifiers, `adversarial-verification` workflow); this harness uses it for every user-facing change.

An agent saying **"the implementation is complete"** is **not evidence.**

## What counts as evidence

Verification relies on artifacts a human (or another agent) can independently inspect:

- compilation succeeds
- type checking passes
- unit tests pass
- integration tests pass
- browser tests / **Playwright** flows pass
- accessibility checks pass (automated)
- visual validation
- API responses match expectations
- architecture constraints hold

Evidence is recorded as files under `artifacts/` (e.g. `test-results.json`, `a11y-review.md`) and as Atomic checkpoints / tool-call records — an **auditable trail**, not model self-report.

## Bounded repair

Verifier findings feed a **bounded** repair loop, never an open-ended one:

```text
Run checks.
If checks fail:  diagnose → repair → rerun.
Maximum repair cycles: 3.
If still failing: stop → produce evidence → escalate to human review.
```

Retries must have explicit limits and an escalation path. In the reference workflow the bound is a workflow input (`maxRepairCycles`), and exhausting it surfaces the stage as `blocked` with failing evidence attached.

## Human review gates

Automated verification is necessary but not sufficient. Put a **human gate** wherever the cost of a wrong decision is high. The workflow **stops** at these gates and waits.

| Gate | The question a human answers |
|------|------------------------------|
| **Product** | Does the implementation satisfy the intended user outcome? |
| **UX** | Does the interaction follow approved patterns? |
| **Accessibility** | Does it satisfy accessibility expectations *beyond* automated testing — semantics, keyboard, screen-reader behavior? |
| **Architecture** | Does it introduce platform implications? |
| **Security** | Does it affect identity, permissions, sensitive data, or external systems? |
| **Release** | Should this actually ship? |

## UX and accessibility are verification layers, not cleanup

For user-facing work, UX and a11y are **stages in the pipeline**, not a pass someone does after the code is "done":

```text
Implementation
   → Design System Check
   → Interaction Review
   → Accessibility Automation
   → Browser / Keyboard Validation
   → UX Review Gate
   → Approval
```

Agents can automate parts of this — design-system conformance, axe/Playwright a11y runs, keyboard-path scripting. **Human review stays essential** for:

- interaction quality
- cognitive complexity
- appropriate component selection
- accessibility semantics
- keyboard experience
- screen-reader behavior
- design-system consistency
- usability risks

## What the engineer reviews at the final gate

Before the workflow finalizes a PR, the engineer reviews:

```text
diff · evidence · test results · open risks · agent findings
```

Only after approval should the workflow open the pull request. The PR is an **outcome of verified work**, not the thing you hope the verification will bless.

## Putting it together

```text
Implementation (author)
      │
Automated Verification ──► evidence artifacts
      │
Fresh Verifier (independent) ──► pass? ── no ──► bounded repair (max 3) ──► escalate
      │ yes
Review gates: UX · a11y · architecture · security
      │
Human approval
      │
Pull Request
```
