import type { Config } from "drizzle-kit";

/*
 * `generate` only diffs the schema files against the last snapshot; it never
 * connects. Migrations are applied by scripts/db/migrate.mts, which chooses its
 * target by flag and reads the result back. So there are deliberately no
 * credentials here: `drizzle-kit push` and `drizzle-kit migrate` have nothing
 * to connect to, and cannot be run against production by reflex.
 */
export default {
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  strict: true,
  verbose: true,
} satisfies Config;
