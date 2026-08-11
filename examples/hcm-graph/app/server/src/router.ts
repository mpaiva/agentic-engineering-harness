/**
 * The composed app router. `AppRouter` is the single type the web client
 * imports (`import type { AppRouter } from "@hcm/server"`) to get end-to-end
 * inference with zero codegen.
 */
import { router } from "./trpc.js";
import { orgRouter } from "./routers/org.js";
import { peopleRouter } from "./routers/people.js";

export const appRouter = router({
  people: peopleRouter,
  org: orgRouter,
});

export type AppRouter = typeof appRouter;
