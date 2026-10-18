import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/*
 * WHAT BELONGS HERE.
 *
 * React Server Components are NOT tested here -- they are covered by the
 * integration tests underneath them and the Playwright journeys above them.
 * What lives here is the interactive leaves: focus management, ARIA wiring, and
 * the layout invariants (a skeleton's height matching its real component) that
 * no other layer can see.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    name: "components",
    environment: "jsdom",
    include: ["tests/components/**/*.test.tsx"],
    setupFiles: ["tests/components/setup.ts"],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /* `server-only` exists to fail the build when a server module is pulled
         into a client bundle. That is exactly what makes it useful in the app
         and useless here. */
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
