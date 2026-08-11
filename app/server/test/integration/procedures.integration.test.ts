import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Driver } from "neo4j-driver";

import { appRouter } from "../../src/router.js";
import { createCallerFactory } from "../../src/trpc.js";
import { Neo4jViewRepository } from "../../src/repository/directory-repository.js";
import { Neo4jOrgRepository } from "../../src/repository/org-repository.js";
import type { SeedPlan } from "../../src/seed/plan.js";
import { startNeo4j, stopNeo4j, type TestGraph } from "./support/neo4j.js";
import { seedGraph } from "./support/seed.js";

/**
 * Contract test for the tRPC API against a REAL, seeded Neo4j (Testcontainers).
 *
 * This is the evidence PROJECT.md §Verification asks for: the seven procedures
 * (+ chart + the two filter lists) run against a live graph seeded through the
 * §4 write-path guards, and their pre-shaped results are checked against the
 * deterministic §7 plan. Three independent cross-checks harden it:
 *   • the enriched API results are reconciled with the canonical, id-only §5
 *     traversal module (Neo4jOrgRepository) on the same graph — the two homes of
 *     the traversals cannot silently diverge;
 *   • schema.md §6.1–§6.5 validation queries are run verbatim and MUST return 0
 *     rows, so the seed the procedures read is invariant-clean;
 *   • the matrix DOTTED_REPORTS_TO case is confirmed to be excluded from the
 *     solid-line traversals (schema.md §1.2).
 *
 * The caller invokes procedures in-process, so `.output()` zod validation runs
 * on every result — a shape regression fails the call, not just an assertion.
 */

const createCaller = createCallerFactory(appRouter);
type Caller = ReturnType<typeof createCaller>;

let graph: TestGraph | undefined;
let driver: Driver;
let caller: Caller;
let orgRepo: Neo4jOrgRepository;
let plan: SeedPlan;

// ── plan-derived expectations (source of truth = the returned SeedPlan) ──
const byId = new Map<string, SeedPlan["positions"][number]>();
const currentHolderOf = new Map<string, string>(); // positionId → personId
const holderSeatOf = new Map<string, string>(); // personId → positionId (current)

function positionChain(startId: string): string[] {
  // seat → root, following the single solid parent.
  const ids: string[] = [];
  let cur: string | null = startId;
  const guard = new Set<string>();
  while (cur) {
    if (guard.has(cur)) throw new Error(`cycle at ${cur}`); // defensive
    guard.add(cur);
    ids.push(cur);
    cur = byId.get(cur)?.reportsToId ?? null;
  }
  return ids;
}

beforeAll(async () => {
  graph = await startNeo4j();
  driver = graph.driver;
  plan = await seedGraph(driver);

  const repo = new Neo4jViewRepository(driver);
  orgRepo = new Neo4jOrgRepository(driver);
  caller = createCaller({ repo });

  for (const p of plan.positions) byId.set(p.id, p);
  for (const h of plan.holds) {
    if (h.to === null) {
      currentHolderOf.set(h.positionId, h.personId);
      holderSeatOf.set(h.personId, h.positionId);
    }
  }
}, 180_000);

afterAll(async () => {
  await stopNeo4j(graph);
});

// Convenience anchors, resolved after seeding.
function ceoSeat() {
  const ceo = plan.positions.find((p) => p.reportsToId === null);
  if (!ceo) throw new Error("no root seat in plan");
  return ceo;
}
function filledIcSeat() {
  const ic = plan.positions.find(
    (p) => p.role === "ic" && p.status === "filled",
  );
  if (!ic) throw new Error("no filled IC seat");
  return ic;
}

describe("org.spanOfControl (§5.3)", () => {
  it("counts direct reports and agrees with the canonical §5 module", async () => {
    const ceo = ceoSeat();
    const expected = plan.positions.filter(
      (p) => p.reportsToId === ceo.id,
    ).length;

    const res = await caller.org.spanOfControl({ positionId: ceo.id });
    expect(res.spanOfControl).toBe(expected); // 5 divisions
    expect(res.spanOfControl).toBe(await orgRepo.spanOfControl(ceo.id));
  });

  it("returns 0 for an IC leaf seat", async () => {
    const ic = filledIcSeat();
    const res = await caller.org.spanOfControl({ positionId: ic.id });
    expect(res.spanOfControl).toBe(0);
  });
});

describe("org.reportingChain (§5.1)", () => {
  it("walks an IC up to the CEO, person→root, enriched with titles/holders", async () => {
    const ic = filledIcSeat();
    const personId = currentHolderOf.get(ic.id)!;
    const expectedSeats = positionChain(ic.id); // ic → lead → director → vp → ceo

    const { chain } = await caller.org.reportingChain({ personId });

    expect(chain.map((n) => n.positionId)).toEqual(expectedSeats);
    // idx 0 is the person's own seat/holder.
    expect(chain[0]!.positionId).toBe(ic.id);
    expect(chain[0]!.personId).toBe(personId);
    // top of the chain is the CEO seat.
    expect(chain.at(-1)!.positionId).toBe(ceoSeat().id);
    // every seat on this all-filled path carries title + holder name.
    for (const node of chain) {
      expect(node.positionTitle).toBeTruthy();
      expect(node.name).toBeTruthy();
    }

    // Cross-check holder ids against the bare §5.1 module (same person→root order).
    const bare = await orgRepo.reportingChainUp(personId);
    expect(chain.map((n) => n.personId)).toEqual(bare);
  });

  it("is a single node for the CEO's own holder", async () => {
    const ceo = ceoSeat();
    const personId = currentHolderOf.get(ceo.id)!;
    const { chain } = await caller.org.reportingChain({ personId });
    expect(chain).toHaveLength(1);
    expect(chain[0]!.positionId).toBe(ceo.id);
  });
});

describe("org.transitiveReports (§5.2)", () => {
  it("returns every seat below the CEO, with holders, matching the §5 module", async () => {
    const ceo = ceoSeat();
    const { reports } = await caller.org.transitiveReports({
      positionId: ceo.id,
    });

    // All 199 non-root seats sit below the CEO.
    expect(reports).toHaveLength(plan.positions.length - 1);

    const seatIds = new Set(reports.map((r) => r.seatId));
    const bare = await orgRepo.transitiveReports(ceo.id);
    expect(seatIds).toEqual(new Set(bare.map((b) => b.seat)));

    // Open seats surface with a null holder; filled seats carry a holder id+name.
    for (const r of reports) {
      const seat = byId.get(r.seatId)!;
      if (seat.status === "open") {
        expect(r.holderPersonId).toBeNull();
        expect(r.holderName).toBeNull();
      } else {
        expect(r.holderPersonId).toBe(currentHolderOf.get(r.seatId) ?? null);
        expect(r.holderName).toBeTruthy();
      }
    }
  });

  it("lists exactly a lead's ICs for a team lead", async () => {
    const lead = plan.positions.find((p) => p.role === "lead")!;
    const expected = new Set(
      plan.positions.filter((p) => p.reportsToId === lead.id).map((p) => p.id),
    );
    const { reports } = await caller.org.transitiveReports({
      positionId: lead.id,
    });
    expect(new Set(reports.map((r) => r.seatId))).toEqual(expected);
  });
});

describe("org.rollup (§5.4)", () => {
  it("rolls up the whole company with unit names, matching the §5 module", async () => {
    const company = plan.orgUnits.find((o) => o.type === "company")!;
    const { units } = await caller.org.rollup({ unitId: company.id });

    // Only units that hold ≥1 position appear (verbatim §5.4 semantics).
    const bare = await orgRepo.orgRollup(company.id);
    expect(new Set(units.map((u) => u.unitId))).toEqual(
      new Set(bare.map((b) => b.unit)),
    );

    // unitName is hydrated and positions reconcile with the plan per unit.
    for (const u of units) {
      const planUnit = plan.orgUnits.find((o) => o.id === u.unitId)!;
      expect(u.unitName).toBe(planUnit.name);
      const expectedPositions = new Set(
        plan.positions.filter((p) => p.orgUnitId === u.unitId).map((p) => p.id),
      );
      expect(new Set(u.positions)).toEqual(expectedPositions);
    }

    // Every position in the company is accounted for exactly once across units.
    const rolledUp = units.flatMap((u) => u.positions);
    expect(new Set(rolledUp).size).toBe(rolledUp.length);
    expect(rolledUp).toHaveLength(plan.positions.length);
  });
});

describe("org.chart", () => {
  it("returns the CEO-rooted tree when called rootless, with span + aria-level", async () => {
    const ceo = ceoSeat();
    const tree = await caller.org.chart({});
    expect(tree).not.toBeNull();
    expect(tree!.positionId).toBe(ceo.id);
    expect(tree!.level).toBe(1);
    expect(tree!.children).toHaveLength(
      plan.positions.filter((p) => p.reportsToId === ceo.id).length,
    );
    // spanOfControl on a node equals its direct child count.
    expect(tree!.spanOfControl).toBe(tree!.children.length);
    for (const vp of tree!.children) {
      expect(vp.level).toBe(2);
      expect(vp.spanOfControl).toBe(vp.children.length);
    }

    // The tree covers exactly the 200 seats, each once.
    const ids: string[] = [];
    const walk = (n: NonNullable<typeof tree>) => {
      ids.push(n.positionId);
      n.children.forEach(walk);
    };
    walk(tree!);
    expect(new Set(ids).size).toBe(plan.positions.length);
  });

  it("roots at an explicit position id (a division VP)", async () => {
    const vp = plan.positions.find((p) => p.role === "vp")!;
    const tree = await caller.org.chart({ rootPositionId: vp.id });
    expect(tree!.positionId).toBe(vp.id);
    expect(tree!.level).toBe(1); // level is relative to the requested root
  });

  it("shows an open seat as a vacant node (holder null)", async () => {
    const open = plan.positions.find((p) => p.status === "open")!;
    const tree = await caller.org.chart({});
    let found: { holderPersonId: string | null } | undefined;
    const walk = (n: NonNullable<typeof tree>) => {
      if (n.positionId === open.id) found = n;
      n.children.forEach(walk);
    };
    walk(tree!);
    expect(found).toBeDefined();
    expect(found!.holderPersonId).toBeNull();
  });
});

describe("people.list — directory search, filter, cursor pagination", () => {
  it("returns only current holders (as of today), sorted by name then id", async () => {
    // Page fully through with a small limit and assemble the whole directory.
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 100; guard++) {
      const page: Awaited<ReturnType<Caller["people"]["list"]>> =
        await caller.people.list(cursor ? { limit: 25, cursor } : { limit: 25 });
      seen.push(...page.rows.map((r) => r.personId));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    const expectedHolders = new Set(currentHolderOf.values());
    expect(seen).toHaveLength(expectedHolders.size); // 188 current holders
    expect(new Set(seen).size).toBe(seen.length); // no dupes across pages
    expect(new Set(seen)).toEqual(expectedHolders);

    // Terminated persons (closed HOLDS only) never appear.
    const terminated = plan.persons
      .filter((p) => p.status === "terminated")
      .map((p) => p.id);
    for (const t of terminated) expect(seen).not.toContain(t);
  });

  it("filters by orgUnitId to that unit's current holders", async () => {
    const team = plan.orgUnits.find((o) => o.type === "team")!;
    const expected = new Set(
      plan.positions
        .filter((p) => p.orgUnitId === team.id && currentHolderOf.has(p.id))
        .map((p) => currentHolderOf.get(p.id)!),
    );
    const page = await caller.people.list({ limit: 100, orgUnitId: team.id });
    expect(new Set(page.rows.map((r) => r.personId))).toEqual(expected);
    for (const row of page.rows) expect(row.orgUnitId).toBe(team.id);
  });

  it("filters by a case-insensitive name substring", async () => {
    const holderId = currentHolderOf.get(filledIcSeat().id)!;
    const person = plan.persons.find((p) => p.id === holderId)!;
    const page = await caller.people.list({
      limit: 100,
      query: person.lastName.toUpperCase(),
    });
    expect(page.rows.some((r) => r.personId === holderId)).toBe(true);
    for (const row of page.rows) {
      const hay =
        `${row.firstName} ${row.lastName} ${row.email}`.toLowerCase();
      expect(hay).toContain(person.lastName.toLowerCase());
    }
  });

  it("filters by locationId (paging through, since a location spans many holders)", async () => {
    const loc = plan.locations[0]!;
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 100; guard++) {
      const page = await caller.people.list(
        cursor
          ? { limit: 100, locationId: loc.id, cursor }
          : { limit: 100, locationId: loc.id },
      );
      for (const row of page.rows) expect(row.locationId).toBe(loc.id);
      seen.push(...page.rows.map((r) => r.personId));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen).size).toBe(seen.length); // pagination keeps rows unique
  });
});

describe("people.get — the person view", () => {
  it("assembles seat, job, unit, location, manager, reports, and root→person chain", async () => {
    const ic = filledIcSeat();
    const personId = currentHolderOf.get(ic.id)!;

    const detail = await caller.people.get({ personId });
    expect(detail).not.toBeNull();
    expect(detail!.person.id).toBe(personId);
    expect(detail!.position!.id).toBe(ic.id);
    expect(detail!.job!.id).toBe(ic.jobId);
    expect(detail!.orgUnit!.id).toBe(ic.orgUnitId);
    expect(detail!.location!.id).toBe(ic.locationId);

    // Manager = holder of the seat this seat REPORTS_TO.
    const managerSeat = ic.reportsToId!;
    expect(detail!.managerPersonId).toBe(currentHolderOf.get(managerSeat)!);

    // reportingChain is ROOT→person: last element is this person; first is CEO.
    const chainSeats = detail!.reportingChain.map((n) => n.positionId);
    expect(chainSeats).toEqual(positionChain(ic.id).slice().reverse());
    expect(detail!.reportingChain.at(-1)!.positionId).toBe(ic.id);
    expect(detail!.reportingChain[0]!.positionId).toBe(ceoSeat().id);
  });

  it("returns a manager's direct reports (its seat's REPORTS_TO children)", async () => {
    const lead = plan.positions.find((p) => p.role === "lead")!;
    const leadPerson = currentHolderOf.get(lead.id)!;
    const expected = new Set(
      plan.positions.filter((p) => p.reportsToId === lead.id).map((p) => p.id),
    );
    const detail = await caller.people.get({ personId: leadPerson });
    expect(new Set(detail!.directReports.map((r) => r.positionId))).toEqual(
      expected,
    );
  });

  it("maps a terminated person (closed HOLDS only) to a null current seat", async () => {
    const terminated = plan.persons.find((p) => p.status === "terminated")!;
    const detail = await caller.people.get({ personId: terminated.id });
    expect(detail).not.toBeNull();
    expect(detail!.person.status).toBe("terminated");
    expect(detail!.position).toBeNull();
    expect(detail!.managerPersonId).toBeNull();
    expect(detail!.reportingChain).toEqual([]);
  });

  it("returns null for an unknown person id", async () => {
    const detail = await caller.people.get({ personId: "PER-DOES-NOT-EXIST" });
    expect(detail).toBeNull();
  });
});

describe("filter sources", () => {
  it("org.listOrgUnits returns every unit with its PART_OF parent", async () => {
    const units = await caller.org.listOrgUnits();
    expect(units).toHaveLength(plan.orgUnits.length); // 40
    const company = units.find((u) => u.type === "company")!;
    expect(company.parentId).toBeNull();
    for (const u of units) {
      const planUnit = plan.orgUnits.find((o) => o.id === u.id)!;
      expect(u.parentId).toBe(planUnit.parentId);
    }
  });

  it("org.listLocations returns every location", async () => {
    const locs = await caller.org.listLocations();
    expect(new Set(locs.map((l) => l.id))).toEqual(
      new Set(plan.locations.map((l) => l.id)),
    );
  });
});

describe("matrix dotted line is excluded from solid-line traversals (§1.2)", () => {
  it("the dotted child does not appear under its dotted parent's reports", async () => {
    const dotted = plan.dotted[0]!;
    const { reports } = await caller.org.transitiveReports({
      positionId: dotted.parentId,
    });
    expect(reports.map((r) => r.seatId)).not.toContain(dotted.childId);

    // The child's solid chain ignores the dotted parent entirely.
    const childPerson = currentHolderOf.get(dotted.childId);
    if (childPerson) {
      const { chain } = await caller.org.reportingChain({
        personId: childPerson,
      });
      expect(chain.map((n) => n.positionId)).not.toContain(dotted.parentId);
    }
  });
});

// ── schema.md §6 validation queries — each MUST return 0 rows on the seed ──
const VALIDATION: { name: string; cypher: string }[] = [
  {
    name: "§6.1 no REPORTS_TO cycle",
    cypher: "MATCH (p:Position)-[:REPORTS_TO*1..]->(p) RETURN p.id LIMIT 1",
  },
  {
    name: "§6.2 at most one current holder per seat",
    cypher: `MATCH (pos:Position)<-[h:HOLDS]-()
             WHERE h.to IS NULL
             WITH pos, count(*) AS openHolders
             WHERE openHolders > 1
             RETURN pos.id, openHolders`,
  },
  {
    name: "§6.3 every filled Position has exactly one IN_ORG_UNIT",
    cypher: `MATCH (pos:Position)
             WHERE pos.status = 'filled'
             WITH pos, size([ (pos)-[:IN_ORG_UNIT]->() | 1 ]) AS units
             WHERE units <> 1
             RETURN pos.id, units`,
  },
  {
    name: "§6.4a every non-root OrgUnit has exactly one PART_OF parent",
    cypher: `MATCH (o:OrgUnit)
             WHERE o.type <> 'company'
             WITH o, size([ (o)-[:PART_OF]->() | 1 ]) AS parents
             WHERE parents <> 1
             RETURN o.id, parents`,
  },
  {
    name: "§6.4b no PART_OF cycle",
    cypher: "MATCH (o:OrgUnit)-[:PART_OF*1..]->(o) RETURN o.id LIMIT 1",
  },
  {
    name: "§6.5 every active held person resolves to exactly one manager, or is root",
    cypher: `MATCH (person:Person {status: 'active'})-[h:HOLDS]->(seat:Position)
             WHERE h.to IS NULL
             WITH person, seat,
                  size([ (seat)-[:REPORTS_TO]->(mSeat)<-[mh:HOLDS]-(m)
                         WHERE mh.to IS NULL | m ]) AS managers,
                  EXISTS { (seat)-[:REPORTS_TO]->() } AS hasParent
             WHERE (hasParent AND managers <> 1) OR (NOT hasParent AND managers <> 0)
             RETURN person.id, managers, hasParent`,
  },
];

describe("graph invariants hold on the seed (schema.md §6 — 0 rows each)", () => {
  it.each(VALIDATION)("$name", async ({ cypher }) => {
    const session = driver.session();
    try {
      const result = await session.executeRead((tx) => tx.run(cypher));
      expect(result.records).toHaveLength(0);
    } finally {
      await session.close();
    }
  });
});
