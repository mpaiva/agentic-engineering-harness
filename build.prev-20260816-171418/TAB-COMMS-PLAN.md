# Plan: turn the four tabs into a stakeholder progress report

Written by `docs` on 2026-08-16, at the human's request. The request was addressed to `lead`;
there is no live `lead` session (see "Who runs this" at the end).

## The problem, stated plainly

The four tabs currently answer *"what is the machine doing?"* They do not answer the question a
stakeholder actually has: **"is this going well, and does it need me?"**

A person glancing at the cockpit today cannot tell, without reading an agent's pane:

- whether a message matters, or is two agents agreeing about a filename
- who did a given piece of work — the board overwrites that
- who is on the team, what they are for, or who else could be pulled in
- how far along anything is, or when it might finish

## Two defects found while grounding this plan

**1. The board destroys per-member attribution.** `scripts/board.sh move <id> <stage>`
reassigns `owner:` to the stage's default role. Verified on the live board: every card that
reached review reads `owner: lead`, including cards the lead never touched. During this
session one card was reassigned away from its actual owner twice mid-task. Asking the board to
"track every task by each member" is not a styling change — the data model has one
single-valued `owner:` field and no history, so the answer is overwritten on every move.

**2. The bench is invisible.** `team/` defines 10 roles; 4 were hired this run
(`researcher`, `implementer`, `docs`, `verifier`). The other 6 — `accessibility`, `architect`,
`designer`, `devops`, `pm`, `lead` — appear in no tab. A stakeholder cannot see what capability
is available but unused, which is exactly the "should we add someone?" decision they own.

Both need a data change before any visual change. Design first, or the tabs will render a
prettier version of the wrong information.

## Per-tab target — one question each tab must answer alone

| Tab | Question it must answer without opening a pane | Owner |
|---|---|---|
| **chat** | "What happened, in words I'd use?" | `docs` |
| **kanban** | "Who is doing what, and what moved since I looked?" | `pm` |
| **team** | "Who is on this, what are they for, who else could help?" | `pm` |
| **workflows** | "How far along, how hard, when done?" | `architect` |

`pm` and `architect` are not currently hired. Two of the four slices need a hire first.

### chat — plain language

- Lead each message with its consequence, not its subject: *"troubleshooting doc is done"*, not
  *"re: card write-docs-troubleshooting"*.
- Mark the few messages a human must act on. Everything else is ambient.
- Collapse agent-to-agent acknowledgements by default. They are traffic, not progress.
- Keep the raw feed one keystroke away. Summarising must never mean hiding.

### kanban — attribution that survives a move

- Add an append-only `history:` line per card (`who`, `stage`, `when`). Keep `owner:` as
  "who holds it now"; stop treating it as "who did it".
- Render contributors per card, not just the current holder.
- Show what changed since the human last looked — a card that has sat still for an hour and a
  card that just moved should not look identical.

### team — profiles, including the bench

- One profile per hired member: role, why hired (already in `build/ROSTER.md`), live state,
  what they are touching now, what they finished.
- A **bench** section: the 6 unhired roles, one line each on what they are for, and the exact
  `scripts/team.sh add <role>` command to hire them.
- Surface a dead or unreachable agent loudly. This session ran for hours with a dead `lead`
  and no tab said so.

### workflows — forecast, not just status

- Per stage: complexity (from stage count and fan-out), progress, and an ETA with an honest
  confidence marker.
- Label estimates as estimates. A wrong number presented confidently is worse than no number.
- Show the terminal state and what it produced, so a finished run reads as an outcome rather
  than a log.

## The improved prompt

The original asked one agent to do four jobs. This version is four independently verifiable
slices with an owner and an acceptance test each, which is what a workflow can actually drive.

Use it as the objective input to a fan-out workflow:

---

<keepContext>
Make the Herdr cockpit's four tabs — chat, kanban, team, workflows — readable as a progress
report by a non-technical stakeholder who will not open an agent pane.

Each tab must answer ONE question with no other source open:
  chat      → "What happened, in words I'd use?"
  kanban    → "Who is doing what, and what moved since I looked?"
  team      → "Who is on this, what are they for, who else could help?"
  workflows → "How far along, how hard, and when will it be done?"

Hard constraints:
- Ground every command and every rendered field in output you actually ran. Do not describe
  behaviour you have not observed. AGENTS.md's "ground truth over assumption" rule is binding.
- Two data defects must be fixed BEFORE the visual work, or the tabs will render the wrong
  information more attractively:
    (a) build/BOARD cards carry a single-valued `owner:` that board.sh overwrites on every
        `move`, so per-member attribution is destroyed. Add append-only history; keep `owner:`
        as current holder only.
    (b) No tab shows unhired roles. The team tab must show the bench — every role in team/
        that is not in build/ROSTER.md — with the command to hire it.
- Estimates must be labelled as estimates, with confidence. A confident wrong ETA is worse
  than none.
- Do not hide the raw view behind a summary. Summaries are a default, not a replacement.
- Scripts must pass bash -n and shellcheck with 0 errors and 0 warnings.
- All four tab scripts must keep working when the herdr server is down, the board is empty,
  and no workflow has ever run. Verify each of those three states, not just the happy path.

Acceptance test, per tab: a person who has not seen this repo reads only that tab and answers
its question correctly. Record the command run and its actual output as evidence in
build/EVIDENCE.md. A screenshot or pasted render counts; a claim that it "looks better" does
not.
</keepContext>

---

## Workflow shape

Fan-out-and-synthesize. The four tabs touch four different scripts, so they are genuinely
independent — except for the two shared data changes, which must land first.

```
stage 0  data model        implementer   board.sh history + bench data    ─┐ blocking
stage 1  chat              docs          scripts/team-chat.sh              │
         kanban            pm            scripts/kanban.sh                 ├ parallel
         team              pm            scripts/team-status.sh            │
         workflows         architect     scripts/workflow-tab.sh          ─┘
stage 2  degradation gate  verifier      3 broken states × 4 tabs
stage 3  stakeholder test  human         reads each tab cold, answers its question
```

Stage 0 is blocking because both defects are shared data, not per-tab styling. Stages 1's four
slices are independent and should run concurrently. Stage 2 is a deterministic tool gate, not a
model stage. Stage 3 is the only test that actually matters and it needs the human.

Hire `pm` and `architect` before launching, or reassign those two slices:

```bash
scripts/team.sh add pm
scripts/team.sh add architect
```

## Who runs this

I am `docs`. Delegation is the lead's job, and there is no live `lead` — `intercom list` shows
`researcher`, `implementer`, `verifier`, `docs`, `human`, and no lead. That is the failure
documented in `build/PRE-RELEASE-CHECK.md` section 8, thread 2, still open.

So this plan is written but not dispatched. To start it, either:

1. Revive a lead — `./build.sh --resume`, following
   `docs/troubleshooting.md` § "The lead is gone", or
2. Tell me to dispatch the four slices directly to the crew over intercom, accepting that a
   specialist is coordinating rather than a lead.

Option 1 is correct if this becomes a real mission. Option 2 is faster and works today.
