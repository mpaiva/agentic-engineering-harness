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
| Mechanism | **Transport-layer broker tap** — extension demoted to optional complement (see §1a/§5a) |

The four choices do not fully compose. **All traffic** now explicitly includes **human ALT+M
overlay sends** (decided 2026-08-14), and those are a UI action, not a model tool call — no
extension event fires for them (§3). So the documented **extension** API cannot satisfy the
scope on its own. Capturing everything means tapping the **broker transport** every send routes
through. §5a is the new center of the design; the extension drops to an optional complement.

## 1a. Recommended path (2026-08-14, revised for "capture human sends too")

**Capture at the broker, not in-session. Point Atomic's configurable `brokerCommand` at a custom
broker that mirrors every routed message to a relay, then fan out to Telegram first, Slack
second.** Rationale, ranked:

1. **Only a transport tap sees human sends.** A human typing in ALT+M sends through the broker
   with no model turn, so no `tool_call`/`tool_result` fires (§3). The broker is the one place
   every message — agent and human — passes through. `~/.atomic/agent/intercom/config.json`
   exposes `brokerCommand` / `brokerArgs` (verified: `dist/builtin/intercom/config.ts`,
   `broker/spawn.ts`), so swapping the broker is a supported config edit, not a patch.
2. **Two tap shapes, both heavy — pick in a spike (§5a):** (a) a **replacement broker** that
   implements the wire protocol and mirrors traffic; (b) a **socket-interposition proxy** that
   owns `broker.sock`, forwards frames to a relocated real broker, and copies each frame to the
   relay. (a) is protocol-aware and cleaner but reimplements routing/ask-correlation; (b) is
   protocol-opaque but must win the socket + auto-spawn race.
3. **Telegram before Slack, outbound before two-way.** Once the tap emits messages, fan-out is
   the easy half: prove it to a Telegram chat (@BotFather token, `getUpdates` long-poll, no
   public URL) before adding Slack Socket Mode or reply-back.

**This is materially harder and riskier than the extension route.** The broker wire protocol is
undocumented, standalone Atomic binaries **bypass `brokerCommand`** (internal handoff — so a
config tap may be npm/node-install-only), and every Atomic upgrade can break the tap. AGENTS.md's
stability warning applies at full force. **Budget a verification spike first (§5a)** before
committing to build.

The extension (`atomic/extensions/intercom-bridge.ts`, outbound tool-call capture) is still worth
building as a **low-risk complement** — it reliably captures agent sends today and can run while
the broker tap is proven — but it is no longer sufficient alone.

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

This spine works for **agent-to-agent** traffic: it sidesteps the private-routing limit and the
unstable inbound `context` format. But it does **not** cover the case this design must handle:

- **A sender that does not run the extension is invisible.** Above all, a human typing in the
  intercom overlay (ALT+M) sends with no model turn and no extension event (§5a); likewise any
  Atomic session launched without the extension, and the bridge's own inbound-relay sends.
  Because capturing human sends is **required** (2026-08-14), the extension route is insufficient
  and capture moves to the broker transport — see §5a.

In this harness the extension would still run in every teammate (launched via `build.sh` /
`scripts/team.sh` at the same `-e` slot as `herdr-state.ts`) as a reliable **complement** for
agent sends — but the human-overlay requirement is what forces the §5a broker tap.

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

## 5a. Capturing human sends: the transport-layer tap (the new center)

Requirement (2026-08-14): human ALT+M overlay sends must be mirrored too. They never surface to
an extension, so capture moves to the broker. Facts and the two candidate designs:

**Verified:**
- `brokerCommand` / `brokerArgs` are user-configurable in `~/.atomic/agent/intercom/config.json`
  (`dist/builtin/intercom/config.ts`); the extension spawns the broker via
  `spawnBrokerIfNeeded(config.brokerCommand, config.brokerArgs)` (`broker/spawn.ts`).
- The socket path comes from `getBrokerSocketPath()` (`broker/paths.ts`); default
  `~/.atomic/agent/intercom/broker.sock`.

**Not verified — spike these before building:**
- Does Atomic append the bundled broker **script path** after `brokerArgs` (so a custom command
  wraps rather than replaces it)? What exact argv does the broker receive, including the socket?
- Docs say standalone Atomic runs the broker via an **internal handoff of the same executable** —
  confirm whether `brokerCommand` is honored on standalone builds at all. If not, the config tap
  is npm/node-install-only and proxy route (b) is the only standalone option.
- Is the wire framing (length-prefixed JSON + request correlation) enough to forward transparently?

**Design (a) — replacement broker.** Custom `brokerCommand` → your process implements registration,
1:1 routing, ask-reply correlation, and session listing, and mirrors every message to the relay.
Sees everything including human sends. Cost: reimplement + maintain the protocol; version-coupled;
likely npm-install-only.

**Design (b) — socket-interposition proxy.** A proxy owns the default `broker.sock`, starts the real
broker on a relocated socket, pipes frames both ways, and copies each frame to the relay.
Protocol-opaque (frames only), but must relocate the real broker's socket, win the auto-spawn race,
and survive the broker's ~5-second idle exit. More fragile, but does not reimplement routing.

**Recommendation:** a short spike answering the three unverified questions, then prefer (a) if
`brokerCommand` is honored and the protocol is tractable, else (b). This is the high-risk core —
build and prove it before the easy Telegram/Slack fan-out.

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
| Union-of-outbound = **agent** traffic (not human sends) when every session runs the extension | **Reasoned, not run** — covers agent-to-agent only; human overlay sends excluded |
| Relay-as-broker-peer can inject inbound sends | **Unproven** — internal protocol, not attempted |
| Slack Socket Mode / Telegram long-poll specifics | **Unverified** — must run against real APIs |
| `brokerCommand`/`brokerArgs` configurable → custom broker feasible | **Proven** — `dist/builtin/intercom/config.ts`; spawned via `spawnBrokerIfNeeded` in `broker/spawn.ts` |
| Human ALT+M sends are invisible to extensions | **Proven** — overlay send is UI, not a model tool call; no intercom event fires |
| `brokerCommand` honored on standalone Atomic builds | **Unverified** — docs note standalone uses an internal handoff; spike needed |
| Broker argv/script path + wire framing tappable | **Unverified** — spike before building |

## 11. Open questions

1. **Resolved:** human ALT+M sends must be captured, so the design uses a transport tap (§5a),
   not the extension alone.
2. Which tap shape — replacement broker (a) or socket proxy (b)? Decide from the §5a spike.
3. Is `brokerCommand` honored on the Atomic build you actually run (npm vs standalone)? Blocks (a).
4. Do we need reply-into-a-live-`ask` (the 10-min race), or is "inject a new message back" enough?
5. Where does the relay/broker-tap live — a `scripts/` daemon, a Herdr pane, or a separate project?
   It holds bot tokens and (for the tap) couples to Atomic internals, so it likely does not belong
   in this docs-first repo; the thin extension complement can.
6. Slack: incoming-webhook (outbound-only) vs bot + Socket Mode (two-way) — pick per reply-back need.

## 12. Phasing (when we build)

0. **Spike the broker tap (§5a).** Answer the three unverified questions; confirm `brokerCommand`
   is honored on your Atomic build and the framing is tappable. This gates everything.
1. **Broker tap → stub relay.** Custom broker (a) or socket proxy (b) mirrors every routed message
   — agent and human — to a local stub. Prove human ALT+M sends appear. Pin the Atomic version.
2. **Fan out to Telegram, outbound.** Relay → Telegram `sendMessage` (@BotFather token, long-poll).
   Prove all traffic lands in a chat, correctly formatted.
3. **Add Slack + mapping.** Slack (Socket Mode for two-way), name↔channel/chat map, attachments.
4. **Inbound reply-back.** Chat message → intercom `send` from a relay-peer named `slack`/`telegram`.
5. **(Stretch) reply-into-`ask`.** Only after inbound is stable and the 10-min window is handled.

Low-risk and parallel: the outbound-only extension complement (`intercom-bridge.ts`) for agent
sends, which needs no spike.

Each phase must leave a runnable, documented state and record what was exercised against the real
tools — not "should work."

