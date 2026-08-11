/**
 * hcm-model-design — Phase 1 of the HCM Graph product.
 *
 * Finalizes the graph model for the Core-HR slice: node labels + typed properties,
 * relationship types + properties, the Neo4j 5 Community constraints/indexes that
 * carry the five invariants, resolutions for the three open questions
 * (temporal model, matrix/dotted-line reporting, IDs), and a seed-data plan for
 * a realistic ~200-person company. It writes ONE artifact, examples/hcm-graph/design/schema.md,
 * challenges it with a fresh independent verifier through a bounded review→repair
 * loop, and STOPS at the "Approve model" human gate before any build begins.
 *
 * Grounds every decision in the Phase-0 approval: examples/hcm-graph/PROJECT.md (the contract),
 * examples/hcm-graph/domain-graph.md (the model), and examples/hcm-graph/research/stack-recommendation.md
 * (the approved stack — Neo4j Community · tRPC · React Router 7 · ARIA tree).
 *
 * DAG-safe: the repair loop is UNROLLED (review-1 / repair-1 / review-2 / …); the
 * verifier runs in fresh context so the author's optimism cannot bias it.
 *
 * Verified against Atomic 0.9.12 — see atomic/README.md for the API.
 */
import { workflow } from "@bastani/workflows";
import { Type } from "typebox";

const SCHEMA_PATH = "examples/hcm-graph/design/schema.md";

export default workflow({
  name: "hcm-model-design",
  description:
    "Finalize the HCM Graph Core-HR schema + constraints + seed plan (Neo4j CE), verify it with a fresh reviewer through a bounded repair loop, and stop for human model approval.",
  autoAttach: true,

  inputs: {
    open_questions: Type.String({
      description: "The modeling questions Phase 1 must settle, with the leaning default.",
      default:
        "Temporal model: effective-dating on HOLDS (and later REPORTS_TO) vs. current-only — the model must support dates while the first UI reads 'as of today'. " +
        "Matrix/dotted-line reporting: a separate [:DOTTED_REPORTS_TO] edge vs. a property on REPORTS_TO (must NOT create a second solid tree parent — it would break ARIA setsize/posinset). " +
        "IDs: external stable business keys vs. DB-native ids.",
    }),
    max_review_cycles: Type.Integer({
      description: "Maximum review→repair iterations before escalating to a human.",
      default: 2,
    }),
  },

  outputs: {
    status: Type.Union([Type.Literal("completed"), Type.Literal("needs_human")]),
    summary: Type.String(),
    schema_artifact: Type.String(),
    review_cycles_used: Type.Integer(),
  },

  run: async (ctx) => {
    const openQuestions = String(ctx.inputs.open_questions);
    const maxReview = Number(ctx.inputs.max_review_cycles);

    const grounding =
      "Read these first and ground every decision in them: " +
      "examples/hcm-graph/PROJECT.md (the contract), examples/hcm-graph/domain-graph.md (the node/edge model and the five invariants), " +
      "and examples/hcm-graph/research/stack-recommendation.md (the APPROVED stack — Neo4j Community 5.x, tRPC, " +
      "React Router 7 + Vite, and an ARIA `tree` org chart). The concrete DB is Neo4j 5 Community: write " +
      "Cypher-specific DDL and be explicit about which invariants Community can enforce DECLARATIVELY " +
      "(existence/uniqueness/node-key) versus which fall to write-path logic + Testcontainers integration " +
      "tests (cardinality such as 'one active holder per position', and acyclicity of REPORTS_TO). Keep all " +
      "Cypher behind a repository seam in prose so the documented Apache AGE fallback stays cheap; note for " +
      "each invariant what AGE (Postgres constraints) would gain.";
    const grounds = [
      "examples/hcm-graph/PROJECT.md",
      "examples/hcm-graph/domain-graph.md",
      "examples/hcm-graph/research/stack-recommendation.md",
    ];

    // ── Phase 1a: Draft the finalized schema artifact ───────────────────────────────
    await ctx.task("draft-schema", {
      prompt:
        `${grounding}\n\n` +
        `Write the FINAL Core-HR graph model to ${SCHEMA_PATH}. It must contain:\n` +
        `1. Node labels with every property, its type, and constraints (required/unique). Cover Person, ` +
        `Position, Job, OrgUnit, Location.\n` +
        `2. Relationship types with direction and properties: HOLDS {from, to}, REPORTS_TO, IN_ORG_UNIT, ` +
        `DEFINED_BY, BASED_AT, PART_OF, plus the matrix/dotted-line decision.\n` +
        `3. The Cypher DDL (CREATE CONSTRAINT / CREATE INDEX) for Neo4j 5 Community, mapped one-to-one to the ` +
        `five invariants in domain-graph.md. For each invariant state: DB-declarable in CE, or enforced on the ` +
        `write path + verified by integration test — and the exact mechanism.\n` +
        `4. Resolutions, WITH RATIONALE, for the three open questions:\n${openQuestions}\n` +
        `5. Traversal notes: the Cypher shape for reporting-chain-up, transitive-reports, span-of-control, and ` +
        `org-rollup, confirming they hold on this model (variable-length REPORTS_TO*, PART_OF*).\n` +
        `6. A seed-data plan for ~200 people: 1 company root → 4–5 divisions → departments → teams, filled and a ` +
        `few open positions, several locations, and one deliberate matrix/dotted-line case.\n` +
        `Be precise and internally consistent. Do NOT build anything or generate seed rows yet — this is the model spec.`,
      context: "fresh",
      reads: grounds,
      output: SCHEMA_PATH,
      outputMode: "file-only",
    });

    // ── Phase 1b: Bounded review → repair (UNROLLED loop, fresh independent verifier) ─
    let approvedByVerifier = false;
    let cyclesUsed = 0;

    for (let i = 1; i <= maxReview + 1; i++) {
      const verdict = await ctx.task(`review-${i}`, {
        prompt:
          `You are an INDEPENDENT graph-model reviewer with no knowledge of the author's reasoning. ` +
          `Derive acceptance checks from examples/hcm-graph/PROJECT.md and examples/hcm-graph/domain-graph.md FIRST, then judge ` +
          `${SCHEMA_PATH} against them. Check, with specific evidence:\n` +
          `- All FIVE invariants are addressed, each correctly classified as CE-declarable vs write-path+test, ` +
          `with a plausible mechanism (e.g. a real Neo4j 5 constraint form, or a guarded MERGE + test).\n` +
          `- The Cypher DDL is syntactically valid for Neo4j 5 Community and does NOT claim an Enterprise-only ` +
          `feature (e.g. property-existence constraints) as available in CE.\n` +
          `- The four marquee traversals actually hold on the finalized model.\n` +
          `- All THREE open questions are resolved WITH rationale, and the matrix decision does not create a ` +
          `second solid REPORTS_TO parent (which would break the ARIA tree's setsize/posinset).\n` +
          `- The seed plan satisfies the ~200-person structure and includes the matrix case.\n` +
          `- Internal consistency with domain-graph.md (no contradicted node/edge).\n` +
          `A P0 or P1 finding is blocking. An author claiming "done" is not evidence.`,
        context: "fresh",
        reads: [SCHEMA_PATH, "examples/hcm-graph/PROJECT.md", "examples/hcm-graph/domain-graph.md"],
        schema: Type.Object({
          passed: Type.Boolean(),
          blocking_findings: Type.Array(
            Type.Object({
              severity: Type.Union([Type.Literal("P0"), Type.Literal("P1"), Type.Literal("P2")]),
              location: Type.String(),
              issue: Type.String(),
            }),
          ),
          rationale: Type.String(),
        }),
      });

      const result = verdict.structured as {
        passed: boolean;
        blocking_findings: Array<{ severity: string; location: string; issue: string }>;
        rationale: string;
      };

      const blocking = result.blocking_findings.filter((f) => f.severity === "P0" || f.severity === "P1");
      if (result.passed && blocking.length === 0) {
        approvedByVerifier = true;
        break;
      }

      // Out of repair budget: escalate to a human rather than looping forever.
      if (i > maxReview) {
        cyclesUsed = maxReview;
        break;
      }

      // Bounded repair: a NEW node each iteration keeps the graph acyclic.
      cyclesUsed = i;
      await ctx.task(`repair-${i}`, {
        prompt:
          `The independent reviewer rejected the model (cycle ${i}/${maxReview}).\n` +
          `Blocking findings:\n${JSON.stringify(blocking, null, 2)}\n` +
          `Rationale: ${result.rationale}\n\n` +
          `Repair ONLY these findings in ${SCHEMA_PATH}. Keep the rest of the model stable; do not expand scope. ` +
          `Preserve internal consistency with examples/hcm-graph/domain-graph.md.`,
        context: "fork",
        reads: [SCHEMA_PATH, "examples/hcm-graph/domain-graph.md"],
        output: SCHEMA_PATH,
        outputMode: "file-only",
      });
    }

    if (!approvedByVerifier) {
      return ctx.exit({
        status: "blocked",
        reason: `Model review bound (${maxReview}) exhausted; escalating to human.`,
        outputs: {
          status: "needs_human",
          summary:
            `The graph model at ${SCHEMA_PATH} did not pass independent review within ${maxReview} repair ` +
            `cycles. Review it before the Approve-model gate.`,
          schema_artifact: SCHEMA_PATH,
          review_cycles_used: cyclesUsed,
        },
      });
    }

    // ── Gate: Approve model (Phase 1 human gate from PROJECT.md) ─────────────────────
    const approved = await ctx.ui.confirm(
      `Graph model finalized and independently reviewed at ${SCHEMA_PATH}. Approve it as the schema for ` +
        `HCM Graph Core-HR? (Decline to send it back for revision.)`,
    );
    if (!approved) {
      return ctx.exit({
        status: "blocked",
        reason: "Model gate declined by human reviewer.",
        outputs: {
          status: "needs_human",
          summary: `Graph model at ${SCHEMA_PATH} was declined; revise before Phase 2 (build).`,
          schema_artifact: SCHEMA_PATH,
          review_cycles_used: cyclesUsed,
        },
      });
    }

    return {
      status: "completed" as const,
      summary: "Graph model approved. Ready for Phase 2 (build) — see examples/hcm-graph/PROJECT.md.",
      schema_artifact: SCHEMA_PATH,
      review_cycles_used: cyclesUsed,
    };
  },
});
