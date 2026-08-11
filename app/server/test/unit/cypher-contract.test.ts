import { describe, expect, it } from "vitest";
import {
  CONSTRAINTS,
  INDEXES,
  GUARDS,
  TRAVERSALS,
  VALIDATIONS,
} from "../../src/db/cypher.js";

/**
 * Contract-drift guard for the Cypher seam.
 *
 * product/design/schema.md is the FROZEN query contract: §3 DDL, §4 write-path
 * guards, §5 marquee traversals, §6 validation queries. cypher.ts is meant to be
 * a literal transcript of those sections. This suite pins the invariant-bearing
 * clauses of every guard/traversal/validation so any silent edit that would
 * change the enforced semantics fails a fast unit test — before it ever reaches
 * a real graph. It asserts SHAPE, not whitespace, so cosmetic reformatting is
 * tolerated while the enforced predicates are not.
 */

/** Collapse runs of whitespace so assertions are robust to indentation/newlines. */
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

describe("§3 DDL — the only declarative layer CE gives us", () => {
  it("declares exactly the five id-uniqueness constraints", () => {
    expect(CONSTRAINTS).toHaveLength(5);
    for (const label of [
      "person_id_unique",
      "position_id_unique",
      "job_id_unique",
      "orgunit_id_unique",
      "location_id_unique",
    ]) {
      expect(CONSTRAINTS.some((c) => c.includes(label))).toBe(true);
    }
    // Every constraint is a plain uniqueness constraint — never an Enterprise-only
    // existence / node-key / type constraint.
    for (const c of CONSTRAINTS) {
      expect(c).toContain("IS UNIQUE");
      expect(c).toContain("IF NOT EXISTS");
      expect(c).not.toMatch(/IS NOT NULL|NODE KEY|IS ::/);
    }
  });

  it("declares the four supporting range indexes, including HOLDS.to", () => {
    expect(INDEXES).toHaveLength(4);
    expect(INDEXES.some((i) => flat(i).includes("FOR (p:Person) ON (p.status)"))).toBe(true);
    expect(INDEXES.some((i) => flat(i).includes("FOR (p:Position) ON (p.status)"))).toBe(true);
    expect(INDEXES.some((i) => flat(i).includes("FOR (o:OrgUnit) ON (o.type)"))).toBe(true);
    // Relationship-property range index on the temporal edge (CE-valid in Neo4j 5).
    expect(INDEXES.some((i) => flat(i).includes("FOR ()-[h:HOLDS]-() ON (h.to)"))).toBe(true);
  });
});

describe("§4 write-path guards — enforce the invariants the CE constraints can't", () => {
  it("§4.1 REPORTS_TO guard forbids a second solid parent AND a cycle, then MERGEs", () => {
    const g = flat(GUARDS.reportsTo);
    expect(g).toContain("NOT EXISTS { (child)-[:REPORTS_TO]->() }"); // at most one solid parent
    expect(g).toContain("NOT EXISTS { (parent)-[:REPORTS_TO*0..]->(child) }"); // would-be cycle
    expect(g).toContain("MERGE (child)-[:REPORTS_TO]->(parent)");
    expect(g).toContain("child <> parent");
  });

  it("§4.2 HOLDS guard opens a seat only when no CURRENT holder exists (to IS NULL)", () => {
    const g = flat(GUARDS.openHold);
    // The IS NULL existential is load-bearing: an inline {to: null} map would never
    // match and would silently permit a second open holder (schema.md §4.2 note).
    expect(g).toContain("NOT EXISTS { MATCH (pos)<-[h:HOLDS]-() WHERE h.to IS NULL }");
    expect(g).toContain("CREATE (p)-[:HOLDS {from: date(), to: null}]->(pos)");
    expect(g).not.toContain("HOLDS {to: null})<-"); // no desugared-null match form
  });

  it("§4.3 IN_ORG_UNIT guard is delete-then-merge, guaranteeing exactly one edge", () => {
    const g = flat(GUARDS.setOrgUnit);
    expect(g).toContain("OPTIONAL MATCH (pos)-[old:IN_ORG_UNIT]->()");
    expect(g).toContain("DELETE old");
    expect(g).toContain("MERGE (pos)-[:IN_ORG_UNIT]->(u)");
  });

  it("§4.4 PART_OF guard is single-parent (delete-then-merge) AND acyclic", () => {
    const g = flat(GUARDS.setPartOf);
    expect(g).toContain("NOT EXISTS { (parent)-[:PART_OF*0..]->(child) }");
    expect(g).toContain("OPTIONAL MATCH (child)-[old:PART_OF]->()");
    expect(g).toContain("DELETE old");
    expect(g).toContain("MERGE (child)-[:PART_OF]->(parent)");
  });

  it("every guard is solid-line only — no guard touches DOTTED_REPORTS_TO", () => {
    for (const g of Object.values(GUARDS)) {
      expect(g).not.toContain("DOTTED_REPORTS_TO");
    }
  });
});

describe("§5 marquee traversals — solid-line reads (ignore DOTTED_REPORTS_TO)", () => {
  it("§5.1 reporting chain up walks REPORTS_TO*0.. to the root and picks current holders", () => {
    const t = flat(TRAVERSALS.reportingChainUp);
    expect(t).toContain("MATCH (p:Person {id: $personId})-[h:HOLDS]->(seat:Position)");
    expect(t).toContain("WHERE h.to IS NULL");
    expect(t).toContain("(seat)-[:REPORTS_TO*0..]->(top:Position)");
    expect(t).toContain("NOT EXISTS { (top)-[:REPORTS_TO]->() }"); // top = root seat
    // Bare iteration variable (parenthesizing it is invalid Cypher — schema.md §5.1).
    expect(t).toContain("[ seat IN nodes(chain) | seat ]");
    expect(t).toContain("head([ (seat)<-[hh:HOLDS]-(m) WHERE hh.to IS NULL | m.id ])");
  });

  it("§5.2 all reports is transitive (REPORTS_TO*1..) with current holders", () => {
    const t = flat(TRAVERSALS.allReports);
    expect(t).toContain("(mgr:Position {id: $positionId})<-[:REPORTS_TO*1..]-(reportSeat:Position)");
    expect(t).toContain("WHERE h.to IS NULL");
    expect(t).toContain("RETURN reportSeat.id AS seat, person.id AS holder");
  });

  it("§5.3 span of control counts DIRECT reports only", () => {
    const t = flat(TRAVERSALS.spanOfControl);
    expect(t).toContain("(mgr:Position {id: $positionId})<-[:REPORTS_TO]-(direct:Position)");
    expect(t).toContain("RETURN count(direct) AS spanOfControl");
    expect(t).not.toContain("REPORTS_TO*"); // direct, never transitive
  });

  it("§5.4 org rollup walks PART_OF*0.. and collects positions per unit", () => {
    const t = flat(TRAVERSALS.orgRollup);
    expect(t).toContain("(u:OrgUnit)-[:PART_OF*0..]->(root)");
    expect(t).toContain("(pos:Position)-[:IN_ORG_UNIT]->(u)");
    expect(t).toContain("RETURN u.id AS unit, collect(pos.id) AS positions");
  });

  it("no traversal reads the dotted line", () => {
    for (const t of Object.values(TRAVERSALS)) {
      expect(t).not.toContain("DOTTED_REPORTS_TO");
    }
  });
});

describe("§6 validation queries — each MUST return 0 rows on a clean seed", () => {
  it("exposes all six checks with stable ids (6.4 is split into 6.4a/6.4b)", () => {
    expect(VALIDATIONS.map((v) => v.id)).toEqual(["6.1", "6.2", "6.3", "6.4a", "6.4b", "6.5"]);
  });

  const byId = (id: string) => VALIDATIONS.find((v) => v.id === id)!.cypher;

  it("6.1 detects any REPORTS_TO cycle", () => {
    expect(flat(byId("6.1"))).toContain("(p:Position)-[:REPORTS_TO*1..]->(p)");
  });

  it("6.2 flags a seat with more than one CURRENT holder", () => {
    const q = flat(byId("6.2"));
    expect(q).toContain("WHERE h.to IS NULL");
    expect(q).toContain("count(*) AS openHolders");
    expect(q).toContain("WHERE openHolders > 1");
  });

  it("6.3 flags a FILLED position without exactly one IN_ORG_UNIT (schema.md §8.1 scope)", () => {
    const q = flat(byId("6.3"));
    expect(q).toContain("WHERE pos.status = 'filled'");
    expect(q).toContain("size([ (pos)-[:IN_ORG_UNIT]->() | 1 ]) AS units");
    expect(q).toContain("WHERE units <> 1");
  });

  it("6.4a flags a non-company OrgUnit without exactly one PART_OF parent", () => {
    const q = flat(byId("6.4a"));
    expect(q).toContain("WHERE o.type <> 'company'");
    expect(q).toContain("size([ (o)-[:PART_OF]->() | 1 ]) AS parents");
    expect(q).toContain("WHERE parents <> 1");
  });

  it("6.4b detects a PART_OF cycle", () => {
    expect(flat(byId("6.4b"))).toContain("(o:OrgUnit)-[:PART_OF*1..]->(o)");
  });

  it("6.5 flags a held active person not resolving to exactly one manager (or non-zero at root)", () => {
    const q = flat(byId("6.5"));
    expect(q).toContain("(person:Person {status: 'active'})-[h:HOLDS]->(seat:Position)");
    expect(q).toContain("WHERE h.to IS NULL");
    expect(q).toContain("EXISTS { (seat)-[:REPORTS_TO]->() } AS hasParent");
    expect(q).toContain("(hasParent AND managers <> 1) OR (NOT hasParent AND managers <> 0)");
  });
});
