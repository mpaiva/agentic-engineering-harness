import { describe, expect, it } from "vitest";
import type { Driver } from "neo4j-driver";
import { Neo4jViewRepository } from "../../src/repository/directory-repository.js";
import type { PeopleListInput } from "../../src/schemas.js";

/**
 * Unit tests for the view-shaped read model (directory-repository.ts).
 *
 * These pin the IN-MEMORY logic the view repository layers on top of the §5
 * traversals — the flat-subtree → rooted-tree assembly (aria-level, child order,
 * span), the keyset-pagination probe (fetch limit+1, emit a cursor), and the
 * person-detail node mapping (nullable seat/job/unit/location). The Cypher itself
 * is exercised against Neo4j in slice.integration.test.ts; here a fake driver
 * replays records so the shaping is tested in isolation.
 */

/** A driver whose sessions replay `queued[i]` (as record.toObject() rows) per read. */
function fakeReadDriver(queued: Record<string, unknown>[][]) {
  const calls: { cypher: string; params: Record<string, unknown> }[] = [];
  let i = 0;
  const driver = {
    session() {
      return {
        async executeRead(work: (tx: unknown) => unknown) {
          const tx = {
            run(cypher: string, params: Record<string, unknown>) {
              calls.push({ cypher, params });
              const rows = queued[i++] ?? [];
              return { records: rows.map((r) => ({ toObject: () => r })) };
            },
          };
          return work(tx);
        },
        async close() {},
      };
    },
  } as unknown as Driver;
  return { driver, calls };
}

const node = (properties: Record<string, unknown>) => ({ properties });

describe("chart() — assembles the flat REPORTS_TO subtree into a rooted tree", () => {
  it("derives the CEO root when called rootless, nests + orders children, sets aria-level", async () => {
    const { driver, calls } = fakeReadDriver([
      // CHART_ROOT
      [{ id: "POS-1" }],
      // CHART_SUBTREE — root + two direct reports (out of title order on purpose)
      [
        { positionId: "POS-1", title: "Chief Executive Officer", holderPersonId: "PER-1", holderName: "Ada Rivera", orgUnitId: "ORG-1", orgUnitName: "Globex", parentPositionId: null, spanOfControl: 2 },
        { positionId: "POS-2", title: "VP, Sales", holderPersonId: null, holderName: null, orgUnitId: "ORG-3", orgUnitName: "Sales", parentPositionId: "POS-1", spanOfControl: 0 },
        { positionId: "POS-3", title: "VP, Engineering", holderPersonId: "PER-2", holderName: "Bruno Chen", orgUnitId: "ORG-2", orgUnitName: "Engineering", parentPositionId: "POS-1", spanOfControl: 0 },
      ],
    ]);
    const repo = new Neo4jViewRepository(driver);

    const tree = await repo.chart(null);

    expect(tree).not.toBeNull();
    expect(tree!.positionId).toBe("POS-1");
    expect(tree!.level).toBe(1);
    expect(tree!.spanOfControl).toBe(2);
    // Children sorted by title then id: "VP, Engineering" before "VP, Sales".
    expect(tree!.children.map((c) => c.positionId)).toEqual(["POS-3", "POS-2"]);
    expect(tree!.children.every((c) => c.level === 2)).toBe(true);
    // Open seat keeps null holder fields (schema.md §1.1 "as of today").
    const sales = tree!.children.find((c) => c.positionId === "POS-2")!;
    expect(sales.holderPersonId).toBeNull();
    expect(sales.holderName).toBeNull();
    // Rootless call issues CHART_ROOT then CHART_SUBTREE with the derived root.
    expect(calls).toHaveLength(2);
    expect(calls[1]!.params).toEqual({ rootId: "POS-1" });
  });

  it("skips the CHART_ROOT query when an explicit root position id is given", async () => {
    const { driver, calls } = fakeReadDriver([
      [{ positionId: "POS-9", title: "VP, Engineering", holderPersonId: "PER-2", holderName: "Bruno Chen", orgUnitId: "ORG-2", orgUnitName: "Engineering", parentPositionId: null, spanOfControl: 0 }],
    ]);
    const repo = new Neo4jViewRepository(driver);

    const tree = await repo.chart("POS-9");

    expect(tree!.positionId).toBe("POS-9");
    expect(calls).toHaveLength(1); // no root-deriving query
    expect(calls[0]!.params).toEqual({ rootId: "POS-9" });
  });

  it("returns null when the derived root has no subtree row", async () => {
    const { driver } = fakeReadDriver([[{ id: "POS-1" }], []]);
    const repo = new Neo4jViewRepository(driver);
    await expect(repo.chart(null)).resolves.toBeNull();
  });
});

describe("listPeople() — keyset pagination probe", () => {
  const rowOf = (n: number) => ({
    personId: `PER-${n}`, firstName: `F${n}`, lastName: `L${n}`, email: `p${n}@x`,
    status: "active", positionId: `POS-${n}`, positionTitle: "IC",
    orgUnitId: "ORG-1", orgUnitName: "Globex", locationId: "LOC-1", locationName: "HQ",
  });

  it("fetches limit+1, trims the probe row, and emits a forward cursor", async () => {
    const { driver, calls } = fakeReadDriver([[rowOf(1), rowOf(2), rowOf(3)]]);
    const repo = new Neo4jViewRepository(driver);
    const input = { limit: 2 } as PeopleListInput;

    const page = await repo.listPeople(input);

    expect(page.rows).toHaveLength(2); // probe row dropped
    expect(page.rows.map((r) => r.personId)).toEqual(["PER-1", "PER-2"]);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(calls[0]!.params.limit).toBe(3); // limit + 1
  });

  it("emits nextCursor=null when the page is not full", async () => {
    const { driver } = fakeReadDriver([[rowOf(1)]]);
    const repo = new Neo4jViewRepository(driver);
    const page = await repo.listPeople({ limit: 25 } as PeopleListInput);
    expect(page.rows).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("lower-cases the search term and threads the org/location filters into params", async () => {
    const { driver, calls } = fakeReadDriver([[]]);
    const repo = new Neo4jViewRepository(driver);
    await repo.listPeople({ limit: 10, query: "RiVeRa", orgUnitId: "ORG-2", locationId: "LOC-3" } as PeopleListInput);
    expect(calls[0]!.params).toMatchObject({ q: "rivera", orgUnitId: "ORG-2", locationId: "LOC-3" });
  });
});

describe("getPerson() — nullable seat/job/unit/location mapping", () => {
  it("maps a person with no current seat to null blocks (terminated / closed HOLDS only)", async () => {
    const { driver } = fakeReadDriver([
      // PERSON_CORE — person present, everything else optional-matched to null
      [{ p: node({ id: "PER-9", firstName: "Zoe", lastName: "Quinn", email: "z@x", status: "terminated", hireDate: "2012-03-01" }), pos: null, job: null, u: null, loc: null, mgr: null }],
      // PERSON_DIRECT_REPORTS, REPORTING_CHAIN (order-insensitive; both empty)
      [],
      [],
    ]);
    const repo = new Neo4jViewRepository(driver);

    const detail = await repo.getPerson("PER-9");

    expect(detail).not.toBeNull();
    expect(detail!.person).toMatchObject({ id: "PER-9", firstName: "Zoe", status: "terminated" });
    expect(detail!.position).toBeNull();
    expect(detail!.job).toBeNull();
    expect(detail!.orgUnit).toBeNull();
    expect(detail!.location).toBeNull();
    expect(detail!.managerPersonId).toBeNull();
    expect(detail!.directReports).toEqual([]);
    expect(detail!.reportingChain).toEqual([]);
  });

  it("returns null when the person id is not found", async () => {
    const { driver } = fakeReadDriver([[]]);
    const repo = new Neo4jViewRepository(driver);
    await expect(repo.getPerson("PER-nope")).resolves.toBeNull();
  });
});
