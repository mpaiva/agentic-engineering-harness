import { describe, expect, it } from "vitest";
import type { Driver } from "neo4j-driver";
import { GraphRepository } from "../../src/db/repository.js";

/**
 * Unit tests for the §4 write-path guard WRAPPERS (repository.ts *Guarded methods).
 *
 * schema.md §4 guards return rows on success and 0 rows on reject. The repository
 * turns a 0-row result into a thrown error so a seed cannot silently violate an
 * invariant. This suite pins that reject/accept contract and the parameter names,
 * using a fake driver — the Cypher SEMANTICS (a real cycle, a real double-booked
 * seat) are proven against Neo4j in guards.integration.test.ts. It also asserts
 * the guards run on the WRITE path (executeWrite), not a read.
 */

interface Call {
  cypher: string;
  params: Record<string, unknown>;
}

/**
 * A Driver whose sessions replay `recordsPerCall[i]` as the records of the i-th
 * `tx.run`, capturing each call. Only the surface GraphRepository.write uses
 * (session.executeWrite → tx.run → { records }, session.close) is implemented.
 */
function fakeWriteDriver(recordsPerCall: unknown[][]) {
  const calls: Call[] = [];
  let i = 0;
  let writes = 0;
  let reads = 0;
  const driver = {
    session() {
      return {
        async executeWrite(work: (tx: unknown) => unknown) {
          writes++;
          const tx = {
            run(cypher: string, params: Record<string, unknown>) {
              calls.push({ cypher, params });
              return { records: recordsPerCall[i++] ?? [] };
            },
          };
          return work(tx);
        },
        async executeRead(work: (tx: unknown) => unknown) {
          reads++;
          const tx = {
            run(cypher: string, params: Record<string, unknown>) {
              calls.push({ cypher, params });
              return { records: recordsPerCall[i++] ?? [] };
            },
          };
          return work(tx);
        },
        async close() {},
      };
    },
  } as unknown as Driver;
  return { driver, calls, writes: () => writes, reads: () => reads };
}

/** One returned row → the guard accepted; an empty array → the guard rejected. */
const ROW = [{}];
const NONE: unknown[] = [];

describe("§4.1 reportsToGuarded — REPORTS_TO acyclic + single solid parent", () => {
  it("resolves and passes {childId, parentId} on the write path when a row comes back", async () => {
    const { driver, calls, writes, reads } = fakeWriteDriver([ROW]);
    const repo = new GraphRepository(driver);

    await expect(repo.reportsToGuarded("POS-000734", "POS-000001")).resolves.toBeUndefined();

    expect(calls[0]!.params).toEqual({ childId: "POS-000734", parentId: "POS-000001" });
    expect(calls[0]!.cypher).toContain("REPORTS_TO");
    expect(writes()).toBe(1);
    expect(reads()).toBe(0); // a guard is a WRITE, never a read
  });

  it("throws (cycle or existing solid parent) when the guard returns 0 rows", async () => {
    const { driver } = fakeWriteDriver([NONE]);
    const repo = new GraphRepository(driver);

    await expect(repo.reportsToGuarded("POS-A", "POS-B")).rejects.toThrow(
      /cycle or existing solid parent/i,
    );
  });
});

describe("§4.2 openHoldGuarded — one current holder per seat", () => {
  it("resolves and passes {personId, positionId} when the seat is free", async () => {
    const { driver, calls } = fakeWriteDriver([ROW]);
    const repo = new GraphRepository(driver);

    await expect(repo.openHoldGuarded("PER-000512", "POS-000734")).resolves.toBeUndefined();
    expect(calls[0]!.params).toEqual({ personId: "PER-000512", positionId: "POS-000734" });
  });

  it("throws when the seat already has a current holder (0 rows)", async () => {
    const { driver } = fakeWriteDriver([NONE]);
    const repo = new GraphRepository(driver);

    await expect(repo.openHoldGuarded("PER-X", "POS-Y")).rejects.toThrow(
      /already has a current holder/i,
    );
  });
});

describe("§4.3 setOrgUnitGuarded — exactly one IN_ORG_UNIT", () => {
  it("resolves and passes {positionId, unitId}", async () => {
    const { driver, calls } = fakeWriteDriver([ROW]);
    const repo = new GraphRepository(driver);

    await expect(repo.setOrgUnitGuarded("POS-000734", "ORG-000002")).resolves.toBeUndefined();
    expect(calls[0]!.params).toEqual({ positionId: "POS-000734", unitId: "ORG-000002" });
  });

  it("throws when neither node exists (0 rows matched)", async () => {
    const { driver } = fakeWriteDriver([NONE]);
    const repo = new GraphRepository(driver);

    await expect(repo.setOrgUnitGuarded("POS-?", "ORG-?")).rejects.toThrow(/matched no nodes/i);
  });
});

describe("§4.4 setPartOfGuarded — single acyclic PART_OF parent", () => {
  it("resolves and passes {childId, parentId}", async () => {
    const { driver, calls } = fakeWriteDriver([ROW]);
    const repo = new GraphRepository(driver);

    await expect(repo.setPartOfGuarded("ORG-000002", "ORG-000001")).resolves.toBeUndefined();
    expect(calls[0]!.params).toEqual({ childId: "ORG-000002", parentId: "ORG-000001" });
  });

  it("throws (cycle) when the guard returns 0 rows", async () => {
    const { driver } = fakeWriteDriver([NONE]);
    const repo = new GraphRepository(driver);

    await expect(repo.setPartOfGuarded("ORG-A", "ORG-B")).rejects.toThrow(/cycle/i);
  });
});
