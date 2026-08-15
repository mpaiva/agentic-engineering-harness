// team-chat-client.mjs — the human's chat peer for the team-chat pane (Phase 2).
//
// Registers with the intercom broker as a peer named "human" so the human can take part in the
// team's conversation. Two directions, both captured into the same feed the viewer shows:
//   • OUTGOING — the viewer appends "<to>\t<text>" lines to $TEAMCHAT_FEED.outbox; this daemon
//     sends each as a real intercom message AND writes it to the feed (from "human").
//   • INCOMING — messages other sessions address to "human" are written to the feed. Agents must
//     reply over intercom (send/reply to "human"); answering only in their own pane does not reach us.
//
// Protocol (verified in research/phase0-broker-client-spike-2026-08-15.md): a Unix socket at
// <agentdir>/intercom/broker.sock, framed as 4-byte big-endian length + JSON. No Atomic imports;
// only node built-ins. Runs under bun or node. Reconnects if the broker restarts.
//
// Env: TEAMCHAT_FEED (feed path), ATOMIC_INTERCOM_GROUP (team group, default "default"),
//      ATOMIC_CODING_AGENT_DIR (agent dir override), TEAMCHAT_ME (display name, default "you").
import net from "node:net";
import fs from "node:fs";

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const AGENT_DIR = process.env.ATOMIC_CODING_AGENT_DIR || process.env.PI_CODING_AGENT_DIR || `${HOME}/.atomic/agent`;
const SOCK = `${AGENT_DIR}/intercom/broker.sock`;
const FEED = process.env.TEAMCHAT_FEED || "build/team-chat.log";
const OUTBOX = `${FEED}.outbox`;
const GROUP = process.env.ATOMIC_INTERCOM_GROUP || "default";
const ME = process.env.TEAMCHAT_ME || "human";
const NAME = ME;      // register on the broker under the same name the team sees in the chat

function frame(msg) {
  const p = Buffer.from(JSON.stringify(msg), "utf8");
  const h = Buffer.alloc(4);
  h.writeUInt32BE(p.length, 0);
  return Buffer.concat([h, p]);
}
function reader(onMsg) {
  let buf = Buffer.alloc(0);
  return (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 4) {
      const len = buf.readUInt32BE(0);
      if (buf.length < 4 + len) break;
      const pay = buf.subarray(4, 4 + len);
      buf = buf.subarray(4 + len);
      try { onMsg(JSON.parse(pay.toString("utf8"))); } catch { /* ignore malformed */ }
    }
  };
}
function appendFeed(entry) {
  try { fs.appendFileSync(FEED, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n"); }
  catch { /* logging must never crash the daemon */ }
}

let sock = null;
let connected = false;
let attempt = 0;
// Start reading the outbox from its current end, so we do not resend lines queued in a past run.
let outboxOffset = 0;
try { outboxOffset = fs.statSync(OUTBOX).size; } catch { outboxOffset = 0; }

function drainOutbox() {
  let size;
  try { size = fs.statSync(OUTBOX).size; } catch { return; }
  if (size < outboxOffset) outboxOffset = 0;          // file was truncated/recreated
  if (size === outboxOffset) return;
  let chunk = "";
  try {
    const fd = fs.openSync(OUTBOX, "r");
    const b = Buffer.alloc(size - outboxOffset);
    fs.readSync(fd, b, 0, b.length, outboxOffset);
    fs.closeSync(fd);
    chunk = b.toString("utf8");
  } catch { return; }
  outboxOffset = size;
  for (const line of chunk.split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    const to = (tab >= 0 ? line.slice(0, tab) : "lead").trim() || "lead";
    const text = tab >= 0 ? line.slice(tab + 1) : line;
    if (!text) continue;
    if (connected && sock) {
      const message = { id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now(), content: { text } };
      try { sock.write(frame({ type: "send", to, message, attemptId: message.id })); } catch { /* dropped */ }
    }
    appendFeed({ from: ME, action: "send", to, message: text });   // capture the human's line locally
  }
}

function connect() {
  sock = net.connect(SOCK);
  sock.on("connect", () => {
    attempt = 0;
    sock.write(frame({
      type: "register",
      session: { cwd: process.cwd(), model: "team-chat", pid: process.pid, startedAt: Date.now(), lastActivity: Date.now(), name: NAME, group: GROUP, status: "idle" },
    }));
  });
  sock.on("data", reader((m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "registered") { connected = true; return; }
    if (m.type === "message" && m.from && m.message && m.message.content) {
      const msg = m.message;
      const action = msg.expectsReply ? "ask" : (msg.replyTo ? "reply" : "send");
      appendFeed({ from: (m.from.name || "peer"), action, to: ME, message: String(msg.content.text ?? "") });
    }
    // other types (sessions/presence/delivered/…) ignored — we tolerate unknown messages
  }));
  const retry = () => {
    connected = false;
    if (sock) { sock.removeAllListeners(); try { sock.destroy(); } catch {} sock = null; }
    attempt++;
    const delay = Math.min(500 * attempt, 5000);
    setTimeout(connect, delay);
  };
  sock.on("error", retry);
  sock.on("close", retry);
}

connect();
setInterval(drainOutbox, 300);      // poll the outbox for lines the viewer queued
