// team-chat-client.mjs — the human's chat peer for the team-chat pane (Phase 2).
//
// Registers with the intercom broker as a peer named "human" so the human can take part in the
// team's conversation. Two directions, both captured into the same feed the viewer shows:
//   • OUTGOING — the viewer appends "<to>\t<text>" lines to $TEAMCHAT_FEED.outbox; this daemon
//     sends each as a real intercom message AND writes it to the feed (from "human").
//   • INCOMING — messages other sessions address to "human" arrive here so the broker keeps us a
//     live peer, but we do NOT re-log them: every teammate loads intercom-bridge.ts, which already
//     logs each agent's outbound send/ask/reply to this same feed at its source. Agents must reply
//     over intercom (send/reply to "human"); answering only in their own pane does not reach us.
// Protocol (verified in research/phase0-broker-client-spike-2026-08-15.md): a Unix socket at
// <agentdir>/intercom/broker.sock, framed as 4-byte big-endian length + JSON. No Atomic imports;
// only node built-ins. Runs under bun or node. Reconnects if the broker restarts.
//
// Env: TEAMCHAT_FEED (feed path), ATOMIC_INTERCOM_GROUP (team group, default "harness"),
//      ATOMIC_CODING_AGENT_DIR (agent dir override), TEAMCHAT_ME (display name, default "you").
import net from "node:net";
import fs from "node:fs";
import { dirname } from "node:path";

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const AGENT_DIR = process.env.ATOMIC_CODING_AGENT_DIR || process.env.PI_CODING_AGENT_DIR || `${HOME}/.atomic/agent`;
const SOCK = `${AGENT_DIR}/intercom/broker.sock`;
const FEED = process.env.TEAMCHAT_FEED || "build/team-chat.log";
const OUTBOX = `${FEED}.outbox`;
const GROUP = process.env.ATOMIC_INTERCOM_GROUP || "harness";
const ME = process.env.TEAMCHAT_ME || "human";
const NAME = ME;      // register on the broker under the same name the team sees in the chat

// Exactly one `human` peer per broker. A second viewer — or an orphan client from a force-closed
// pane — registering under the same name makes the team see several `human` peers and reply to
// each, which duplicates every line in the feed. A pid lockfile guards against that: if a live
// holder exists we stand down (the viewer still works, read-only); a stale holder is taken over.
const LOCK = `${AGENT_DIR}/intercom/teamchat-${NAME}.lock`;
function acquireLock() {
  try { fs.mkdirSync(dirname(LOCK), { recursive: true }); } catch { /* dir already exists */ }
  for (let i = 0; i < 2; i++) {
    try {
      const fd = fs.openSync(LOCK, "wx");            // exclusive create — fails if it exists
      fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
      return true;
    } catch {
      let pid = 0;
      try { pid = parseInt(fs.readFileSync(LOCK, "utf8").trim(), 10) || 0; } catch { /* unreadable */ }
      if (pid && pid !== process.pid) {
        try { process.kill(pid, 0); return false; }  // holder is alive — stand down
        catch { /* ESRCH: stale lock, fall through and take it over */ }
      }
      try { fs.unlinkSync(LOCK); } catch { /* someone else may have cleared it */ }
    }
  }
  return false;
}
if (!acquireLock()) process.exit(0);   // another human peer already serves this broker

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
let shuttingDown = false;
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
    // Incoming messages to `human` are intentionally NOT appended to the feed. Every teammate loads
    // intercom-bridge.ts, which already logs each agent's outbound send/ask/reply to this same feed
    // at its source — re-logging here would double every agent→human line in the viewer. We still
    // read incoming so the broker keeps us a live peer; we just do not write it again.
    // Other types (sessions/presence/delivered/…) are ignored — we tolerate unknown messages.
  }));
  const retry = () => {
    if (shuttingDown) return;          // a deliberate shutdown must not reconnect as a new ghost
    connected = false;
    if (sock) { sock.removeAllListeners(); try { sock.destroy(); } catch {} sock = null; }
    attempt++;
    const delay = Math.min(500 * attempt, 5000);
    setTimeout(connect, delay);
  };
  sock.on("error", retry);
  sock.on("close", retry);
}

// Clean shutdown: tell the broker we are leaving so it drops us at once (no ghost peer), release
// the lock, then exit. team-chat.sh sends SIGTERM on quit; a closed pane sends SIGHUP.
function releaseLock() {
  try { if (fs.readFileSync(LOCK, "utf8").trim() === String(process.pid)) fs.unlinkSync(LOCK); }
  catch { /* already gone */ }
}
function shutdown() {
  if (shuttingDown) return; shuttingDown = true;
  releaseLock();
  try { if (sock && connected) { sock.write(frame({ type: "unregister" })); sock.end(); } else if (sock) sock.destroy(); }
  catch { /* socket already dead */ }
  setTimeout(() => process.exit(0), 150).unref?.();
}
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, shutdown);
process.on("exit", releaseLock);

connect();
setInterval(drainOutbox, 300);      // poll the outbox for lines the viewer queued
