/**
 * The declarative layer Neo4j Community Edition gives us — schema.md §3: five
 * `id` uniqueness constraints plus four supporting range indexes. The statements
 * are single-sourced from cypher.ts (the one place raw Cypher lives) and merely
 * re-exported here alongside `applySchema`, the driver-level applier the server
 * boot path (main.ts) and integration tests call. None of the five graph
 * invariants is CE-declarable; these constraints are the foundation the
 * write-path guards rely on, not the invariants themselves. `applySchema` is
 * idempotent (`IF NOT EXISTS`).
 */
import type { Driver } from "neo4j-driver";
import { CONSTRAINTS, INDEXES } from "./cypher.js";

export { CONSTRAINTS, INDEXES };

export async function applySchema(
  driver: Driver,
  database?: string | undefined,
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  try {
    for (const statement of [...CONSTRAINTS, ...INDEXES]) {
      await session.run(statement);
    }
  } finally {
    await session.close();
  }
}
