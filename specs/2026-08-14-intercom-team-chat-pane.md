# Design spec — a "team chat" Herdr pane over Atomic intercom

> **Status: PHASES 1 + 2 SHIPPED.** Built and in use: `atomic/extensions/intercom-bridge.ts`
> (agents' outbound intercom → feed file), `scripts/team-chat.sh` (live TUI: reflows on resize,
> per-message dark-grey boxes, sender colour-chips, SEND/ASK/REPLY badges, bold-white first
> sentence, underlined paths, scroll, a `p` markdown document-preview modal, and an `i` compose
> line), and `scripts/team-chat-client.mjs` (the human's `chat` broker peer: sends your typed
> lines to the team and mirrors both directions into the feed). build.sh loads the extension in
> every teammate, auto-opens the pane, and passes the team's intercom group. Still a design only:
> external fan-out to Slack/Telegram (§11). One known gap: messages the human types into another
> session's ALT+M popup are still not captured — send from the pane's `i` compose instead.
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
4. **pane view** — a live TUI (`scripts/team-chat.sh`): reflows on resize, boxes each message,
   scrolls (j/k, g/G, space/b), and previews linked documents in a modal (`p`) with a small
   dependency-free markdown renderer. Non-interactive/piped output falls back to a one-shot render.

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
| chat client can register as a peer and send/receive over the socket | **Proven** — a standalone ~50-line client registered, listed, and exchanged a message with the real broker (isolated agent dir); see `research/phase0-broker-client-spike-2026-08-15.md` |
| Extension appends outbound `send`/`ask`/`reply` to the feed; ignores control calls | **Proven live** — real headless Atomic (anthropic/claude-haiku-4) loaded the extension and made a real intercom `send`; feed line written; `list`/non-intercom ignored, `reply` omits `to` |
| Union of per-agent captures = one merged feed | **Demonstrated (sequential)** — two real sessions (`lead` and `verifier`) appended to one feed, rendered as one chat by `team-chat.sh`. Concurrent multi-session still untested |
| build.sh auto-open: split → rename `team-chat` → run `team-chat.sh`, feed renders in the pane | **Proven live** — ran the exact build.sh sequence against a real headless Herdr server (throwaway session); pane opened, `send-keys Enter` executed headlessly, two appended lines rendered as formatted chat |
| Live TUI reflows the boxed feed on resize / font-change | **Confirmed** — repaints at current width on SIGWINCH; render width-audited at 44/64 cols; reflow/scroll confirmed in the live pane by the user |
| Markdown preview modal: `p` → pick a link → scroll the rendered doc | **Confirmed** — link resolution + markdown render/wrap tested; reads keys from /dev/tty; no glow/pandoc needed |
| Human `chat` peer: send to team + capture both directions | **Proven** — `team-chat-client.mjs` tested with the real broker: outbox line reached `lead` (as `chat`) and logged `from:you`; an agent→`chat` message logged `from:<agent> to:you`; isolated agent dir, real broker untouched |

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

0. **Spike the client-half protocol — DONE.** A from-scratch standalone client registered with the
   real broker, listed peers, and sent+received a message (Atomic 0.9.13, isolated agent dir); the
   protocol is 4-byte-BE-length + JSON and needs no Atomic internals beyond the wire format. See
   `research/phase0-broker-client-spike-2026-08-15.md`. Phase 2 is unblocked.
1. **Extension → feed, pane tails it. — DONE.** `atomic/extensions/intercom-bridge.ts` hooks
   `tool_execution_start` for `toolName === "intercom"` and appends `send`/`ask`/`reply` to
   `TEAMCHAT_FEED` (default `build/team-chat.log`); `scripts/team-chat.sh` tails it (jq-formatted
   when jq is present, raw JSON otherwise). Smoke-tested against a fake `pi`. Delivers a real-time
   **agent** chat view at zero protocol risk. Not yet run across live multi-session teammates.
2. **Chat client (human send + inbound) — DONE.** `scripts/team-chat-client.mjs` registers as
   peer `chat` in the team group, sends the human's composed lines (viewer `i` → outbox), and
   mirrors sent + received messages into the feed. Protocol proven in Phase 0; tested end to end
   with the real broker (human→agent and agent→human both captured). Remaining: reply-into-`ask`.
3. **View polish — DONE.** Live TUI: reflows on resize, per-message boxes, sender colour-chips,
   SEND/ASK/REPLY badges, bold-white first sentence, underlined paths, scroll, and a `p` markdown
   preview modal. Confirmed working in the live pane.
4. **(Future, §11) External fan-out.** Only if wanted later.

Each phase leaves a runnable, documented state and records what was exercised against the real
tools — not "should work."

## 11. Future — external fan-out to Slack / Telegram

Deliberately out of scope. If remote access is wanted later, add a **separate** process that reads
the same feed file and forwards to Slack (Socket Mode) / Telegram (Bot API long-poll), with inbound
replies routed back through the chat client's `send`. Keep it out of this docs-first repo: it holds
bot tokens and adds network egress and third-party privacy exposure. The feed-file seam makes this
additive — the local design does not change to enable it.
