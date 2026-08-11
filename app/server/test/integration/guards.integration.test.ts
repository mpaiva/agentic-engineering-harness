import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GraphRepository } from "../../src/db/repository.js";
import { startNeo4j, stopNeo4j, readOne, type TestGraph } from "./support/neo4j.js";

/**
 * The §4 write-path guards against a REAL Neo4j, on a tiny hand-built graph.
 *
 * The seed proves the guards ACCEPT valid writes; this file proves they REJECT the
 * exact violations the CE constraints cannot express — a REPORTS_TO cycle, a second
 * solid parent, a double-booked seat, and a PART_OF cycle/self-loop — and that the
 * single-edge guards (IN_ORG_UNIT) really collapse to one edge. Each test starts from
 * an empty graph, so a rejection leaves nothing behind.
 */

let graph: TestGraph;
let repo: GraphRepository;

const position = (id: string) =>
  repo.upsertPosition({ id, title: id, level: 1, fte: 1, status: "filled" });

beforeAll(async () => {
  graph = await startNeo4j();
  repo = new GraphRepository(graph.driver);
  await repo.migrate();
}, 240_000);

beforeEach(async () => {
  await repo.wipeAll();
});

afterAll(async () => {
  await stopNeo4j(graph);
});

describe("§4.1 REPORTS_TO — acyclic, single solid parent", () => {
  it("accepts a valid solid chain C → B → A", async () => {
    await position("A");
    await position("B");
    await position("C");
    await expect(repo.reportsToGuarded("B", "A")).resolves.toBeUndefined();
    await expect(repo.reportsToGuarded("C", "B")).resolves.toBeUndefined();
  });

  it("rejects a would-be cycle (A → C when C already reaches A)", async () => {
    await position("A");
    await position("B");
    await position("C");
    await repo.reportsToGuarded("B", "A");
    await repo.reportsToGuarded("C", "B"); // C → B → A
    await expect(repo.reportsToGuarded("A", "C")).rejects.toThrow(/cycle or existing solid parent/i);
    // Nothing was written: A still has no solid parent.
    const parents = await readOne<number>(
      graph.driver,
      "MATCH (a:Position {id:'A'})-[r:REPORTS_TO]->() RETURN count(r) AS c",
      {},
      "c",
    );
    expect(parents).toBe(0);
  });

  it("rejects a second solid parent for a seat that already reports somewhere", async () => {
    await position("A");
    await position("B");
    await position("C");
    await repo.reportsToGuarded("B", "A"); // B → A
    await expect(repo.reportsToGuarded("B", "C")).rejects.toThrow(/cycle or existing solid parent/i);
  });

  it("rejects a self-loop (child === parent)", async () => {
    await position("A");
    await expect(repo.reportsToGuarded("A", "A")).rejects.toThrow();
  });
});

describe("§4.2 HOLDS — one current holder per seat", () => {
  it("accepts one open holder, then rejects a second on the same seat", async () => {
    await position("S");
    await repo.upsertPerson({ id: "P1", firstName: "Pat", lastName: "One", email: "p1@x", status: "active", hireDate: "2020-01-01" });
    await repo.upsertPerson({ id: "P2", firstName: "Sam", lastName: "Two", email: "p2@x", status: "active", hireDate: "2020-01-01" });

    await expect(repo.openHoldGuarded("P1", "S")).resolves.toBeUndefined();
    await expect(repo.openHoldGuarded("P2", "S")).rejects.toThrow(/already has a current holder/i);

    const open = await readOne<number>(
      graph.driver,
      "MATCH (:Position {id:'S'})<-[h:HOLDS]-() WHERE h.to IS NULL RETURN count(h) AS c",
      {},
      "c",
    );
    expect(open).toBe(1); // still exactly one current holder
  });

  it("allows a new open holder once the incumbent edge is CLOSED (a transfer)", async () => {
    await position("S");
    await repo.upsertPerson({ id: "P1", firstName: "Pat", lastName: "One", email: "p1@x", status: "terminated", hireDate: "2018-01-01" });
    await repo.upsertPerson({ id: "P2", firstName: "Sam", lastName: "Two", email: "p2@x", status: "active", hireDate: "2020-01-01" });
    // A closed predecessor edge does not block a new current holder (h.to IS NOT NULL).
    await repo.closedHold("P1", "S", "2018-01-01", "2019-12-31");
    await expect(repo.openHoldGuarded("P2", "S")).resolves.toBeUndefined();
  });
});

describe("§4.3 IN_ORG_UNIT — exactly one unit", () => {
  it("collapses to a single edge when the org unit is re-set (delete-then-merge)", async () => {
    await position("S");
    await repo.upsertOrgUnit({ id: "U1", name: "Unit One", type: "team" });
    await repo.upsertOrgUnit({ id: "U2", name: "Unit Two", type: "team" });

    await repo.setOrgUnitGuarded("S", "U1");
    await repo.setOrgUnitGuarded("S", "U2"); // reassignment

    const count = await readOne<number>(
      graph.driver,
      "MATCH (:Position {id:'S'})-[r:IN_ORG_UNIT]->() RETURN count(r) AS c",
      {},
      "c",
    );
    const target = await readOne<string>(
      graph.driver,
      "MATCH (:Position {id:'S'})-[:IN_ORG_UNIT]->(u) RETURN u.id AS uid",
      {},
      "uid",
    );
    expect(count).toBe(1); // never two units
    expect(target).toBe("U2"); // the latest assignment wins
  });
});

describe("§4.4 PART_OF — single acyclic parent", () => {
  it("rejects a cycle (OA → OB when OB already parents OA)", async () => {
    await repo.upsertOrgUnit({ id: "OA", name: "A", type: "division" });
    await repo.upsertOrgUnit({ id: "OB", name: "B", type: "department" });
    await repo.setPartOfGuarded("OB", "OA"); // OB → OA
    await expect(repo.setPartOfGuarded("OA", "OB")).rejects.toThrow(/cycle/i);
  });

  it("rejects a self-loop (child === parent)", async () => {
    await repo.upsertOrgUnit({ id: "OA", name: "A", type: "division" });
    await expect(repo.setPartOfGuarded("OA", "OA")).rejects.toThrow();
  });
});
