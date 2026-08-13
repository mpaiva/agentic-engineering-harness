/**
 * build-intake — ask the human what to build, once, at the start of a run.
 *
 * This is the harness's front door. It fires in the lead's pane before any tokens are
 * spent, so the opening question cannot be skipped by the model deciding not to ask it.
 *
 * Writes the answer verbatim to $BUILD_DIR/IDEA.md. The lead then refines that raw answer
 * into build/MISSION.md with Atomic's bundled `prompt-engineer` skill. Keeping the raw
 * answer on disk matters: refinement can widen scope, and MISSION.md embeds the original
 * so drift stays visible.
 *
 * WHY THIS EXTENSION DOES NOT SELF-START THE REFINEMENT TURN
 *
 * Atomic's extension API does expose ways to make the agent start a turn programmatically
 * (`pi.sendMessage(msg, { triggerTurn: true })` and `pi.sendUserMessage(...)`, which "always
 * triggers a turn" — see docs/extensions.md around lines 1465 and 1506). This extension
 * deliberately does not use them. Its only contract, per the plan, is producing
 * `$BUILD_DIR/IDEA.md`; the kickoff message is `build.sh`'s job (Task 7), which already polls
 * for that file and sends the refinement instruction via `herdr pane send-text`. Having both
 * the extension and `build.sh` trigger a turn would double-kick the lead the moment Task 7
 * lands. Nothing in the installed docs shows `sendMessage`/`sendUserMessage` being called from
 * inside `session_start` before the first turn, so there is no documented precedent to lean on
 * either. Keeping this extension a pure "write one file" step keeps the two halves of the
 * intake flow (asking, and kicking off refinement) independently testable.
 *
 * Verified against Atomic 0.9.12.
 */
import type { ExtensionAPI } from "@bastani/atomic";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROLE = process.env.ATOMIC_ROLE ?? "";
const BUILD_DIR = process.env.BUILD_DIR ?? "build";
const IDEA_PATH = join(BUILD_DIR, "IDEA.md");

const QUESTION = "What do you want to build today?";
const PLACEHOLDER = "e.g. a CLI that converts CSV to JSON, with tests";

async function askAndRecord(ctx: any): Promise<boolean> {
  const answer = await ctx.ui.input(QUESTION, PLACEHOLDER);

  // Escape/cancel returns undefined. Write nothing — a half-captured idea is worse than
  // none, because the lead would build against it.
  if (answer === undefined || String(answer).trim() === "") {
    ctx.ui.notify("No idea captured. Run /build-intake to try again.", "warning");
    return false;
  }

  mkdirSync(dirname(IDEA_PATH), { recursive: true });
  writeFileSync(
    IDEA_PATH,
    `# Raw idea\n\nCaptured verbatim from the opening question. Do not edit — \`MISSION.md\`\nis the refined version, and this file is what it is checked against.\n\n> ${QUESTION}\n\n${String(answer).trim()}\n`,
    "utf8",
  );
  ctx.ui.notify(`Captured. Refining into ${BUILD_DIR}/MISSION.md…`, "info");
  return true;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Only the orchestrator asks. Without this guard every specialist pops a dialog at boot.
    if (ROLE !== "lead") return;

    // A restarted lead must resume, not re-ask and clobber the mission it already has.
    if (existsSync(IDEA_PATH)) return;

    await askAndRecord(ctx);
  });

  // Manual re-trigger, so a cancelled or mistyped answer is recoverable without relaunching.
  pi.registerCommand("build-intake", {
    description: "Ask what to build and (re)write build/IDEA.md",
    handler: async (_args, ctx) => {
      await askAndRecord(ctx);
    },
  });
}
