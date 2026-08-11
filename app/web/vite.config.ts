import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The org chart, directory, and person view are server-rendered via React Router 7
// framework mode; loaders call the tRPC API (@hcm/server) server-side. Vitest config
// lives separately in vitest.config.ts so component tests run without the RR plugin.
export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
});
