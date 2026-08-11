# HCM Graph — Core-HR Slice: Unified Stack Recommendation

*Synthesized from the four Phase-0 research artifacts (`graph-db.md`, `api.md`, `ui-orgchart.md`, `accessibility.md`). One stack, internally consistent, optimized for graph-native traversals, fast local dev, an accessible org chart (WCAG 2.2 AA), TypeScript end to end, permissive licensing, and a small dependency surface.*

---

## TL;DR — the stack

| Layer | Choice | One-line reason |
|---|---|---|
| **Graph DB** | **Neo4j Community 5.x** (primary); **Apache AGE** if permissive licensing is a *hard* gate | Cypher is the language the domain model is already written in; best-in-class TypeScript driver; smoothest local-dev/verify loop |
| **API paradigm** | **tRPC** (thin typed RPC); REST+OpenAPI as fallback | Each traversal is one named procedure over a graph query; GraphQL-grade end-to-end types with zero codegen and a tiny dep surface |
| **Web framework** | **React + React Router 7 (framework mode) on Vite** | Unlocks React Aria Components; loaders are a clean seam for server-side traversals; lean surface, fast HMR |
| **Org chart** | **Hand-rolled ARIA `role="tree"` on React Aria `Tree`** — no SVG/canvas org-chart library | The `REPORTS_TO` DAG *is* a tree; accessible by construction, not bolt-on |
| **Accessibility** | **APG Tree pattern**: roving tabindex, arrow-key reporting-chain traversal, author-declared `aria-level/setsize/posinset`, `aria-describedby` for span/org-unit, focus-managed detail panel, polite live region | Turns the gated a11y requirement into a concrete, verifiable ARIA contract |
| **Local dev** | **Docker Compose**: one `neo4j` container + one Node/Vite process; Neo4j Testcontainers for integration tests | Single `docker run`, real DB in tests (a Verification requirement) |

This stack is **TypeScript from the Bolt driver to the DOM**, adds essentially **one new client dependency family** (`react-aria-components`) and **two server families** (`neo4j-driver`, `@trpc/*` + `zod`), and every recommended package is MIT or Apache-2.0 **except the database engine itself**.

---

## Why these choices cohere

The four decisions are not independent — they reinforce each other around one spine: **traversals run server-side, next to the graph driver, and return already-shaped trees.**

1. **The domain is a graph of variable-depth traversals** (reporting chain up, transitive reports, span of control, org rollup). Three of the four marquee queries are arbitrary-depth. This single fact drives the DB *and* the API choice: you want Cypher's variable-length paths (`REPORTS_TO*`), and you want the API to *name* each traversal rather than pretend a client can shape it.

2. **tRPC procedures wrap Cypher queries one-to-one.** `org.reportingChain`, `org.transitiveReports`, `org.spanOfControl`, `org.rollup`, `people.list`, `people.get`, `org.chart` — each is a thin wrapper over one query in a repository layer. The graph DB stays isolated behind that layer, which is what keeps the DB *swappable* (Neo4j → AGE fallback) without touching the API contract.

3. **React Router 7 loaders consume tRPC procedures server-side** and hand pre-shaped trees to the components. Traversals stay graph-native; client JS stays small.

4. **The org chart renders the `REPORTS_TO` DAG the DB already computed** as an ARIA `tree`. The tree's `aria-setsize` on each node *is* the span-of-control number returned by `org.spanOfControl` — the same graph fact, reused. Accessibility and graph semantics are the same structure.

So the accessibility contract (artifact 4) constrains the UI library choice (artifact 3), the UI's server-loader model constrains the API shape (artifact 2), and the API's need for variable-length Cypher constrains the DB (artifact 1). The chain closes.

---

## The stack in detail

### Graph DB — Neo4j Community (primary)

Wins five of six axes the harness leans on: traversal ergonomics (the model is already in Cypher), the most mature TS graph driver (`neo4j-driver` v6, Apache-2.0), smoothest local dev (one container, Neo4j Browser, Testcontainers), small dependency surface, low operational weight.

Its one loss is **licensing: GPLv3, not permissive.** For this project that loss is *soft* — you serve the DB behind your own API and do not redistribute or embed it, so GPLv3 imposes no practical obligation. Community Edition also can't *declaratively* enforce the existence/cardinality invariants ("exactly one `IN_ORG_UNIT`," "one active holder per position") — those are Enterprise-only — so they fall to write-path logic plus integration tests, which `PROJECT.md` already requires.

**Isolate all Cypher behind a thin repository interface** so the fallback stays cheap.

### API — tRPC

Best-in-class end-to-end TypeScript by *inference, zero codegen* — GraphQL's typing benefit without its dependency surface, schema language, codegen watch step, or N+1/DataLoader machinery. GraphQL is rejected on substance: it cannot express recursive traversals, so it would compute them in the DB anyway while adding a client runtime and cache. Dependencies: `@trpc/server`, `@trpc/client`, `zod`, on a small Hono runtime. Cursor pagination for the directory; no spec ceremony for ~200 people.

### Web framework — React Router 7 + Vite

Chosen over Next.js (runner-up) on **small dependency surface** and **simplicity**: the per-route loader is a near-perfect seam for "one traversal, one typed result, rendered on the server." SvelteKit is rejected despite smaller bundles because it has no equivalent to React Aria's tested `Tree` — and the org chart is the hardest accessible widget in the product.

### Org chart + accessibility — one decision

Model the org chart as a single-select ARIA `tree` where the hierarchy *is* the `REPORTS_TO` traversal, built on **React Aria's `Tree`**, styled with CSS to read as an org chart. This is the **conformance-bearing source of truth** that axe and the scripted keyboard walkthrough verify. `←` walks up to the manager, `→` drills into reports, `↑/↓` across peers; `aria-level/setsize/posinset` are declared from the graph (mandatory once nodes lazy-load); reporting relationship + span + org unit ride in `aria-describedby`; `Enter` opens a focus-managed detail panel that restores focus on `Escape`; a polite live region announces async expansion. Matrix/dotted-line reporting is an annotated link, never a second tree parent (it would break `setsize/posinset`).

SVG/canvas org-chart drawing libraries (`d3-org-chart`, React Flow) are **inadmissible as the source of truth** — they render shapes, not a `treeitem` hierarchy, and cannot carry roving focus or ARIA state. A canvas visual is permitted later *only* as an `aria-hidden` decorative layer over the same tree DOM.

**Directory:** semantic sortable `<table>` + React Aria `SearchField`/`Select`/`ComboBox`. **Person:** plain accessible HTML (`<h1>`, description list, manager/reports links, reporting-chain breadcrumb). No virtualization needed at 200 people.

### Local-dev setup that ties it together

```
docker-compose.yml
  ├─ neo4j:5-community        # Bolt :7687, Browser :7474, seeded on init
  └─ (app runs on host)
app/
  ├─ server/  tRPC router + Neo4j repository (Cypher lives here only)
  ├─ web/     React Router 7 + Vite, loaders call tRPC
  └─ test/    Neo4j Testcontainers → invariant + traversal integration tests
```

`docker compose up` gives a real graph DB with Neo4j Browser for query development; `vite dev` gives HMR. Integration tests run against a Testcontainers Neo4j (real DB, per the Verification requirement); a11y evidence is an **axe pass + a Playwright scripted keyboard walkthrough** of the tree. Every layer is TypeScript, so a single `tsc`/`vitest`/`playwright` toolchain covers the stack.

---

## Trade-offs table

| Decision | What we optimize for | What we give up | Fallback / mitigation |
|---|---|---|---|
| **Neo4j CE** over Apache AGE | Cypher ergonomics, best TS driver, local-dev/verify loop | Permissive licensing (GPLv3 copyleft); no DB-declared cardinality invariants in CE | AGE (Apache-2.0 + Postgres constraints) if licensing is a hard gate; Cypher isolated behind a repository so the swap is contained |
| **tRPC** over GraphQL/REST | Zero-codegen E2E types, tiny surface, fast iteration | TS-to-TS coupling — no language-agnostic/public client | REST + OpenAPI (`openapi-typescript`) sharing the same query layer, when a public API is needed |
| **React Router 7** over Next.js / SvelteKit | Small surface, loader-as-traversal-seam, React Aria access | Next.js's marginally smaller client JS (RSC); Svelte's smaller bundles | Next.js App Router is a drop-in with identical React Aria a11y if minimum client JS later outranks minimum surface |
| **ARIA `tree`** over SVG/canvas org chart | WCAG 2.2 AA by construction, keyboard-native, axe-inspectable DOM | Spatial "boxes-and-connectors" polish | Add `d3-org-chart` later as an `aria-hidden` visual layer mirroring the tree |
| **Neo4j in Docker** (server) over embedded | Real-DB parity in dev and CI, mature tooling | An embedded/zero-server store's instant spin-up (KuzuDB — but it's abandoned) | Testcontainers keeps per-test isolation fast enough |

---

## Top risks

1. **Licensing mismatch (highest-signal decision).** The brief lists "permissive licensing" as an explicit target, yet the primary DB is GPLv3. It's a *soft* loss for a served backend, but it directly contradicts the stated preference. **This is the one item the Phase-0 approval gate must settle explicitly:** *preference (GPLv3-for-a-server acceptable) → Neo4j; hard requirement (Apache/MIT only) → Apache AGE.* Everything else in the stack is unaffected by the answer because Cypher sits behind the repository interface.

2. **CE can't declaratively enforce the cardinality/existence invariants.** "One active holder per position," "exactly one org unit," cycle-freedom — none are DB-declarable in Neo4j CE. *Mitigation:* enforce on the write path (`MERGE`/guarded transactions) and verify all five invariants with Testcontainers integration tests against seed data — already required scope, so no extra cost. (If you pivot to AGE, you *gain* Postgres partial-unique/exclusion/CHECK constraints here.)

3. **Visual-expectation mismatch on the org chart.** Stakeholders may expect a spatial canvas diagram; this stack ships an accessible *tree* styled as an org chart first, with canvas as a later additive layer. **Confirm acceptable at the gate** before build.

4. **AGE governance risk (only if you pivot).** Bitnine dismissed the AGE dev team in Oct 2024; releases resumed late 2025 but cadence is uncertain. *Mitigation:* pin a known-good Postgres+AGE version, keep the repository seam, and treat "migrate to Neo4j or native recursive CTEs" as a documented contingency. Also accept clunkier TS (Cypher-in-SQL + `agtype` parsing) concentrated in one typed helper module.

5. **Rejected-option regret — KuzuDB.** Perfect on paper (MIT, embedded, Cypher, tiny surface) but **archived and abandoned (Oct 2025)**. Do not build the system of record on it, regardless of how attractive the local-dev story looks.

**Net recommendation for the Phase-0 "Approve stack" gate:** approve **Neo4j CE · tRPC · React Router 7 + Vite · React Aria `tree` org chart · Docker Compose + Testcontainers**, with the single open decision being how hard the permissive-licensing requirement is — that answer alone toggles Neo4j ↔ Apache AGE and nothing else.