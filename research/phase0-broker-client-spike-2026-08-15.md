# Phase-0 spike — standalone intercom broker client (RESULT: feasible)

Date: 2026-08-15 · Verified against Atomic `0.9.13` (bun runtime).

## Question

Can a small standalone process (not an Atomic session) speak the intercom broker protocol —
register as a peer, list sessions, send a message, and receive one? This gates Phase 2 of
`specs/2026-08-14-intercom-team-chat-pane.md` (the `chat` client that lets the human take part
and captures their sends).

## Result: YES — proven end to end

A ~50-line client with no Atomic imports registered, listed, and exchanged a real message with a
second client through the actual broker binary:

```
chat:   registered (id 902eea46)
chat:   peers = [chat]
chat:   <session_joined>
chat:   GOT from tester: "hello from tester"
tester: registered (id 17559f7c)
tester: delivered ok
```

The spike ran in an isolated `ATOMIC_CODING_AGENT_DIR=/tmp/teamchat-spike`, so the user's live
broker at `~/.atomic/agent/intercom/broker.sock` was never touched (confirmed still present after).

## The protocol (verified from source)

Transport: Unix domain socket at `getBrokerSocketPath()` = `<agentdir>/intercom/broker.sock`.
Framing (`dist/builtin/intercom/broker/framing.ts`): **4-byte big-endian length + UTF-8 JSON**.

Client → broker:
- `{ type:"register", session:{ cwd, model, pid, startedAt, lastActivity, name?, group?, status? } }`
  — the broker assigns the id and replies `registered`.
- `{ type:"list", requestId, group? }`
- `{ type:"send", to, message:{ id, timestamp, content:{ text, attachments? }, replyTo?, expectsReply? }, attemptId }`
- `{ type:"presence", ... }`, `{ type:"unregister" }`

Broker → client:
- `{ type:"registered", sessionId }`
- `{ type:"sessions", requestId, sessions:[SessionInfo...] }`
- `{ type:"message", from:SessionInfo, message:Message, channel? }`  ← inbound delivery
- `{ type:"delivered", messageId, attemptId? }`
- `{ type:"session_joined" | "session_left" | "presence_update" | ... }`
- `{ type:"registration_failed", reason }`

Reference implementations: `dist/builtin/intercom/broker/client.ts` and `.../broker/broker.ts`.
The broker self-starts on `bun broker.ts` and exits when the last session disconnects.

## What this means for Phase 2

- **The client is standalone and small.** No dependency on `brokerCommand`, npm-vs-standalone, or
  any Atomic internals beyond the wire format — the client just connects to whatever `broker.sock`
  exists. The earlier "standalone bypass" worry applied to *spawning* the broker, not to a client.
- A `chat` peer in the team-chat pane can: receive messages addressed to `chat` (show them),
  and send the human's typed line as a real `intercom send` (which agents receive) **and** append
  it to the feed — so human participation is captured locally, no overlay tap needed.

## Caveats (carry into the build)

- **Undocumented protocol.** Shapes above are read from source, not a public contract. Pin the
  Atomic version and re-verify on upgrade; keep the client tolerant of unknown message types.
- **`ask` reply window.** Answering an agent's blocking `ask` from the pane still has the ~10-min
  limit; phase the chat client for `send` first, reply-into-`ask` later.
- **Group.** Register in the run's intercom group (default is `default`; atomic cockpit sets
  `ATOMIC_INTERCOM_GROUP`). A `chat` peer must join the same group as the team to see/address it.

## Reproduce

Client used: `/tmp/ic-spike.mjs` (throwaway). Harness: isolated `ATOMIC_CODING_AGENT_DIR`, launch
`bun .../broker/broker.ts`, run two client instances (`listen chat`, `send tester chat`), verify
receipt, then remove the temp dir. No repo files were changed by the spike itself.
