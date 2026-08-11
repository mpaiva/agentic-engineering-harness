/**
 * trpc.server.ts — the ONLY seam between app/web and the tRPC API.
 *
 * Loaders (which run server-side in React Router 7 framework mode) call `getApi()`
 * and invoke procedures with full end-to-end inference from the server's exported
 * `AppRouter` type. No Cypher, no Neo4j driver, and no fetch protocol details leak
 * into components — components consume the plain view-model shapes in contract.ts.
 *
 * Import-type only from @hcm/server keeps this a compile-time coupling (no server
 * runtime is bundled into the client): the actual transport is HTTP to the running
 * Hono server via httpBatchLink.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@hcm/server";

/**
 * Base URL of the tRPC HTTP endpoint. In dev/prod the Hono server (app/server)
 * mounts the router at `${API_URL}/trpc`. Overridable via env so the integrator can
 * point loaders at the compose service without code changes.
 */
function apiUrl(): string {
  const base =
    (typeof process !== "undefined" && process.env && process.env.API_URL) ||
    "http://localhost:8787";
  return `${base.replace(/\/$/, "")}/trpc`;
}

let client: ReturnType<typeof createTRPCClient<AppRouter>> | undefined;

/**
 * Server-side tRPC client, memoized per process. Only ever call from loaders/actions
 * — never from a component render path (it would leak the API base into the browser
 * bundle and defeat the "traversals stay server-side" contract).
 */
export function getApi() {
  if (!client) {
    client = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: apiUrl() })],
    });
  }
  return client;
}
