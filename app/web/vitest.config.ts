import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Component tests run against jsdom with Testing Library. They exercise the pure view
// components (DirectoryTable, PersonView, OrgTree) with fixture props — no server or DB
// needed — so this suite is green standalone. Integration + e2e (real Neo4j, axe,
// Playwright keyboard walkthrough) are owned by the test-engineer.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    css: false,
  },
});
