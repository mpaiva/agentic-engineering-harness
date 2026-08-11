import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e for the Core-HR slice (PROJECT.md Verification: browser/e2e +
 * automated axe + a scripted keyboard walkthrough of the org chart).
 *
 * Orchestration note (deliberate): Playwright starts `webServer`s BEFORE
 * `globalSetup`, and the webServer array runs in PARALLEL — so it cannot bring up
 * and seed the database first. The graph is therefore prepared by the workspace
 * `pretest` script (`db:up && db:seed`) which npm runs before `test`. This config
 * only launches the API (Hono/tRPC) and the web app (React Router 7), each of
 * which connects to the already-running, already-seeded Neo4j.
 *
 * Point at an already-running stack instead by setting E2E_BASE_URL (then the
 * webServers are skipped and the DB prep is your responsibility).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8787";
const external = Boolean(process.env.E2E_BASE_URL);

const NEO4J_ENV = {
  NEO4J_URI: process.env.NEO4J_URI ?? "bolt://localhost:7687",
  NEO4J_USER: process.env.NEO4J_USER ?? "neo4j",
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ?? "password",
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : [
        {
          name: "api",
          // Hono/tRPC server (src/main.ts): waits for Neo4j, applies §3 schema, serves.
          command: "npm run start -w @hcm/server",
          cwd: "..",
          url: `${API_URL}/health`,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          env: { PORT: "8787", ...NEO4J_ENV },
        },
        {
          name: "web",
          // React Router 7 dev server; loaders call the API server-side over API_URL.
          command: "npm run dev -w @hcm/web -- --port 3000",
          cwd: "..",
          url: BASE_URL,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          env: { API_URL },
        },
      ],
});
