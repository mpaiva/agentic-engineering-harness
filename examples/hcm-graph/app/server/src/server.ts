/**
 * The Hono app that mounts the tRPC router. Pure and side-effect-free: it
 * builds a driver, a repository, and an app object, but does not listen or
 * apply schema — `main.ts` does that. Keeping it importable lets tests and
 * React Router loaders construct the app without starting a network server.
 */
import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import type { Driver } from "neo4j-driver";
import { appRouter } from "./router.js";
import { createContextFactory } from "./context.js";
import { configFromEnv, createDriver } from "./db/driver.js";
import type { Neo4jConfig } from "./db/driver.js";
import { Neo4jViewRepository } from "./repository/directory-repository.js";

export interface HcmServer {
  app: Hono;
  driver: Driver;
  config: Neo4jConfig;
}

export function createServer(overrides?: Partial<Neo4jConfig>): HcmServer {
  const config = configFromEnv(overrides);
  const driver = createDriver(config);
  const repo = new Neo4jViewRepository(driver, config.database);

  const app = new Hono();
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: createContextFactory(repo),
    }),
  );

  return { app, driver, config };
}
