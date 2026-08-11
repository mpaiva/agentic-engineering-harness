# @hcm/web — Core-HR web UI

React Router 7 (framework mode) + Vite. The employee **directory**, a **person** view, and
a keyboard-navigable **org chart**, over the tRPC API in [`app/server`](../server) (`@hcm/server`).
Builds to the finalized contract in [`product/design/schema.md`](../../product/design/schema.md).

## Run

```bash
npm install            # from the app/ workspace root
npm run dev            # Vite dev server (needs @hcm/server + a seeded Neo4j; see app/README)
npm run typecheck      # react-router typegen && tsc --noEmit
npm run test           # vitest component tests (jsdom; no server/DB needed)
```

Point loaders at the API with `API_URL` (default `http://localhost:8787`); the router is
mounted at `${API_URL}/trpc`.

## How it fits together

Traversals stay **server-side**. Every route `loader` runs on the server, calls a tRPC
procedure through the single seam in [`app/lib/trpc.server.ts`](app/lib/trpc.server.ts)
(`createTRPCClient<AppRouter>`), and hands components a pre-shaped result. No Cypher,
Neo4j driver, or API base ever reaches the browser bundle.

| Route | Loader → tRPC | View |
|-------|---------------|------|
| `/directory` | `people.list` + `org.listOrgUnits` + `org.listLocations` | `DirectoryTable` (semantic sortable `<table>`) + `DirectoryFilters` (React Aria `SearchField`/`ComboBox`/`Select`) |
| `/person/:personId` | `people.get` | `PersonView` (accessible HTML, manager/reports links, reporting-chain breadcrumb) |
| `/org-chart` | `org.chart` | `OrgTree` — a single-select ARIA **tree** whose hierarchy IS the solid-line `REPORTS_TO` traversal |

`app/lib/contract.ts` mirrors the server's `schemas.ts` DTOs field-for-field; it is the
prop contract for the pure view components (which is why the component tests run without a
server). Filtering + pagination happen in Neo4j; a falsy filter param means "unset".

## Accessibility

The org chart (`OrgTree` — owned by the accessibility specialist) is a hand-rolled
`role="tree"` (APG Tree View): roving tabindex, `←/→` up-to-manager / down-to-reports,
`↑/↓` across peers, author-declared `aria-level`/`aria-setsize`/`aria-posinset` from the
graph, a focus-managed detail panel that restores focus on `Escape`, and a polite live
region. Matrix / dotted-line reporting is an annotated link, never a second tree parent.
The directory is a real sortable table with `aria-sort`; every view has a visible focus
ring and the app has a skip link. Automated axe + Playwright keyboard walkthrough are owned
by the test engineer.
