# Design spec — bridge Atomic intercom to Slack and Telegram

> **Status: FUTURE / NOT IMPLEMENTED.** This is a design, not a shipped feature. No code in
> this repo bridges intercom to Slack or Telegram yet. Every "the extension does X" below is
> a proposal; every "intercom does Y" is verified against the installed Atomic and cited.
>
> Verified against: Atomic `0.9.12` (`docs/intercom.md`, `docs/extensions.md`), and this
> repo's `atomic/extensions/herdr-state.ts`, which already hooks intercom tool calls.

## 1. Goal and chosen shape

Mirror the messages Atomic sessions exchange over **intercom** into **Slack** and
**Telegram**, and let a human reply from either app back into intercom.

Decisions taken (2026-08-14):

| Axis | Choice |
|---|---|
| Deliverable | Design spec first (this document) |
| Direction | **Two-way** — read on Slack/Telegram, and reply back into intercom |
| Scope | **All intercom traffic** — every `send` / `ask` / `reply` |
| Mechanism | **Atomic extension** (the documented extension API) |

The rest of the spec is honest about where those four choices fight each other. Two of them
(**all traffic** + **extension**) do not compose cleanly; §4 and §5 say exactly how far the
extension model reaches and where a gap remains.

## 1a. Recommended path (2026-08-14)

**Build the extension in this repo, keep the relay out of it, and prove the pipe with Telegram
first — outbound-only.** Rationale, ranked:

1. **Relay lives in a separate project, not here.** It is a networked daemon holding bot tokens;
   this repo is intentionally docs + light TS/shell and AGENTS.md forbids unasked runtime deps.
   The **extension** is the opposite — dependency-free (`fetch` to a URL), and it slots next to
   `atomic/extensions/herdr-state.ts`. The extension belongs here; the relay does not.
2. **Telegram before Slack.** One @BotFather token, `getUpdates` long-poll, no public URL —
   testable on a laptop in minutes. Slack two-way needs a bot app + Socket Mode. Prove the pipe
   on the cheap platform, add Slack once the shape holds.
3. **Outbound-only first.** Skip reply-into-a-live-`ask` (the 10-minute race) and the
   relay-as-broker-peer path (undocumented protocol, breaks on Atomic upgrades). Ship
   "all traffic → Telegram" and confirm capture is complete and correctly formatted before
   going two-way.

Concrete order: (1) `atomic/extensions/intercom-bridge.ts` hooks `tool_execution_start` for
`toolName === "intercom"`, POSTs `{from,to,action,message,ts}` to a relay URL, fire-and-forget,
inert with no URL; (2) a throwaway relay stub → Telegram `sendMessage`; (3) 2-session intercom
test; (4) then Slack, mapping, inbound.

**Caveat that could change everything:** "all traffic" still misses what a human types in the
ALT+M overlay (§3). If that must be captured, the whole design shifts to the broker-peer relay —
the harder path. Decide this before building.

## 2. Ground truth (the constraints the design must obey)

From `docs/intercom.md`:

- **Local only.** Transport is a Unix domain socket (named pipe on Windows), length-prefixed
  JSON. **No network.** Slack/Telegram are network services; the bridge is the only network
  edge.
- **No message log.** "Messages are kept in session history; there is no separate intercom
  transcript or inbox." There is nothing to `tail`. Capture must happen live, in-process.
- **Private 1:1 routing.** The broker routes each message to one addressed peer. A peer
  **cannot** passively observe messages between two other peers. `ask` is client-side: the
  broker relays a plain message and the sender's client blocks for the matching reply.
- **Broker lifecycle.** Auto-spawns on first use, exits ~5s after the last session leaves.
  It is not a always-on service the bridge can lean on.

From `docs/extensions.md` (events catalog) — **the load-bearing fact:**

- There is **no `intercom_message` event.** An extension sees intercom activity only as:
  - `tool_execution_start` / `tool_call` / `tool_result` where `toolName === "intercom"` —
    this is the session's **own outbound** `send` / `ask` / `reply`, with full args
    (`action`, `to`, `message`, attachments). Proven in-repo:
    `atomic/extensions/herdr-state.ts:96-107` already reads `event.toolName === "intercom"`
    and `args.action === "ask"`.
  - `context` (can modify messages) — **inbound** intercom messages arrive here, injected
    into the model's context, **not** as a tool call. Parsing them is fragile (format is not
    a stable contract).
- An extension is **per-session**: it only sees the traffic of the session it is loaded into.

## 3. What "all traffic" means under these constraints

Because the broker is private 1:1, no single vantage point sees everything. But every message
has exactly one **sender**, and the sender emits it as an outbound `intercom` tool call that
its own extension can read cleanly. Therefore:

> **If every session runs the bridge extension, the union of each session's outbound captures
> equals all traffic — each message captured exactly once, at its source.**

This is the design's spine. It sidesteps the private-routing limit and the unstable inbound
`context` format. It has one honest gap:

- **A sender that does not run the extension is invisible.** That includes a human typing in
  the intercom overlay (ALT+M), any Atomic session launched without the extension, and the
  bridge's own inbound-relay sends (§5). Coverage is only as complete as extension adoption.

In this harness, adoption is enforceable: `build.sh` / `scripts/team.sh` launch every teammate
with `atomic -e <ext>` (the same slot `herdr-state.ts` uses today), so every teammate would
carry the bridge. The human-in-overlay case stays a documented blind spot.

## 4. Architecture

```
   Atomic session (lead)          Atomic session (verifier)         ... every teammate
   ┌─────────────────────┐        ┌─────────────────────┐
   │ intercom tool  ───┐ │        │ intercom tool  ───┐ │
   │ bridge extension ◄┘ │        │ bridge extension ◄┘ │   (tool_execution_start:
   └─────────┬───────────┘        └─────────┬───────────┘    toolName === "intercom")
             │ outbound capture (send/ask/reply, to, message)
             └───────────────┬───────────────┘
                             ▼
                   ┌───────────────────┐   HTTP out    ┌──────────┐
                   │  relay endpoint   │ ────────────► │  Slack   │
                   │ (bridge process/  │               ├──────────┤
                   │  webhook target)  │ ◄──────────── │ Telegram │
                   └─────────┬─────────┘   inbound     └──────────┘
                             │ inbound → intercom send (§5, the hard part)
                             ▼
                     broker.sock (Atomic intercom)
```

Two components:

1. **Bridge extension** (loaded in every session). On `tool_execution_start` with
   `toolName === "intercom"` and `action ∈ {send, ask, reply}`, POST a normalized event
   (from, to, action, message, ts, sessionId) to the relay. Outbound only, non-blocking, best
   effort — a failed POST must never stall the agent (mirror herdr-state.ts's fire-and-forget
   `report()`).
2. **Relay** (the network edge; a small always-on process the extensions POST to). Formats and
   forwards to Slack (Web API / incoming webhook) and Telegram (Bot API `sendMessage`), and
   receives inbound from both to drive §5. The extension itself has no inbound network server,
   so the relay owns all bot tokens and the public receive surface.

Why a separate relay and not the extension calling Slack directly: an extension is per-session
and dies with its session; Slack/Telegram inbound (Events API callback, Telegram webhook/
long-poll) needs one stable listener, not one per teammate. Keep secrets in one place.

## 5. The hard part: inbound reply-back into intercom

Outbound (intercom → Slack/Telegram) is straightforward. The reverse is not, and the spec must
not pretend otherwise.

A human replies in Slack/Telegram → the relay receives it → it must become an intercom `send`
to a specific peer (e.g. reply routed to `lead`). Problems:

- **An extension cannot make the model issue a tool call on demand.** The `intercom` tool is
  invoked by the LLM. The documented lever an extension has is injecting a message into context
  (`before_agent_start` / `context`) so the model chooses to act — indirect and unreliable for
  a verbatim relay.
- **Cleaner path — the relay speaks the broker protocol directly** as its own addressable peer
  named e.g. `slack`. Then a Slack reply becomes a real `intercom send` from `slack` to `lead`,
  and it shows up for teammates exactly like any peer message. **Cost:** the broker wire
  protocol is internal and undocumented (length-prefixed JSON, request correlation); there is
  **no documented public client SDK** — `dist/builtin/intercom` exposes only config/backoff
  helpers, and the broker internals under `dist/core/intercom-runtime-group` and
  `dist/bun/internal-intercom-broker` are not a supported client surface. Implementing it means
  reverse-engineering `internal-intercom-broker.js` and re-verifying on every Atomic upgrade —
  exactly the kind of unstable coupling AGENTS.md warns against.
- **`ask` reply-back has a hard 10-minute window.** `docs/intercom.md`: `ask` blocks ~10 min.
  A human answering from Telegram must beat that timeout or the sender's `ask` has already
  failed. One-way notify of asks is safe; true reply-into-an-ask is timing-bound.

**Recommendation for phase 1:** ship outbound-only (all traffic → Slack/Telegram) plus inbound
as *new* intercom sends from a relay-peer named `slack`/`telegram` (not replies into a live
`ask`). Defer answering a blocking `ask` from chat until the relay-as-broker-peer path is
proven. This delivers "two-way" in the useful sense (you can inject messages back) without
betting the design on the 10-minute `ask` race.

## 6. Message and identity mapping

| intercom | Slack | Telegram |
|---|---|---|
| peer name (`lead`, `verifier`) | thread or channel per run/peer | one chat, prefix `[lead → verifier]` |
| `send` | message | message |
| `ask` | message tagged ⏳ *awaiting reply (10 min)* | same |
| `reply` | threaded under the ask | reply-to the ask message |
| attachments (`file`/`snippet`/`context`) | snippet / file upload | document / code block |

A config file maps intercom names ↔ Slack channel IDs ↔ Telegram chat IDs, and maps the
reverse (which Slack thread / Telegram reply targets which intercom peer). Slack threads model
per-peer conversations well; Telegram's flat chat needs explicit `[from → to]` prefixes and
`reply_to_message_id` to disambiguate.

## 7. Platform notes (to verify before building)

**Slack** — two options: (a) an **incoming webhook** URL (outbound only, dead simple, no inbound
→ no reply-back); (b) a **bot token + Events API** (bot posts via `chat.postMessage`, receives
via an Events API request URL or Socket Mode). Two-way needs (b). Socket Mode avoids exposing a
public URL, which fits a local harness.

**Telegram** — one **Bot API** token from @BotFather. Outbound: `sendMessage`. Inbound: either
`getUpdates` **long-poll** (no public URL, ideal for local) or a `setWebhook` callback (needs a
public HTTPS endpoint). Prefer long-poll for a laptop-local relay.

Both specifics (Socket Mode handshake, `getUpdates` offset handling, rate limits) must be run
against the real APIs before they enter any implementation doc — do not copy this table into
code comments as fact until exercised.

## 8. Configuration and secrets

- **No secrets in the repo.** Bot tokens, signing secrets, channel/chat IDs live in the
  environment or `~/.config/` (AGENTS.md: never commit secrets or `~/.config/herdr` / `~/.atomic`
  contents; `.gitignore` already excludes them). The relay reads tokens from env; the extension
  reads only a relay URL.
- **No new repo dependencies without being asked** (AGENTS.md). The extension can be dependency-
  free (POST via `fetch`). The relay will need a Slack/Telegram client or raw HTTP; that is a
  new runtime component and must be an explicit, separate decision — flagged, not assumed.
- Enable/disable per launch via an env flag (mirror herdr-state.ts going inert when
  `HERDR_SOCKET_PATH` is unset): no relay URL configured → extension is a no-op.

## 9. Failure modes and safety

- **Never block the agent.** All bridge I/O is best-effort and fire-and-forget; a down relay or
  Slack outage must not slow or stall a teammate. Drop, do not queue-block.
- **Loop guard.** A relay that speaks intercom as peer `slack` must not re-forward its own
  injected sends back to Slack (tag origin; skip round-trips).
- **Ordering / dedup.** Union-of-senders gives each message once; but if a session is
  double-covered (extension + a future tap), dedup on (sessionId, ts, action).
- **Privacy.** All intercom content leaves the machine for a third-party chat service. State
  this loudly; make it opt-in per run.
- **Broker restarts** mid-run: extension capture is unaffected (it hooks tool calls, not the
  socket); a relay-as-peer must reconnect with backoff (intercom already documents client
  auto-reconnect).

## 10. Proven vs unproven (ground-truth ledger)

| Claim | Status |
|---|---|
| Extension can read outbound intercom (`action`, `to`, `message`) via tool events | **Proven** — `herdr-state.ts:96-107` does the detection today |
| Intercom is local-only, no log, private 1:1 routing | **Proven** — `docs/intercom.md` |
| No `intercom_message` event; inbound arrives via `context` | **Proven** — `docs/extensions.md` events catalog |
| No *documented* public intercom client SDK | **Partly verified** — `dist/builtin/intercom` exposes only config/backoff; broker internals under `dist/core`/`dist/bun` not inspected as a client surface |
| Union-of-outbound = all traffic when every sender runs the extension | **Reasoned, not run** — needs a live multi-session test |
| Relay-as-broker-peer can inject inbound sends | **Unproven** — internal protocol, not attempted |
| Slack Socket Mode / Telegram long-poll specifics | **Unverified** — must run against real APIs |

## 11. Open questions

1. Is the human-in-overlay blind spot (§3) acceptable, or must the human's ALT+M sends also
   mirror? (They can't, via the extension route.)
2. Do we need reply-into-a-live-`ask` (the 10-min race), or is "inject a new message back" enough?
3. One relay per machine, or per run? Where does it live — a `scripts/` daemon, a Herdr pane, or
   outside the harness entirely?
4. Slack: incoming-webhook (outbound-only, trivial) vs bot+Socket Mode (two-way, more setup) —
   pick per how much reply-back matters.
5. Is the relay in-scope for this repo at all, or does it belong in a separate project (this repo
   is intentionally docs + light TS/shell)?

## 12. Phasing (when we build)

1. **Extension, outbound-only, one platform.** Hook intercom tool events → POST to a stub relay
   → Telegram `sendMessage` (long-poll not yet needed). Proves capture + formatting end to end.
2. **Second platform + mapping.** Add Slack (incoming webhook first), the name↔channel/chat map,
   and attachment rendering.
3. **Inbound as relay-peer sends.** Stand up the relay as a broker peer named `slack`/`telegram`;
   inbound chat → new intercom `send`. Verify the internal protocol; pin the Atomic version.
4. **(Stretch) reply-into-`ask`.** Only after phase 3 is stable and the 10-min window is handled.

Each phase must leave a runnable, documented state and record what was exercised against the real
tools — not "should work."
```

