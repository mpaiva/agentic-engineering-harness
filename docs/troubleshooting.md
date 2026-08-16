# Troubleshooting

Four situations that stop a new user cold, each with the exact command to run. Verified against
Atomic `0.9.13`, Herdr `0.8.0`, Ghostty `1.3.1` on 2026-08-16.

## The intake question timed out, or I took too long to answer

**It didn't.** `build.sh`'s wait for your answer to *"What do you want to build today?"* has no
timeout — it waits indefinitely and prints a heartbeat every minute so a long wait doesn't look
like a hang:

```text
[harness] still waiting for your answer in the cockpit (3m elapsed)…
```

If you see that line, the run is fine. Attach and answer:

```bash
herdr --session harness
```

**If you press Ctrl-C before answering**, the script prints recovery steps and exits — the lead
agent is still alive in its pane, nothing is lost:

```text
[harness] Interrupted before you answered. The lead is still live in its pane.
  Attach with:  herdr --session harness
  Answer the question, then re-run: ./build.sh --resume
  Or stop the run: herdr --session harness server stop
```

Follow those three lines. Don't run `./build.sh` again without `--resume` — that starts a second,
separate run instead of returning to the one waiting for you.

## A pane looks stuck (stopped moving, no BLOCKED label)

1. List every pane and its state:
   ```bash
   herdr agent list
   ```
   Look at `agent_status` for the pane in question: `idle`, `working`, `blocked`, `done`, or
   `unknown`.
2. `working` that hasn't changed in several minutes — read what it last printed:
   ```bash
   herdr agent read <pane-id> --lines 40
   ```
   (`<pane-id>` is the `pane_id` field from step 1, e.g. `w1:p4` — see the note below on why a
   bare role name like `implementer` may not resolve.)
3. `unknown` — Herdr can't classify the pane confidently. That is not proof of a hang; read its
   output (step 2) before assuming it's stuck.
4. Still no output after a few minutes and the pane is `working` — attach and look directly:
   ```bash
   herdr agent attach <pane-id>
   ```
   Detach without killing it: the standard tmux/Ghostty detach for your terminal (do not close
   the pane or run `herdr server stop` unless you mean to end the whole run).
5. Genuinely dead (no output, no state change, attach shows a frozen or crashed process) — check
   its stderr log, then decide whether to restart that one specialist or the whole run:
   ```bash
   ls build/.launch/*.stderr.log
   ```

## The lead is gone — specialists report "Session not found"

**Symptom.** Agents trying to report to the lead get:

```text
Message to "lead" was not delivered: Session not found
```

The cockpit still looks healthy — specialist panes are present and working — but the agent
that coordinates the run is absent, and nothing on screen says so. Observed in a real run on
2026-08-16.

**Confirm it.** Two checks, both cheap:

```bash
herdr agent list     # is there an agent named "lead"?
herdr pane list      # is there a pane labelled "lead"?
```

If neither lists a lead, the lead is genuinely gone rather than merely busy. In the observed
case the lead's whole pane had disappeared — not just its agent label — while
`build/.launch/lead.pane` still recorded the old pane id.

**Recovery.** Run:

```bash
./build.sh --resume
```

This prunes the stale `lead.pane` record, keeps your confirmed `build/MISSION.md`, and skips
both the opening question and the approval gate — you do not re-answer or re-approve anything.

If it stops with:

```text
could not find a shell pane to start the lead in
```

then every pane on the main tab is still occupied by a live agent, so there is nowhere to put
a new lead. Stop the session and resume — a restart brings the panes back with their agents
dead, which frees one:

```bash
herdr --session harness server stop
./build.sh --resume
```

That error is the safe outcome, not a fault. `build.sh` only ever claims an unoccupied pane on
the **main** tab, so it will refuse rather than take a pane that is in use.

> **Historical note.** Before commit `c425783`, `build.sh` picked the first pane with no
> *label*, and an unlabelled pane is not necessarily a free one — the team-chat, kanban, roster
> and workflow tabs all run unlabelled. On the session where this was found, `--resume` would
> have renamed the **team-chat** pane to `lead` and started an agent inside it, destroying the
> pane the human was using to talk to the team. It now filters on live-agent status and
> restricts to the main tab. If you are running an older checkout, check what it would claim
> before resuming:
>
> ```bash
> herdr pane list | python3 -c "
> import sys,json
> p=json.load(sys.stdin)['result']['panes']
> free=[x for x in sorted(p,key=lambda y:y['pane_id']) if not x.get('label')]
> print('an old build.sh would claim:', free[0]['pane_id'] if free else '(none)')
> for x in free: print(' ', x['pane_id'], x.get('terminal_title_stripped') or x.get('terminal_title'))
> "
> ```

> **Not yet proven end to end.** The diagnosis above is verified — the missing lead, the stale
> `lead.pane` record, and the pane-selection behaviour were all reproduced against a live
> session. The recovery commands are read from `build.sh`'s resume logic and its refusal path
> was confirmed live, but running the full recovery would have destroyed the session being
> examined, so it has not been exercised end to end in a real lead-loss run. Treat it as the
> best available recovery, not as a tested guarantee. See `build/BLOCKED.md` for how this class
> of gap gets closed.

**Meanwhile, you are not stuck.** Specialists that cannot reach the lead can still be read and
driven directly — `herdr agent list` for state, `herdr agent read <pane-id>` for output — and
their work lands in files under `build/` regardless of whether the lead is alive to be told
about it.

## `herdr agent` state is unclear

`herdr agent get <pane-id>` is the reliable check — it returns the full state record for one
pane:

```bash
herdr agent get w1:p6
```
```json
{"agent":"verifier","agent_status":"blocked","pane_id":"w1:p6", ...}
```

**Rough edge, confirmed on this install:** a bare role name (`herdr agent get verifier`,
`herdr agent explain verifier`) returned `agent_not_found` in live testing, even though
`herdr agent list` shows an agent literally named `verifier`. `herdr agent explain <pane-id>`
also failed here, with `agent_explain_unavailable — does not have a detected agent label`, for
every pane tried, including ones `herdr agent list` reported cleanly. Reproduce:

```bash
$ herdr agent get verifier
{"error":{"code":"agent_not_found","message":"agent target verifier not found"}}
$ herdr agent get w1:p6          # pane_id from `herdr agent list` — this one works
{"id":"cli:agent:get","result":{"agent":{"agent":"verifier","agent_status":"blocked", ...
$ herdr agent explain w1:p6
{"error":{"code":"agent_explain_unavailable","message":"agent target w1:p6 does not have a detected agent label"}}
```

**Workaround:** always resolve the `pane_id` first with `herdr agent list`, then pass that
`pane_id` — not the role name — to `get`/`read`/`send-keys`/`attach`. For state you can't
otherwise explain, `herdr agent read <pane-id> --source detection` shows the raw buffer Herdr's
own classifier is matching against, which is usually enough to see why a state looks wrong.

## Interpreting `build/BLOCKED.md`

An agent writes `build/BLOCKED.md` when a mission success criterion cannot be closed
autonomously — most often because closing it needs a human to authorize spend or drive a live
run, and the mission's own rules forbid fabricating that evidence. It is not a crash report.

Read it like this:

1. Each section is one gap, named after the specific claim that's unproven.
2. **"What a human run must do to close this"** is a numbered checklist — the exact steps,
   in order, to produce real evidence.
3. **"Why this isn't closed by this session"** explains what was checked and ruled out, so you
   know the gap wasn't just skipped.

To close a gap: do the numbered steps yourself, or tell an agent to (`intercom send <role> "human
authorized: go run the BLOCKED.md steps for G2"`). The agent then records the result in
`build/EVIDENCE.md`, not by editing `BLOCKED.md` in place — that file's job is to describe the
gap, not to become a running log.

If `build/BLOCKED.md` is stale (the gap it names was since closed), the mission isn't finished
until whoever closed it deletes or updates that section — an unaddressed `BLOCKED.md` at the end
of a run means the mission stopped with open questions, not that something is broken.

## See also

- [docs/monitoring-agents.md](monitoring-agents.md) — the full state model (`working` /
  `blocked` / `done` / `idle` / `unknown`) and how Herdr classifies it.
- [docs/getting-started.md](getting-started.md) — the "If something goes wrong" table there
  covers setup-time failures (missing binaries, not logged in); this page covers what goes
  wrong *during* a run.
