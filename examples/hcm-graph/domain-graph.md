# HCM domain graph — Core HR

The graph model for the first slice. This is the shared source of truth the graph-modeler and DB agents refine and the query/API/UI agents build against. Notation is DB-agnostic (nodes in `(Parens)`, relationships in `[:BRACKETS]`); the concrete graph database is chosen in [Phase 0](PROJECT.md#roadmap).

## Nodes

| Node | Key fields | Notes |
|------|-----------|-------|
| **Person** | `id`, `firstName`, `lastName`, `email`, `status` (active/leave/terminated), `hireDate` | A human worker. Holds positions over time. |
| **Position** | `id`, `title`, `level`, `fte`, `status` (filled/open) | A *seat*. The org structure lives here, not on people. |
| **Job** | `id`, `title`, `family`, `level`, `description` | Reusable role definition from a job catalog. Many positions share one job. |
| **OrgUnit** | `id`, `name`, `type` (company/division/department/team) | A unit in the org hierarchy. |
| **Location** | `id`, `name`, `city`, `country`, `timezone` | Where a position is based. |

## Relationships (the graph)

```text
(Person)   -[:HOLDS {from, to}]->        (Position)     a person occupies a seat, over time
(Position) -[:REPORTS_TO]->              (Position)     the reporting line (structure on seats)
(Position) -[:IN_ORG_UNIT]->             (OrgUnit)      which unit the seat belongs to
(Position) -[:DEFINED_BY]->              (Job)          the seat instantiates a job
(Position) -[:BASED_AT]->                (Location)     where the seat sits
(OrgUnit)  -[:PART_OF]->                 (OrgUnit)      org hierarchy
```

Derived, for convenience (computed by traversal, not stored as truth):

```text
(Person) reports-to (Person)   =  the holder of the Position this person's Position REPORTS_TO
(Person) member-of (OrgUnit)   =  the OrgUnit of the Position this person HOLDS
```

## Why these are edges (the graph payoff)

The questions Core HR must answer are **traversals**, cheap on a graph and painful in SQL:

- **Reporting chain up:** follow `HOLDS → REPORTS_TO* → HOLDS` from a person to the CEO.
- **All reports (transitive):** every seat below a position, and their holders.
- **Span of control:** count of direct `REPORTS_TO` into a position.
- **Org rollup:** every position `IN_ORG_UNIT` of a unit or any unit `PART_OF*` it.
- **Reorg impact:** what moves if an OrgUnit or Position changes.

## Invariants (enforced by DB constraints + verified by tests)

1. **No cycles** in `REPORTS_TO` — the org is a DAG rooted at the top position.
2. **One active holder per Position** — at most one `HOLDS` with an open `to` per position.
3. **Every active Position** has exactly one `IN_ORG_UNIT` edge.
4. **Every OrgUnit except the company root** has exactly one `PART_OF` parent (also acyclic).
5. **Every active person** with a held position resolves to exactly one manager, or is the single root (e.g. CEO).

These invariants are part of [Verification](PROJECT.md#verification-how-we-know-it-works--evidence-not-claims) — the independent verifier checks them against real seed data, not against claims.

## Seed data

~200 people across a realistic tree: 1 company root → 4–5 divisions → departments → teams, with positions filled and a few open, several locations, and one deliberate matrix/dotted-line case to prove the model handles it. The seed is generated in Phase 2 and is what the invariants and queries are verified against.

## Open questions (resolved in Phase 1)

- Temporal model: effective-dating on `HOLDS` (and later on `REPORTS_TO`) vs. simpler "current only" for slice 1 — model supports dates; UI reads "as of today."
- Matrix/dotted-line reporting: a separate `[:DOTTED_REPORTS_TO]` edge vs. a property on `REPORTS_TO`.
- IDs: external stable keys vs. DB-native ids.
