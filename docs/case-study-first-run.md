# Case study: the first run

A record of the first real run of `./build.sh`, on 2026-08-13, immediately after the harness
was made project-agnostic. It is here because the repo used to argue its case through worked
examples, and those were deleted. This is what replaced them: not a curated demo, but the
first time anyone pressed the button.

It includes what broke. Two bugs made the first attempt impossible to complete, a third
killed the second attempt mid-build, and none of them were found by review — they were found
by running it.

## The question and the answer

`./build.sh` created a Herdr session with one pane, booted Atomic as the `lead`, and the
`build-intake` extension opened a dialog:

```
What do you want to build today?
> an accessible to do app using shadcn
```

That answer landed verbatim in `build/IDEA.md`, under a header telling every later reader not
to edit it. Keeping the raw text matters because the next step rewrites it, and rewriting is
where scope quietly grows.

## The refined mission

The lead ran `/skill:prompt-engineer` over the raw idea and wrote `build/MISSION.md`. Eleven
words became a specification with six sections. The Goal:

> A small, single-page to-do list web app, built with React and shadcn/ui components, that
> lets a user add, complete, and delete tasks — and that a keyboard-only or screen-reader user
> can operate exactly as well as a mouse user.

Ten numbered success criteria, each checkable by someone who did not build it. Two examples:

> 5. Every interactive control (add input, submit, per-task toggle, per-task delete) is
>    reachable and operable using only the keyboard … with a visible focus indicator on every
>    focused element.
>
> 10. The verifier reproduces items 5–8 independently (fresh context, own commands/tools) and
>     records pass/fail with evidence in `build/EVIDENCE.md`.

**The Non-goals section is the one that earns its place.** `prompt-engineer` makes prompts
sharper, which is also how a to-do list becomes a productivity platform. The mission refused,
in writing, before any agent was hired:

> - No backend, API, database, or user accounts.
> - No multi-user sync, sharing, or collaboration.
> - No task metadata beyond text + completion state (no due dates, priorities, tags,
>   subtasks, or categories) unless the human asks for it later.
> - No deployment/hosting setup (Vercel, Netlify, etc.).

## The gate

Before hiring anyone, the lead called `ask_user_question` — "Proceed as written?" — and
waited. The human approved. Nothing had been spent on a team up to this point.

This is the cheapest moment to correct a run: one prompt, one answer, before autonomous spend
across several agents begins. It is also visible in the cockpit, because
`atomic/extensions/herdr-state.ts` maps a blocking `ask_user_question` to Herdr's `blocked`
state.

## The roster

The lead read `team/ROLES.md` and hired four specialists — not the nine the old HRIS example
always launched, and not the eight its own web-app composition example suggests.

| Role | Reason (recorded by `team.sh` at hire time) |
|---|---|
| `implementer` | builds the React + shadcn/ui to-do app: add/complete/delete tasks, localStorage persistence |
| `designer` | shapes the interaction and information design for the task list: add/complete/delete flows, empty state, non-color completion signal |
| `accessibility` | owns WCAG 2.1 AA conformance: keyboard operability, accessible names, live-region announcements, contrast, non-color signaling |
| `verifier` | independent fresh-context proof that every success criterion in `build/MISSION.md` is met |

In its own words, on what it declined to hire:

> Skipped `pm`/`researcher`/`architect` — small, fully-specified single-page app, no product
> ambiguity or unfamiliar tech.

That is the role library working. **`accessibility` was hired here because this mission has a
user interface and an explicit WCAG requirement** — and `team/ROLES.md` tells the lead to
*never* hire it for a CLI, a library, or a service, where there is no interface to make
accessible. The same library must produce a different roster for a different mission, or it
is just a fixed team with extra steps.

## The work

The lead wrote `build/CONTRACT.md` first — "shared shape for the to-do app, so `implementer`,
`designer`, and `accessibility` don't diverge" — then briefed all four over Intercom and, in
its own words:

> All four briefed over intercom with their scope and told to talk to each other directly
> rather than routing everything through me.

Produced before the run was stopped:

```
build/CONTRACT.md   build/DESIGN.md   build/A11Y.md
build/app/  src/App.tsx · src/main.tsx · src/index.css
            src/components/{AddTaskForm,TaskItem,TaskList}.tsx
            src/components/ui/{button,card,checkbox,input}.tsx   ← shadcn, copied in per its model
            src/lib/{storage,types,utils}.ts
            a11y/audit.spec.ts · a11y/contrast-check.spec.ts     ← Playwright + @axe-core/playwright
```

The single best artifact is `build/A11Y.md`, which maps every check to both a `MISSION.md`
criterion and a WCAG 2.1 AA criterion, and contains this aside:

> coordinate with `verifier` before adding a second, duplicate tooling setup; see
> `build/CONTRACT.md`

That is one agent avoiding a collision with another agent's work, through the contract,
unprompted.

## What went wrong

### 1. The first run deadlocked on its own readiness check

`build.sh` sent the lead's launch command, then polled for the pane title to start with
`atomic` before continuing. It never did. `build-intake.ts` opens its dialog during
`session_start`, and **while that dialog is open the pane title stays `bash .../lead.sh`**.

After 60 seconds the poll gave up, deleted `lead.pane`, and exited — leaving a correctly
rendered popup on screen with no script alive to send the kickoff once it was answered. The
human would have answered a question into the void.

The fix was a deletion. That poll existed only to gate a `/name lead` send that had already
been removed (see below); the wait for `IDEA.md` is a strictly better readiness signal,
because it cannot be satisfied unless Atomic booted, rendered the dialog, and got an answer.

### 2. The mission would have been the literal string `/name lead`

Caught in review, one step before the first run. `build.sh` sent `/name lead` into the pane to
make the session addressable over Intercom. But by then the intake dialog was already open, so
that text would have landed **in the popup**, and `Enter` would have submitted it. `IDEA.md`
would have contained `/name lead`, and the lead would have refined that into a mission.

It was unnecessary anyway: `-n lead` at launch already sets the session name. Verified in
Atomic's own source — `--name` calls `appendSessionInfo` before the runtime is created, and
Intercom's presence name reads from there, falling back to `subagent-chat-<id>` only when it
is empty.

The asymmetry is deliberate and documented in both scripts: `scripts/team.sh` still sends
`/name`, because specialists never load `build-intake.ts` and so never have a dialog open.

### 3. Uninstalling an unrelated Herdr plugin killed the running team

Mid-build, the human asked to uninstall the `herdr-sidebar` plugin. Running
`herdr plugin uninstall` **restarted the Herdr server**, destroying the workspace and all five
agent panes. Zero Atomic processes survived.

Nothing on disk was lost — every artifact above was already written. What was lost was the
agents' in-flight turns and their live context, including the verifier's unwritten
`EVIDENCE.md`. **The run in this document was never finished.**

Then the recovery hit a bug that had been predicted and deliberately deferred: `build/.launch/`
still held five `.pane` files pointing at dead panes, so `scripts/team.sh` would have refused
every re-hire with "already hired". Recovery requires `rm build/.launch/*.pane` first, which
nothing tells you.

**Lesson, unglamorous but real: do not run `herdr plugin` commands against a session with live
agents in it.** Stop the team first.

## What this run proves, and what it doesn't

**Proves:**

- The intake popup renders in a pane of a headless Herdr server and can be answered by a
  client that attaches afterwards — which is why `build.sh` prints the attach command and
  waits, rather than trying to own the terminal.
- A one-line idea becomes a specification with checkable criteria and explicit non-goals.
- The human gate fires before any spend, and shows up in the sidebar as `blocked`.
- The lead composes a roster that fits the mission and records why, and the role library
  discriminates — four agents here, and `accessibility` hired for a reason it would refuse on
  a CLI.
- Agents coordinate through a written contract rather than through the orchestrator.
- The state adapter reports live `working`/`idle`/`blocked` for Atomic sessions, which Herdr
  0.8.0 cannot detect natively.

**Does not prove:**

- That the app works. `EVIDENCE.md` was never written, no success criterion was independently
  verified, and the app was never run. The verifier was still working when the run died.
- That a run converges. This one was stopped, not finished.
- That `--resume` recovers a killed run. It has never completed successfully; the stale
  `.pane` files above are a known unfixed obstacle.

The honest summary: **everything up to and including "the team is building" is demonstrated.
"The team finished, and the result was verified" is not.**

## Reproducing

```bash
./build.sh                     # terminal 1 — asks what to build, then waits
herdr --session harness        # terminal 2 — the cockpit, where you answer
```

Answer the popup, approve the mission at the gate, and watch `build/ROSTER.md` fill in. Stop
any time with `herdr --session harness server stop`.
