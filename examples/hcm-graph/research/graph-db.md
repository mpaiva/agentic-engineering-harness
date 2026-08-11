I have enough grounded facts. Here is the complete stage artifact.

---

# Phase 0 — Graph database recommendation for HCM Core-HR

Scope: the graph store behind the Core-HR slice defined in `examples/hcm-graph/PROJECT.md` and modeled in `examples/hcm-graph/domain-graph.md`. Judged strictly on the six things the contract and your brief ask for: **traversal/query ergonomics, invariant/constraint support, local-dev experience, licensing, TypeScript client maturity, operational weight** — weighted by what this slice actually is: a read-mostly, ~200-person org graph served by an API to an accessible web UI, built and verified by agents.

## TL;DR

**Recommend: Neo4j Community Edition (5.x / current LTS).** It wins or ties on five of the six axes the harness depends on most heavily — traversal ergonomics (it *is* the reference Cypher implementation your `domain-graph.md` is already written in), the most mature TypeScript driver, the smoothest local-dev/verify loop, small dependency surface, and low operational weight. It loses on exactly one axis: **licensing is GPLv3 (copyleft), not permissive.** That loss is *soft* for this project because you serve the database over an API and do not redistribute or embed it, so GPLv3 imposes no practical obligation.

**Pivot to Apache AGE (Postgres + AGE)** if — and only if — permissive licensing is a *hard* requirement rather than a preference, or if you weight *declarative, DB-enforced* invariants above query/TS ergonomics. AGE is Apache-2.0 and gives you real Postgres constraint machinery for the invariants, at the cost of clunkier TypeScript and real project-governance risk.

**Do not build on KuzuDB** despite it being the theoretically perfect fit (MIT, embedded, Cypher, TS binding): the project was **archived and abandoned by Kùzu Inc. in October 2025**. Starting a new product on frozen, unmaintained software is an avoidable risk.

## The candidates against your six axes

Grounded facts verified against each project's current source/license/registry (Aug 2026 read of live sources; see "Sources" at the end).

### 1. Traversal / query ergonomics (for the exact queries in `domain-graph.md`)

Your five headline queries — reporting chain up (`HOLDS → REPORTS_TO* → HOLDS`), all-reports-transitive, span of control, org rollup over `PART_OF*`, reorg impact — are variable-length path traversals. This is where the query language matters most.

- **Neo4j — best.** Cypher is the native language and `domain-graph.md` is already written in its notation. Reporting chain up is a one-liner: `MATCH (p:Person)-[:HOLDS]->(:Position)-[:REPORTS_TO*]->(:Position)<-[:HOLDS]-(mgr:Person)`. `shortestPath`, variable-length `*`, and `apoc`-style path expansion are first-class.
- **Memgraph — best (same language).** openCypher-compatible with strong path algorithms (BFS/DFS/wShortest as query syntax), MAGE library for graph algorithms. Ergonomically a peer of Neo4j for these queries.
- **KuzuDB — very good.** Implements Cypher; built for fast recursive joins. Language-wise a peer; disqualified on maintenance, not ergonomics.
- **Apache AGE — good, with friction.** openCypher *subset* exposed through `SELECT * FROM cypher('graph', $$ MATCH ... $$) AS (...)`. Variable-length paths work, but you write Cypher inside SQL strings and results come back as `agtype` you must parse. Some Cypher niceties are missing. Workable, not fluent.
- **ArangoDB — weakest for these.** AQL is capable but verbose for variable-length reporting chains (`FOR v,e,p IN 1..100 OUTBOUND ...`). It's a different language from your model's notation, so every query in `domain-graph.md` needs translation.

### 2. Invariant / constraint support (the five invariants in the model)

Reality check that levels the field: **none** of these engines can *declaratively* prevent a `REPORTS_TO` cycle. Cycle-freedom (invariants 1 and 4) is enforced on the write path + verified by tests everywhere. The differentiator is the other invariants — "one active holder per Position," "exactly one `IN_ORG_UNIT`," "exactly one `PART_OF` parent."

- **Apache AGE — strongest, by a lot.** Because it's Postgres underneath, you get the richest declarative toolbox: partial **unique indexes** ("one `HOLDS` with open `to` per Position"), **foreign keys**, **exclusion constraints**, `CHECK`, and triggers on the underlying edge storage. This maps directly to the contract's language: "invariants enforced by DB constraints." No other candidate enforces these at the DB layer as well.
- **Neo4j — partial.** Community Edition has **uniqueness constraints only**. Property-**existence** and **node-key** constraints are **Enterprise-only**, so "exactly one `IN_ORG_UNIT` edge" and similar cannot be declared in Community — they fall to app-layer write logic + verification tests. That is acceptable for this slice (invariants are already required to be test-verified against seed data), but it is a genuine gap versus AGE.
- **Memgraph — partial.** Uniqueness + existence constraints exist; still no declarative cycle or cardinality-of-edge guarantees. Comparable to Neo4j, slightly better on existence.
- **ArangoDB — partial.** Unique/persistent indexes and schema validation (JSON Schema on collections); edge-cardinality invariants remain app-enforced.
- **KuzuDB — schema-typed** (structured property graph with typed node/rel tables, primary keys) but disqualified on maintenance.

### 3. Local-dev experience (fast local dev is an explicit priority)

- **KuzuDB — best in theory** (embedded, no server, a single file; instant spin-up in tests) — disqualified.
- **Neo4j — excellent.** One `docker run neo4j`, bundled Neo4j Browser for visual query dev, `neo4j-migrations`/Cypher-shell, testcontainers module for integration tests against a real DB (which your Verification section requires). Enormous body of org-chart examples.
- **Memgraph — very good.** Single container, Memgraph Lab UI, in-memory-first so tests are fast; Bolt means you reuse Neo4j tooling.
- **ArangoDB — good.** Single container, web UI, arango-shell.
- **Apache AGE — good, familiar.** `apache/age` Docker image (Postgres + extension); everything you know about Postgres applies (psql, migrations, testcontainers-postgres). Slightly more setup (create extension, `SET search_path`, load `ag_catalog`).

### 4. Licensing (explicit priority: permissive)

This is the decisive axis and the one that splits the field cleanly.

| DB | License | Permissive? | Practical read for this project |
|----|---------|-------------|---------------------------------|
| **Apache AGE** | Apache 2.0 | **Yes** | Fully permissive. No usage, dataset, or distribution limits. |
| **KuzuDB** | MIT | **Yes** | Permissive but **abandoned/archived** (Oct 2025). |
| **Neo4j Community** | **GPLv3** | No (copyleft) | Legally fine for a *served* backend — GPL obligations trigger on *distribution/embedding*, not on running it behind your own API. Not "permissive," but not a practical blocker for SaaS-style use. Enterprise features (existence/key constraints, RBAC, multi-DB, hot backup, clustering) require a commercial license. |
| **Memgraph Community** | **BSL 1.1** (+ Additional Use Grant) | No (source-available) | Additional Use Grant permits internal production use; converts to Apache 2.0 on the 2030 change date. Not OSI-open; a competitive-use carve-out applies. |
| **ArangoDB Community** | **BUSL-1.1 + ArangoDB Community License** (since 3.12) | No (source-available) | Most restrictive here: free for **non-commercial** use only, datasets capped at **100 GB**, no rights to commercial use, embed, or distribute. Poor fit for a product. |

If "permissive" is strict, only **AGE** (and the abandoned Kuzu) qualify. If "permissive" is a strong preference but GPLv3-for-a-server is acceptable, **Neo4j** re-enters as the top functional choice.

### 5. TypeScript client maturity (explicit priority: TS end to end)

- **Neo4j — best.** The official `neo4j-driver` (v6, Apache-2.0 licensed driver, TS 5.9, RxJS support, record object-mapping preview) is the most mature, best-typed graph client in the JS ecosystem. Bolt protocol, session/transaction API, typed integers. This is the gold standard for "TypeScript end to end."
- **Memgraph — very good (borrowed).** Speaks Bolt, so you use the same `neo4j-driver`. You inherit Neo4j's excellent TS client for free.
- **ArangoDB — good.** Official `arangojs` is mature and well-typed, but you're writing AQL, not the Cypher your model is expressed in.
- **KuzuDB — decent** npm `kuzu` native binding with types — but archived.
- **Apache AGE — weakest end-to-end.** No first-class TS/graph client. You use `pg` (itself excellent and mature) and wrap Cypher in SQL template strings, then parse `agtype` results by hand or with a thin helper. It works and `pg`'s types are solid, but it is *not* a smooth graph-native TS experience.

### 6. Operational weight / dependency surface (explicit priority: small surface)

- **KuzuDB — lightest** (in-process, no server) — disqualified.
- **Apache AGE — very light *if* you already run Postgres.** Graph + relational + your app tables collapse into **one system** and **one driver** (`pg`). If the product will have any relational needs, this is the smallest total surface.
- **Neo4j — light.** One server, one driver. Well-understood ops, testcontainers support.
- **Memgraph — light.** One server, reuse Bolt driver.
- **ArangoDB — moderate.** One server; multi-model engine you won't fully use.

## Recommendation and reasoning

**Primary: Neo4j Community Edition.**

Why it best serves *this* contract:

1. **The harness's success hinges on agents fluently writing and verifying graph queries and TS.** Neo4j gives the lowest-friction path to a correct, well-tested slice: your `domain-graph.md` is already in Cypher, the driver is the best-typed graph client in TS, testcontainers lets integration tests run against a real DB (a Verification requirement), and org-chart traversal examples are abundant.
2. It wins or ties on **traversal ergonomics, TS end-to-end, local dev, operational weight, and dependency surface** — five of six axes.
3. Its single loss — **licensing** — is *soft here*: you serve the DB behind an API and do not distribute or embed it, so GPLv3 imposes no practical obligation, and the read-only ~200-person slice needs no Enterprise feature.

**Runner-up / pivot: Apache AGE (Postgres + AGE).** Choose this if permissive licensing is a *hard* gate, or if you weight *DB-enforced* invariants highest — AGE is the only candidate that enforces the cardinality invariants ("one active holder," "exactly one org unit") declaratively at the DB layer, matching the contract's "enforced by DB constraints" language, and it collapses graph+relational into one Apache-2.0 system with the mature `pg` driver.

## Risks and mitigations

**If you pick Neo4j (primary):**
- *Risk — licensing is copyleft, not permissive (violates the stated preference).* Mitigation: confirm the deployment model is "served behind our API, not redistributed/embedded"; under that model GPLv3 Community is a well-trodden, safe path. If the product will ever *ship* the DB to customers' machines, revisit.
- *Risk — Community can't declaratively enforce existence/node-key/edge-cardinality invariants (Enterprise-only).* Mitigation: enforce them on the write path (`MERGE`/guarded transactions) and, per the contract, verify all five invariants with integration tests against real seed data. This is already required by `PROJECT.md`, so the gap costs no extra scope.
- *Risk — vendor pull toward Enterprise.* Mitigation: this slice needs nothing Enterprise-only; keep the query/driver layer Bolt-standard so Memgraph remains a drop-in fallback (same driver, same Cypher).

**If you pivot to Apache AGE:**
- *Risk — project governance/cadence.* Bitnine dismissed the AGE dev team in Oct 2024; activity resumed late 2025 with releases tracking PG17/18/19, but long-term cadence is uncertain. Mitigation: pin a known-good Postgres+AGE version, keep graph access behind a thin repository interface, and treat "migrate to native Postgres recursive CTEs or Neo4j" as a documented contingency.
- *Risk — TS ergonomics (Cypher-in-SQL + agtype parsing).* Mitigation: build one small typed query helper that wraps `cypher()` calls and parses `agtype`; concentrate the friction in one module.
- *Risk — openCypher subset gaps.* Mitigation: validate each of the five `domain-graph.md` queries against AGE early (Phase 1/2) before committing UI work.

**Rejected outright:**
- **KuzuDB** — perfect on paper (MIT, embedded, Cypher, small surface, fast local dev) but **archived and abandoned (Oct 2025)**. Do not start a new product on it. (If an embedded, zero-server store were later wanted for CI speed and the community fork matures, revisit — but not as the slice's system of record.)
- **Memgraph** — excellent Cypher/Bolt peer of Neo4j and a clean *fallback*, but **BSL 1.1** is source-available, not permissive — it fails the licensing priority without buying you anything Neo4j doesn't already give.
- **ArangoDB** — **BUSL + non-commercial, 100 GB-capped Community License** is the worst licensing fit for a product, and AQL diverges from your Cypher-native model. Rejected.

## One decision the human gate should settle

The whole comparison pivots on how hard the **"permissive licensing"** requirement is:

- **Preference (GPLv3-for-a-server acceptable) → Neo4j Community.** Best overall fit for the build/verify loop.
- **Hard requirement (Apache/MIT only) → Apache AGE.** The only maintained, permissive, Cypher-speaking option, with the bonus of DB-level invariant enforcement.

I recommend Neo4j and flag this as the explicit choice for the Phase 0 "Approve stack" gate.

## Sources (verified live)

- Neo4j Community license GPLv3; Enterprise open-core split — `github.com/neo4j/neo4j`, `neo4j.com/legal-terms`, `neo4j.com/open-core-and-neo4j`.
- Neo4j JS driver v6, TS 5.9, official/Apache-2.0 — `github.com/neo4j/neo4j-javascript-driver`, `neo4j.com/docs/javascript-manual/current`.
- Memgraph BSL 1.1 + Additional Use Grant, change date 2030 → Apache 2.0 — `github.com/memgraph/memgraph/blob/master/licenses/BSL.txt`, `memgraph.com/legal`.
- ArangoDB 3.12+ BUSL-1.1 + Community License, non-commercial, 100 GB cap — `docs.arango.ai/.../incompatible-changes-in-3-12`, `arango.ai/downloads`.
- Apache AGE Apache-2.0, dev-team disruption Oct 2024, renewed releases PG17/18/19 late 2025 — `github.com/apache/age` discussions #2150/#2305, AGE releases.
- KuzuDB MIT, **archived Oct 10 2025, abandoned by Kùzu Inc.** — `github.com/kuzudb/kuzu` (status: ARCHIVED), The Register 2025-10-14.