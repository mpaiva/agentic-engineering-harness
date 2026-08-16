/**
 * feature-development — the reference engineering workflow for atomic cockpit.
 *
 * Shape:
 *   Research (parallel fan-out)
 *     → Plan
 *     → Human gate: plan review            (ctx.ui.confirm)
 *     → Implementation (parallel branches)
 *     → Automated verification
 *     → Fresh, independent verifier
 *     → Bounded repair loop (UNROLLED — max N iterations, DAG-safe)
 *     → Human gate: final review           (ctx.ui.confirm)
 *     → Optional PR                         (ctx.tool, only if create_pr)
 *
 * This is a teaching reference: it shows the full shape explicitly. In production you
 * would often replace the implement→verify→repair core with the built-in `goal` or
 * `ralph` workflow and keep the fan-out and the human gates around it.
 *
 * Verified against Atomic 0.9.12. See ../README.md for the API surface.
 */
import { workflow } from "@bastani/workflows";
import { Type } from "typebox";

const RUN_DIR = ".atomic/workflows/runs/feature-development";

export default workflow({
  name: "feature-development",
  description:
    "Research → plan → human gate → parallel implementation → verification → bounded repair → human review → PR.",
  autoAttach: true,

  inputs: {
    objective: Type.String({
      description:
        "What must be TRUE when the work is complete (a verifiable outcome, not a task list).",
    }),
    scope: Type.Optional(
      Type.String({
        description:
          "What agents may change and what they must NOT touch (paths, APIs, components).",
      }),
    ),
    constraints: Type.String({
      description: "Non-negotiables (design system, architecture, WCAG 2.2 AA, no new deps, …).",
      default:
        "Use the approved design system. Follow existing architecture. Add no dependencies without approval. Maintain WCAG 2.2 AA. Preserve existing APIs unless authorized. Do not modify unrelated code.",
    }),
    user_facing: Type.Boolean({
      description: "Whether the change has UI. Enables UX + accessibility verification stages.",
      default: true,
    }),
    max_repair_cycles: Type.Integer({
      description: "Maximum diagnose→repair→re-verify iterations before escalating to a human.",
      default: 3,
    }),
    create_pr: Type.Boolean({
      description: "Authorize opening a PR after final human approval. Objective text never opts in.",
      default: false,
    }),
  },

  outputs: {
    status: Type.Union(
      [Type.Literal("completed"), Type.Literal("needs_human")],
      { description: "completed = approved (and PR opened if authorized); needs_human = a gate stopped the run." },
    ),
    summary: Type.String({ description: "One-paragraph run reason shown in lifecycle notices." }),
    plan_artifact: Type.String({ description: "Path to the approved implementation plan." }),
    evidence_artifact: Type.String({ description: "Path to the collected verification evidence." }),
    repair_cycles_used: Type.Integer(),
    pr_opened: Type.Boolean(),
  },

  run: async (ctx) => {
    const objective = String(ctx.inputs.objective);
    const scope = ctx.inputs.scope ? String(ctx.inputs.scope) : "Not restricted beyond the constraints.";
    const constraints = String(ctx.inputs.constraints);
    const userFacing = Boolean(ctx.inputs.user_facing);
    const maxRepair = Number(ctx.inputs.max_repair_cycles);

    // ── Phase 1: Research (parallel fan-out, each returns a small artifact) ─────────
    const research = {
      codebase: `${RUN_DIR}/research/codebase.md`,
      patterns: `${RUN_DIR}/research/patterns.md`,
      apis: `${RUN_DIR}/research/apis.md`,
      a11y: `${RUN_DIR}/research/accessibility.md`,
      tests: `${RUN_DIR}/research/test-strategy.md`,
    } as const;

    const researchItems = [
      { name: "research-codebase", focus: "the codebase areas this objective touches: files, modules, ownership.", output: research.codebase },
      { name: "research-patterns", focus: "existing patterns and components to reuse (and anti-patterns to avoid).", output: research.patterns },
      { name: "research-apis", focus: "API dependencies, contracts, and data shapes relevant to the objective.", output: research.apis },
      { name: "research-tests", focus: "the test strategy: what to test, at what level, and existing test infrastructure.", output: research.tests },
    ];
    if (userFacing) {
      researchItems.push({
        name: "research-a11y",
        focus: "accessibility implications: semantics, keyboard paths, screen-reader behavior, WCAG 2.2 AA risks.",
        output: research.a11y,
      });
    }

    await ctx.parallel(
      researchItems.map((r) => ({
        name: r.name,
        prompt:
          `Objective: ${objective}\nScope: ${scope}\n\n` +
          `Investigate ${r.focus}\n` +
          `Write concise, evidence-backed findings (file:line references where possible) to the artifact. ` +
          `Do not implement anything. Return only the artifact.`,
        context: "fresh",
        output: r.output,
        outputMode: "file-only",
      })),
      { concurrency: researchItems.length },
    );

    // ── Phase 2: Plan (synthesize research into an implementation plan) ─────────────
    const planPath = `${RUN_DIR}/specs/implementation-plan.md`;
    await ctx.task("plan", {
      prompt:
        `Objective: ${objective}\nScope: ${scope}\nConstraints: ${constraints}\n\n` +
        `Read the research artifacts and synthesize a concrete implementation plan: ` +
        `the change set, parallelizable workstreams (frontend / backend / tests / docs), ` +
        `verification criteria, risks, and open questions.\n` +
        `Read these incrementally: ${Object.values(research).join(", ")}\n` +
        `Write the plan to the artifact.`,
      reads: Object.values(research),
      output: planPath,
      outputMode: "file-only",
    });

    // ── Gate 1: Human plan review ──────────────────────────────────────────────────
    const planApproved = await ctx.ui.confirm(
      `Plan ready at ${planPath}. Approve to begin implementation? ` +
        `(Decline to stop the run for revision.)`,
    );
    if (!planApproved) {
      return ctx.exit({
        status: "blocked",
        reason: "Plan gate declined by human reviewer.",
        outputs: {
          status: "needs_human",
          summary: `Plan at ${planPath} was not approved; run stopped before implementation.`,
          plan_artifact: planPath,
          evidence_artifact: "",
          repair_cycles_used: 0,
          pr_opened: false,
        },
      });
    }

    // ── Phase 3: Implementation (parallel branches from the approved plan) ──────────
    const implItems = [
      { name: "impl-frontend", focus: "the frontend/UI changes" },
      { name: "impl-backend", focus: "the service/API changes" },
      { name: "impl-tests", focus: "unit and integration tests for the change" },
    ];
    await ctx.parallel(
      implItems.map((it) => ({
        name: it.name,
        prompt:
          `Approved plan: ${planPath}\nConstraints: ${constraints}\n\n` +
          `Read the plan and implement ${it.focus}. Stay within scope: ${scope}\n` +
          `Follow existing patterns. Make focused, reviewable changes only.`,
        // Implementation stages keep a coherent forked context across their work.
        context: "fork",
        reads: [planPath],
      })),
      { concurrency: implItems.length },
    );

    // ── Phase 4 + 5: Verification, then bounded repair (UNROLLED loop — DAG-safe) ────
    const evidencePath = `${RUN_DIR}/artifacts/evidence.md`;
    let approvedByVerifier = false;
    let cyclesUsed = 0;

    for (let i = 1; i <= maxRepair + 1; i++) {
      // Automated verification: run the real checks and record evidence.
      await ctx.task(`verify-automated-${i}`, {
        prompt:
          `Objective: ${objective}\n\n` +
          `Run the automated checks for this change and record EVIDENCE (commands run + observed output): ` +
          `compile, typecheck, unit tests, integration tests` +
          (userFacing ? `, accessibility automation (axe/Playwright), keyboard-path validation` : ``) +
          `. Append results to the evidence artifact. Report facts, not conclusions.`,
        output: evidencePath,
        outputMode: "file-only",
      });

      // Fresh, independent verifier: clean context, judges from evidence + diff.
      const verdict = await ctx.task(`verify-independent-${i}`, {
        prompt:
          `Objective: ${objective}\nConstraints: ${constraints}\n\n` +
          `You are an INDEPENDENT verifier with no knowledge of the implementer's reasoning. ` +
          `Derive acceptance checks from the objective FIRST, then inspect the actual diff and the ` +
          `evidence at ${evidencePath}. Decide pass/fail with file:line evidence. ` +
          `An implementer claiming "done" is not evidence.`,
        context: "fresh",
        reads: [evidencePath, planPath],
        // A schema-backed gate: Atomic gives this stage the structured-output tool.
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

      if (result.passed && result.blocking_findings.length === 0) {
        approvedByVerifier = true;
        break;
      }

      // Out of repair budget: escalate to a human rather than looping forever.
      if (i > maxRepair) {
        cyclesUsed = maxRepair;
        break;
      }

      // Bounded repair: a NEW node each iteration keeps the graph acyclic.
      cyclesUsed = i;
      await ctx.task(`repair-${i}`, {
        prompt:
          `The independent verifier rejected the change (cycle ${i}/${maxRepair}).\n` +
          `Findings:\n${JSON.stringify(result.blocking_findings, null, 2)}\n` +
          `Rationale: ${result.rationale}\n\n` +
          `Diagnose and repair ONLY these findings. Do not expand scope: ${scope}`,
        context: "fork",
        reads: [evidencePath, planPath],
      });
    }

    if (!approvedByVerifier) {
      return ctx.exit({
        status: "blocked",
        reason: `Repair bound (${maxRepair}) exhausted; escalating to human review.`,
        outputs: {
          status: "needs_human",
          summary:
            `Independent verification did not pass within ${maxRepair} repair cycles. ` +
            `Evidence at ${evidencePath} for human review.`,
          plan_artifact: planPath,
          evidence_artifact: evidencePath,
          repair_cycles_used: cyclesUsed,
          pr_opened: false,
        },
      });
    }

    // ── Gate 2: Final human review (diff · evidence · risks) ────────────────────────
    const reviewApproved = await ctx.ui.confirm(
      `Independent verification passed. Review the diff, evidence (${evidencePath}), and open risks. ` +
        `Approve to finalize?`,
    );
    if (!reviewApproved) {
      return ctx.exit({
        status: "blocked",
        reason: "Final review gate declined by human reviewer.",
        outputs: {
          status: "needs_human",
          summary: `Change verified but final human approval was declined. Evidence at ${evidencePath}.`,
          plan_artifact: planPath,
          evidence_artifact: evidencePath,
          repair_cycles_used: cyclesUsed,
          pr_opened: false,
        },
      });
    }

    // ── Phase 6: Optional PR (durable side effect, only if explicitly authorized) ───
    let prOpened = false;
    if (Boolean(ctx.inputs.create_pr)) {
      await ctx.task("open-pr", {
        prompt:
          `The change is verified and human-approved. Open a pull request: ` +
          `write a title and body summarizing the objective, the change, and the evidence at ${evidencePath}. ` +
          `Use the project's git/gh tooling.`,
        reads: [evidencePath, planPath],
      });
      prOpened = true;
    }

    return {
      status: "completed" as const,
      summary: prOpened
        ? "Objective implemented, independently verified, human-approved, PR opened."
        : "Objective implemented, independently verified, human-approved (PR not authorized).",
      plan_artifact: planPath,
      evidence_artifact: evidencePath,
      repair_cycles_used: cyclesUsed,
      pr_opened: prOpened,
    };
  },
});
