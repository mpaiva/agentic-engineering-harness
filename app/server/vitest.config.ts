import { defineConfig } from "vitest/config";

// DEFAULT (unit) suite: fast, no Docker. Covers the fake-driver query-shape and
// guard-wrapper tests, the Cypher contract-drift pins, the seed-plan checks, and
// the view-repository shaping tests. The Testcontainers integration suite (a real
// Neo4j) lives under test/integration and is excluded here — run it with
// `vitest run --config vitest.integration.config.ts` (npm run test:integration).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/integration/**", "**/node_modules/**", "dist/**"],
  },
});
