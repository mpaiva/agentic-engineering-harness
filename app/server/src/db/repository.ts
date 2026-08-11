/**
 * The repository seam.
 *
 * All graph access flows through here; the Cypher itself lives in cypher.ts.
 * This is the isolation boundary the stack recommendation requires ("Isolate all
 * Cypher behind a thin repository interface") so the DB stays swappable and the
 * write-path guards are the single enforcement point for the five invariants.
 *
 * The four structural writers (reportsTo / openHold / setOrgUnit / setPartOf) are the
 * §4 guards. reportsTo, openHold and setPartOf return 0 rows when they REJECT (a cycle,
 * a second solid parent, a double-booked seat). During seeding a reject is a bug, so the
 * `*Guarded` helpers assert a row came back and throw otherwise — the seed proves the
 * guards accept only valid writes. Rejection behaviour itself is exercised by the
 * integration tests (schema.md §6), not here.
 */
import { type Driver, type Session } from "neo4j-driver";
import { CONSTRAINTS, INDEXES, GUARDS, WRITES, TRAVERSALS, VALIDATIONS, COUNTS } from "./cypher.js";

export interface ValidationResult {
  id: string;
  label: string;
  rows: number;
  offending: Record<string, unknown>[];
}

export class GraphRepository {
  constructor(private readonly driver: Driver) {}

  private async write(cypher: string, params: object = {}) {
    const session = this.driver.session();
    try {
      return await session.executeWrite((tx) => tx.run(cypher, params as Record<string, unknown>));
    } finally {
      await session.close();
    }
  }

  private async read(cypher: string, params: object = {}) {
    const session = this.driver.session();
    try {
      return await session.executeRead((tx) => tx.run(cypher, params as Record<string, unknown>));
    } finally {
      await session.close();
    }
  }

  // ── §3 schema migration (idempotent) ──
  /** Apply §3 constraints + indexes. Each schema command runs in its own auto-commit tx. */
  async migrate(): Promise<{ constraints: number; indexes: number }> {
    const session: Session = this.driver.session();
    try {
      for (const ddl of CONSTRAINTS) await session.run(ddl);
      for (const ddl of INDEXES) await session.run(ddl);
    } finally {
      await session.close();
    }
    return { constraints: CONSTRAINTS.length, indexes: INDEXES.length };
  }

  async wipeAll(): Promise<void> {
    await this.write(WRITES.wipeAll);
  }

  // ── node upserts (idempotent MERGE-by-id) ──
  upsertPerson(p: PersonInput) { return this.write(WRITES.upsertPerson, p); }
  upsertPosition(p: PositionInput) { return this.write(WRITES.upsertPosition, p); }
  upsertJob(j: JobInput) { return this.write(WRITES.upsertJob, j); }
  upsertOrgUnit(o: OrgUnitInput) { return this.write(WRITES.upsertOrgUnit, o); }
  upsertLocation(l: LocationInput) { return this.write(WRITES.upsertLocation, l); }

  // ── non-invariant relationship writers ──
  definedBy(positionId: string, jobId: string) { return this.write(WRITES.definedBy, { positionId, jobId }); }
  basedAt(positionId: string, locationId: string) { return this.write(WRITES.basedAt, { positionId, locationId }); }
  dottedReportsTo(childId: string, parentId: string, reason: string) {
    return this.write(WRITES.dottedReportsTo, { childId, parentId, reason });
  }
  closedHold(personId: string, positionId: string, from: string, to: string) {
    return this.write(WRITES.closedHold, { personId, positionId, from, to });
  }

  // ── §4 write-path guards ──
  /** §4.1 — create the solid reporting line; rejects a cycle or a second solid parent. */
  async reportsToGuarded(childId: string, parentId: string): Promise<void> {
    const r = await this.write(GUARDS.reportsTo, { childId, parentId });
    if (r.records.length === 0) {
      throw new Error(`REPORTS_TO guard rejected ${childId} -> ${parentId} (cycle or existing solid parent)`);
    }
  }
  /** §4.2 — open a HOLDS; rejects if the seat already has a current (to IS NULL) holder. */
  async openHoldGuarded(personId: string, positionId: string): Promise<void> {
    const r = await this.write(GUARDS.openHold, { personId, positionId });
    if (r.records.length === 0) {
      throw new Error(`HOLDS guard rejected ${personId} -> ${positionId} (seat already has a current holder)`);
    }
  }
  /** §4.3 — set the single IN_ORG_UNIT (delete-then-merge; always succeeds if nodes exist). */
  async setOrgUnitGuarded(positionId: string, unitId: string): Promise<void> {
    const r = await this.write(GUARDS.setOrgUnit, { positionId, unitId });
    if (r.records.length === 0) {
      throw new Error(`IN_ORG_UNIT guard matched no nodes for ${positionId} / ${unitId}`);
    }
  }
  /** §4.4 — set the single PART_OF parent; rejects a cycle. */
  async setPartOfGuarded(childId: string, parentId: string): Promise<void> {
    const r = await this.write(GUARDS.setPartOf, { childId, parentId });
    if (r.records.length === 0) {
      throw new Error(`PART_OF guard rejected ${childId} -> ${parentId} (cycle)`);
    }
  }

  // ── §5 marquee traversals (used by the seed run-log as evidence) ──
  async reportingChainUp(personId: string): Promise<(string | null)[]> {
    const r = await this.read(TRAVERSALS.reportingChainUp, { personId });
    return (r.records[0]?.get("managerChain") as (string | null)[]) ?? [];
  }
  async allReports(positionId: string): Promise<{ seat: string; holder: string | null }[]> {
    const r = await this.read(TRAVERSALS.allReports, { positionId });
    return r.records.map((rec) => ({ seat: rec.get("seat"), holder: rec.get("holder") }));
  }
  async spanOfControl(positionId: string): Promise<number> {
    const r = await this.read(TRAVERSALS.spanOfControl, { positionId });
    return (r.records[0]?.get("spanOfControl") as number) ?? 0;
  }
  async orgRollup(unitId: string): Promise<{ unit: string; positions: string[] }[]> {
    const r = await this.read(TRAVERSALS.orgRollup, { unitId });
    return r.records.map((rec) => ({ unit: rec.get("unit"), positions: rec.get("positions") }));
  }

  // ── §6 validation (each MUST return 0 rows) ──
  async validateAll(): Promise<ValidationResult[]> {
    const out: ValidationResult[] = [];
    for (const v of VALIDATIONS) {
      const r = await this.read(v.cypher);
      out.push({
        id: v.id,
        label: v.label,
        rows: r.records.length,
        offending: r.records.map((rec) => rec.toObject()),
      });
    }
    return out;
  }

  async nodeCounts(): Promise<{ label: string; count: number }[]> {
    const r = await this.read(COUNTS);
    return r.records.map((rec) => ({ label: rec.get("label"), count: rec.get("c") as number }));
  }
}

export interface PersonInput {
  id: string; firstName: string; lastName: string; email: string;
  status: "active" | "leave" | "terminated"; hireDate: string;
}
export interface PositionInput {
  id: string; title: string; level: number; fte: number; status: "filled" | "open";
}
export interface JobInput { id: string; title: string; family: string; level: number; description: string; }
export interface OrgUnitInput { id: string; name: string; type: "company" | "division" | "department" | "team"; }
export interface LocationInput { id: string; name: string; city: string; country: string; timezone: string; }
