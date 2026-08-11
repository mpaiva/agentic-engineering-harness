/**
 * Standalone entrypoint: apply the CE schema, then serve the Hono app on Node.
 * `docker compose up` provides Neo4j; this process serves the API the web
 * loaders and e2e tests hit over HTTP.
 */
import { serve } from "@hono/node-server";
import { createServer } from "./server.js";
import { applySchema } from "./db/schema.js";
import { waitForNeo4j } from "./db/driver.js";

const { app, driver, config } = createServer();

await waitForNeo4j(driver);
await applySchema(driver, config.database);

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });

// eslint-disable-next-line no-console
console.log(
  `HCM tRPC API listening on http://localhost:${port}/trpc (health: /health)`,
);
