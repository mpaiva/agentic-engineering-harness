/**
 * The one place a Neo4j driver is constructed. Everything else takes a `Driver`
 * so tests can inject a Testcontainers-backed one and production can read env.
 *
 * `disableLosslessIntegers` makes the driver return plain JS numbers for graph
 * integers. Our domain values (levels, counts, fte) are far inside Number's
 * safe range, so this removes `neo4j.int` juggling from the repository without
 * risking precision loss.
 */
import neo4j from "neo4j-driver";
import type { Driver } from "neo4j-driver";

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  /** Optional target database; CE serves a single "neo4j" database by default. */
  database?: string | undefined;
}

export function configFromEnv(overrides?: Partial<Neo4jConfig>): Neo4jConfig {
  return {
    uri: overrides?.uri ?? process.env.NEO4J_URI ?? "bolt://localhost:7687",
    user: overrides?.user ?? process.env.NEO4J_USER ?? "neo4j",
    password: overrides?.password ?? process.env.NEO4J_PASSWORD ?? "password",
    database: overrides?.database ?? process.env.NEO4J_DATABASE,
  };
}

export function createDriver(config: Neo4jConfig): Driver {
  return neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.user, config.password),
    { disableLosslessIntegers: true },
  );
}

/**
 * Poll `verifyConnectivity` until the container's Bolt endpoint answers, or throw
 * after `timeoutMs`. Used by the migration/seed entrypoints, which run right after
 * `docker compose up` when Neo4j may still be starting.
 */
export async function waitForNeo4j(driver: Driver, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      await driver.verifyConnectivity();
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  throw new Error(`Neo4j not reachable within ${timeoutMs}ms: ${String(lastErr)}`);
}
