import type { Driver } from "neo4j-driver";
import { GraphRepository } from "../../../src/db/repository.js";
import { buildPlan, type SeedPlan } from "../../../src/seed/plan.js";

/**
 * Seed a live graph from the deterministic §7 plan, THROUGH the §4 write-path
 * guards — the same order and the same guarded writers as src/seed/seed.ts, but
 * driver-injectable (no env, no log file) so a Testcontainers driver can drive it.
 *
 * Because every structural edge is written through reportsToGuarded / openHoldGuarded
 * / setOrgUnitGuarded / setPartOfGuarded, a seed that completes without throwing is
 * itself evidence the guards ACCEPT only valid writes. The returned plan is the
 * source of truth the integration assertions derive their expectations from.
 */
export async function seedGraph(driver: Driver): Promise<SeedPlan> {
  const repo = new GraphRepository(driver);
  const plan = buildPlan();

  await repo.migrate(); // §3 constraints + indexes (idempotent)
  await repo.wipeAll();

  // reference data
  for (const j of plan.jobs) await repo.upsertJob(j);
  for (const l of plan.locations) await repo.upsertLocation(l);

  // org units + PART_OF (guard §4.4)
  for (const o of plan.orgUnits) await repo.upsertOrgUnit(o);
  for (const o of plan.orgUnits) {
    if (o.parentId) await repo.setPartOfGuarded(o.id, o.parentId);
  }

  // positions + IN_ORG_UNIT (guard §4.3), DEFINED_BY, BASED_AT
  for (const p of plan.positions) {
    await repo.upsertPosition({ id: p.id, title: p.title, level: p.level, fte: p.fte, status: p.status });
  }
  for (const p of plan.positions) {
    await repo.setOrgUnitGuarded(p.id, p.orgUnitId);
    await repo.definedBy(p.id, p.jobId);
    await repo.basedAt(p.id, p.locationId);
  }

  // solid reporting lines (guard §4.1)
  for (const p of plan.positions) {
    if (p.reportsToId) await repo.reportsToGuarded(p.id, p.reportsToId);
  }

  // persons + HOLDS: current holders (guard §4.2), then closed predecessors
  for (const person of plan.persons) await repo.upsertPerson(person);
  for (const h of plan.holds.filter((x) => x.to === null)) {
    await repo.openHoldGuarded(h.personId, h.positionId);
  }
  for (const h of plan.holds.filter((x) => x.to !== null)) {
    await repo.closedHold(h.personId, h.positionId, h.from, h.to!);
  }

  // matrix dotted line (distinct type, §1.2)
  for (const d of plan.dotted) await repo.dottedReportsTo(d.childId, d.parentId, d.reason);

  return plan;
}
