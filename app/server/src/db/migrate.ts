/**
 * Idempotent schema migration — applies schema.md §3 constraints + indexes.
 *
 * Every statement is `... IF NOT EXISTS`, so running this repeatedly is a no-op.
 * Run standalone (`npm run migrate`) or reused by the seed.
 */
import { createDriver, waitForNeo4j, configFromEnv } from "./driver.js";
import { GraphRepository } from "./repository.js";

export async function runMigration(): Promise<void> {
  const driver = createDriver(configFromEnv());
  try {
    await waitForNeo4j(driver);
    const repo = new GraphRepository(driver);
    const { constraints, indexes } = await repo.migrate();
    console.log(`[migrate] applied ${constraints} uniqueness constraints, ${indexes} indexes (idempotent).`);
  } finally {
    await driver.close();
  }
}

// Run when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch((err) => {
    console.error("[migrate] failed:", err);
    process.exit(1);
  });
}
