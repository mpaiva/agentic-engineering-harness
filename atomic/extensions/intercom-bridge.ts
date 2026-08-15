/**
 * intercom-bridge — mirror an Atomic session's outbound intercom messages into a shared
 * "team chat" feed file.
 *
 * WHY THIS EXISTS
 *
 * Intercom routing is private 1:1 (see docs/intercom.md): a peer only sees messages addressed
 * to it, and there is no intercom transcript or inbox — messages live in per-session history.
 * So there is no single place to watch the whole team talk. This extension builds one, the
 * only way the documented API allows: each session logs its OWN outbound sends. Load it in
 * every teammate and the union of those logs is the agent side of the conversation, each
 * message written once, at its source.
 *
 * This is Phase 1 of specs/2026-08-14-intercom-team-chat-pane.md — the zero-protocol,
 * agent-traffic half. It captures what agents `send`/`ask`/`reply`. It does NOT capture what a
 * human types in the ALT+M overlay (that is a UI action, not a model tool call, and fires no
 * extension event); the human side is Phase 2 (a `chat` intercom client). See the spec.
 *
 * HOW IT CAPTURES
 *
 * Atomic's extension API has no intercom-message event. The one clean signal is the session's
 * own `intercom` tool call, which carries { action, to, message } at call time. herdr-state.ts
 * already reads exactly this (toolName === "intercom", args.action). We hook the same event and
 * append one JSON line per message to the feed.
 *
 * USAGE
 *
 *   # load in a teammate (add next to any other -e extensions)
 *   ATOMIC_ROLE=lead atomic -e /abs/path/to/intercom-bridge.ts ...
 *
 *   # watch the feed in a Herdr pane
 *   herdr pane split --current --direction right          # make a pane
 *   herdr pane run <new-pane-id> ./scripts/team-chat.sh   # or just run the script in any pane
 *
 * The feed path is TEAMCHAT_FEED, defaulting to build/team-chat.log (git-ignored, per repo
 * convention). Writing is best-effort and fire-and-forget: a missing dir or slow disk must
 * never slow or break the agent, so every failure is swallowed.
 *
 * Verified against Atomic 0.9.13 and Herdr 0.8.0.
 */
import type { ExtensionAPI } from "@bastani/atomic";
import { appendFile, mkdir } from "node:fs";
import { dirname } from "node:path";

const FEED = process.env.TEAMCHAT_FEED ?? "build/team-chat.log";
const FROM = process.env.ATOMIC_ROLE ?? "me";

// Only these intercom actions carry a message worth logging. list/status/pending/join/leave
// are control calls, not chat.
const MESSAGE_ACTIONS = new Set(["send", "ask", "reply"]);

// Best-effort: make sure the feed's directory exists once, but never throw if it does not.
try {
  mkdir(dirname(FEED), { recursive: true }, () => {});
} catch {
  /* a feed we cannot create is not the agent's problem */
}

interface IntercomArgs {
  action?: string;
  to?: string;
  message?: string;
  attachments?: unknown[];
}

function logMessage(args: unknown): void {
  const a = (args ?? {}) as IntercomArgs;
  if (!a.action || !MESSAGE_ACTIONS.has(a.action)) return;

  const entry = {
    ts: new Date().toISOString(),
    from: FROM,
    action: a.action,
    // `reply` has no `to` — it goes to whoever last asked — so omit it there.
    ...(a.to ? { to: a.to } : {}),
    message: a.message ?? "",
    ...(Array.isArray(a.attachments) && a.attachments.length
      ? { attachments: a.attachments.length }
      : {}),
  };

  // Fire-and-forget, O_APPEND line write: atomic enough for short lines on a local fs, so
  // concurrent writers interleave cleanly. Errors are swallowed on purpose.
  try {
    appendFile(FEED, `${JSON.stringify(entry)}\n`, () => {});
  } catch {
    /* logging chat must never break the agent */
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_execution_start", async (event) => {
    if (event.toolName === "intercom") logMessage(event.args);
  });
}
