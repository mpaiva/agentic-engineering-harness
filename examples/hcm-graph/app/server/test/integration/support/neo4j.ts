import { Neo4jContainer, type StartedNeo4jContainer } from "@testcontainers/neo4j";
import type { Driver } from "neo4j-driver";
import { createDriver, waitForNeo4j } from "../../../src/db/driver.js";

/**
 * Testcontainers harness — a REAL Neo4j 5 Community per integration file.
 *
 * PROJECT.md Verification requires integration tests against a real graph DB, and
 * stack-recommendation.md pins Neo4j Testcontainers for exactly this. The driver is
 * built with the app's own createDriver (disableLosslessIntegers) so counts come
 * back as plain numbers, matching production. Image `neo4j:5-community` is the same
 * tag docker-compose.yml uses.
 */
export interface TestGraph {
  container: StartedNeo4jContainer;
  driver: Driver;
}

export async function startNeo4j(): Promise<TestGraph> {
  const container = await new Neo4jContainer("neo4j:5-community").start();
  const driver = createDriver({
    uri: container.getBoltUri(),
    user: container.getUsername(),
    password: container.getPassword(),
  });
  await waitForNeo4j(driver);
  return { container, driver };
}

export async function stopNeo4j(graph: TestGraph | undefined): Promise<void> {
  if (!graph) return;
  await graph.driver.close();
  await graph.container.stop();
}

/** One-shot read helper for test-only assertions (never used by app code). */
export async function readOne<T>(
  driver: Driver,
  cypher: string,
  params: Record<string, unknown>,
  key: string,
): Promise<T | undefined> {
  const session = driver.session();
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records[0]?.get(key) as T | undefined;
  } finally {
    await session.close();
  }
}
