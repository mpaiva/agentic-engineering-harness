/**
 * Public surface of `@hcm/server`. The web client imports `AppRouter` for typed
 * inference; integration tooling imports `createServer`, the driver helpers, and
 * the schema/DDL helpers. The whole zod contract is re-exported for shared types.
 */
export { appRouter, type AppRouter } from "./router.js";
export { createServer, type HcmServer } from "./server.js";
export { createContextFactory, type Context } from "./context.js";
export { appRouter as router } from "./router.js";
export {
  Neo4jViewRepository,
  type ViewRepository,
} from "./repository/directory-repository.js";
export {
  configFromEnv,
  createDriver,
  waitForNeo4j,
  type Neo4jConfig,
} from "./db/driver.js";
export { applySchema, CONSTRAINTS, INDEXES } from "./db/schema.js";
export * from "./schemas.js";
