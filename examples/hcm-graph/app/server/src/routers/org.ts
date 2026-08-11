/**
 * `org.*` — the four marquee traversals plus the pre-shaped org chart and the
 * two filter-source lists the directory's Select/ComboBox read from.
 *
 * The traversal procedures wrap the repository one-to-one (schema.md §5): the
 * chain, transitive reports, span of control, and rollup. `org.chart` returns
 * the whole REPORTS_TO tree already shaped. Every result is re-validated by its
 * output schema.
 */
import { router, publicProcedure } from "../trpc.js";
import {
  chartInput,
  chartOutputSchema,
  locationListSchema,
  orgUnitListSchema,
  personIdInput,
  positionIdInput,
  reportingChainSchema,
  rollupSchema,
  spanOfControlSchema,
  transitiveReportsSchema,
  unitIdInput,
} from "../schemas.js";

export const orgRouter = router({
  /** §5.1 — reporting chain up, ordered person → root. */
  reportingChain: publicProcedure
    .input(personIdInput)
    .output(reportingChainSchema)
    .query(async ({ input, ctx }) => ({
      chain: await ctx.repo.reportingChain(input.personId),
    })),

  /** §5.2 — every seat transitively below a position, with holders. */
  transitiveReports: publicProcedure
    .input(positionIdInput)
    .output(transitiveReportsSchema)
    .query(async ({ input, ctx }) => ({
      reports: await ctx.repo.transitiveReports(input.positionId),
    })),

  /** §5.3 — count of direct reports into a position. */
  spanOfControl: publicProcedure
    .input(positionIdInput)
    .output(spanOfControlSchema)
    .query(async ({ input, ctx }) => ({
      spanOfControl: await ctx.repo.spanOfControl(input.positionId),
    })),

  /** §5.4 — positions rolled up across a unit and its PART_OF descendants. */
  rollup: publicProcedure
    .input(unitIdInput)
    .output(rollupSchema)
    .query(async ({ input, ctx }) => ({
      units: await ctx.repo.rollup(input.unitId),
    })),

  /** The org chart: a single ChartNode tree; rootless ⇒ derive the CEO root. */
  chart: publicProcedure
    .input(chartInput)
    .output(chartOutputSchema)
    .query(({ input, ctx }) => ctx.repo.chart(input.rootPositionId ?? null)),

  /** Filter source — every org unit with its PART_OF parent. */
  listOrgUnits: publicProcedure
    .output(orgUnitListSchema)
    .query(({ ctx }) => ctx.repo.listOrgUnits()),

  /** Filter source — every location. */
  listLocations: publicProcedure
    .output(locationListSchema)
    .query(({ ctx }) => ctx.repo.listLocations()),
});
