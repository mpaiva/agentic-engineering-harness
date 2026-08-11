# @hcm/e2e — end-to-end + accessibility evidence

Playwright e2e for the Core-HR slice. Covers the three views end to end against the
**real** tRPC API and a **real** Neo4j graph, and produces the two accessibility
artifacts `PROJECT.md` Verification requires:

- **A scripted keyboard walkthrough** of the org-chart ARIA `tree`
  ([`tests/org-chart.keyboard.spec.ts`](tests/org-chart.keyboard.spec.ts)) — roving
  tabindex, `←/→` up-to-manager / down-to-reports, `↑/↓` across peers, `Home/End`,
  `Enter` to open the focus-managed detail panel, `Escape` to close and restore focus.
- **An automated axe pass** ([`tests/axe.spec.ts`](tests/axe.spec.ts)) — zero WCAG 2.2
  A/AA violations on the directory, org chart, and person views.

Plus directory and person smoke flows.

## Prerequisites

- **Docker** (for the Neo4j 5 Community container).
- Workspace deps installed from the repo `app/` root: `npm install`.
- Chromium for Playwright: `npm run install:browsers -w @hcm/e2e`.

## Run

```bash
# from app/
npm run test:e2e
```

`npm test` in this workspace runs a `pretest` hook that (1) brings up the Neo4j
container (`docker compose -f ../docker-compose.yml up -d --wait neo4j`) and (2) seeds
the deterministic §7 graph (`npm run seed -w @hcm/server`). Playwright then starts the
API (`8787`) and the web app (`3000`) via its `webServer` config and runs the tests.

> **Why the DB is seeded before Playwright, not in `globalSetup`:** Playwright starts
> `webServer`s *before* `globalSetup`, and the array runs in parallel — so it can't
> prepare the database first. The `pretest` npm chain does, deterministically.

## Point at an already-running stack

Set `E2E_BASE_URL` (and optionally `E2E_API_URL`) to skip the managed web servers and
DB prep and test an external deployment:

```bash
E2E_BASE_URL=https://staging.example npm run test -w @hcm/e2e
```

## Teardown

```bash
npm run db:down -w @hcm/e2e
```
