import { int } from "neo4j-driver";
import type { Driver } from "neo4j-driver";
import { describe, expect, it } from "vitest";
import { Neo4jOrgRepository } from "../src/repository/org-repository.js";

/**
 * Unit tests for the four marquee traversals. These pin the *result shapes* the
 * repository returns to the API/UI — how driver records are mapped to the
 * typed contract in types.ts — and assert each method issues exactly one query
 * with the expected parameter. They do not exercise Cypher semantics against a
 * real graph; that is the Testcontainers integration stage (schema.md §5/§6).
 */

interface FakeCall {
  cypher: string;
  params: Record<string, unknown>;
}

/** A neo4j-driver Record stand-in: only `.get(key)` is used by the repo. */
function record(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] };
}

/**
 * Build a Driver whose sessions return the next queued result per `tx.run`,
 * capturing every call. Enough of the driver surface for the repository.
 */
function fakeDriver(results: Array<{ records: ReturnType<typeof record>[] }>) {
  const calls: FakeCall[] = [];
  let cursor = 0;
  let closed = 0;
  const driver = {
    session() {
      return {
        async executeRead(work: (tx: unknown) => unknown) {
          const tx = {
            run(cypher: string, params: Record<string, unknown>) {
              calls.push({ cypher, params });
              return results[cursor++] ?? { records: [] };
            },
          };
          return work(tx);
        },
        async close() {
          closed++;
        },
      };
    },
  } as unknown as Driver;
  return { driver, calls, sessionsClosed: () => closed };
}

describe("Neo4jOrgRepository — result shapes (schema.md §5)", () => {
  describe("§5.1 reportingChainUp", () => {
    it("returns the managerChain list, preserving nulls for vacant seats", async () => {
      const { driver, calls } = fakeDriver([
        { records: [record({ managerChain: ["PER-000512", null, "PER-000001"] })] },
      ]);
      const repo = new Neo4jOrgRepository(driver);

      const chain = await repo.reportingChainUp("PER-000512");

      expect(chain).toEqual(["PER-000512", null, "PER-000001"]);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.params).toEqual({ personId: "PER-000512" });
      expect(calls[0]!.cypher).toContain("REPORTS_TO*0..");
    });

    it("returns an empty array when the person has no current seat (0 rows)", async () => {
      const { driver } = fakeDriver([{ records: [] }]);
      const repo = new Neo4jOrgRepository(driver);

      await expect(repo.reportingChainUp("PER-999999")).resolves.toEqual([]);
    });

    it("returns an empty array when managerChain comes back null", async () => {
      const { driver } = fakeDriver([{ records: [record({ managerChain: null })] }]);
      const repo = new Neo4jOrgRepository(driver);

      await expect(repo.reportingChainUp("PER-000512")).resolves.toEqual([]);
    });
  });

  describe("§5.2 transitiveReports", () => {
    it("maps each row to { seat, holder }, holder null when the seat is open", async () => {
      const { driver, calls } = fakeDriver([
        {
          records: [
            record({ seat: "POS-000734", holder: "PER-000512" }),
            record({ seat: "POS-000900", holder: null }),
          ],
        },
      ]);
      const repo = new Neo4jOrgRepository(driver);

      const reports = await repo.transitiveReports("POS-000001");

      expect(reports).toEqual([
        { seat: "POS-000734", holder: "PER-000512" },
        { seat: "POS-000900", holder: null },
      ]);
      expect(calls[0]!.params).toEqual({ positionId: "POS-000001" });
      expect(calls[0]!.cypher).toContain("REPORTS_TO*1..");
    });

    it("returns an empty array for a leaf seat (0 rows)", async () => {
      const { driver } = fakeDriver([{ records: [] }]);
      const repo = new Neo4jOrgRepository(driver);

      await expect(repo.transitiveReports("POS-999999")).resolves.toEqual([]);
    });
  });

  describe("§5.3 spanOfControl", () => {
    it("coerces a neo4j Integer count to a plain number", async () => {
      const { driver, calls } = fakeDriver([
        { records: [record({ spanOfControl: int(5) })] },
      ]);
      const repo = new Neo4jOrgRepository(driver);

      const span = await repo.spanOfControl("POS-000001");

      expect(span).toBe(5);
      expect(typeof span).toBe("number");
      expect(calls[0]!.params).toEqual({ positionId: "POS-000001" });
    });

    it("returns 0 when the seat has no direct reports", async () => {
      const { driver } = fakeDriver([{ records: [record({ spanOfControl: int(0) })] }]);
      const repo = new Neo4jOrgRepository(driver);

      await expect(repo.spanOfControl("POS-000734")).resolves.toBe(0);
    });
  });

  describe("§5.4 orgRollup", () => {
    it("maps each row to { unit, positions }", async () => {
      const { driver, calls } = fakeDriver([
        {
          records: [
            record({ unit: "OU-COMPANY", positions: ["POS-000001"] }),
            record({ unit: "OU-ENG", positions: ["POS-000734", "POS-000900"] }),
          ],
        },
      ]);
      const repo = new Neo4jOrgRepository(driver);

      const rollup = await repo.orgRollup("OU-COMPANY");

      expect(rollup).toEqual([
        { unit: "OU-COMPANY", positions: ["POS-000001"] },
        { unit: "OU-ENG", positions: ["POS-000734", "POS-000900"] },
      ]);
      expect(calls[0]!.params).toEqual({ unitId: "OU-COMPANY" });
      expect(calls[0]!.cypher).toContain("PART_OF*0..");
    });

    it("returns an empty array when the unit has no positions (0 rows)", async () => {
      const { driver } = fakeDriver([{ records: [] }]);
      const repo = new Neo4jOrgRepository(driver);

      await expect(repo.orgRollup("OU-EMPTY")).resolves.toEqual([]);
    });
  });

  it("closes the session after each traversal", async () => {
    const { driver, sessionsClosed } = fakeDriver([
      { records: [record({ spanOfControl: int(3) })] },
    ]);
    const repo = new Neo4jOrgRepository(driver);

    await repo.spanOfControl("POS-000001");

    expect(sessionsClosed()).toBe(1);
  });
});
