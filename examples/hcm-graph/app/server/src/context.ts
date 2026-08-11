/**
 * Request context. The context carries the one thing procedures need — the
 * view repository — so the Cypher stays hidden behind the seam and procedures
 * are pure mappers. A single repository instance (one driver, one pool) is
 * shared across requests via a factory closure.
 */
import type { ViewRepository } from "./repository/directory-repository.js";

// A `type` alias (not an `interface`) so the context is assignable to the
// `Record<string, unknown>` the Hono tRPC adapter's createContext expects —
// interfaces have no implicit index signature, object-literal type aliases do.
export type Context = {
  repo: ViewRepository;
};

export function createContextFactory(repo: ViewRepository): () => Context {
  return () => ({ repo });
}
