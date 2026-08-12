/**
 * intercom-team — a runnable demo of Atomic's Intercom feature.
 *
 * Two agents run concurrently in ONE ctx.parallel set that shares an Intercom group
 * (`group: true`). The `builder` is given a spec that is DELIBERATELY ambiguous on three
 * points; instead of guessing, it must `intercom.ask` the `product-owner` peer live,
 * mid-run, and implement exactly what the peer decides. The peer answers decisively and
 * logs each decision. A fresh `verify` stage then checks the build against those decisions.
 *
 * This is the canonical Atomic "live peer steering" pattern: agents communicating over
 * Intercom to progress toward a goal. Watch it with `/workflow status <run-id>`; the
 * Intercom exchange is the point. (Intercom is intra-workflow and invisible to Herdr — for
 * a Herdr-monitored team see examples/agentic-hris.)
 *
 * Output under examples/atomic-intercom/build/ (git-ignored). Verified against Atomic 0.9.12.
 */
import { workflow } from "@bastani/workflows";
import { Type } from "typebox";

const BUILD = "examples/atomic-intercom/build";
const DECISIONS = `${BUILD}/decisions.md`;
const EVIDENCE = `${BUILD}/evidence.md`;

export default workflow({
  name: "intercom-team",
  description:
    "Two agents coordinate live via Atomic Intercom: a builder asks a product-owner peer to resolve an ambiguous spec, mid-run, instead of guessing.",
  autoAttach: true,

  inputs: {
    // The task is fixed by default so the ambiguity (and thus the Intercom traffic) is guaranteed.
    task: Type.String({
      description: "What the pair builds. The default has three deliberately unspecified points.",
      default:
        "A `parseDuration(input: string): number` utility that converts a duration string to milliseconds " +
        "(e.g. '1h30m' → 5400000, '90m' → 5400000, '45s' → 45000), plus a test file, in a small Node project.",
    }),
  },

  outputs: {
    status: Type.Union([Type.Literal("completed"), Type.Literal("needs_human")]),
    summary: Type.String(),
    decisions_artifact: Type.String(),
    evidence_artifact: Type.String(),
  },

  run: async (ctx) => {
    const task = String(ctx.inputs.task);

    // ── Live peer steering: builder + product-owner, ONE parallel set, shared Intercom group ──
    // `group: true` mints one shared Intercom group for this ctx.parallel set, so the two
    // stages can `intercom.ask` each other while both are still generating.
    await ctx.parallel(
      [
        {
          name: "builder",
          prompt:
            `You are the BUILDER, paired with a "product-owner" peer in this same run.\n\n` +
            `Build, under ${BUILD}/ (create it), this: ${task}\n\n` +
            `The spec is DELIBERATELY INCOMPLETE. Three things are UNSPECIFIED and you MUST NOT guess them — ` +
            `instead ask the "product-owner" peer LIVE using the intercom tool (intercom.ask), wait for the ` +
            `answer, and implement exactly what they decide:\n` +
            `  1. Invalid / unparseable input (e.g. "abc", "") — throw? return null? return 0?\n` +
            `  2. Which units to support beyond h/m/s — days ("d")? weeks ("w")?\n` +
            `  3. A bare number with no unit (e.g. "500") — milliseconds, or invalid?\n\n` +
            `Ask each question clearly via intercom to "product-owner", follow the answers, then finish the ` +
            `implementation and its tests. Keep everything in ${BUILD}/. Return a short summary of what you built ` +
            `and the three decisions you received.`,
        },
        {
          name: "product-owner",
          prompt:
            `You are the PRODUCT-OWNER, paired with a "builder" peer in this same run; you hold the intended spec. ` +
            `The builder will ask you — live, via the intercom tool — to resolve ambiguities. Answer DECISIVELY ` +
            `and consistently, and proactively steer if the builder drifts:\n` +
            `  1. Invalid / unparseable input → THROW a TypeError with a clear message.\n` +
            `  2. Units → support h, m, s, and d (days). NOT weeks.\n` +
            `  3. A bare number with no unit → INVALID (throw); every value must carry a unit.\n\n` +
            `Log every question you receive and the answer you gave to ${DECISIONS} (create it) as a short Q/A list. ` +
            `Return a summary of the decisions you issued.`,
        },
      ],
      { concurrency: 2, group: true },
    );

    // ── Fresh verifier: judge the build against the decisions, from evidence ────────────
    await ctx.task("verify", {
      prompt:
        `You are a FRESH, independent verifier. Read ${DECISIONS} (the product-owner's decisions) and the code + ` +
        `tests under ${BUILD}/. Run the tests (e.g. \`node --test\`). Confirm the implementation matches EACH ` +
        `decision: (1) invalid input throws, (2) units h/m/s/d supported and "w" is NOT, (3) a bare number throws. ` +
        `Report pass/fail per decision with the exact command output and the overall test result. Judge from ` +
        `evidence, not from the builders' claims.`,
      context: "fresh",
      reads: [DECISIONS],
      output: EVIDENCE,
      outputMode: "file-only",
    });

    return {
      status: "completed" as const,
      summary:
        "Builder and product-owner coordinated over Intercom to resolve an ambiguous spec; a fresh verifier " +
        "checked the result against the decisions. See the decisions and evidence artifacts.",
      decisions_artifact: DECISIONS,
      evidence_artifact: EVIDENCE,
    };
  },
});
