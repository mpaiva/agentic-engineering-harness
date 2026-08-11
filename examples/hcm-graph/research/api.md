Both documents are clear. This is a focused architecture decision I can make directly from the contract. Here is my recommendation.

---

# API paradigm decision — how the HCM Graph read API exposes the graph

**Recommendation: a thin, typed RPC layer (tRPC), with traversals modeled as explicit named operations backed by graph-DB queries.** REST + OpenAPI is the designated fallback if a language-agnostic API becomes a requirement. **GraphQL is not recommended for this slice.**

Grounded in `examples/hcm-graph/PROJECT.md` (the contract) and `examples/hcm-graph/domain-graph.md` (the model).

## What the API actually has to do (from the model)

The contract's first slice is a **read API** only — write/edit beyond seed and authn/authz are explicitly **out** (`PROJECT.md:28`). The queries that matter are the traversals named in `domain-graph.md:37-41` and `PROJECT.md:46`:

- **Reporting chain up:** `HOLDS → REPORTS_TO* → HOLDS`, person to CEO — *arbitrary depth*.
- **All reports (transitive):** every seat below a position — *arbitrary depth*.
- **Span of control:** count of direct `REPORTS_TO` into a position — one hop.
- **Org rollup:** every position `IN_ORG_UNIT` of a unit or any unit `PART_OF*` it — *arbitrary depth*.
- Plus the three UI surfaces (`PROJECT.md:19-21`): directory (paginated search/filter), org chart (tree, navigable up/down), person page (a node + its immediate neighbors).

The decisive fact: three of the four marquee queries are **variable-depth transitive traversals**. That single fact drives the whole decision.

## Why not GraphQL

GraphQL's name invites the assumption that it is graph-DB-native. It is not. GraphQL is a hierarchical, fixed-shape query language with **no recursion in the query itself**. It cannot express "walk `REPORTS_TO` until the root" or "every unit `PART_OF*` this one." You would either:

1. hard-code a fixed nesting depth (`manager { manager { manager { … } } }`) — wrong for an org of unknown height, or
2. compute the traversal server-side in the graph DB and expose it as a flat list field — at which point GraphQL is adding a schema language and client runtime on top of what is really an RPC call.

So GraphQL's central advantage over REST — client-shaped nested fetching — **does not map to the queries this product is built to answer**. The traversal must happen in the graph DB (e.g. Cypher variable-length paths) and come back materialized regardless of paradigm.

What GraphQL would still buy — end-to-end typing and a self-documenting schema — is real but comes at a cost the contract weighs against: a meaningfully **larger dependency surface** (schema builder, server, client cache library, codegen pipeline) and slower local iteration (`PROJECT.md` priorities: fast local dev, small dependency surface, add no dependencies without approval — `PROJECT.md:40`). It also introduces the N+1 traversal problem, requiring DataLoader batching to stay correct. That is a lot of machinery to end up computing traversals in the DB anyway.

Note on licensing: this is **not** a differentiator. The mainstream GraphQL, REST, and RPC toolchains (graphql-js, Apollo Server, Pothos, urql, Hono, Fastify, tRPC, Zod) are all MIT/permissive. I won't claim otherwise.

## Why tRPC (thin typed RPC) wins here

Against the contract's stated priorities:

| Priority (from PROJECT.md) | How tRPC scores |
|---|---|
| **Graph-native traversals** | Each traversal is one named procedure (`org.reportingChain`, `org.transitiveReports`, `org.spanOfControl`, `org.rollup`) that runs a single graph query and returns the DB-computed result. The traversal lives where it belongs — in the graph DB — and the API names it honestly. |
| **TypeScript end to end** | Best-in-class: types flow from server to client by **inference, with zero codegen**. This matches GraphQL's typing benefit without the schema-language or codegen step. |
| **Fast local dev** | No schema compile, no codegen watch step, no client cache to configure. Add a procedure, it's typed on the frontend instantly. |
| **Small dependency surface** | `@trpc/server`, `@trpc/client`, and `zod` for input validation. That's it. A small HTTP runtime (Hono) underneath. |
| **Permissive licensing** | MIT across the board. |
| **Accessible org chart** | Neutral — a11y is a frontend concern (`PROJECT.md:39`). The API's job is to return clean tree/list shapes the UI can render and keyboard-navigate; explicit endpoints give exactly the shapes each surface needs. |

On **coupling to the chosen graph DB** (still undecided until Phase 0, `PROJECT.md:59`): tRPC keeps this cleanest. Each procedure is a thin wrapper over one query in a repository/data layer, so the Cypher/Gremlin/etc. stays isolated and swappable. There is no schema-resolver graph tempting you to leak DB shape into the API contract.

**Shape of the surface:**
- `people.list` — paginated directory (cursor pagination), filters by org unit / location.
- `people.get` — a person plus immediate neighbors (manager, direct reports, position, job, org unit) — directly serves the person page in `PROJECT.md:21`.
- `org.chart` — subtree for the org-chart UI, expandable node by node.
- `org.reportingChain` / `org.transitiveReports` / `org.spanOfControl` / `org.rollup` — the four named traversals, each a single graph query.

Pagination is explicit and simple (cursor over stable IDs) — no spec ceremony needed for a ~200-person dataset (`domain-graph.md:55`).

## The honest trade-off, and the fallback

tRPC's one real cost: it couples client and server as **TypeScript-to-TypeScript**. A non-TS or third-party public client cannot consume it directly. For this slice that is a **feature, not a bug** — the contract's explicit priority is "TypeScript end to end," auth and external consumers are out of scope, and the frontend and API live in the same TS codebase.

If a later slice needs a language-agnostic or public API, the migration path is clean: **REST + OpenAPI** (with `openapi-typescript` for frontend types). REST expresses these traversals just as well as RPC — each traversal is a purpose-built endpoint returning a DB-computed result (`GET /positions/:id/reports?transitive=true`, `/org-units/:id/rollup`) — it just costs a bit more ceremony (route definitions, an OpenAPI document, a codegen step) than tRPC's inference. So REST is the recommended fallback, and the two share the same underlying repository/query layer, making the swap low-risk.

## Decision, in one line

**Use tRPC: it gives GraphQL-grade end-to-end TypeScript types with a fraction of the dependency surface, models each org traversal as an explicit operation that runs where graph traversals actually belong (in the graph DB), and keeps the not-yet-chosen graph database cleanly swappable behind a thin data layer. GraphQL's "graph" naming is a false match — it cannot express the variable-depth reporting-chain, transitive-reports, and org-rollup traversals this product exists to answer. REST + OpenAPI is the fallback the moment a language-agnostic API is required.**

This is an architecture decision and therefore hits a standing gate (`PROJECT.md:53`) — it should be confirmed at the Phase 0 stack-approval gate before Phase 2 build.