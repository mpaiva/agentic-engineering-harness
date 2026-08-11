# Core HR graph schema — Neo4j 5 Community

Concrete, finalized schema for the first slice, derived from [domain-graph.md](../domain-graph.md). Target engine: **Neo4j 5, Community Edition (CE)**. Everything below is CE-valid: no property-existence constraints, no node-key constraints, no type constraints (all Enterprise-only). CE gives us exactly one declarative tool — **uniqueness constraints** — plus indexes; every cardinality, acyclicity, and conditional rule is enforced on the write path and verified by test.

Node and relationship shapes are unchanged from domain-graph.md §Nodes / §Relationships and are not restated here except where the schema pins a concrete type.

## 1. Open questions — resolved

### 1.1 Temporal model — effective-dating on `HOLDS`, current-only structure
`HOLDS` carries `{from, to}` (both `date`). **`to IS NULL` means "current".** A transfer closes the incumbent edge (`SET h.to = date()`) and opens a new one. `REPORTS_TO`, `IN_ORG_UNIT`, `PART_OF`, `DEFINED_BY`, `BASED_AT` are **undated in slice 1**. Rationale: person↔seat churn is the only history Core HR must show now; keeping structure undated avoids a temporal join on every traversal. The model can later add `{from, to}` to `REPORTS_TO` without reshaping nodes. **UI reads "as of today" = the `to IS NULL` edge.**

### 1.2 Matrix / dotted-line — a distinct `DOTTED_REPORTS_TO` edge
A dotted line is a **separate relationship type**, not a property on `REPORTS_TO` and **not a second `REPORTS_TO`**:
```text
(Position) -[:DOTTED_REPORTS_TO {reason}]-> (Position)
```
Rationale: the solid line must stay single-parent so Invariant 1 (DAG) and Invariant 5 (exactly one manager) hold by construction — a person's *manager* is resolved only through `REPORTS_TO`. Overloading `REPORTS_TO` with a `kind` property would force either a second `REPORTS_TO` edge (a second solid parent — forbidden) or ambiguous filtering on every management traversal. A distinct type keeps solid-line traversals untouched and lets dotted lines be queried on their own. `DOTTED_REPORTS_TO` is excluded from the acyclicity and single-parent guards.

### 1.3 IDs — external stable business keys in `id`, native ids not exposed
Every node's `id` is an application-assigned stable string (e.g. `POS-000734`, `PER-000512`). It is the API/UI contract key and survives reseed and migration. Neo4j's internal `elementId()` is never exposed or persisted. Uniqueness of `id` is the one thing CE *can* enforce declaratively — see §3.

## 2. Invariant classification (CE-declarable vs write-path + test)

All five invariants from domain-graph.md §Invariants. **None of the five is expressible as a CE `CREATE CONSTRAINT`** — CE has no existence, node-key, or conditional-uniqueness constraint, and no engine expresses graph acyclicity as a constraint. Each is enforced on the write path and checked by a validation query returning **0 rows**. The CE constraints in §3 (id uniqueness) are the *foundation* the guards rely on, not the invariants themselves.

| # | Invariant | CE-declarable? | Enforcement |
|---|-----------|----------------|-------------|
| 1 | No cycles in `REPORTS_TO` (DAG) | No | Write-path guard §4.1 + test §6.1 |
| 2 | One active holder per Position | No (conditional on `to IS NULL`) | Write-path guard §4.2 + test §6.2 |
| 3 | Every active Position has exactly one `IN_ORG_UNIT` | No (cardinality) | Write-path guard §4.3 + test §6.3 |
| 4 | Every OrgUnit except root has exactly one `PART_OF` parent (acyclic) | No (cardinality + acyclic) | Write-path guard §4.4 + test §6.4 |
| 5 | Every active held person resolves to exactly one manager, or is the single root | No (derived) | Holds by construction from 1+2; test §6.5 |

## 3. Cypher DDL — the only declarative layer CE gives us

```cypher
CREATE CONSTRAINT person_id_unique   IF NOT EXISTS FOR (p:Person)   REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT position_id_unique IF NOT EXISTS FOR (p:Position) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT job_id_unique      IF NOT EXISTS FOR (j:Job)      REQUIRE j.id IS UNIQUE;
CREATE CONSTRAINT orgunit_id_unique  IF NOT EXISTS FOR (o:OrgUnit)  REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT location_id_unique IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE;
```
Supporting indexes (range indexes on node and relationship properties are CE-valid in Neo4j 5):
```cypher
CREATE INDEX person_status   IF NOT EXISTS FOR (p:Person)   ON (p.status);
CREATE INDEX position_status IF NOT EXISTS FOR (p:Position) ON (p.status);
CREATE INDEX orgunit_type    IF NOT EXISTS FOR (o:OrgUnit)  ON (o.type);
CREATE INDEX holds_to        IF NOT EXISTS FOR ()-[h:HOLDS]-() ON (h.to);
```
> Deliberately **not** used: `REQUIRE … IS NOT NULL` (existence — Enterprise), `REQUIRE (…) IS NODE KEY` (Enterprise), `REQUIRE … IS :: <TYPE>` (type — Enterprise).

## 4. Write-path guards (application-side, single-statement, race-safe)

### 4.1 Invariant 1 — create `REPORTS_TO` only if acyclic and no existing solid parent
```cypher
MATCH (child:Position {id: $childId}), (parent:Position {id: $parentId})
WHERE child <> parent
  AND NOT EXISTS { (child)-[:REPORTS_TO]->() }              // at most one solid parent
  AND NOT EXISTS { (parent)-[:REPORTS_TO*0..]->(child) }    // would-be cycle
MERGE (child)-[:REPORTS_TO]->(parent)
RETURN child.id AS child, parent.id AS parent;              // 0 rows ⇒ reject
```

### 4.2 Invariant 2 — open a `HOLDS` only if the seat has no current holder
```cypher
MATCH (p:Person {id: $personId}), (pos:Position {id: $positionId})
WHERE NOT EXISTS { MATCH (pos)<-[h:HOLDS]-() WHERE h.to IS NULL }  // no current open holder
CREATE (p)-[:HOLDS {from: date(), to: null}]->(pos)
RETURN p.id AS person, pos.id AS position;                        // 0 rows ⇒ reject
```
The guard uses an existential subquery with `h.to IS NULL`. An inline `{to: null}` map would desugar to `h.to = null`, always NULL and never matching — so `NOT EXISTS { … }` would always be true and a second open seat could be created silently. The `IS NULL` form actually rejects a transfer onto a filled seat and matches the predicate the traversals and integration test use.

### 4.3 Invariant 3 — set the org unit, guaranteeing exactly one `IN_ORG_UNIT`
```cypher
MATCH (pos:Position {id: $positionId}), (u:OrgUnit {id: $unitId})
OPTIONAL MATCH (pos)-[old:IN_ORG_UNIT]->()
DELETE old
MERGE (pos)-[:IN_ORG_UNIT]->(u)
RETURN pos.id AS position, u.id AS unit;
```

### 4.4 Invariant 4 — set the `PART_OF` parent, single and acyclic
```cypher
MATCH (child:OrgUnit {id: $childId}), (parent:OrgUnit {id: $parentId})
WHERE child <> parent
  AND NOT EXISTS { (parent)-[:PART_OF*0..]->(child) }
OPTIONAL MATCH (child)-[old:PART_OF]->()
DELETE old
MERGE (child)-[:PART_OF]->(parent)
RETURN child.id AS child, parent.id AS parent;             // 0 rows ⇒ reject
```

### 4.5 Invariant 5 — holds by construction
A person's manager is *derived*: the holder of the seat this person's held seat `REPORTS_TO`. Given Invariant 1 (single solid parent, acyclic) and Invariant 2 (one current holder), every active held person resolves to exactly one manager, except the single root seat, which has no `REPORTS_TO` out-edge. §6.5 verifies it.

## 5. Marquee traversals (solid-line only)

### 5.1 Reporting chain up (person → root)
```cypher
MATCH (p:Person {id: $personId})-[h:HOLDS]->(seat:Position)
WHERE h.to IS NULL
MATCH chain = (seat)-[:REPORTS_TO*0..]->(top:Position)
WHERE NOT EXISTS { (top)-[:REPORTS_TO]->() }
WITH [ seat IN nodes(chain) | seat ] AS seatChain
RETURN [ seat IN seatChain |
          head([ (seat)<-[hh:HOLDS]-(m) WHERE hh.to IS NULL | m.id ]) ] AS managerChain;
```
The list comprehension binds a **bare** iteration variable — `[ seat IN … | … ]`; parenthesizing it (`[ (seat) IN … | … ]`) is invalid Cypher. The inner pattern comprehension is correctly parenthesized; `head(…)` picks the single current holder (unique by Invariant 2).

### 5.2 All reports (transitive)
```cypher
MATCH (mgr:Position {id: $positionId})<-[:REPORTS_TO*1..]-(reportSeat:Position)
OPTIONAL MATCH (reportSeat)<-[h:HOLDS]-(person:Person)
WHERE h.to IS NULL
RETURN reportSeat.id AS seat, person.id AS holder;
```

### 5.3 Span of control
```cypher
MATCH (mgr:Position {id: $positionId})<-[:REPORTS_TO]-(direct:Position)
RETURN count(direct) AS spanOfControl;
```

### 5.4 Org rollup
```cypher
MATCH (root:OrgUnit {id: $unitId})
MATCH (u:OrgUnit)-[:PART_OF*0..]->(root)
MATCH (pos:Position)-[:IN_ORG_UNIT]->(u)
RETURN u.id AS unit, collect(pos.id) AS positions;
```

## 6. Validation queries (each MUST return 0 rows on clean seed)
```cypher
-- 6.1  Invariant 1: no REPORTS_TO cycle
MATCH (p:Position)-[:REPORTS_TO*1..]->(p) RETURN p.id LIMIT 1;

-- 6.2  Invariant 2: at most one current holder per seat
MATCH (pos:Position)<-[h:HOLDS]-()
WHERE h.to IS NULL
WITH pos, count(*) AS openHolders
WHERE openHolders > 1
RETURN pos.id, openHolders;

-- 6.3  Invariant 3: every filled Position has exactly one IN_ORG_UNIT
MATCH (pos:Position)
WHERE pos.status = 'filled'
WITH pos, size([ (pos)-[:IN_ORG_UNIT]->() | 1 ]) AS units
WHERE units <> 1
RETURN pos.id, units;

-- 6.4  Invariant 4: every non-root OrgUnit has exactly one PART_OF parent
MATCH (o:OrgUnit)
WHERE o.type <> 'company'
WITH o, size([ (o)-[:PART_OF]->() | 1 ]) AS parents
WHERE parents <> 1
RETURN o.id, parents;
MATCH (o:OrgUnit)-[:PART_OF*1..]->(o) RETURN o.id LIMIT 1;

-- 6.5  Invariant 5: every active held person resolves to exactly one manager, or is root
MATCH (person:Person {status: 'active'})-[h:HOLDS]->(seat:Position)
WHERE h.to IS NULL
WITH person, seat,
     size([ (seat)-[:REPORTS_TO]->(mSeat)<-[mh:HOLDS]-(m)
            WHERE mh.to IS NULL | m ]) AS managers,
     EXISTS { (seat)-[:REPORTS_TO]->() } AS hasParent
WHERE (hasParent AND managers <> 1) OR (NOT hasParent AND managers <> 0)
RETURN person.id, managers, hasParent;
```

## 7. Seed plan (~200 people, generated Phase 2)
- **1 company root** OrgUnit (`type: company`) holding the single root Position (CEO) — the only seat with no `REPORTS_TO` out-edge (Invariant 5 root).
- **4–5 divisions** `PART_OF` the company → **departments** → **teams**; depth 4, ~30–40 OrgUnits.
- **~200 Positions**, each `IN_ORG_UNIT` exactly one unit, `DEFINED_BY` a Job (~15-Job catalog), `BASED_AT` one of **~6 Locations** across ≥3 timezones; `REPORTS_TO` wired into a single-solid-parent DAG giving span-of-control 2–8.
- **Holders:** ~185 Positions `filled` by `active` Persons via open `HOLDS {to: null}`; **~10–15 left `open`** (no holder). A handful of `terminated`/`leave` Persons carry a **closed** `HOLDS` to exercise the temporal filter.
- **One deliberate matrix case:** a Person whose seat has its normal single `REPORTS_TO` (solid) **plus one `DOTTED_REPORTS_TO`** to a manager in a different division. This adds **no** second `REPORTS_TO` — §6.1/§6.5 still pass, §5.2/§5.3 still ignore the dotted line, and a `DOTTED_REPORTS_TO` query surfaces the matrix relationship. This proves §1.2.

After seeding, §6.1–§6.5 return 0 rows and §5.1–§5.4 return the expected chains, counts, and rollups. That evidence — real data, zero violations, correct query results — is the [Verification](../PROJECT.md#verification-how-we-know-it-works--evidence-not-claims) the independent verifier checks.

---

## 8. Known non-blocking notes for Phase 2 (from independent review)

These passed review as non-blocking (P2); fold them into the build so the evidence stays clean:

1. **Invariant 3 scope (§6.3).** The validation query checks `status = 'filled'`, while the invariant text says "every *active* Position". Open seats are intentionally unchecked here but §7 still assigns each an `IN_ORG_UNIT`. Confirm the intended predicate when writing the test.
2. **Invariant 5 precondition (§4.5).** "Holds by construction" is slightly overstated: a person resolves to a manager only if the parent seat is *filled*. The seed plan should state that open seats are **leaf seats** (no direct reports), or §6.5 will legitimately flag reports of a vacant manager.
3. **Traversal §5.1 style.** The chain query reuses the bound variable `seat` as a list-comprehension iterator — redundant, at most a deprecation warning; results are unaffected. Rename on next touch.