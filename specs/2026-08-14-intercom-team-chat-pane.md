# Design spec — a "team chat" Herdr pane over Atomic intercom

> **Status: FUTURE / NOT IMPLEMENTED.** This is a design, not a shipped feature. No code in
> this repo builds it yet. Every "the pane/extension/client does X" is a proposal; every
> "intercom/Herdr does Y" is verified against the installed tools and cited.
>
> Verified against: Atomic `0.9.13` (`docs/intercom.md`, `docs/extensions.md`, `atomic --help`),
> Herdr `0.8.0` (`herdr --help`, `herdr integration status`, `herdr notification --help`), and
> this repo's `atomic/extensions/herdr-state.ts`, which already hooks intercom tool calls.

## 1. Goal

Give a human a single **"team chat"** surface — a Herdr pane — that shows the team's intercom
conversation and lets the human take part, with **human messages captured** like any agent's.
Keep it **local**: no Slack, no Telegram, no bot tokens, no network egress. External fan-out to
Slack/Telegram is recorded as **future** (§11), not built.

This replaces the earlier Slack/Telegram-first design. The pivot: rather than *tap the transport*
to catch what a human types in the ALT+M overlay, **route the human through a channel we own** —
a chat pane — so capture is free.

| Axis | Choice |
|---|---|
| Deliverable | Design spec first (this document) |
| Surface | A **Herdr pane** ("team chat"), local only |
| Scope | **All traffic** — agent↔agent and human↔agent |
| Human sends | Captured by routing the human through the pane, not by tapping the broker |
| Slack / Telegram | **Future** external fan-out (§11), out of scope for the local design |

## 1a. Recommended shape

**One feed file, two writers, one reader.**

- **Writer 1 — per-agent extension** (`atomic/extensions/intercom-bridge.ts`): in every teammate,
  hook `tool_execution_start` where `toolName === "intercom"` and append each outbound
  `send`/`ask`/`reply` (from, to, action, message, ts) to a shared **feed file**. This captures
  **agent↔agent** traffic with the documented API — the exact pattern `herdr-state.ts:96-107`
  already uses. Low risk, dependency-free.
- **Writer 2 — chat client** (the human's send path): a small program running in the team-chat
  pane that connects to the intercom broker as a peer named `chat` (or `human`). The human types →
  it issues an intercom `send` (so agents receive it) **and** appends the line to the feed file
  (so it is captured). This is the only piece that touches the broker wire protocol, and only its
  **client half**.
- **Reader — the pane view**: the team-chat pane renders the feed. Simplest form: `herdr pane`
  runs `tail -f <feed>` (or a thin TUI). Zero-risk, Herdr-native.

Net: agent traffic is captured by a documented extension; human traffic is captured because the
human sends through our client; the pane is just a tail of the merged feed.

## 2. Ground truth (constraints the design must obey)

From `docs/intercom.md`:

- **Local only.** Unix domain socket, length-prefixed JSON. No network.
- **No message log.** "Messages are kept in session history; there is no separate intercom
  transcript or inbox." Nothing to tail — the feed file is ours to write.
- **Private 1:1 routing.** The broker delivers each message to one addressed peer. A peer
  **cannot** passively see messages between two other peers (this is why the pane alone is not a
  full feed — see §4). No shared-room/broadcast primitive.
- **Broker lifecycle.** Auto-spawns on first use, exits ~5s after the last session disconnects;
  clients auto-reconnect. The chat client must tolerate reconnects.

From `docs/extensions.md` and `atomic --help`:

- **No `intercom_message` event.** An extension sees intercom only as its session's **own
  outbound** tool calls (`tool_execution_start`/`tool_call`/`tool_result`, `toolName ===
  "intercom"`, full args). Proven in-repo: `herdr-state.ts:96-107`. Inbound arrives as injected
  `context`, not an event.
- **No `atomic intercom` CLI.** You cannot send an intercom message from a plain script; sending
  requires either a live Atomic session or speaking the broker protocol.
- **No programmatic intercom-send API for extensions.** Extensions get an `input` interception
  hook and `pi.sendMessage`/`pi.sendUserMessage`, but those inject into the **local model**, not
  the broker. So an extension cannot cleanly send on the human's behalf without the model in the
  loop — which is why the human-send path is a broker client (§3), not an extension.

From Herdr (`herdr --help`, `herdr integration status`, `herdr notification --help`):

- **Herdr has no messaging plugin.** `herdr integration` installs agent-**state** hooks into agent
  CLIs (the sidebar working/blocked/done signal, same family as `herdr-state.ts`). `herdr
  notification show` raises a **local desktop** popup (title/body/position/sound) — not a webhook.
- **Herdr is the wrong layer for message content.** It sees panes and agent state, never intercom
  payloads. But `herdr pane` can run **any command**, so it is the right host for the chat pane
  (tail/TUI) and for launching the chat client.

## 3. Capturing human sends (why a client, not a tap)

The earlier design needed a broker **tap** because a human typing in the ALT+M overlay produces no
event. The pane removes that need: the human sends through the chat client, so we capture at the
source. Two ways to build the client; one is recommended.

**Option A — intercom client (recommended).** A small program speaks the broker socket as peer
`chat`: connect to `getBrokerSocketPath()` (default `~/.atomic/agent/intercom/broker.sock`),
register the name, then framed `send`/receive. Human line → `send` to the target peer + append to
feed. Inbound (messages addressed to `chat`) → append to feed + render. **Cost:** the wire protocol
is undocumented, so this couples to internals — but only the **client half** (connect, register,
send, receive). No routing, no ask-correlation, no socket-race, no broker replacement. The real
broker runs normally; we add one more client. Far smaller and more stable than a tap.

**Option B — Atomic session + `input` hook (not recommended).** The pane is an Atomic session; an
extension intercepts typed lines (`input` event) and relays them. Uses only documented APIs, but
with **no programmatic send** it must get the **model** to call the intercom tool for each line:
per-message LLM latency and cost, and the model may not relay verbatim. Keep as a fallback only if
the client-half protocol proves intractable in the §Phase-0 spike.

## 4. The feed problem: private routing

Because routing is private 1:1, the `chat` peer sees only messages **addressed to it** — not
agent↔agent traffic. So the pane is not automatically a whole-team feed. The design closes the gap
by **merging two capture streams into one feed file**:

- **agent↔agent** — from Writer 1 (the per-agent extension), which reads each agent's own outbound.
- **human↔agent** — from Writer 2 (the chat client), which reads its own sends and its inbound.

Union ≈ the whole conversation, each message written once at its source. Residual gaps, stated
plainly:

- An agent **not** running the extension is invisible on the agent side. In this harness every
  teammate is launched with `atomic -e <ext>` (the slot `herdr-state.ts` uses today), so adoption
  is enforceable.
- A human who bypasses the pane and uses ALT+M in some other session is invisible — a **documented
  convention** ("send team messages from the chat pane"), like TRANSPORT.md's existing send/ask
  rules. Optional hardening: the per-agent extension also logs inbound-from-human it observes.

## 5. Components

```
   every teammate (Atomic)                         team-chat Herdr pane
   ┌───────────────────────────┐                   ┌──────────────────────────┐
   │ intercom tool             │                   │ chat client  (peer=chat) │
   │ intercom-bridge extension │──append──┐        │  human types → send +    │
   │  (tool_execution_start)   │          │        │  inbound → append        │──append──┐
   └───────────────────────────┘          ▼        └─────────────┬────────────┘          ▼
                                    ┌────────────┐                │ broker socket   ┌────────────┐
                                    │ feed file  │◄───────────────┼─────────────────│ feed file  │
                                    └─────┬──────┘   (one shared append-only log)   └────────────┘
                                          │
                                          ▼  tail -f / thin TUI
                                    team-chat pane view
```

1. **`intercom-bridge` extension** — dependency-free; appends outbound intercom to the feed;
   inert when no feed path is configured (mirror herdr-state.ts going inert without
   `HERDR_SOCKET_PATH`). Never blocks the agent (best-effort append).
2. **chat client** — peer `chat`; reads stdin (or a small input box) → intercom `send` + feed
   append; receives → feed append. Reconnect with backoff (broker idle-exits). Launched in the
   pane by `herdr pane` (precedent: `build/.launch/*.sh`).
3. **feed file** — append-only newline-JSON (or formatted text) under `build/` or the agent dir;
   the single source of truth the pane reads. Concurrent appends from multiple writers → use
   `O_APPEND` line writes (atomic for small lines on local fs).
4. **pane view** — `tail -f` first; a scrollable/coloured TUI later.

## 6. Configuration and secrets

- **No tokens needed for the local design.** No Slack/Telegram, no network — nothing secret. This
  is a major simplification over the bridge design.
- **No new repo dependencies without being asked** (AGENTS.md). The extension is `fetch`-free file
  I/O. The chat client needs a socket + framing; keep it dependency-light. Any dep is an explicit,
  separate decision.
- Feed path and target-peer defaults via env (e.g. `TEAMCHAT_FEED`, `TEAMCHAT_TARGET`); unset →
  extension no-ops, client refuses to start with a clear message.

## 7. Failure modes and safety

- **Never block the agent.** Extension append is best-effort; a slow/missing feed file must not
  stall a teammate.
- **Broker restarts.** Extension capture is unaffected (it hooks tool calls, not the socket). The
  chat client must reconnect (intercom documents client auto-reconnect).
- **Feed contention.** Multiple writers append; use line-atomic `O_APPEND`, tolerate interleave,
  include a per-writer id + ts for ordering/dedup.
- **Privacy.** Content stays on the machine — a real advantage of dropping Slack/Telegram. Note it.
- **Convention drift.** If humans send via ALT+M elsewhere, capture is incomplete; document the
  rule and consider the inbound-observed fallback (§4).

## 8. Proven vs unproven (ground-truth ledger)

| Claim | Status |
|---|---|
| Extension reads outbound intercom (`action`,`to`,`message`) via tool events | **Proven** — `herdr-state.ts:96-107` |
| Intercom is local-only, no log, private 1:1 routing | **Proven** — `docs/intercom.md` |
| No `intercom_message` event; inbound via `context` | **Proven** — `docs/extensions.md` |
| No `atomic intercom` CLI | **Proven** — `atomic --help` |
| No programmatic intercom-send API for extensions | **Proven** — only `input` + `pi.sendMessage`/`sendUserMessage` (local model) |
| Herdr has no messaging plugin; `pane` runs any command | **Proven** — `herdr integration status`, `herdr notification --help`, `herdr --help` |
| Broker socket path/default | **Proven** — `getBrokerSocketPath()`, `~/.atomic/agent/intercom/broker.sock` |
| chat client can register as a peer and send/receive over the socket | **Unverified** — undocumented framing; §Phase-0 spike |
| Union of extension + client captures ≈ whole conversation | **Reasoned, not run** — needs a live multi-session test |

## 9. Open questions

1. **Client-half protocol tractable?** Can we register as peer `chat` and send/receive with a small
   client, or is the framing/handshake too coupled? Phase-0 decides A vs the fallback B.
2. **Feed format** — newline-JSON (machine-mergeable, needs a formatter for the view) vs pre-
   formatted text (human-readable, harder to reprocess)? Recommend JSON + a tiny formatter in the
   view.
3. **Where does it live?** The extension belongs in this repo (next to `herdr-state.ts`). The chat
   client couples to Atomic internals — thin, but decide repo vs separate project.
4. **Reply into a live `ask`?** The 10-min `ask` window still applies if the human answers an
   agent's blocking `ask` from the pane; confirm timing or restrict the pane to non-blocking sends.

## 10. Phasing

0. **Spike the client-half protocol.** Prove a tiny program can connect to `broker.sock`, register
   as peer `chat`, send a message another session receives, and receive one. Gates Option A. Pin
   the Atomic version. If it fails, fall back to Option B.
1. **Extension → feed, pane tails it.** Build `intercom-bridge` (agent outbound → feed) and view
   the feed in a Herdr pane (`tail -f`). Delivers a real-time **agent** chat view, zero protocol
   risk, immediately.
2. **Chat client (human send + inbound).** Add the peer-`chat` client so the human participates and
   human sends land in the feed. Now "capture human sends" is satisfied, locally.
3. **View polish.** Thin TUI: colour by peer, mark `ask`/`reply`, timestamps.
4. **(Future, §11) External fan-out.** Only if wanted later.

Each phase leaves a runnable, documented state and records what was exercised against the real
tools — not "should work."

## 11. Future — external fan-out to Slack / Telegram

Deliberately out of scope. If remote access is wanted later, add a **separate** process that reads
the same feed file and forwards to Slack (Socket Mode) / Telegram (Bot API long-poll), with inbound
replies routed back through the chat client's `send`. Keep it out of this docs-first repo: it holds
bot tokens and adds network egress and third-party privacy exposure. The feed-file seam makes this
additive — the local design does not change to enable it.
