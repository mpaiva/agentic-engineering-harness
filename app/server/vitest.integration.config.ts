import { defineConfig } from "vitest/config";

// INTEGRATION suite: real Neo4j 5 Community via Testcontainers (PROJECT.md
// Verification requires a real graph DB). Generous timeouts cover image pull +
// container start; forks + no file-parallelism keep one container per file rather
// than fanning containers across worker threads. Requires a running Docker daemon.
export default defineConfig({
  test: {
    include: ["test/integration/**/*.integration.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 240_000,
    fileParallelism: false,
    pool: "forks",
  },
});
