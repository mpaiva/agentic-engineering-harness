/**
 * tRPC initialization. One `initTRPC` instance, typed on our `Context`, exports
 * the router/procedure builders and the caller factory the contract tests use
 * to invoke procedures in-process (no HTTP) against a real seeded graph.
 */
import { initTRPC } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
