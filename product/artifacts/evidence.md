I ran every check in the slice's evidence contract for real and appended the observed commands + output to `product/artifacts/evidence.md`. This environment is Docker-capable (Colima), so nothing had to be recorded as UNVERIFIED.

# Phase 3 Verification — Core-HR slice: EVIDENCE (facts observed)

**Environment:** macOS/aarch64 · Node 22.22.0 · Docker 29.5.2 via Colima 0.10.3 · `neo4j:5-community` kernel **5.26.29** CE (digest `sha256:d9dd3dc7…`) · tsc 5.9.3 · vitest 4.1.10 · Playwright 1.62.1. Integration used `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock` + `TESTCONTAINERS_RYUK_DISABLED=true`.

## Results

| Check | Command | Result |
|---|---|---|
| tsc — server / web / e2e | `npm run typecheck -w @hcm/{server,web,e2e}` | **PASS** — all exit 0 |
| vitest unit — server | `npm run test:unit -w @hcm/server` | **PASS** — 57/57, 5 files |
| vitest unit — web | `npm run test -w @hcm/web` | **PASS** — 24/24, 4 files |
| integration (real Neo4j, Testcontainers) | `npm run test:integration -w @hcm/server` | **PASS** — 47/47, 3 files, ~58 s |
| §6 five invariants (0 rows) | seed validator + direct `cypher-shell` verbatim | **PASS** — all 6 statements 0 rows |
| §5 four traversals | direct `cypher-shell` on seeded graph | **PASS** — correct chains/counts/rollups |
| Playwright e2e | `npm run test:e2e` | **PASS** — 9/9, ~16 s |
| org-chart keyboard walkthrough | `org-chart.keyboard.spec.ts` (2) | **PASS** |
| axe WCAG 2.2 AA (directory, org-chart, person) | `axe.spec.ts` (3) | **PASS** — 0 violations |

**§6 (each returned 0 data rows; positive-control count query on the same shell returned rows):** 6.1 no `REPORTS_TO` cycle; 6.2 ≤1 current holder/seat; 6.3 filled Position → exactly one `IN_ORG_UNIT`; 6.4a non-root OrgUnit → exactly one `PART_OF`; 6.4b `PART_OF` acyclic; 6.5 each active held person → exactly one manager or root.

**§5 (on the deterministic ~200-person seed: 40 units / 200 positions / 192 persons / 188 open holds):** §5.1 matrix IC PER-000006 → `[PER-000006,004,003,002,001]`, 5 levels to root, **dotted Finance line excluded from the solid chain**; §5.2 CEO POS-000001 → 199 report seats / 187 held; §5.3 CEO span = 5; §5.4 company rollup = 40 units / 200 positions. Matrix §1.2 confirmed: `POS-000006 -[:DOTTED_REPORTS_TO]-> POS-000171` is a distinct edge with the seat still holding exactly one solid `REPORTS_TO`.

**e2e specifics:** genuine `role="tree"`/`treeitem` with one roving `tabindex="0"`; `→`/`←` drill/climb, `↑`/`↓` peer moves, `Home`/`End` first/last of 5 VPs, `aria-level`/`aria-setsize=5` from the graph, `Enter` opens a focus-managed detail region, `Escape` restores focus (WCAG 2.4.3). axe ran tags `wcag2a/2aa/21a/21aa/22aa` over `/directory`, `/org-chart`, `/person/PER-000001` — zero violations each. API booted on `:8787`, React Router 7 web on `:3000`, both against live Neo4j.

## Deviations from the prior `test-evidence.md` (reported as facts, not corrections)
- It predicted `web/test/OrgTree.test.tsx` would fail as a stale `treegrid` assertion. **Did not reproduce** — 7/7 passed.
- It reported a **blocking web-boot defect** (missing `entry.server.tsx`). **Did not reproduce** — the RR7 dev server booted and all 9 e2e tests passed.

Both appear resolved in the current tree.

## UNVERIFIED
None. Every contract check ran for real in this Docker-capable environment. DB torn down afterward (`npm run db:down`, exit 0).

**Artifact written:** `product/artifacts/evidence.md` (exact commands + observed output). No source files were modified; nothing was committed.