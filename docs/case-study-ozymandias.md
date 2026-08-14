# Case study: the run in the picture

The GIF at the top of the README is this run. Every frame of it is a screenshot of the screen
while this was happening, taken every two seconds. Nothing in it was drawn or re-created.

It ran on 14 August 2026, from 05:58 to 06:43 in the morning. A person asked for a web page.
Four agents built and checked it. It cost about four dollars.

Two other runs are written up here too. [The first one](case-study-first-run.md) did not
finish. [The second one](case-study-poem-page.md) did, with a two-agent team and a 19-minute
stall. This is the third.

## What was asked for

The question was *What do you want to build today?* The answer, typed in plain words:

> a single HTML landing page that reveals one line of a public-domain poem every 2 seconds
> until the whole poem is shown, ending with the author signature

![The cockpit with a single pane. It asks "What do you want to build today?" and the answer is typed below it, waiting for Enter.](media/steps/01-the-question.png)

One pane. One question. Nothing has been started, and nothing will be until a person presses
Enter.

## The answer becomes a plan

![The pane shows "Captured. Refining into build/MISSION.md" followed by the lead reading IDEA.md, loading the prompt-engineer skill, and reading team/ROLES.md.](media/steps/02-answer-captured.png)

The words are saved to `build/IDEA.md` exactly as typed. Then the lead reads them back,
loads its prompt-engineering skill, and reads the list of roles it is allowed to hire.

![The mission, showing the raw idea quoted back and the start of a goal section, ending with "Now let's confirm with you before hiring the team."](media/steps/03-the-mission.png)

Out comes `build/MISSION.md`: 64 lines, **7 success criteria**, each one written so that
somebody who did not build the page can check it.

The lead also decided two things nobody asked for:

- the poem must be **public domain**, and it picked *Ozymandias* by Percy Bysshe Shelley
  (1818) because it is short enough to reveal in about half a minute;
- the page must make **no network calls at all** — no fonts, no CDN, nothing. It has to work
  with the internet turned off.

## The gate

![The confirm-mission dialog. It restates the mission in one sentence and offers five choices: proceed as written, different poem, adjust timing, type something, or chat about it.](media/steps/04-the-gate.png)

This is the part that matters. The plan is stated in one sentence, and then everything stops.

Five ways out: take it, swap the poem, change the timing, say something else, or just talk
about it. No agent is hired, no file is written, and no money is spent on a team until a
person picks one. This run picked *Yes, proceed as written*.

## Who was hired

![The lead announcing it is hiring, listing implementer, designer, accessibility and verifier, and running scripts/team.sh add implementer.](media/steps/05-hiring.png)

> Confirmed. Hiring the team now — small scope: implementer, designer, accessibility,
> verifier.

| Agent | Why it was hired |
|-------|------------------|
| `implementer` | Writes the single self-contained HTML/CSS/JS file |
| `designer` | Owns typography, spacing, and how the reveal feels |
| `accessibility` | It is a page people read; contrast, readability, non-flashing motion |
| `verifier` | Independent proof that the 7 criteria pass |

Four, not two. The [previous run](case-study-poem-page.md) asked for almost the same thing and
hired two. The difference is that this mission put presentation and readability in its success
criteria, so the lead staffed for them. It still skipped the researcher, the architect, the
docs writer and the rest of the role library.

![The cockpit split into five panes: lead across the top, then implementer, designer, accessibility and verifier.](media/steps/06-team-of-five.png)

The cockpit grew from one pane to five in about a minute, one hire at a time.

## The work

![Five busy panes. The implementer is running a Playwright script, the designer has replied to the verifier, the accessibility agent is reporting keyboard results, and the verifier is logging PASS lines.](media/steps/07-the-team-working.png)

Fourteen minutes. The agents talk to each other directly — the designer answering the
verifier, the accessibility agent sending fixes to the implementer — and the lead only hears
about it when something is settled.

Some of what the accessibility agent added was never asked for and never argued about:

- a **pause/resume button**, because a timed reveal that cannot be stopped fails WCAG 2.2.2;
- that button then **enlarged to 66×33 px**, because 24×24 px is the minimum target size
  under WCAG 2.5.8;
- a `prefers-reduced-motion` path, for people who have asked their computer to stop animating
  things;
- contrast measured at **14.67:1** for body text and **8.19:1** for the accent colour.

## The proof

![The lead's final status: all 7 MISSION.md success criteria PASS by independent verification, plus designer and accessibility sign-off, and a note that build/EVIDENCE.md is the complete record.](media/steps/08-the-verdict.png)

The `verifier` did not read the builder's notes. It checksummed `build/index.html` first so it
could prove which file it was talking about, installed Playwright **outside** the repo so the
deliverable stayed dependency-free, and ran headless Chromium against the real file.

It logged every network request the browser made while loading the page:

```
All requests: ["file:///Users/mp/git-repos/agentic-engineering-harness/build/index.html"]
Non-file requests: []
```

All 7 criteria came back **PASS**. The full record is `build/EVIDENCE.md`, written by the
agent that ran the tests.

## What was built

![The page in a browser, four lines of Ozymandias visible, a small Pause button in the corner.](media/steps/09-page-revealing.png)

![The finished page: all fourteen lines and the signature "— Percy Bysshe Shelley". The pause button is gone.](media/steps/10-page-complete.png)

![The same page without the browser around it: fourteen lines of Ozymandias and the signature, on a dark background.](media/steps/11-the-page-itself.png)

One HTML file, 6,649 bytes, `md5 dd88f5ce3751aa11942750e4244a8180`. The first line shows at
once, another every two seconds, and after the fourteenth the signature appears and the timer
stops. The pause button hides itself once there is nothing left to pause.

The file is kept at [docs/samples/ozymandias.html](samples/ozymandias.html), byte for byte as
the agents produced it.

## What it cost

Five agents, as Atomic reported them at the end:

| Agent | Cost |
|-------|------|
| `lead` | $0.728 |
| `implementer` | $1.006 |
| `designer` | $0.630 |
| `accessibility` | $0.807 |
| `verifier` | $1.036 |
| **total** | **$4.21** |

Atomic showed a banner on every pane saying this usage is billed per token as extra usage,
not out of a Claude plan's included limits. Four agents cost about four times one agent. That
is the whole trade.

## What went wrong

Nothing stopped the build, but four things are worth writing down.

**1. `build.sh` gave up while a person was still typing.** It waits ten minutes for the intake
popup to be answered, then exits. The popup in this run was answered nineteen minutes after
`build.sh` started waiting for it. The lead agent
survived — it is a separate process in its own pane — but the script that was supposed to send
the two follow-up messages was gone. Those two messages (`/name lead`, then the *Begin…*
kickoff) had to be sent by hand with `herdr pane send-text`. `./build.sh --resume` is the
documented recovery, but it restarts the Herdr server, which would have killed the live lead
and the answer already typed into it. **The ten-minute timeout should be longer, or it should
not be a timeout at all** — nothing is being wasted while a human thinks.

**2. The lead looked for `TRANSPORT.md` in the wrong place.**

```
read ~/git-repos/agentic-engineering-harness/TRANSPORT.md
ENOENT: no such file or directory
find **/TRANSPORT.md
# team/TRANSPORT.md
```

It recovered by itself in one step, which is the good version of this bug. But the brief it
was given names the file without its directory.

**3. The verifier's own evidence quotes a byte count that does not match the file it hashed.**
`build/EVIDENCE.md` says `index.html` is 6516 bytes. The file is 6649 bytes. The md5 in the
same document — `dd88f5ce3751aa11942750e4244a8180` — is correct, and matches the file today.
So the verification is sound and one number in the write-up is stale. A verifier that quotes
a size should re-read it at the same moment it takes the hash.

**4. The model was not the one that was asked for.** `build.sh` launched the lead with
`--model claude-sonnet-5`. At the intake popup the pane footer read `claude-opus-4-8 medium`.
By the time the team was working, every pane — including the lead's — read
`claude-sonnet-5 medium`. Both readings are in the screenshots. Nothing in this run depended
on it, and the cause is not established here.

## The timing

| Time | What |
|------|------|
| 05:58 | `./build.sh` starts the lead in one pane |
| 06:06 | the cockpit is attached; the question is on screen |
| 06:17 | Enter — the answer is saved to `build/IDEA.md` |
| 06:18 | `build/MISSION.md`, 7 criteria, and the gate |
| 06:19 | approved, and four agents hired in about a minute |
| 06:28 | the last write to `build/index.html` |
| 06:35 | `build/EVIDENCE.md` — all 7 PASS |
| 06:37 | the lead closes the mission |
| 06:39 | the page opened in a browser and watched end to end |

**Sixteen minutes** from *yes* to *proven*. The rest was a person reading, and deciding.

## How the picture was made

`scripts/capture-demo.sh` grabbed the whole screen every two seconds for the length of the
run and threw away every frame identical to the one before it: 619 kept out of 1103 taken.
`scripts/assemble-demo.sh` crops those to the cockpit window and cuts them, following
[docs/media/build-demo.edit.tsv](media/build-demo.edit.tsv) for the GIF and
[docs/media/steps.tsv](media/steps.tsv) for the stills on this page. Both lists are committed,
so which frames were used — and which were left out — is reviewable.

The raw frames are not committed. They are 418 MB.
