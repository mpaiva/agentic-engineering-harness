/**
 * hcm-stack-research — Phase 0 of the HCM Graph product.
 *
 * Fans out independent research on the four stack decisions for a graph-native Core-HR
 * product, synthesizes a single recommendation with trade-offs, and STOPS at a human
 * gate for approval. Nothing is built until the stack is approved.
 *
 * Reads the project contract at examples/hcm-graph/PROJECT.md and the domain graph at
 * examples/hcm-graph/domain-graph.md. Writes artifacts under examples/hcm-graph/research/.
 *
 * Verified against Atomic 0.9.12 — see atomic/README.md for the API.
 */
import { workflow } from "@bastani/workflows";
import { Type } from "typebox";

const DIR = "examples/hcm-graph/research";

export default workflow({
  name: "hcm-stack-research",
  description:
    "Research the graph DB, API, UI/org-chart, and accessibility choices for the HCM Graph product; recommend a stack; stop for human approval.",
  autoAttach: true,

  inputs: {
    priorities: Type.String({
      description: "What to optimize the stack for.",
      default:
        "Graph-native traversals (reporting chains, span of control, org rollup), fast local dev, an accessible org chart (WCAG 2.2 AA), TypeScript end to end, permissive licensing, small dependency surface.",
    }),
  },

  outputs: {
    status: Type.Union([Type.Literal("completed"), Type.Literal("needs_human")]),
    summary: Type.String(),
    recommendation_artifact: Type.String(),
  },

  run: async (ctx) => {
    const priorities = String(ctx.inputs.priorities);
    const contract =
      "Read examples/hcm-graph/PROJECT.md (the contract) and examples/hcm-graph/domain-graph.md (the model) first. " +
      "Ground every claim in those. Optimize for: " + priorities;

    // ── Fan out the four independent stack decisions ────────────────────────────
    const branches = {
      graphdb: `${DIR}/graph-db.md`,
      api: `${DIR}/api.md`,
      ui: `${DIR}/ui-orgchart.md`,
      a11y: `${DIR}/accessibility.md`,
    } as const;

    await ctx.parallel(
      [
        {
          name: "research-graph-db",
          prompt:
            `${contract}\n\nCompare graph databases for this Core-HR graph (e.g. Neo4j, Memgraph, ArangoDB, ` +
            `Postgres+Apache AGE, KuzuDB). Judge each on: traversal/query ergonomics for the queries in ` +
            `domain-graph.md, constraint support for the invariants, local-dev experience, licensing, ` +
            `TypeScript client maturity, and operational weight. Recommend one with reasons and risks.`,
          context: "fresh",
          output: branches.graphdb,
          outputMode: "file-only",
        },
        {
          name: "research-api",
          prompt:
            `${contract}\n\nDecide how the API should expose the graph: GraphQL vs REST (or a thin RPC). ` +
            `Consider how well each expresses traversals (reporting chain, transitive reports, org rollup), ` +
            `pagination, typing to the TS frontend, and coupling to the chosen graph DB. Recommend one.`,
          context: "fresh",
          output: branches.api,
          outputMode: "file-only",
        },
        {
          name: "research-ui",
          prompt:
            `${contract}\n\nRecommend the web framework and the org-chart rendering approach (a library vs. ` +
            `hand-rolled tree/treegrid). Weigh org-chart libraries on interaction quality AND whether their ` +
            `output can be made WCAG 2.2 AA accessible. Cover the directory and person views too.`,
          context: "fresh",
          output: branches.ui,
          outputMode: "file-only",
        },
        {
          name: "research-accessibility",
          prompt:
            `${contract}\n\nDefine the accessible-org-chart pattern: the right ARIA model (tree vs treegrid), ` +
            `keyboard navigation for expanding/collapsing and moving between reports, focus management, and ` +
            `screen-reader announcements for reporting relationships. This constrains the UI choice — be specific.`,
          context: "fresh",
          output: branches.a11y,
          outputMode: "file-only",
        },
      ],
      { concurrency: 4 },
    );

    // ── Synthesize into one recommendation ──────────────────────────────────────
    const recPath = `${DIR}/stack-recommendation.md`;
    await ctx.task("synthesize", {
      prompt:
        `Read the four research artifacts and synthesize ONE coherent, internally-consistent stack ` +
        `recommendation for the HCM Graph Core-HR slice. Cover: graph DB, API paradigm, web framework, ` +
        `org-chart approach, accessibility pattern, and the local-dev setup that ties them together. ` +
        `Include a short trade-offs table and the top risks. Optimize for: ${priorities}\n` +
        `Read incrementally: ${Object.values(branches).join(", ")}`,
      reads: Object.values(branches),
      output: recPath,
      outputMode: "file-only",
    });

    // ── Human gate: approve the stack before anything is built ───────────────────
    const approved = await ctx.ui.confirm(
      `Stack recommendation ready at ${recPath}. Approve it as the stack for HCM Graph? ` +
        `(Decline to send it back for another round.)`,
    );
    if (!approved) {
      return ctx.exit({
        status: "blocked",
        reason: "Stack recommendation not approved.",
        outputs: {
          status: "needs_human",
          summary: `Stack recommendation at ${recPath} was declined; revise before Phase 1.`,
          recommendation_artifact: recPath,
        },
      });
    }

    return {
      status: "completed" as const,
      summary: "Stack approved. Ready for Phase 1 (domain model) — see examples/hcm-graph/PROJECT.md.",
      recommendation_artifact: recPath,
    };
  },
});
