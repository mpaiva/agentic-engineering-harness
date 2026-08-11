/**
 * hcm-feature-build — Phases 2–3 of the HCM Graph product.
 *
 * The specialization of the reference `feature-development` shape with the named
 * specialists from examples/hcm-graph/agent-team.md, authored AFTER Phase 0 (stack) and Phase 1
 * (model) were approved so every stage can name the REAL tools:
 *   Neo4j 5 Community · tRPC + zod (Hono) · React Router 7 + Vite · React Aria `Tree`
 *   org chart · Neo4j Testcontainers · axe + Playwright · vitest + tsc.
 *
 * Shape (mirrors examples/hcm-graph/agent-team.md's engineering graph):
 *   Phase 2  Implement (parallel specialists) → integrate
 *   Phase 3  Verify (automated evidence) → fresh independent verifier
 *            → bounded repair (UNROLLED, max N, DAG-safe)
 *            → HUMAN GATE: final review (diff · evidence · risks)
 *            → optional local commit/PR (only if authorized)
 *
 * Grounds every stage in the approved artifacts: examples/hcm-graph/PROJECT.md (contract),
 * examples/hcm-graph/design/schema.md (finalized model — labels, CE constraints, write-path
 * guards, marquee traversals, seed plan), examples/hcm-graph/research/stack-recommendation.md
 * (approved stack), and examples/hcm-graph/domain-graph.md (the five invariants).
 *
 * ── RUN-TIME PREREQUISITE ───────────────────────────────────────────────────────
 * Phase 3's integration + e2e evidence needs a CONTAINER RUNTIME (Docker) so
 * Neo4j Testcontainers and Playwright can run against a real graph DB. In an
 * environment without Docker those checks cannot produce real evidence, and the
 * harness forbids fabricated evidence — the automated-verification stage must record
 * the gap honestly rather than claim a pass. Run this workflow where Docker + Node 22
 * are available. Scaffolding the app also introduces an npm workspace under examples/hcm-graph/app/,
 * which AGENTS.md says to add only when asked — this workflow IS that authorization
 * boundary, so keep `create_pr` off and the repo local unless explicitly told.
 *
 * DAG-safe: the repair loop is UNROLLED; the verifier runs in fresh context.
 * Verified against Atomic 0.9.12 — see atomic/README.md for the API.
 */
import { workflow } from "@bastani/workflows";
import { Type } from "typebox";

const APP = "app"; // server/ (tRPC + Neo4j repo) · web/ (RR7 + Vite) · test/ (Testcontainers)
const EVIDENCE = "examples/hcm-graph/artifacts/evidence.md";

const GROUNDS = [
  "examples/hcm-graph/PROJECT.md",
  "examples/hcm-graph/design/schema.md",
  "examples/hcm-graph/research/stack-recommendation.md",
  "examples/hcm-graph/domain-graph.md",
];

export default workflow({
  name: "hcm-feature-build",
  description:
    "Build and verify the HCM Graph Core-HR slice against the approved stack + schema: parallel specialists → integrate → automated evidence → fresh verifier → bounded repair → final review gate.",
  autoAttach: true,

  inputs: {
    objective: Type.String({
      description: "The verifiable outcome for the slice.",
      default:
        "Deliver the Core-HR slice from examples/hcm-graph/PROJECT.md: an employee directory (search + filter), a " +
        "keyboard-navigable WCAG 2.2 AA org chart, and a person view, over a real Neo4j graph served by a " +
        "tRPC API, with the five graph invariants enforced and the four marquee traversals correct — " +
        "exactly as finalized in examples/hcm-graph/design/schema.md.",
    }),
    max_repair_cycles: Type.Integer({
      description: "Maximum diagnose→repair→re-verify iterations before escalating to a human.",
      default: 3,
    }),
    create_pr: Type.Boolean({
      description:
        "Authorize a local commit + PR after final human approval. The repo is local-only by default " +
        "(AGENTS.md: no remote/push unless asked); leave false to stop at a reviewed local branch.",
      default: false,
    }),
  },

  outputs: {
    status: Type.Union([Type.Literal("completed"), Type.Literal("needs_human")]),
    summary: Type.String(),
    evidence_artifact: Type.String(),
    repair_cycles_used: Type.Integer(),
    pr_opened: Type.Boolean(),
  },

  run: async (ctx) => {
    const objective = String(ctx.inputs.objective);
    const maxRepair = Number(ctx.inputs.max_repair_cycles);

    const ground =
      "Read the approved artifacts first and build to them EXACTLY — do not re-open settled decisions: " +
      `${GROUNDS.join(", ")}. The stack is fixed (Neo4j 5 Community, tRPC over Hono with zod, ` +
      "React Router 7 + Vite, a React Aria `Tree` org chart, Neo4j Testcontainers for integration tests). " +
      "The model is fixed in examples/hcm-graph/design/schema.md: use its node labels/properties, its CE uniqueness " +
      "constraints and range indexes, its write-path guards for the five invariants (§4), and its marquee " +
      "traversals (§5) verbatim as the query contract. Keep all Cypher behind a repository seam. Add no " +
      "dependency that is not implied by that stack without flagging it. Work under the examples/hcm-graph/app/ workspace.";

    // ── Phase 2: Implementation (parallel specialists from agent-team.md) ────────────
    const impl = [
      {
        name: "db-engineer",
        focus:
          `Stand up the Neo4j schema in ${APP}/server: apply schema.md §3 constraints + indexes as an ` +
          `idempotent migration, implement the §4 write-path guards, and write a deterministic seed generator ` +
          `for the §7 plan (~200 people: 1 root → 4–5 divisions → depts → teams, ~185 filled / ~10–15 open ` +
          `LEAF seats, ~15 jobs, ~6 locations ≥3 timezones, one DOTTED_REPORTS_TO matrix case, a few closed ` +
          `HOLDS). Provide a docker-compose neo4j:5-community service and a seed run log.`,
      },
      {
        name: "query-specialist",
        focus:
          `Implement the four marquee traversals from schema.md §5 (reporting-chain-up, transitive reports, ` +
          `span-of-control, org-rollup) as typed repository methods over the Neo4j driver, solid-line only, ` +
          `ignoring DOTTED_REPORTS_TO. Each method is the single home of its Cypher. Unit-test result shapes.`,
      },
      {
        name: "api-engineer",
        focus:
          `Expose the traversals + directory as tRPC procedures in ${APP}/server (org.reportingChain, ` +
          `org.transitiveReports, org.spanOfControl, org.rollup, org.chart, people.list with cursor ` +
          `pagination + name/orgUnit/location filters, people.get). Validate inputs with zod; return ` +
          `pre-shaped trees. Contract-test each procedure against seeded data.`,
      },
      {
        name: "frontend-engineer",
        focus:
          `Build ${APP}/web on React Router 7 + Vite: a directory (semantic sortable table + React Aria ` +
          `SearchField/Select/ComboBox), a person view (accessible HTML, manager/reports links, reporting-` +
          `chain breadcrumb), and the org chart as a single-select React Aria \`Tree\` where the hierarchy IS ` +
          `the REPORTS_TO traversal. Loaders call tRPC server-side. Component tests for each view.`,
      },
      {
        name: "accessibility-specialist",
        focus:
          `Make the org chart WCAG 2.2 AA by construction per stack-recommendation §"Org chart + accessibility": ` +
          `role=tree with roving tabindex, ←/→ up-to-manager / down-to-reports, ↑/↓ across peers, author-` +
          `declared aria-level/setsize/posinset from the graph, aria-describedby carrying reporting relation + ` +
          `span + org unit, focus-managed detail panel restoring focus on Escape, and a polite live region for ` +
          `async expansion. Matrix lines are annotated links, never a second tree parent.`,
      },
      {
        name: "test-engineer",
        focus:
          `Author the test suites: unit (query shapes, guards), integration against a REAL Neo4j via ` +
          `Testcontainers (the five §6 validation queries must return 0 rows on clean seed; the four traversals ` +
          `return expected chains/counts/rollups), and Playwright e2e including a scripted keyboard walkthrough ` +
          `of the org-chart tree + an axe pass. Wire tsc + vitest + playwright scripts.`,
      },
    ];

    await ctx.parallel(
      impl.map((it) => ({
        name: it.name,
        prompt:
          `${ground}\n\nObjective: ${objective}\n\nYou are the ${it.name}. ${it.focus}\n` +
          `Make focused, reviewable changes only. Do not declare your own work correct — a fresh verifier ` +
          `judges it in Phase 3. Commit nothing; the workflow integrates and gates first.`,
        context: "fork",
        reads: GROUNDS,
      })),
      { concurrency: impl.length },
    );

    // ── Integrate: one coherent, buildable slice ─────────────────────────────────────
    await ctx.task("integrate", {
      prompt:
        `${ground}\n\nIntegrate the specialists' work into ONE coherent, buildable slice under ${APP}/: ` +
        `reconcile the tRPC router with the repository/query layer and the RR7 loaders, ensure a single ` +
        `docker-compose + dev scripts, and make \`tsc\` typecheck the whole workspace. Resolve seams and ` +
        `duplicate/contradictory files. Do not expand scope. Leave the tree ready for automated verification.`,
      context: "fork",
      reads: GROUNDS,
    });

    // ── Phase 3: Automated verification → fresh verifier → bounded repair (UNROLLED) ─
    let approvedByVerifier = false;
    let cyclesUsed = 0;

    for (let i = 1; i <= maxRepair + 1; i++) {
      await ctx.task(`verify-automated-${i}`, {
        prompt:
          `Objective: ${objective}\n\nRun the REAL checks for the slice and record EVIDENCE (exact commands + ` +
          `observed output) by appending to ${EVIDENCE}: tsc typecheck, vitest unit, integration against a ` +
          `real Neo4j (Testcontainers) INCLUDING the five schema.md §6 validation queries (each must return 0 ` +
          `rows) and the four §5 traversals, Playwright e2e, the org-chart keyboard walkthrough, and the axe ` +
          `pass. Report FACTS, not conclusions. If a check cannot run here (e.g. no container runtime for a ` +
          `real Neo4j), record that gap explicitly as UNVERIFIED with the reason — never claim a pass you did ` +
          `not observe. Fabricated evidence is a failure.`,
        output: EVIDENCE,
        outputMode: "file-only",
      });

      const verdict = await ctx.task(`verify-independent-${i}`, {
        prompt:
          `Objective: ${objective}\n\nYou are an INDEPENDENT verifier with no knowledge of the implementers' ` +
          `reasoning. Derive acceptance checks from examples/hcm-graph/PROJECT.md §Verification and examples/hcm-graph/design/schema.md ` +
          `FIRST, then judge the actual diff and the evidence at ${EVIDENCE}. Require, with file:line / command ` +
          `evidence: the five invariants hold on real seed (the §6 queries return 0 rows), the four traversals ` +
          `are correct, typecheck + unit + integration + e2e pass, and the org chart passes axe + the keyboard ` +
          `walkthrough. An UNVERIFIED/gap-recorded check is NOT a pass — treat a missing real-DB or e2e result ` +
          `as failing. An implementer claiming "done" is not evidence.`,
        context: "fresh",
        reads: [EVIDENCE, ...GROUNDS],
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

      if (i > maxRepair) {
        cyclesUsed = maxRepair;
        break;
      }

      cyclesUsed = i;
      await ctx.task(`repair-${i}`, {
        prompt:
          `The independent verifier rejected the slice (cycle ${i}/${maxRepair}).\n` +
          `Blocking findings:\n${JSON.stringify(blocking, null, 2)}\n` +
          `Rationale: ${result.rationale}\n\n` +
          `Diagnose and repair ONLY these findings against the approved schema/stack. Do not expand scope or ` +
          `re-open settled model decisions. Re-run the affected checks.`,
        context: "fork",
        reads: [EVIDENCE, ...GROUNDS],
      });
    }

    if (!approvedByVerifier) {
      return ctx.exit({
        status: "blocked",
        reason: `Repair bound (${maxRepair}) exhausted; escalating to human review.`,
        outputs: {
          status: "needs_human",
          summary:
            `Independent verification did not pass within ${maxRepair} repair cycles. Evidence at ${EVIDENCE} ` +
            `(including any UNVERIFIED gaps such as a missing container runtime) for human review.`,
          evidence_artifact: EVIDENCE,
          repair_cycles_used: cyclesUsed,
          pr_opened: false,
        },
      });
    }

    // ── Gate: final human review (PROJECT.md Phase 3 — diff · evidence · risks) ───────
    const approved = await ctx.ui.confirm(
      `Independent verification passed. Review the diff, evidence (${EVIDENCE}), a11y results, and open risks. ` +
        `Approve to finalize the Core-HR slice?`,
    );
    if (!approved) {
      return ctx.exit({
        status: "blocked",
        reason: "Final review gate declined by human reviewer.",
        outputs: {
          status: "needs_human",
          summary: `Slice verified but final human approval was declined. Evidence at ${EVIDENCE}.`,
          evidence_artifact: EVIDENCE,
          repair_cycles_used: cyclesUsed,
          pr_opened: false,
        },
      });
    }

    // ── Optional finalize (local commit / PR — only if explicitly authorized) ─────────
    let prOpened = false;
    if (Boolean(ctx.inputs.create_pr)) {
      await ctx.task("finalize-pr", {
        prompt:
          `The slice is verified and human-approved. Commit the change on a feature branch and open a PR: ` +
          `title + body summarizing the objective, the change, and the evidence at ${EVIDENCE}. Use the ` +
          `project's git/gh tooling. Do NOT create a remote or push if none is configured — AGENTS.md keeps ` +
          `this repo local by default; in that case stop at a local commit and say so.`,
        reads: [EVIDENCE, ...GROUNDS],
      });
      prOpened = true;
    }

    return {
      status: "completed" as const,
      summary: prOpened
        ? "Core-HR slice implemented, independently verified, human-approved, and committed/PR-opened."
        : "Core-HR slice implemented, independently verified, and human-approved (PR not authorized).",
      evidence_artifact: EVIDENCE,
      repair_cycles_used: cyclesUsed,
      pr_opened: prOpened,
    };
  },
});
