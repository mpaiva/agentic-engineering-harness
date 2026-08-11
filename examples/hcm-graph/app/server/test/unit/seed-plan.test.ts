import { describe, expect, it } from "vitest";
import { buildPlan } from "../../src/seed/plan.js";

/**
 * Unit tests for the deterministic seed plan (schema.md §7).
 *
 * plan.ts already self-asserts its targets (assertPlan) and throws on drift, so
 * `buildPlan()` not throwing is itself a check. This suite pins the §7 numbers as
 * an EXTERNAL contract (so a change to the plan's own asserts can't quietly move
 * the target), proves determinism (schema.md §1.3 — ids survive reseed), and
 * re-derives the two §8 preconditions the integration §6 checks depend on:
 * open seats are leaves, and no manager seat is held by a non-active person.
 */

describe("seed plan (schema.md §7)", () => {
  const plan = buildPlan();

  it("is deterministic — a reseed is byte-identical (ids survive reseed, §1.3)", () => {
    expect(buildPlan()).toEqual(plan);
  });

  it("meets the §7 node-count targets exactly", () => {
    expect(plan.orgUnits).toHaveLength(40);
    expect(plan.orgUnits.filter((o) => o.type === "company")).toHaveLength(1);
    expect(plan.orgUnits.filter((o) => o.type === "division")).toHaveLength(5);
    expect(plan.orgUnits.filter((o) => o.type === "department")).toHaveLength(10);
    expect(plan.orgUnits.filter((o) => o.type === "team")).toHaveLength(24);
    expect(plan.positions).toHaveLength(200);
    expect(plan.jobs).toHaveLength(15);
    expect(plan.locations).toHaveLength(6);
  });

  it("has exactly one root seat (the CEO — the only seat with no REPORTS_TO)", () => {
    const roots = plan.positions.filter((p) => p.reportsToId === null);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.role).toBe("ceo");
  });

  it("has 188 filled seats and 12 open seats (185+ filled per §7)", () => {
    expect(plan.positions.filter((p) => p.status === "filled")).toHaveLength(188);
    expect(plan.positions.filter((p) => p.status === "open")).toHaveLength(12);
  });

  it("opens a current HOLDS for every filled seat and a closed HOLDS for predecessors", () => {
    const open = plan.holds.filter((h) => h.to === null);
    const closed = plan.holds.filter((h) => h.to !== null);
    expect(open).toHaveLength(188); // one current holder per filled seat
    expect(closed).toHaveLength(4); // terminated predecessors exercise the temporal filter
  });

  it("carries exactly one matrix dotted line and adds NO second REPORTS_TO (§1.2)", () => {
    expect(plan.dotted).toHaveLength(1);
    // The dotted child still has exactly one solid parent — the dotted edge is additive.
    const child = plan.positions.find((p) => p.id === plan.dotted[0]!.childId)!;
    expect(child.reportsToId).not.toBeNull();
    // The dotted parent is in a different division than the child's solid chain (matrix).
    expect(plan.dotted[0]!.parentId).not.toBe(child.reportsToId);
  });

  it("keeps every open seat a LEAF (§8.2 precondition for §6.5 — no vacant manager)", () => {
    const managerSeats = new Set(
      plan.positions.map((p) => p.reportsToId).filter((x): x is string => Boolean(x)),
    );
    for (const open of plan.positions.filter((p) => p.status === "open")) {
      expect(managerSeats.has(open.id)).toBe(false);
    }
  });

  it("holds every manager seat with an ACTIVE person (leave holders are IC leaves only)", () => {
    const managerSeatIds = new Set(
      plan.positions.map((p) => p.reportsToId).filter((x): x is string => Boolean(x)),
    );
    const personById = new Map(plan.persons.map((p) => [p.id, p]));
    for (const h of plan.holds) {
      if (h.to !== null) continue; // only current holders
      if (!managerSeatIds.has(h.positionId)) continue; // only manager seats
      expect(personById.get(h.personId)!.status).toBe("active");
    }
  });

  it("gives every manager a span of control within the §7 band of 2–8", () => {
    const span = new Map<string, number>();
    for (const p of plan.positions) {
      if (p.reportsToId) span.set(p.reportsToId, (span.get(p.reportsToId) ?? 0) + 1);
    }
    // CEO span = number of divisions.
    const ceo = plan.positions.find((p) => p.role === "ceo")!;
    expect(span.get(ceo.id)).toBe(5);
    for (const n of span.values()) {
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  it("spans ≥ 3 timezones across its locations", () => {
    expect(new Set(plan.locations.map((l) => l.timezone)).size).toBeGreaterThanOrEqual(3);
  });

  it("assigns every position an org unit, a job, and a location (no dangling seats)", () => {
    for (const p of plan.positions) {
      expect(p.orgUnitId).toBeTruthy();
      expect(p.jobId).toBeTruthy();
      expect(p.locationId).toBeTruthy();
    }
  });

  it("uses stable external business-key ids with the documented prefixes (§1.3)", () => {
    expect(plan.positions.every((p) => /^POS-\d{6}$/.test(p.id))).toBe(true);
    expect(plan.orgUnits.every((o) => /^ORG-\d{6}$/.test(o.id))).toBe(true);
    expect(plan.persons.every((p) => /^PER-\d{6}$/.test(p.id))).toBe(true);
  });
});
