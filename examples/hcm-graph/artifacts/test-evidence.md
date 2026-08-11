# Test-engineer evidence — Core-HR slice

What the test-engineer authored for the Phase-2 build and the **real results observed
in this run**. Per [AGENTS.md](../../../AGENTS.md): evidence, not claims. Nothing is
committed; the workflow integrates and gates. A fresh verifier judges correctness.

Environment: macOS, Node 22, Docker 29.5.2 via **Colima**, `neo4j:5-community` image.

## Suites authored (all behind the repository seam; Cypher only in `db/`+`repository/`)

| Layer | Files | Covers |
|---|---|---|
| **Unit** (no Docker) | `examples/hcm-graph/app/server/test/unit/cypher-contract.test.ts`, `guards.repository.test.ts`, `seed-plan.test.ts`, `view-repository.test.ts` | §3–§6 Cypher contract-drift pins; §4 guard reject/accept wrappers (fake driver); §7 seed determinism + counts + §8 preconditions; view-repo tree-assembly / cursor / person mapping |
| **Integration** (real Neo4j via Testcontainers) | `examples/hcm-graph/app/server/test/integration/slice.integration.test.ts`, `guards.integration.test.ts`, `support/neo4j.ts`, `support/seed.ts` | §6 validations = 0 rows; §5 traversals with **plan-derived** chains/counts/rollups; tRPC caller contract; temporal "as of today"; live guard rejection of cycle / second parent / double-book / self-loop / PART_OF cycle |
| **e2e** (Playwright + axe) | `examples/hcm-graph/app/e2e/` (`playwright.config.ts`, `tests/org-chart.keyboard.spec.ts`, `axe.spec.ts`, `directory.spec.ts`, `person.spec.ts`) | Scripted **keyboard walkthrough** of the ARIA `tree` (roving tabindex, ←/→/↑/↓/Home/End, Enter→panel, Escape→restore focus); **axe** WCAG 2.2 AA on directory/org-chart/person; directory + person smoke |

Wiring: `examples/hcm-graph/app/server/vitest.config.ts` (unit, excludes integration) + `vitest.integration.config.ts`; scripts `test` / `test:unit` / `test:integration`; new `@hcm/e2e` workspace (added to root `workspaces`) with `pretest` DB bring-up+seed; root `typecheck` / `test` / `test:integration` / `test:e2e`.

Dependencies added — **all implied by the approved stack** (Neo4j Testcontainers, axe + Playwright), none novel: server devDeps already carried `vitest` + `testcontainers` + `@testcontainers/neo4j`; e2e adds `@playwright/test`, `@axe-core/playwright`.

## Results observed in this run

- **Unit — PASS.** `npm run test:unit -w @hcm/server` → **57 passed** (5 files; includes the pre-existing `org-repository.shape.test.ts`). ~0.3 s.
- **Type-check — PASS.** `tsc` over `src` + all `test/**` (unit + integration) → 0 errors. `@hcm/e2e` `tsc --noEmit` → 0 errors.
- **Integration — PASS against real Neo4j.** `npm run test:integration -w @hcm/server` → **47 passed** (3 files, ~63 s): my `slice` (11) and `guards` (9), plus the api-engineer's `procedures` (27), which consume the `support/` harness I authored. The five §6 checks returned **0 rows**; the four §5 traversals matched the plan exactly (CEO span 5, 199 seats below root, 200 positions rolled up, 5-deep chains); guards rejected every real violation.
  - **Required env on Colima:** `TESTCONTAINERS_RYUK_DISABLED=true` (or `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`). Without it the Ryuk reaper fails to mount `~/.colima/default/docker.sock` and every container `beforeAll` errors — exactly as [phase-2-run-notes.md](phase-2-run-notes.md) predicts. `afterAll` stops containers explicitly, so disabling Ryuk is safe here.
- **e2e — authored, wired, and DISCOVERABLE (9 tests), but BLOCKED by a web-workspace defect (see below).** The harness itself is proven: `pretest` brought up Compose Neo4j and seeded it, and the **API booted on :8787**. Chromium installed.

## Blocking finding for the integrator / repair stage (not in the test surface)

**`@hcm/web` cannot boot (dev *or* build).** `react-router dev` and `react-router build` both fail at `resolveEntryFiles`:

```
Error: Could not determine server runtime. Please install @react-router/node,
or provide a custom entry.server.tsx/jsx file in your app directory.
```

`@react-router/node@7.18.2` **is** installed and declared, and `react-router.config.ts` sets `ssr: true`, yet RR7's runtime auto-detection does not fire and there is **no `examples/hcm-graph/app/web/app/entry.server.tsx`**. The error's own remedy is to add `examples/hcm-graph/app/entry.server.tsx` (and `entry.client.tsx`). This blocks all e2e and any production serve. Left for the web-engineer / repair loop — outside the test-engineer lane.

## Second finding (non-blocking, web unit test)

`examples/hcm-graph/app/web/test/OrgTree.test.tsx` asserts `role="treegrid"` / `role="row"`, but the shipped `OrgTree.tsx` renders the APG **`role="tree"` / `role="treeitem"`** the accessibility contract mandates. The component is correct; that component test is stale and will fail `vitest`. The e2e keyboard walkthrough targets the correct `tree`/`treeitem` DOM.

## How to reproduce

```bash
cd app && npm install
npm run test:unit -w @hcm/server                                   # 57 pass, no Docker
TESTCONTAINERS_RYUK_DISABLED=true npm run test:integration -w @hcm/server   # 47 pass, real Neo4j
npm run install:browsers -w @hcm/e2e && npm run test:e2e           # after the web-boot fix
```
