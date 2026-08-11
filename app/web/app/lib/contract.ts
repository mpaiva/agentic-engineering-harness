/**
 * contract.ts — the view-model shapes app/web renders.
 *
 * These are conformed FIELD-FOR-FIELD to the api-engineer's single-source zod contract
 * at app/server/src/schemas.ts (the tRPC procedures' `.output()` DTOs) and the finalized
 * model in product/design/schema.md. Keeping them here lets the pure view components +
 * their component tests typecheck and run standalone; at integration the loaders' calls
 * are additionally checked against `import type { AppRouter } from "@hcm/server"`
 * inference in app/web/app/lib/trpc.server.ts.
 *
 * Nullability mirrors schemas.ts exactly: an unfilled seat has null holder fields; a
 * person may lack a current position/job/unit/location (e.g. terminated with only a
 * closed HOLDS), so those blocks are nullable and the UI degrades gracefully.
 *
 * Temporal note (schema.md §1.1): the UI reads "as of today" = the HOLDS edge with
 * `to IS NULL`. Holders/managers below are the current holder only. Structure is
 * solid-line REPORTS_TO only; DOTTED_REPORTS_TO is never a tree parent.
 */

export type PersonStatus = "active" | "leave" | "terminated";
export type PositionStatus = "filled" | "open";
export type OrgUnitType = "company" | "division" | "department" | "team";

/** One hop in a reporting chain or a direct-reports list. Holder is null for a vacant seat. */
export interface ChainNode {
  personId: string | null;
  name: string | null;
  positionId: string;
  positionTitle: string;
}

// ── Directory ─────────────────────────────────────────────────────────────────────
export interface DirectoryRow {
  personId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PersonStatus;
  positionId: string;
  positionTitle: string;
  orgUnitId: string;
  orgUnitName: string;
  locationId: string;
  locationName: string;
}

export interface DirectoryPage {
  rows: DirectoryRow[];
  nextCursor: string | null;
}

// ── Filters (org.listOrgUnits / org.listLocations) ────────────────────────────────
export interface OrgUnitOption {
  id: string;
  name: string;
  type: OrgUnitType;
  parentId: string | null;
}

export interface LocationOption {
  id: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

// ── Person view (people.get) ──────────────────────────────────────────────────────
export interface PersonCore {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PersonStatus;
  hireDate: string | null;
}

export interface PositionCore {
  id: string;
  title: string;
  level: number;
  fte: number;
  status: PositionStatus;
}

export interface JobCore {
  id: string;
  title: string;
  family: string;
  level: number;
}

export interface OrgUnitCore {
  id: string;
  name: string;
  type: OrgUnitType;
}

export interface LocationCore {
  id: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

export interface PersonDetail {
  person: PersonCore;
  position: PositionCore | null;
  job: JobCore | null;
  orgUnit: OrgUnitCore | null;
  location: LocationCore | null;
  managerPersonId: string | null;
  managerName: string | null;
  directReports: ChainNode[];
  /** Ordered ROOT → this person (inclusive); the last element is the person → aria-current. */
  reportingChain: ChainNode[];
}

// ── Matrix / dotted-line (schema.md §1.2 DOTTED_REPORTS_TO {reason}) ───────────────
// A seat's dotted-line manager(s). Rendered as annotated LINKS in the org chart's
// detail panel and named in each treeitem's aria-describedby — NEVER a second tree
// parent (that would corrupt aria-setsize/posinset and Invariants 1 & 5). Solid-line
// REPORTS_TO alone builds the tree. Populated by the api-engineer from the
// (Position)-[:DOTTED_REPORTS_TO]->(Position) edge; absent until then.
export interface DottedManager {
  positionId: string;
  title: string;
  holderPersonId?: string;
  holderName?: string;
  orgUnitName: string;
  reason?: string;
}

// ── Org chart (org.chart) — the ARIA Tree source of truth ─────────────────────────
export interface ChartNode {
  positionId: string;
  title: string;
  /** Current holder of the seat, or null if the seat is open (HOLDS with to IS NULL). */
  holderPersonId: string | null;
  holderName: string | null;
  orgUnitId: string;
  orgUnitName: string;
  /** Direct-report count = schema.md §5.3 span of control; drives the row's description. */
  spanOfControl: number;
  /** 1-based depth = aria-level authored on the treeitem (React Aria derives it from the tree). */
  level: number;
  /** Solid-line reports only; the hierarchy IS the REPORTS_TO traversal. */
  children: ChartNode[];
  /**
   * Matrix / dotted-line managers this seat reports to (schema.md §1.2). Optional and
   * additive: the solid-line tree is complete without it. Never a tree parent.
   */
  dottedManagers?: DottedManager[];
}
