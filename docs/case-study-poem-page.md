# Case study: a build that finished

This is the first run that went all the way through. Someone asked for a web page, agents
built it, another agent proved it worked, and a person checked it too.

An earlier run did not finish. That story is in
[docs/case-study-first-run.md](case-study-first-run.md). Read both. The first one shows what
breaks. This one shows what it looks like when it works.

## What was asked for

The question was *What do you want to build today?* The answer, typed in plain words:

> a single HTML landing page that reveals one verse of a public-domain poem every 10 seconds
> until the whole poem is shown, ending with the author signature

## What the lead did with it

The lead turned that one sentence into a plan with 8 goals. Each goal can be checked by
someone who did not build the page.

It also added rules nobody asked for, but that mattered:

- The poem must be **public domain**, with the source named.
- The page must make **no network calls**. It has to work with no internet.

Then it stopped and asked: *Proceed as written?* Nothing was built until a person said yes.

## Who was hired

Two agents. Not four, not nine.

| Agent | Why it was hired |
|-------|------------------|
| `implementer` | Ships the single-file HTML/CSS/JS poem reveal page — the entire deliverable. |
| `verifier` | Independent evidence that all 8 success criteria pass. |

The lead skipped the designer, the researcher, the accessibility agent, and the rest. This is
the point of the role library: a small job gets a small team. An earlier run, for a to-do app
with an accessibility requirement, hired four — including an accessibility agent this job did
not need.

## What was built

One HTML file, 4.4 KB. It shows Robert Frost's *The Road Not Taken*, first published in 1916
and in the public domain in the United States.

The first verse shows right away. Another verse appears every 10 seconds. After the last
verse, the author's signature appears and the timer stops:

> — Robert Frost, "The Road Not Taken," *Mountain Interval* (1916, public domain)

The page itself is kept at [docs/samples/poem-page.html](samples/poem-page.html), byte for
byte as the agents produced it.

## The proof

The `verifier` agent tested the page on its own. It did not read the builder's notes. It
loaded the real file in a real browser using `playwright-cli`, watched a full 70-second
reveal cycle, and checked the page at 375 px and 1920 px wide.

| # | What was checked | Result |
|---|------------------|--------|
| 1 | Opens from a file, no console errors | PASS |
| 2 | Only the first verse shows on load | PASS |
| 3 | One verse every 10 seconds, in order | PASS |
| 4 | Signature appears last, then the timer stops | PASS |
| 5 | Poem is public domain, and the source is named | PASS |
| 6 | Readable from 375 px to 1920 px, nothing cut off | PASS |
| 7 | No network calls, works offline | PASS |
| 8 | Once a verse appears, it never disappears | PASS |

**All 8 passed. No repair cycles were needed.**

A person then opened the page too, waited through the whole reveal, and saw the poem finish
with the signature. That check is the screenshot in the README.

## What went wrong on the way

The run stalled for 19 minutes in the middle, and the cause is worth knowing.

**The team could not find its own lead.**

Atomic's messaging is lazy. A session does not join the message system until it sends its
first message. The lead had hired its team using a shell command, not a message — so it had
never joined. It was invisible to the agents it had just started.

Both specialists were told their first action was to message the lead. That message had
nowhere to go:

```
intercom send lead
✗ Message to "lead" was not delivered: Session not found
```

The implementer waited. It wrote: *"Lead still hasn't come online after ~14 minutes of
waiting."* The lead sat idle, waiting for reports that could never arrive. Nothing was built.

**Why it happened.** An earlier fix removed the line that registers the lead's name. That fix
was made for a good reason — the line was being typed into the opening question box by
mistake — but it was removed on the belief that a startup flag already did the same job. It
does not. The flag sets the session's display name. Only the `/name` command registers the
name other agents can reach.

**The fix.** The line is back, and now runs at the one moment it is safe: right after the
question is answered and the box closes. It is in `build.sh`, with a comment explaining why
it must not move in either direction.

Once the lead was reachable, the page was built in a few minutes.

## What this run proves

- A plain-language request becomes a plan with checkable goals.
- A person approves the plan before any money is spent.
- The team is sized to the job.
- Agents build working software.
- A separate agent proves it works, with commands and output, not opinions.

## What it does not prove

- Bigger jobs still have not finished. The largest one tried was stopped part way.
- Restarting a stopped build has not been tested from start to finish.
- One run is one run. This was a small, well-defined job — the easiest kind to get right.
