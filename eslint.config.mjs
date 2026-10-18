import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    // Layering rules. These catch the two import mistakes that are invisible in
    // review but expensive at runtime: a component reaching past the query layer
    // straight into Drizzle, and a client component pulling a server-only module
    // (which fails the build with an error that names the wrong file).
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/schema", "@/lib/db/schema/*", "@/lib/db/client", "@/lib/db/scope"],
              message:
                "Components and pages read through lib/queries/* and write through lib/actions/*. Do not import the database directly.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
