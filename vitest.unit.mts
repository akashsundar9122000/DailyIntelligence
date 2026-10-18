import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** No I/O, no database, no browser. Milliseconds. This is the tier people
 *  actually run, so keep it that way. */
export default defineConfig({
  test: {
    name: "unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      // fileURLToPath, not new URL(...).pathname: a project path containing a
      // space comes back percent-encoded, so the alias resolves to nothing.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
