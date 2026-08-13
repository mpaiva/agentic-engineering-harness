/**
 * herdr-state — project an Atomic session's live state into the Herdr sidebar.
 *
 * WHY THIS EXISTS
 *
 * Herdr 0.8.0 detects ~21 agent CLIs (`herdr agent start --kind`); Atomic is not one of
 * them. A pane running Atomic therefore shows no working/blocked/done state, and
 * "supervision by exception" — the entire point of the cockpit — stops working.
 *
 * Both halves of the contract already exist, they were just never joined:
 *   - Herdr's socket API exposes `pane.report_agent`, letting an external process claim an
 *     agent identity on a pane and push lifecycle state into the sidebar.
 *   - Atomic's extension API exposes lifecycle events, including `agent_settled`, which the
 *     Atomic docs describe as the event "a status integration" should use to know there is
 *     no automatic continuation left.
 *
 * This file joins them. It is a narrow, one-directional slice of the Atomic <-> Herdr
 * adapter that herdr/atomic-integration.md lists as a target: state OUT of Atomic, INTO
 * Herdr's sidebar. It does not project Atomic workflow stages onto panes, and it is not a
 * Herdr integration in the `herdr integration install` sense.
 *
 * TRANSPORT NOTE — why the socket and not the CLI
 *
 * `herdr pane report-agent` exists as a CLI command, but on 0.8.0 its argument parser does
 * not accept the invocation its own --help documents (`--source <ID>` is rejected in space
 * form, `--agent <LABEL>` in attached form, and no combination parses). The underlying
 * socket method is well-specified in `herdr api schema --json` (PaneReportAgentParams), so
 * this talks to the socket directly: newline-delimited JSON over the Unix socket at
 * $HERDR_SOCKET_PATH. Verified by probe: request {id, method, params} -> {"type":"ok"}.
 *
 * USAGE
 *
 * Herdr injects HERDR_PANE_ID / HERDR_SESSION / HERDR_SOCKET_PATH into every pane, so the
 * only thing a launcher must supply is the role name:
 *
 *   ATOMIC_ROLE=pm atomic -e /abs/path/to/herdr-state.ts --provider anthropic --model claude-sonnet-5
 *
 * Outside a Herdr pane HERDR_SOCKET_PATH is unset and the extension is inert, so the same
 * command still works in a plain terminal.
 *
 * STATE MAPPING
 *   session_start ............................ idle     (claims the agent identity)
 *   agent_start .............................. working
 *   ask_user_question / intercom ask ......... blocked  (waiting on a human or a peer)
 *   agent_settled ............................ idle
 *   session_shutdown ......................... unknown  (pane no longer hosts an agent)
 *
 * Verified against Atomic 0.9.12 and Herdr 0.8.0.
 */
import type { ExtensionAPI } from "@bastani/atomic";
import { connect } from "node:net";

const SOCKET = process.env.HERDR_SOCKET_PATH ?? "";
const PANE = process.env.HERDR_PANE_ID ?? "";
const ROLE = process.env.ATOMIC_ROLE ?? "atomic";
const SOURCE = "atomic-herdr-state";

type State = "idle" | "working" | "blocked" | "unknown";

// Herdr orders reports by seq and ignores ones that are not newer. Seeding from the clock
// (rather than 0) keeps the sequence monotonic across restarts, so a relaunched agent's
// first report is not discarded as stale by state left behind by the previous session.
let seq = Date.now();

function report(state: State, message?: string): void {
  if (!SOCKET || !PANE) return; // not inside a Herdr pane — stay out of the way

  const request = {
    id: `herdr-state:${++seq}`,
    method: "pane.report_agent",
    params: {
      pane_id: PANE,
      source: SOURCE,
      agent: ROLE,
      state,
      seq,
      ...(message ? { message } : {}),
    },
  };

  try {
    // Fire-and-forget: reporting state must never slow down or break the agent.
    const sock = connect(SOCKET);
    sock.on("error", () => {});
    sock.on("connect", () => {
      sock.write(`${JSON.stringify(request)}\n`);
      sock.end();
    });
    sock.unref();
  } catch {
    // A stopped Herdr server is not the agent's problem.
  }
}

// Tools that mean "this agent is waiting on someone else to answer".
function isBlockingTool(toolName: string, args: unknown): boolean {
  if (toolName === "ask_user_question") return true;
  if (toolName === "contact_supervisor") {
    const reason = (args as { reason?: string } | undefined)?.reason;
    return reason === "need_decision" || reason === "interview_request";
  }
  if (toolName === "intercom") {
    // `send` is fire-and-forget; only `ask` blocks until a peer replies.
    return (args as { action?: string } | undefined)?.action === "ask";
  }
  return false;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => report("idle", `${ROLE} ready`));

  pi.on("agent_start", async () => report("working"));

  // agent_end can be followed by a retry, compaction, or a queued follow-up.
  // agent_settled is the one that means "nothing left to continue on its own".
  pi.on("agent_settled", async () => report("idle"));

  pi.on("tool_execution_start", async (event) => {
    if (isBlockingTool(event.toolName, event.args)) {
      report("blocked", `waiting on ${event.toolName}`);
    }
  });

  pi.on("tool_execution_end", async (event) => {
    if (isBlockingTool(event.toolName, event.args)) report("working");
  });

  pi.on("session_shutdown", async () => report("unknown", `${ROLE} stopped`));
}
