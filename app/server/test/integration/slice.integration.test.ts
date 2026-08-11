import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SeedPlan } from "../../src/seed/plan.js";
import { GraphRepository } from "../../src/db/repository.js";
import { Neo4jViewRepository } from "../../src/repository/directory-repository.js";
import { createCallerFactory } from "../../src/trpc.js";
import { appRouter } from "../../src/router.js";
import { startNeo4j, stopNeo4j, readOne, type TestGraph } from "./support/neo4j.js";
import { seedGraph } from "./support/seed.js";

/**
 * The Core-HR slice against a REAL Neo4j (schema.md §5/§6, PROJECT.md Verification).
 *
 * One container is started and seeded with the deterministic §7 plan (through the §4
 * guards) once for the file. Then:
 *   • the five §6 validation queries must each return 0 rows (invariants hold), and
 *   • the four §5 marquee traversals must return the exact chains/counts/rollups the
 *     plan predicts, and
 *   • the tRPC procedures (called in-process) must return the wire shapes the UI reads.
 *
 * Expectations are DERIVED FROM THE PLAN (the source of truth), never hard-coded, so
 * the test proves the Cypher agrees with the model rather than restating magic numbers.
 */

let graph: TestGraph;
let plan: SeedPlan;
let repo: GraphRepository;
let view: Neo4jViewRepository;
const createCaller = createCallerFactory(appRouter);
let caller: ReturnType<typeof createCaller>;

// ── plan-derived expectation helpers ──────────────────────────────────────────
const posById = () => new Map(plan.positions.map((p) => [p.id, p]));
/** seatId → current (open HOLDS) holder person id. */
function currentHolders(): Map<string, string> {
  const m = new Map<string, string>();
  for (const h of plan.holds) if (h.to === null) m.set(h.positionId, h.personId);
  return m;
}
/** solid-line seat chain from a seat up to (and including) the root, ordered seat→root. */
function solidChain(seatId: string): string[] {
  const by = posById();
  const chain: string[] = [];
  let cur: string | null = seatId;
  while (cur) {
    chain.push(cur);
    cur = by.get(cur)?.reportsToId ?? null;
  }
  return chain;
}

beforeAll(async () => {
  graph = await startNeo4j();
  plan = await seedGraph(graph.driver);
  repo = new GraphRepository(graph.driver);
  view = new Neo4jViewRepository(graph.driver);
  caller = createCaller({ repo: view });
}, 240_000);

afterAll(async () => {
  await stopNeo4j(graph);
});

describe("§6 validation queries — each MUST return 0 rows on the clean seed", () => {
  it("reports zero violations across all five invariants", async () => {
    const results = await repo.validateAll();
    // A readable failure message lists any offending rows.
    const violations = results.filter((r) => r.rows !== 0);
    expect(
      violations,
      violations.map((v) => `§${v.id} ${v.label}: ${JSON.stringify(v.offending)}`).join("\n"),
    ).toEqual([]);
    // And explicitly: all six checks (6.1, 6.2, 6.3, 6.4a, 6.4b, 6.5) are present and 0.
    expect(results.map((r) => r.id)).toEqual(["6.1", "6.2", "6.3", "6.4a", "6.4b", "6.5"]);
    expect(results.every((r) => r.rows === 0)).toBe(true);
  });
});

describe("§5 marquee traversals — exact chains, counts, and rollups", () => {
  it("§5.1 reporting chain up follows the SOLID line to the root (dotted line ignored)", async () => {
    // Use the matrix case's IC as the subject: it also has a DOTTED_REPORTS_TO into
    // Finance, which must NOT appear in the solid reporting chain (schema.md §1.2).
    const dottedChildSeat = plan.dotted[0]!.childId;
    const financeParentSeat = plan.dotted[0]!.parentId;
    const holders = currentHolders();
    const subjectPerson = holders.get(dottedChildSeat)!;

    const seatChain = solidChain(dottedChildSeat); // IC → Lead → Director → VP → CEO
    const expected = seatChain.map((seat) => holders.get(seat) ?? null);

    const managerChain = await repo.reportingChainUp(subjectPerson);

    expect(managerChain).toEqual(expected);
    expect(managerChain[0]).toBe(subjectPerson); // idx 0 is the person's own seat holder
    expect(managerChain).toHaveLength(5); // IC + Lead + Director + VP + CEO
    // The dotted Finance manager is NOT on the solid chain.
    expect(seatChain).not.toContain(financeParentSeat);
  });

  it("§5.2 all reports (transitive) below the CEO covers every other seat, holders included", async () => {
    const ceo = plan.positions.find((p) => p.role === "ceo")!;
    const reports = await repo.allReports(ceo.id);

    const filledBelowCeo = plan.positions.filter((p) => p.status === "filled" && p.id !== ceo.id).length;
    expect(reports).toHaveLength(plan.positions.length - 1); // 199 seats below the single root
    expect(reports.filter((r) => r.holder !== null)).toHaveLength(filledBelowCeo); // 187 held
    expect(reports.filter((r) => r.holder === null)).toHaveLength(plan.positions.filter((p) => p.status === "open").length); // 12 open
  });

  it("§5.3 span of control counts DIRECT reports (CEO = divisions, VP = departments)", async () => {
    const ceo = plan.positions.find((p) => p.role === "ceo")!;
    const vp = plan.positions.find((p) => p.role === "vp")!;
    const expectedCeoSpan = plan.positions.filter((p) => p.reportsToId === ceo.id).length;
    const expectedVpSpan = plan.positions.filter((p) => p.reportsToId === vp.id).length;

    expect(await repo.spanOfControl(ceo.id)).toBe(expectedCeoSpan);
    expect(expectedCeoSpan).toBe(5); // 5 divisions
    expect(await repo.spanOfControl(vp.id)).toBe(expectedVpSpan);
  });

  it("§5.4 org rollup over the company root gathers every unit and all 200 positions", async () => {
    const company = plan.orgUnits.find((o) => o.type === "company")!;
    const rollup = await repo.orgRollup(company.id);

    expect(rollup).toHaveLength(plan.orgUnits.length); // all 40 units at/below the root
    const total = rollup.reduce((n, r) => n + r.positions.length, 0);
    expect(total).toBe(plan.positions.length); // 200 positions total
  });

  it("surfaces the matrix relationship via DOTTED_REPORTS_TO without a second REPORTS_TO", async () => {
    const dotted = plan.dotted[0]!;
    const solidParents = await readOne<number>(
      graph.driver,
      "MATCH (c:Position {id:$id})-[r:REPORTS_TO]->() RETURN count(r) AS c",
      { id: dotted.childId },
      "c",
    );
    const dottedEdges = await readOne<number>(
      graph.driver,
      "MATCH (c:Position {id:$id})-[d:DOTTED_REPORTS_TO]->(:Position) RETURN count(d) AS c",
      { id: dotted.childId },
      "c",
    );
    expect(solidParents).toBe(1); // exactly one solid parent (Invariant 1)
    expect(dottedEdges).toBe(1); // plus one additive dotted line (§1.2)
  });
});

describe("tRPC API contract — the wire shapes the UI loaders read", () => {
  it("org.chart returns the whole solid-line tree, rooted at the CEO with 1-based levels", async () => {
    const ceo = plan.positions.find((p) => p.role === "ceo")!;
    const tree = await caller.org.chart({});
    expect(tree).not.toBeNull();
    expect(tree!.positionId).toBe(ceo.id);
    expect(tree!.level).toBe(1);
    expect(tree!.children).toHaveLength(5); // the five VP seats
    expect(tree!.children.every((c) => c.level === 2)).toBe(true);
    // spanOfControl on the root row = its direct-report count (aria-setsize source).
    expect(tree!.spanOfControl).toBe(5);
  });

  it("org.spanOfControl and org.reportingChain agree with the graph", async () => {
    const ceo = plan.positions.find((p) => p.role === "ceo")!;
    expect((await caller.org.spanOfControl({ positionId: ceo.id })).spanOfControl).toBe(5);

    const dottedChildSeat = plan.dotted[0]!.childId;
    const subjectPerson = currentHolders().get(dottedChildSeat)!;
    const { chain } = await caller.org.reportingChain({ personId: subjectPerson });
    expect(chain).toHaveLength(5); // person → root, enriched
    expect(chain[0]!.positionId).toBe(dottedChildSeat); // idx 0 is the person's own seat
    expect(chain[chain.length - 1]!.positionId).toBe(ceo.id); // last is the root seat
    expect(chain[0]!.personId).toBe(subjectPerson);
  });

  it("people.get returns a person's seat, manager, and ROOT→person breadcrumb", async () => {
    const by = posById();
    const dottedChildSeat = plan.dotted[0]!.childId;
    const holders = currentHolders();
    const subjectPerson = holders.get(dottedChildSeat)!;
    const managerSeat = by.get(dottedChildSeat)!.reportsToId!;
    const expectedManagerPerson = holders.get(managerSeat)!;

    const detail = await caller.people.get({ personId: subjectPerson });
    expect(detail).not.toBeNull();
    expect(detail!.person.id).toBe(subjectPerson);
    expect(detail!.position!.id).toBe(dottedChildSeat);
    expect(detail!.managerPersonId).toBe(expectedManagerPerson);
    expect(detail!.directReports).toHaveLength(0); // the matrix IC is a leaf seat
    // Breadcrumb is ROOT → person (reverse of the person→root walk); last node = person.
    expect(detail!.reportingChain).toHaveLength(5);
    expect(detail!.reportingChain[detail!.reportingChain.length - 1]!.personId).toBe(subjectPerson);
    expect(detail!.reportingChain[0]!.positionId).toBe(plan.positions.find((p) => p.role === "ceo")!.id);
  });

  it("people.list paginates (limit+cursor) and filters by org unit and search", async () => {
    // Default page: 188 current-seat holders, limit 25 ⇒ a full page plus a cursor.
    const first = await caller.people.list({});
    expect(first.rows).toHaveLength(25);
    expect(first.nextCursor).toEqual(expect.any(String));

    // Following the cursor returns a different, non-overlapping page.
    const second = await caller.people.list({ cursor: first.nextCursor! });
    const firstIds = new Set(first.rows.map((r) => r.personId));
    expect(second.rows.some((r) => firstIds.has(r.personId))).toBe(false);

    // Org-unit filter narrows to that unit's direct seats only.
    const by = posById();
    const teamUnit = by.get(plan.dotted[0]!.childId)!.orgUnitId;
    const filtered = await caller.people.list({ orgUnitId: teamUnit, limit: 100 });
    expect(filtered.rows.length).toBeGreaterThan(0);
    expect(filtered.rows.every((r) => r.orgUnitId === teamUnit)).toBe(true);

    // Search by a person's (unique) email returns exactly that person.
    const subjectPerson = currentHolders().get(plan.dotted[0]!.childId)!;
    const email = plan.persons.find((p) => p.id === subjectPerson)!.email;
    const searched = await caller.people.list({ query: email });
    expect(searched.rows).toHaveLength(1);
    expect(searched.rows[0]!.personId).toBe(subjectPerson);
  });

  it("reads 'as of today': a terminated person (closed HOLDS only) is absent from the directory but visible via people.get", async () => {
    const terminated = plan.persons.find((p) => p.status === "terminated")!;
    // Not in the directory — they hold no current (to IS NULL) seat.
    const inDirectory = await caller.people.list({ query: terminated.email });
    expect(inDirectory.rows).toHaveLength(0);
    // But the person record still resolves, with a null current position.
    const detail = await caller.people.get({ personId: terminated.id });
    expect(detail).not.toBeNull();
    expect(detail!.person.status).toBe("terminated");
    expect(detail!.position).toBeNull();
  });
});
