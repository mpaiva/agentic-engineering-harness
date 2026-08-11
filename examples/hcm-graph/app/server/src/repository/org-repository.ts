import { type Driver, isInt } from "neo4j-driver";
import { TRAVERSALS } from "../db/cypher.js";
import type {
  ManagerChain,
  OrgRepository,
  OrgRollupRow,
  TransitiveReport,
} from "./types.js";

/**
 * Neo4j implementation of the four marquee traversals (schema.md §5), returning
 * the canonical id-only shapes in types.ts.
 *
 * The Cypher itself is single-sourced from db/cypher.ts (`TRAVERSALS`), the one
 * place raw Cypher lives — those strings are the literal §5 transcript pinned by
 * the contract-drift test. This class is the typed seam over them: nothing else
 * in the codebase issues these traversals. All are solid-line only (they follow
 * `REPORTS_TO` / `PART_OF`, never `DOTTED_REPORTS_TO`); "current" holders are the
 * `HOLDS` edges with `to IS NULL`, matching the guards and validation queries.
 * The enriched, view-shaped variants the tRPC API serves live in
 * directory-repository.ts and mirror these same §5 cores.
 */
const REPORTING_CHAIN_UP = TRAVERSALS.reportingChainUp; // §5.1 person → root
const TRANSITIVE_REPORTS = TRAVERSALS.allReports; //        §5.2 transitive reports
const SPAN_OF_CONTROL = TRAVERSALS.spanOfControl; //        §5.3 direct span
const ORG_ROLLUP = TRAVERSALS.orgRollup; //                 §5.4 org rollup

/** Neo4j Integer or plain number → number. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (isInt(value)) return value.toNumber();
  return Number(value);
}

export class Neo4jOrgRepository implements OrgRepository {
  constructor(private readonly driver: Driver) {}

  async reportingChainUp(personId: string): Promise<ManagerChain> {
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) =>
        tx.run(REPORTING_CHAIN_UP, { personId }),
      );
      const record = result.records[0];
      if (!record) return [];
      const chain = record.get("managerChain") as (string | null)[] | null;
      return chain ?? [];
    } finally {
      await session.close();
    }
  }

  async transitiveReports(positionId: string): Promise<TransitiveReport[]> {
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) =>
        tx.run(TRANSITIVE_REPORTS, { positionId }),
      );
      return result.records.map((record) => ({
        seat: record.get("seat") as string,
        holder: (record.get("holder") as string | null) ?? null,
      }));
    } finally {
      await session.close();
    }
  }

  async spanOfControl(positionId: string): Promise<number> {
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) =>
        tx.run(SPAN_OF_CONTROL, { positionId }),
      );
      const record = result.records[0];
      return record ? toNumber(record.get("spanOfControl")) : 0;
    } finally {
      await session.close();
    }
  }

  async orgRollup(unitId: string): Promise<OrgRollupRow[]> {
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) =>
        tx.run(ORG_ROLLUP, { unitId }),
      );
      return result.records.map((record) => ({
        unit: record.get("unit") as string,
        positions: (record.get("positions") as string[]) ?? [],
      }));
    } finally {
      await session.close();
    }
  }
}
