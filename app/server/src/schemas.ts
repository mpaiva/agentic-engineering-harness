/**
 * The tRPC contract, single-sourced as zod.
 *
 * Every procedure validates its input with an `*Input` schema and re-validates
 * its result with an output schema, so the wire shape is enforced at runtime,
 * not merely inferred. The `z.infer` types exported here are the DTOs the
 * repository seam returns; `repository/types.ts` imports them so the graph
 * layer and the API cannot drift apart. Frontend imports `AppRouter` and gets
 * these shapes by inference.
 */
import { z } from "zod";

// ---- shared enums (schema.md / domain-graph.md node property domains) ----
export const personStatus = z.enum(["active", "leave", "terminated"]);
export const positionStatus = z.enum(["filled", "open"]);
export const orgUnitType = z.enum(["company", "division", "department", "team"]);

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const peopleListInput = z.object({
  /** Case-insensitive substring over firstName / lastName / email. */
  query: z.string().trim().min(1).max(200).optional(),
  /** Exact match on the current seat's IN_ORG_UNIT unit id. */
  orgUnitId: z.string().min(1).optional(),
  /** Exact match on the current seat's BASED_AT location id. */
  locationId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  /** Opaque forward cursor returned as `nextCursor` by a prior page. */
  cursor: z.string().min(1).optional(),
});
export type PeopleListInput = z.infer<typeof peopleListInput>;

export const personIdInput = z.object({ personId: z.string().min(1) });
export const positionIdInput = z.object({ positionId: z.string().min(1) });
export const unitIdInput = z.object({ unitId: z.string().min(1) });
export const chartInput = z.object({ rootPositionId: z.string().min(1).optional() });

// ---------------------------------------------------------------------------
// Directory (people.list)
// ---------------------------------------------------------------------------

export const directoryRowSchema = z.object({
  personId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  status: personStatus,
  positionId: z.string(),
  positionTitle: z.string(),
  orgUnitId: z.string(),
  orgUnitName: z.string(),
  locationId: z.string(),
  locationName: z.string(),
});
export type DirectoryRow = z.infer<typeof directoryRowSchema>;

export const directoryPageSchema = z.object({
  rows: z.array(directoryRowSchema),
  nextCursor: z.string().nullable(),
});
export type DirectoryPage = z.infer<typeof directoryPageSchema>;

// ---------------------------------------------------------------------------
// Chain / report elements (shared by people.get, org.reportingChain)
// ---------------------------------------------------------------------------

/** A seat plus its current holder (holder null when the seat is vacant/open). */
export const chainNodeSchema = z.object({
  personId: z.string().nullable(),
  name: z.string().nullable(),
  positionId: z.string(),
  positionTitle: z.string(),
});
export type ChainNode = z.infer<typeof chainNodeSchema>;

export const reportingChainSchema = z.object({ chain: z.array(chainNodeSchema) });

export const transitiveReportSchema = z.object({
  seatId: z.string(),
  positionTitle: z.string(),
  holderPersonId: z.string().nullable(),
  holderName: z.string().nullable(),
});
export type TransitiveReport = z.infer<typeof transitiveReportSchema>;

export const transitiveReportsSchema = z.object({
  reports: z.array(transitiveReportSchema),
});

export const spanOfControlSchema = z.object({
  spanOfControl: z.number().int().nonnegative(),
});

export const rollupUnitSchema = z.object({
  unitId: z.string(),
  unitName: z.string(),
  positions: z.array(z.string()),
});
export type RollupUnit = z.infer<typeof rollupUnitSchema>;

export const rollupSchema = z.object({ units: z.array(rollupUnitSchema) });

// ---------------------------------------------------------------------------
// Person view (people.get)
// ---------------------------------------------------------------------------

export const personDetailSchema = z.object({
  person: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    status: personStatus,
    hireDate: z.string().nullable(),
  }),
  position: z
    .object({
      id: z.string(),
      title: z.string(),
      level: z.number().int(),
      fte: z.number(),
      status: positionStatus,
    })
    .nullable(),
  job: z
    .object({
      id: z.string(),
      title: z.string(),
      family: z.string(),
      level: z.number().int(),
    })
    .nullable(),
  orgUnit: z
    .object({ id: z.string(), name: z.string(), type: orgUnitType })
    .nullable(),
  location: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string(),
      country: z.string(),
      timezone: z.string(),
    })
    .nullable(),
  managerPersonId: z.string().nullable(),
  managerName: z.string().nullable(),
  directReports: z.array(chainNodeSchema),
  /** Ordered ROOT → person for a breadcrumb. */
  reportingChain: z.array(chainNodeSchema),
});
export type PersonDetail = z.infer<typeof personDetailSchema>;

// ---------------------------------------------------------------------------
// Org chart (org.chart) — recursive REPORTS_TO tree, solid-line only
// ---------------------------------------------------------------------------

export interface ChartNode {
  positionId: string;
  title: string;
  holderPersonId: string | null;
  holderName: string | null;
  orgUnitId: string;
  orgUnitName: string;
  /** Direct solid-line reports of this seat (= aria-setsize source). */
  spanOfControl: number;
  /** 1-based depth from the chart root (= aria-level). */
  level: number;
  children: ChartNode[];
}

export const chartNodeSchema: z.ZodType<ChartNode> = z.lazy(() =>
  z.object({
    positionId: z.string(),
    title: z.string(),
    holderPersonId: z.string().nullable(),
    holderName: z.string().nullable(),
    orgUnitId: z.string(),
    orgUnitName: z.string(),
    spanOfControl: z.number().int().nonnegative(),
    level: z.number().int().min(1),
    children: z.array(chartNodeSchema),
  }),
);

export const chartOutputSchema = chartNodeSchema.nullable();

// ---------------------------------------------------------------------------
// Filter sources (org.listOrgUnits / org.listLocations)
// ---------------------------------------------------------------------------

export const orgUnitRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: orgUnitType,
  parentId: z.string().nullable(),
});
export type OrgUnitRef = z.infer<typeof orgUnitRefSchema>;

export const locationRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  timezone: z.string(),
});
export type LocationRef = z.infer<typeof locationRefSchema>;

export const orgUnitListSchema = z.array(orgUnitRefSchema);
export const locationListSchema = z.array(locationRefSchema);
