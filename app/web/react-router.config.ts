import type { Config } from "@react-router/dev/config";

// Server-side rendering ON: loaders run on the server, next to the tRPC client, so
// graph traversals stay server-side and the client ships pre-shaped trees (per
// product/research/stack-recommendation.md — "traversals run server-side").
export default {
  ssr: true,
} satisfies Config;
