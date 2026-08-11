/**
 * Typed result shapes for the four marquee traversals from
 * product/design/schema.md §5. These are the query contract the API and UI
 * consume; the Cypher that produces them lives only in the repository.
 */

/**
 * §5.1 Reporting chain up. One entry per seat on the path from the person's
 * own current seat up to the root seat, holding the id of that seat's current
 * holder — or `null` when the seat is vacant (an open seat has no current
 * HOLDS). Index 0 is the person's own seat's holder; the last entry is the
 * root seat's holder.
 */
export type ManagerChain = (string | null)[];

/**
 * §5.2 All reports (transitive). One row per seat strictly below the queried
 * position in the solid-line REPORTS_TO DAG, with the id of its current holder
 * or `null` when the seat is open.
 */
export interface TransitiveReport {
  seat: string;
  holder: string | null;
}

/**
 * §5.4 Org rollup. One row per org unit at or below the queried unit (via
 * PART_OF), with the ids of the positions that sit directly IN_ORG_UNIT of it.
 */
export interface OrgRollupRow {
  unit: string;
  positions: string[];
}

/**
 * The repository seam. Every method is the single home of one traversal's
 * Cypher; all queries are solid-line only and ignore DOTTED_REPORTS_TO.
 */
export interface OrgRepository {
  /** §5.1 — manager-id chain from a person up to the root seat. */
  reportingChainUp(personId: string): Promise<ManagerChain>;
  /** §5.2 — every seat transitively reporting into a position, with holders. */
  transitiveReports(positionId: string): Promise<TransitiveReport[]>;
  /** §5.3 — count of direct REPORTS_TO into a position. */
  spanOfControl(positionId: string): Promise<number>;
  /** §5.4 — positions rolled up across a unit and its PART_OF descendants. */
  orgRollup(unitId: string): Promise<OrgRollupRow[]>;
}
