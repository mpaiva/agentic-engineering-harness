# Agentic engineering harness

This project lets you ask AI agents to build software for you.

You type what you want. A team of AI agents plans it, builds it, and checks the work. You
watch them and make the big decisions.

## What this does

You run one command. The computer asks you one question:

> What do you want to build today?

You answer in your own words. For example: *an accessible to do app using shadcn*.

Then:

1. One agent turns your answer into a written plan.
2. It shows you the plan. **Nothing else happens until you say yes.**
3. It starts the other agents it needs. A small job gets a small team.
4. The agents build the software. They talk to each other while they work.
5. One agent checks the work. It is not the agent that wrote the code.

<figure>
  <img src="docs/media/build-demo.gif" width="1200"
       alt="A 40-second animation of one real run. It moves through eight stages: a single terminal pane asking what to build; the typed answer; a written plan with seven checks; a dialog that halts everything until a person approves; four agents hired one at a time as the window splits from one pane into five; the team working; a separate agent reporting all seven checks pass; and a browser showing the finished page, a poem revealed line by line, ending with the author's signature." />
  <figcaption>
    <em>Not a drawing and not a re-creation: these are screenshots of the screen, taken every
    two seconds while this actually happened on 14 August 2026. The run finished — all 7
    checks passed, proved by an agent that did not write the code, then watched by a person.
    It cost $4.21. It also turned up four things that were wrong, one of which needed a human
    to work around it mid-run. Every stage above is described in words, with still pictures,
    in <a href="https://mpaiva.github.io/agentic-engineering-harness/docs/case-study-ozymandias.html">the
    case study</a>.</em>
  </figcaption>
</figure>

Everything here is also published as a website:
**[mpaiva.github.io/agentic-engineering-harness](https://mpaiva.github.io/agentic-engineering-harness/)**.
The pages the agents built run there, so you can watch one instead of reading its HTML.

## Before you start

You need three things:

- **A Mac.** These steps are tested on macOS. They may not work on Windows or Linux.
- **A terminal app.** This is a program where you type commands. The setup installs one
  called Ghostty.
- **A Claude Pro or Max account.** The agents use it to think. It costs money to run them.

**This is not free.** Each agent uses your Claude account while it works. A team of five
agents costs about five times as much as one. You can stop them at any time. See
[How to stop](#how-to-stop).

## Set up (you do this once)

### Step 1: Get the project

Open your terminal app. Type this and press Return:

```bash
git clone https://github.com/mpaiva/agentic-engineering-harness
cd agentic-engineering-harness
```

**You will see:** lines of text about downloading files.

### Step 2: Install the tools

Type this and press Return:

```bash
./scripts/setup.sh
```

**You will see:** a list of green check marks (✓). This can take a few minutes.

If you see a red ✗, the message tells you what to fix. Fix it, then run the command again.

### Step 3: Log in

Type this and press Return:

```bash
atomic
```

A program opens. Type `/login` and press Return. Choose **Claude Pro/Max**. Follow the steps
in your web browser.

**You will see:** a message that says you are logged in.

To leave the program, hold **Control** and press **C**. Do this twice.

**You are now set up.** You will not need to do these three steps again.

## Build something

You need **two terminal windows** for this. The first one runs the build. The second one is
where you answer questions.

### Step 1: Start the build

In your first terminal window, type this and press Return:

```bash
./build.sh
```

**You will see:** a message telling you to open a second window. The first window then waits.
This is normal. Leave it open.

### Step 2: Open the second window

Open a new terminal window. Type this and press Return:

```bash
herdr --session harness
```

**You will see:** a dark screen with a box in the middle. The box asks:
*What do you want to build today?*

### Step 3: Answer the question

Type what you want to build. Use normal words. You do not need to be technical.

Good answers look like this:

- *a to do list app I can use with a keyboard only*
- *a tool that turns a spreadsheet into a web page*
- *a program that renames my photo files by date*

Press Return when you are done.

**You will see:** the screen change while an agent writes your plan. This takes a minute or
two.

### Step 4: Read the plan and say yes

The agent shows you a plan. It asks: *Proceed as written?*

Read the plan first. Look for:

- **Goal** — what you will have at the end
- **Success criteria** — how you will know it worked
- **Non-goals** — what it will *not* build

If the plan looks right, choose yes.

If the plan looks wrong, say what to change. It is much cheaper to fix the plan now than to
fix the software later.

**You will see:** the screen split into boxes after you say yes. Each box is one agent.

### Step 5: Watch the agents work

Each box has a name, like `implementer` or `verifier`. Under each name is a word that tells
you what that agent is doing:

| Word | What it means |
|---------|---------------------------------------------|
| working | The agent is busy. |
| idle | The agent is waiting for work. |
| blocked | **The agent needs you.** Read that box. |
| done | The agent finished its task. |

You do not need to read every box. Watch for the word **blocked**. That is the one that
needs you.

Your files are saved in a folder called `build`.

## How to stop

You can stop at any time. Type this in any terminal window and press Return:

```bash
herdr --session harness server stop
```

**You will see:** the agent boxes close. The agents stop. Nothing more is charged to your
account.

Your files stay in the `build` folder. Nothing you built is deleted.

## If something goes wrong

| What you see | What to do |
|--------------|------------|
| The second window is empty, with no question | Wait 30 seconds. The agent may still be starting. |
| "atomic has no usable credential" | You are not logged in. Do [Step 3: Log in](#step-3-log-in) again. |
| "herdr not found" or "atomic not found" | The setup did not finish. Run `./scripts/setup.sh` again. |
| "build/ already holds a run" | You have an unfinished build. To continue it, run `./build.sh --resume`. To start fresh, rename the `build` folder. |
| An agent stopped and you do not know why | Its notes are saved in `build/.launch/`. Each agent has a file ending in `.stderr.log`. |
| You want to start over completely | Run the stop command above. Then rename the `build` folder. Then run `./build.sh`. |

## Words used in this project

| Word | What it means here |
|------|--------------------|
| Agent | An AI that does one job, like writing code or checking work. |
| Lead | The agent in charge. It writes the plan and starts the other agents. |
| Mission | The written plan, saved as `build/MISSION.md`. |
| Roster | The list of agents chosen for your job, saved as `build/ROSTER.md`. |
| Role | The job an agent does, such as `designer` or `verifier`. |
| Pane | One box on the screen. Each agent gets one. |
| Session | One run of the whole team. This one is named `harness`. |
| Gate | A point where the work stops and waits for your answer. |

## How it works

This project joins three tools that already exist. It does not replace them.

| Tool | What it does here |
|------|-------------------|
| [Ghostty](https://ghostty.org/) | The terminal app you type in. |
| [Herdr](https://herdr.dev/) | Shows each agent in its own box. Tells you what each one is doing. |
| [Atomic](https://github.com/bastani-inc/atomic) | Runs the agents. Keeps them to the plan. |

The agents send messages to each other while they work. They do not send every message
through you.

## Rules this project follows

1. **Ask before spending.** You approve the plan before any team starts.
2. **The writer does not grade its own work.** A separate agent checks it.
3. **Show proof, not promises.** "It works" is not enough. The proof is the command that was
   run and what it printed.
4. **Only hire who is needed.** A small job gets a small team.
5. **Stop instead of guessing.** An agent that is stuck asks you. It does not invent an
   answer.
6. **Write things down.** Agents share files, not memory.

## Learn more

These pages have more detail. They are written for people who want the full picture.

- [docs/getting-started.md](docs/getting-started.md) — setup, with every step spelled out
- [docs/case-study-ozymandias.md](docs/case-study-ozymandias.md) — the run in the picture above, screenshot by screenshot
- [docs/case-study-first-run.md](docs/case-study-first-run.md) — a real run, including what broke
- [docs/architecture.md](docs/architecture.md) — how the three tools fit together
- [docs/monitoring-agents.md](docs/monitoring-agents.md) — how to watch a team without reading everything
- [docs/verification-and-gates.md](docs/verification-and-gates.md) — how the work gets checked
- [docs/security.md](docs/security.md) — how to run this safely
- [team/ROLES.md](team/ROLES.md) — every agent role, and when it is used

## What is finished and what is not

**A full build has now worked, start to finish.**

Someone asked for *"a single HTML landing page that reveals one verse of a public-domain poem
every 10 seconds until the whole poem is shown, ending with the author signature."*

Here is what happened:

- Two agents were started for the job: one to build, one to check.
- The page was built as one HTML file.
- It shows Robert Frost's poem *The Road Not Taken*, one verse every 10 seconds.
- It ends with the author's signature, then stops.
- The checking agent tested all 8 goals. **All 8 passed.** Nothing had to be fixed.
- A person then opened the page and watched it, to be sure.

<figure>
  <img src="docs/media/poem-page-verified.jpg" width="1200"
       alt="A finished web page on a cream background: the last two verses of The Road Not Taken, ending with the line 'I took the one less traveled by, And that has made all the difference.' Below a rule sits the signature 'Robert Frost, The Road Not Taken, Mountain Interval (1916, public domain)' and a note that the text is a pre-1929 U.S. publication." />
  <figcaption>
    <em>The end of the page the first finished run built, in a browser.
    <a href="https://mpaiva.github.io/agentic-engineering-harness/docs/samples/poem-page.html">Watch
    it run</a> — it takes about 40 seconds to reveal the whole poem. The file itself is
    <a href="docs/samples/poem-page.html">docs/samples/poem-page.html</a>.</em>
  </figcaption>
</figure>

Read the full story in [docs/case-study-poem-page.md](docs/case-study-poem-page.md).

**It has now worked twice, with a different sized team each time.**

A second job — the same idea, but one *line* every 2 seconds instead of one verse every 10 —
was asked for on 14 August 2026. This time the lead hired **four** agents, not two, because
that mission put presentation and readability in its checks. All 7 checks passed, proved by an
agent that did not write the code. It cost $4.21 in total.

<figure>
  <img src="docs/media/steps/11-the-page-itself.png" width="1200"
       alt="A finished web page on a near-black background. The heading OZYMANDIAS in gold small capitals, then all fourteen lines of the sonnet in a cream serif, from 'I met a traveller from an antique land' to 'The lone and level sands stretch far away.' Underneath, right-aligned in gold italics, the signature 'Percy Bysshe Shelley'." />
  <figcaption>
    <em>The page the second run built, photographed from the screen the moment the reveal
    finished and the timer stopped.
    <a href="https://mpaiva.github.io/agentic-engineering-harness/docs/samples/ozymandias.html">Watch
    it run</a> — it takes about 30 seconds, and there is a Pause button while it goes. The file
    itself is <a href="docs/samples/ozymandias.html">docs/samples/ozymandias.html</a>.</em>
  </figcaption>
</figure>

That run is the picture at the top of this page, and it is written up screenshot by screenshot
in [docs/case-study-ozymandias.md](docs/case-study-ozymandias.md), including the four things
that went wrong.

**This works:**

- The question, the plan, and the approval step.
- Choosing a team that fits the job. A small job gets two agents. A bigger one gets more.
- Agents talking to each other while they work.
- Seeing what each agent is doing.
- Building real, working software and proving it works.

**Restarting a stopped build works:**

If a build stops before it is done, you can start it again:

```bash
./build.sh --resume
```

We tested this. We stopped a build on purpose, then started it again. The lead agent came
back, read the plan, and carried on. It did not ask the question again, and it did not make
you approve the plan a second time.

The test found three problems. All three are fixed.

**This is still rough:**

- The first two tries failed before any build worked. Both problems are now fixed. You can
  read what broke in [docs/case-study-first-run.md](docs/case-study-first-run.md).
- **`build.sh` stops waiting for your answer after ten minutes.** If you take longer to answer
  the opening question, the script exits. The agent itself keeps running with your question on
  screen, but the two messages that get it moving never arrive, and `--resume` is not a safe
  fix at that point — it restarts the server and would throw away the answer you just typed.
  This happened in the run pictured above and needed a human to work around it. Not fixed yet.
- We have not yet used `--resume` to finish a job that was left half done. Our test brought
  back a job that was already complete. So restarting works. Picking up unfinished work is
  not proven.
- Bigger jobs have not been finished yet. The largest job tried so far was stopped early.

Tested with Atomic 0.9.12, Herdr 0.8.0, and Ghostty 1.3.1.
