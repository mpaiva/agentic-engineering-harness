/**
 * The Cypher contract — the ONLY place raw Cypher lives.
 *
 * Every string below is copied VERBATIM from product/design/schema.md
 * (§3 DDL, §4 write-path guards, §5 marquee traversals, §6 validation queries).
 * The repository seam (repository.ts) is the sole consumer; nothing else in the
 * codebase writes Cypher. Keeping the DDL/guards/traversals as a literal transcript
 * of the approved schema is what makes them auditable against §3–§6.
 *
 * Node upsert helpers (idempotent MERGE-by-id) and the non-invariant relationship
 * writers (DEFINED_BY / BASED_AT / DOTTED_REPORTS_TO / closed HOLDS) are seed-support
 * writes, not part of the schema.md contract, and are grouped separately at the end.
 */

// ─── §3  Cypher DDL — uniqueness constraints (the only declarative layer CE gives us) ───
export const CONSTRAINTS: readonly string[] = [
  `CREATE CONSTRAINT person_id_unique   IF NOT EXISTS FOR (p:Person)   REQUIRE p.id IS UNIQUE`,
  `CREATE CONSTRAINT position_id_unique IF NOT EXISTS FOR (p:Position) REQUIRE p.id IS UNIQUE`,
  `CREATE CONSTRAINT job_id_unique      IF NOT EXISTS FOR (j:Job)      REQUIRE j.id IS UNIQUE`,
  `CREATE CONSTRAINT orgunit_id_unique  IF NOT EXISTS FOR (o:OrgUnit)  REQUIRE o.id IS UNIQUE`,
  `CREATE CONSTRAINT location_id_unique IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE`,
];

// ─── §3  Supporting range indexes (CE-valid on node and relationship properties) ───
export const INDEXES: readonly string[] = [
  `CREATE INDEX person_status   IF NOT EXISTS FOR (p:Person)   ON (p.status)`,
  `CREATE INDEX position_status IF NOT EXISTS FOR (p:Position) ON (p.status)`,
  `CREATE INDEX orgunit_type    IF NOT EXISTS FOR (o:OrgUnit)  ON (o.type)`,
  `CREATE INDEX holds_to        IF NOT EXISTS FOR ()-[h:HOLDS]-() ON (h.to)`,
];

// ─── §4  Write-path guards (application-side, single-statement, race-safe) ───
// Each returns rows on success, 0 rows on reject.
export const GUARDS = {
  // §4.1 Invariant 1 — create REPORTS_TO only if acyclic and no existing solid parent
  reportsTo: `MATCH (child:Position {id: $childId}), (parent:Position {id: $parentId})
WHERE child <> parent
  AND NOT EXISTS { (child)-[:REPORTS_TO]->() }              // at most one solid parent
  AND NOT EXISTS { (parent)-[:REPORTS_TO*0..]->(child) }    // would-be cycle
MERGE (child)-[:REPORTS_TO]->(parent)
RETURN child.id AS child, parent.id AS parent`,

  // §4.2 Invariant 2 — open a HOLDS only if the seat has no current holder
  openHold: `MATCH (p:Person {id: $personId}), (pos:Position {id: $positionId})
WHERE NOT EXISTS { MATCH (pos)<-[h:HOLDS]-() WHERE h.to IS NULL }  // no current open holder
CREATE (p)-[:HOLDS {from: date(), to: null}]->(pos)
RETURN p.id AS person, pos.id AS position`,

  // §4.3 Invariant 3 — set the org unit, guaranteeing exactly one IN_ORG_UNIT
  setOrgUnit: `MATCH (pos:Position {id: $positionId}), (u:OrgUnit {id: $unitId})
OPTIONAL MATCH (pos)-[old:IN_ORG_UNIT]->()
DELETE old
MERGE (pos)-[:IN_ORG_UNIT]->(u)
RETURN pos.id AS position, u.id AS unit`,

  // §4.4 Invariant 4 — set the PART_OF parent, single and acyclic
  setPartOf: `MATCH (child:OrgUnit {id: $childId}), (parent:OrgUnit {id: $parentId})
WHERE child <> parent
  AND NOT EXISTS { (parent)-[:PART_OF*0..]->(child) }
OPTIONAL MATCH (child)-[old:PART_OF]->()
DELETE old
MERGE (child)-[:PART_OF]->(parent)
RETURN child.id AS child, parent.id AS parent`,
} as const;

// ─── §5  Marquee traversals (solid-line only) — the read contract ───
export const TRAVERSALS = {
  // §5.1 Reporting chain up (person → root)
  reportingChainUp: `MATCH (p:Person {id: $personId})-[h:HOLDS]->(seat:Position)
WHERE h.to IS NULL
MATCH chain = (seat)-[:REPORTS_TO*0..]->(top:Position)
WHERE NOT EXISTS { (top)-[:REPORTS_TO]->() }
WITH [ seat IN nodes(chain) | seat ] AS seatChain
RETURN [ seat IN seatChain |
          head([ (seat)<-[hh:HOLDS]-(m) WHERE hh.to IS NULL | m.id ]) ] AS managerChain`,

  // §5.2 All reports (transitive)
  allReports: `MATCH (mgr:Position {id: $positionId})<-[:REPORTS_TO*1..]-(reportSeat:Position)
OPTIONAL MATCH (reportSeat)<-[h:HOLDS]-(person:Person)
WHERE h.to IS NULL
RETURN reportSeat.id AS seat, person.id AS holder`,

  // §5.3 Span of control
  spanOfControl: `MATCH (mgr:Position {id: $positionId})<-[:REPORTS_TO]-(direct:Position)
RETURN count(direct) AS spanOfControl`,

  // §5.4 Org rollup
  orgRollup: `MATCH (root:OrgUnit {id: $unitId})
MATCH (u:OrgUnit)-[:PART_OF*0..]->(root)
MATCH (pos:Position)-[:IN_ORG_UNIT]->(u)
RETURN u.id AS unit, collect(pos.id) AS positions`,
} as const;

// ─── §6  Validation queries (each MUST return 0 rows on a clean seed) ───
// §6.4 is two statements; both must return 0 rows. All others are single statements.
export const VALIDATIONS: readonly { id: string; label: string; cypher: string }[] = [
  {
    id: "6.1",
    label: "Invariant 1: no REPORTS_TO cycle",
    cypher: `MATCH (p:Position)-[:REPORTS_TO*1..]->(p) RETURN p.id LIMIT 1`,
  },
  {
    id: "6.2",
    label: "Invariant 2: at most one current holder per seat",
    cypher: `MATCH (pos:Position)<-[h:HOLDS]-()
WHERE h.to IS NULL
WITH pos, count(*) AS openHolders
WHERE openHolders > 1
RETURN pos.id, openHolders`,
  },
  {
    id: "6.3",
    label: "Invariant 3: every filled Position has exactly one IN_ORG_UNIT",
    cypher: `MATCH (pos:Position)
WHERE pos.status = 'filled'
WITH pos, size([ (pos)-[:IN_ORG_UNIT]->() | 1 ]) AS units
WHERE units <> 1
RETURN pos.id, units`,
  },
  {
    id: "6.4a",
    label: "Invariant 4: every non-root OrgUnit has exactly one PART_OF parent",
    cypher: `MATCH (o:OrgUnit)
WHERE o.type <> 'company'
WITH o, size([ (o)-[:PART_OF]->() | 1 ]) AS parents
WHERE parents <> 1
RETURN o.id, parents`,
  },
  {
    id: "6.4b",
    label: "Invariant 4: OrgUnit PART_OF is acyclic",
    cypher: `MATCH (o:OrgUnit)-[:PART_OF*1..]->(o) RETURN o.id LIMIT 1`,
  },
  {
    id: "6.5",
    label: "Invariant 5: every active held person resolves to exactly one manager, or is root",
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

// ─── Seed-support writes (NOT part of the schema.md contract) ───
// Idempotent node upserts + the relationship writers with no invariant to guard.
export const WRITES = {
  upsertPerson: `MERGE (p:Person {id: $id})
SET p.firstName = $firstName, p.lastName = $lastName,
    p.email = $email, p.status = $status, p.hireDate = date($hireDate)`,

  upsertPosition: `MERGE (pos:Position {id: $id})
SET pos.title = $title, pos.level = $level, pos.fte = $fte, pos.status = $status`,

  upsertJob: `MERGE (j:Job {id: $id})
SET j.title = $title, j.family = $family, j.level = $level, j.description = $description`,

  upsertOrgUnit: `MERGE (o:OrgUnit {id: $id})
SET o.name = $name, o.type = $type`,

  upsertLocation: `MERGE (l:Location {id: $id})
SET l.name = $name, l.city = $city, l.country = $country, l.timezone = $timezone`,

  // (Position)-[:DEFINED_BY]->(Job) — no invariant; many positions share one job.
  definedBy: `MATCH (pos:Position {id: $positionId}), (j:Job {id: $jobId})
MERGE (pos)-[:DEFINED_BY]->(j)`,

  // (Position)-[:BASED_AT]->(Location) — no invariant.
  basedAt: `MATCH (pos:Position {id: $positionId}), (l:Location {id: $locationId})
MERGE (pos)-[:BASED_AT]->(l)`,

  // §1.2 dotted line — a DISTINCT type, excluded from acyclicity/single-parent guards.
  dottedReportsTo: `MATCH (child:Position {id: $childId}), (parent:Position {id: $parentId})
WHERE child <> parent
MERGE (child)-[d:DOTTED_REPORTS_TO]->(parent)
SET d.reason = $reason`,

  // A CLOSED HOLDS for a former (terminated) holder — exercises the temporal filter.
  // §1.1: `to` is a concrete date, so it is NOT the "current" edge; the §4.2 guard's
  // `h.to IS NULL` check ignores it, so a current open holder can still be opened.
  closedHold: `MATCH (p:Person {id: $personId}), (pos:Position {id: $positionId})
CREATE (p)-[:HOLDS {from: date($from), to: date($to)}]->(pos)`,

  // Full reset for an idempotent reseed.
  wipeAll: `MATCH (n) DETACH DELETE n`,
} as const;

// Convenience read for the seed run-log (not a schema.md query).
export const COUNTS = `MATCH (n)
WITH labels(n)[0] AS label, count(*) AS c
RETURN label, c ORDER BY label`;
